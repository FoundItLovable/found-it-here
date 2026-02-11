import dotenv from "dotenv";
import path from "path";
import crypto from "crypto";
import os from "os";
import { createClient } from "@supabase/supabase-js";

// Load the project's .env.local reliably from the process CWD (project root)
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), debug: true });

import express from "express";
import { geminiStatus, listModels, analyzeImage, analyzeImageFile } from "./gemini";

// Process-level diagnostics to capture why the server may exit
process.on("uncaughtException", (err) => {
  console.error("uncaughtException:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("unhandledRejection:", reason);
});

// Graceful shutdown helper (will be wired to signals below)
let server: any = null;
let _keepAlive: NodeJS.Timeout | null = null;

function shutdown(code = 0) {
  console.log("Shutting down server...");
  try {
    if (_keepAlive) {
      clearInterval(_keepAlive);
      _keepAlive = null;
    }
    if (server && server.close) {
      server.close(() => {
        console.log("HTTP server closed");
        process.exit(code);
      });
      // Fallback: force exit if server doesn't close in 5s
      setTimeout(() => {
        console.log("Forcing exit");
        process.exit(code);
      }, 5000).unref();
    } else {
      process.exit(code);
    }
  } catch (e) {
    console.error("Error during shutdown:", e);
    process.exit(code);
  }
}

process.on("SIGINT", () => {
  console.log("Received SIGINT");
  shutdown(0);
});
process.on("SIGTERM", () => {
  console.log("Received SIGTERM");
  shutdown(0);
});
process.on("exit", (code) => {
  console.log("Process exiting with code:", code);
});

const app = express();

const SESSION_TTL_MS = 10 * 60 * 1000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png"]);
const uploadSessions = new Map<string, {
  sessionId: string;
  tokenHash: string;
  staffId: string;
  officeId: string;
  status: "pending" | "uploaded" | "consumed";
  imageUrl?: string;
  storagePath?: string;
  createdAt: number;
  expiresAt: number;
  consumedAt?: number;
}>();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SECRET_KEY;
const serverSupabase = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } })
  : null;

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");
const now = () => Date.now();

function isExpired(expiresAt: number): boolean {
  return now() > expiresAt;
}

function cleanupExpiredSessions() {
  const t = now();
  for (const [sessionId, session] of uploadSessions.entries()) {
    if (session.expiresAt < t || session.status === "consumed") {
      if (session.storagePath) {
        void deleteSessionImage(session);
      }
      uploadSessions.delete(sessionId);
    }
  }
}

async function deleteSessionImage(session: {
  storagePath?: string;
  imageUrl?: string;
}) {
  if (!session.storagePath) return;
  if (!serverSupabase) {
    throw new Error("Server upload is not configured");
  }
  const { error } = await serverSupabase.storage.from("item-images").remove([session.storagePath]);
  if (error) {
    throw new Error(error.message);
  }
  session.storagePath = undefined;
  session.imageUrl = undefined;
}

function buildPublicAppUrl(req: express.Request): string {
  const fromEnv = String(process.env.PUBLIC_APP_URL ?? "").trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  const origin = String(req.headers.origin ?? "").trim();
  if (origin) {
    try {
      const url = new URL(origin);
      const isLocalHost = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
      if (isLocalHost) {
        const lanIp = getLanIpv4();
        if (lanIp) {
          return `${url.protocol}//${lanIp}:${url.port || "8080"}`;
        }
      }
      return `${url.protocol}//${url.host}`;
    } catch {
      // Ignore invalid origin header and continue with host fallback.
    }
  }

  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";
  const host = req.get("host") || "localhost:8080";
  const [hostname, port] = host.split(":");
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

  if (isLocalHost) {
    const lanIp = getLanIpv4();
    if (lanIp) {
      return `${proto}://${lanIp}:${port || "8080"}`;
    }
  }

  return `${proto}://${host}`;
}

function getLanIpv4(): string {
  const interfaces = os.networkInterfaces();
  for (const ifName of Object.keys(interfaces)) {
    for (const net of interfaces[ifName] ?? []) {
      if (net.family !== "IPv4" || net.internal) continue;
      const ip = net.address;
      if (
        ip.startsWith("10.") ||
        ip.startsWith("192.168.") ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
      ) {
        return ip;
      }
    }
  }
  return "";
}

function requireValidSession(req: express.Request, res: express.Response) {
  const sessionId = String(req.params.sessionId ?? "");
  const token = String(req.query.token ?? req.body?.token ?? "");
  const staffId = String(req.query.staffId ?? req.body?.staffId ?? "");
  const officeId = String(req.query.officeId ?? req.body?.officeId ?? "");

  if (!sessionId || !token) {
    res.status(400).json({ error: "Missing required params: sessionId and token" });
    return null;
  }

  const session = uploadSessions.get(sessionId);
  if (!session) {
    res.status(404).json({ error: "Upload session not found" });
    return null;
  }

  if (session.tokenHash !== sha256(token)) {
    res.status(401).json({ error: "Invalid token" });
    return null;
  }

  if (isExpired(session.expiresAt)) {
    session.status = "consumed";
    res.status(410).json({ error: "Upload session expired", status: "expired" });
    return null;
  }

  if ((staffId && staffId !== session.staffId) || (officeId && officeId !== session.officeId)) {
    res.status(403).json({ error: "Session context mismatch" });
    return null;
  }

  return session;
}

// Log incoming requests to help diagnose routing issues
app.use((req, _res, next) => {
  console.log("Incoming request:", req.method, req.url);
  next();
});

// Parse JSON bodies for API endpoints (allow larger payloads for image base64)
app.use(express.json({ limit: '16mb' }));

// Periodically clear expired sessions from memory.
setInterval(cleanupExpiredSessions, 60 * 1000).unref();

app.get("/api/gemini", async (_req, res) => {
  try {
    const text = await geminiStatus();
    // Return plain text containing only what the model said.
    res.type("text").send(text);
    console.log("geminiStatus text:", text);
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error("geminiStatus error:", err.stack ?? err.message);
      res.status(500).send(err.message);
    } else {
      console.error("geminiStatus error:", err);
      res.status(500).send("Gemini FAIL");
    }
  }
});

// List available models (safe): returns model ids and display names
app.get("/models", async (_req, res) => {
  try {
    const data = await listModels();
    // Expecting data.models as array
    const models = Array.isArray(data?.models)
      ? data.models.map((m: any) => ({ name: m.name, displayName: m.displayName, description: m.description }))
      : data;
    res.json({ models });
  } catch (err) {
    console.error("listModels error:", err instanceof Error ? err.stack ?? err.message : err);
    res.status(500).send("Could not list models");
  }
});

// Analyze an uploaded image via Gemini and return a parsed JSON object
app.post("/api/gemini/analyze", async (req, res) => {
  try {
    const { imageUrl } = req.body ?? {};
    if (!imageUrl || typeof imageUrl !== "string") {
      return res.status(400).json({ error: "Missing required field: imageUrl" });
    }
    const result = await analyzeImage(imageUrl);
    return res.json(result);
  } catch (err: any) {
    console.error("analyzeImage error:", err?.stack ?? err?.message ?? err);
    return res.status(502).json({ error: "Model error", details: err?.message ?? String(err) });
  }
});

// Analyze an uploaded file's bytes. Accepts JSON { filename, mimeType, base64 }
app.post("/api/gemini/analyze-file", async (req, res) => {
  try {
    const { filename, mimeType, base64 } = req.body ?? {};
    if (!base64 || !filename || !mimeType) {
      return res.status(400).json({ error: "Missing required fields: filename, mimeType, base64" });
    }
    const result = await analyzeImageFile(base64, filename, mimeType);
    return res.json(result);
  } catch (err: any) {
    console.error("analyzeImageFile error:", err?.stack ?? err?.message ?? err);
    return res.status(502).json({ error: "Model error", details: err?.message ?? String(err) });
  }
});

app.post("/api/upload-sessions", async (req, res) => {
  try {
    const { staffId, officeId } = req.body ?? {};
    if (!staffId || !officeId) {
      return res.status(400).json({ error: "Missing required fields: staffId, officeId" });
    }

    const sessionId = crypto.randomUUID();
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = now() + SESSION_TTL_MS;
    const mobileUrl = `${buildPublicAppUrl(req)}/admin/mobile-capture?sessionId=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}&staffId=${encodeURIComponent(String(staffId))}&officeId=${encodeURIComponent(String(officeId))}`;

    uploadSessions.set(sessionId, {
      sessionId,
      tokenHash: sha256(token),
      staffId: String(staffId),
      officeId: String(officeId),
      status: "pending",
      createdAt: now(),
      expiresAt,
    });

    return res.json({
      sessionId,
      token,
      expiresAt,
      mobileUrl,
      status: "pending",
    });
  } catch (err: any) {
    console.error("create upload session error:", err?.stack ?? err?.message ?? err);
    return res.status(500).json({ error: "Could not create upload session" });
  }
});

app.get("/api/upload-sessions/:sessionId/status", async (req, res) => {
  const session = requireValidSession(req, res);
  if (!session) return;

  return res.json({
    sessionId: session.sessionId,
    status: session.status,
    expiresAt: session.expiresAt,
    imageUrl: session.imageUrl ?? null,
  });
});

app.post("/api/upload-sessions/:sessionId/upload", async (req, res) => {
  try {
    const session = requireValidSession(req, res);
    if (!session) return;

    if (session.status !== "pending") {
      return res.status(409).json({ error: "Session is no longer pending", status: session.status });
    }

    const { filename, mimeType, base64 } = req.body ?? {};
    if (!filename || !mimeType || !base64) {
      return res.status(400).json({ error: "Missing required fields: filename, mimeType, base64" });
    }

    const normalizedMimeType = String(mimeType).toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(normalizedMimeType)) {
      return res.status(415).json({ error: "Unsupported image type. Use JPEG or PNG." });
    }

    const base64Body = String(base64).replace(/^data:[^;]+;base64,/, "");
    const bytes = Buffer.from(base64Body, "base64");
    if (bytes.length === 0) {
      return res.status(400).json({ error: "Invalid image payload" });
    }
    if (bytes.length > MAX_IMAGE_BYTES) {
      return res.status(413).json({ error: "Image exceeds 10MB limit" });
    }

    if (!serverSupabase) {
      return res.status(500).json({
        error:
          "Server upload is not configured. Add SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY) and SUPABASE_URL/VITE_SUPABASE_URL to server env.",
      });
    }

    if (session.storagePath) {
      try {
        await deleteSessionImage(session);
      } catch (deleteErr: any) {
        console.error("failed to delete previous session image:", deleteErr?.message ?? deleteErr);
      }
    }

    const extension = normalizedMimeType === "image/png" ? "png" : "jpg";
    const storagePath = `${session.staffId}/qr-${session.sessionId}-${Date.now()}.${extension}`;
    const { error: uploadError } = await serverSupabase.storage
      .from("item-images")
      .upload(storagePath, bytes, { contentType: normalizedMimeType, upsert: false });

    if (uploadError) {
      console.error("session upload storage error:", uploadError);
      return res.status(502).json({ error: "Could not upload image to storage", details: uploadError.message });
    }

    const { data } = serverSupabase.storage.from("item-images").getPublicUrl(storagePath);
    session.status = "uploaded";
    session.storagePath = storagePath;
    session.imageUrl = data.publicUrl;

    return res.json({
      ok: true,
      status: session.status,
      imageUrl: session.imageUrl,
    });
  } catch (err: any) {
    console.error("upload session image error:", err?.stack ?? err?.message ?? err);
    return res.status(500).json({ error: "Could not upload image" });
  }
});

app.post("/api/upload-sessions/:sessionId/cancel", async (req, res) => {
  try {
    const session = requireValidSession(req, res);
    if (!session) return;

    if (session.storagePath) {
      try {
        await deleteSessionImage(session);
      } catch (err: any) {
        console.error("cancel session delete error:", err?.message ?? err);
      }
    }

    session.status = "pending";
    session.consumedAt = undefined;

    return res.json({
      ok: true,
      status: session.status,
      imageUrl: null,
      canceled: true,
    });
  } catch (err: any) {
    console.error("cancel session error:", err?.stack ?? err?.message ?? err);
    return res.status(500).json({ error: "Could not cancel upload session" });
  }
});

app.post("/api/upload-sessions/:sessionId/consume", async (req, res) => {
  const session = requireValidSession(req, res);
  if (!session) return;

  if (session.status === "consumed") {
    return res.status(409).json({ error: "Session already consumed", status: "consumed" });
  }

  if (session.status !== "uploaded") {
    return res.status(409).json({ error: "Session has no uploaded image to consume", status: session.status });
  }

  session.status = "consumed";
  session.consumedAt = now();
  return res.json({ ok: true, status: session.status });
});

// Friendly root route so visiting http://localhost:5050 shows a helpful message
app.get("/", (_req, res) => {
  res.send(
    `<html><body><h1>Server is running</h1><p>Try <a href="/api/gemini">/api/gemini</a></p></body></html>`
  );
});

// Custom 404 so we can tell when the server legitimately didn't match a route
app.use((req, res) => {
  console.log("No matching route for:", req.method, req.url);
  res.status(404).send(`No route for ${req.method} ${req.url}`);
});

server = app.listen(5050, () => {
  console.log("Server running on http://localhost:5050");
  try {
    console.log("server.address():", server.address());
    console.log("server.listening:", server.listening);
  } catch (e) {
    console.error("Error accessing server properties:", e);
  }
});

server.on("close", () => {
  console.log("Express server closed");
});
