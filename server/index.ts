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

type MatchableLostReport = {
  id: string;
  student_id: string;
  item_name?: string | null;
  description?: string | null;
  category?: string | null;
  brand?: string | null;
  color?: string | null;
  lost_location?: string | null;
  status?: string | null;
  [k: string]: unknown;
};

type MatchableFoundItem = {
  id: string;
  office_id?: string | null;
  item_name?: string | null;
  description?: string | null;
  category?: string | null;
  brand?: string | null;
  color?: string | null;
  found_location?: string | null;
  [k: string]: unknown;
};

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");
const now = () => Date.now();

function isExpired(expiresAt: number): boolean {
  return now() > expiresAt;
}

const MATCH_THRESHOLD = 0.45;
const MATCH_LIMIT = 5;

const parseCommaSeparatedValues = (value: unknown): string[] => {
  if (!value) return [];
  return String(value)
    .toLowerCase()
    .split(/[;,/|]+/g)
    .map((part) => part.trim())
    .filter(Boolean);
};

const calculateListOverlapSimilarity = (a: string[], b: string[]): number => {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  const overlap = a.filter((item) => setB.has(item));
  return overlap.length / Math.max(a.length, b.length);
};

const calculateTextSimilarity = (text1: string, text2: string): number => {
  if (!text1 || !text2) return 0;

  const normalize = (str: string) => str.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "");
  const norm1 = normalize(text1);
  const norm2 = normalize(text2);

  if (norm1 === norm2) return 1;
  if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.8;

  const words1 = norm1.split(/\s+/);
  const words2 = norm2.split(/\s+/);
  const commonWords = words1.filter((word) => words2.includes(word) && word.length > 2);

  if (commonWords.length === 0) return 0;
  return commonWords.length / Math.max(words1.length, words2.length);
};

const calculateKeywordSimilarity = (desc1: string, desc2: string): number => {
  if (!desc1 || !desc2) return 0;

  const stop = new Set([
    "the","and","for","are","but","not","you","all","can","had","her","was","one","our","out","day","get","has","him","his","how","man","new","now","old","see","two","way","who","boy","did","its","let","put","say","she","too","use",
  ]);

  const extractKeywords = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stop.has(w));

  const keywords1 = extractKeywords(desc1);
  const keywords2 = extractKeywords(desc2);
  if (keywords1.length === 0 || keywords2.length === 0) return 0;

  const set2 = new Set(keywords2);
  const common = keywords1.filter((w) => set2.has(w));
  return common.length / Math.max(keywords1.length, keywords2.length);
};

const calculateMatchScore = (lostItem: MatchableLostReport, foundItem: MatchableFoundItem): number => {
  let score = 0;
  let totalWeights = 0;

  const categoryWeight = 0.4;
  totalWeights += categoryWeight;
  if (lostItem.category && foundItem.category) {
    if (String(lostItem.category).toLowerCase() === String(foundItem.category).toLowerCase()) {
      score += categoryWeight;
    }
  }

  const nameWeight = 0.3;
  totalWeights += nameWeight;
  if (lostItem.item_name && foundItem.item_name) {
    const nameSimilarity = calculateTextSimilarity(String(lostItem.item_name), String(foundItem.item_name));
    score += nameSimilarity * nameWeight;
  }

  const colorWeight = 0.15;
  totalWeights += colorWeight;
  if (lostItem.color && foundItem.color) {
    const lostColors = parseCommaSeparatedValues(lostItem.color);
    const foundColors = parseCommaSeparatedValues(foundItem.color);
    const colorSimilarity = calculateListOverlapSimilarity(lostColors, foundColors);
    score += colorSimilarity * colorWeight;
  }

  const brandWeight = 0.15;
  totalWeights += brandWeight;
  if (lostItem.brand && foundItem.brand) {
    if (String(lostItem.brand).toLowerCase() === String(foundItem.brand).toLowerCase()) {
      score += brandWeight;
    }
  }

  const locationWeight = 0.1;
  totalWeights += locationWeight;
  if (lostItem.lost_location && foundItem.found_location) {
    const locationSimilarity = calculateTextSimilarity(String(lostItem.lost_location), String(foundItem.found_location));
    score += locationSimilarity * locationWeight;
  }

  const descriptionWeight = 0.1;
  totalWeights += descriptionWeight;
  if (lostItem.description && foundItem.description) {
    const descSimilarity = calculateKeywordSimilarity(String(lostItem.description), String(foundItem.description));
    score += descSimilarity * descriptionWeight;
  }

  return score / totalWeights;
};

function cleanupExpiredSessions() {
  const t = now();
  for (const [sessionId, session] of uploadSessions.entries()) {
    // Consumed sessions have been accepted by desktop flow; do not delete their storage object.
    if (session.status === "consumed") {
      uploadSessions.delete(sessionId);
      continue;
    }

    // Expired sessions should be cleaned up, including any temporary uploaded object.
    if (session.expiresAt < t) {
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
    const message = String(err?.message ?? err ?? "Model error");
    const lower = message.toLowerCase();
    const status =
      lower.includes("429") || lower.includes("quota") || lower.includes("rate limit")
        ? 429
        : 502;
    return res.status(status).json({ error: "Model error", details: message });
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
    const message = String(err?.message ?? err ?? "Model error");
    const lower = message.toLowerCase();
    const status =
      lower.includes("429") || lower.includes("quota") || lower.includes("rate limit")
        ? 429
        : 502;
    return res.status(status).json({ error: "Model error", details: message });
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
  uploadSessions.delete(session.sessionId);
  return res.json({ ok: true, status: session.status });
});

app.post("/api/admin/potential-matches/update", async (req, res) => {
  try {
    if (!serverSupabase) {
      return res.status(500).json({ error: "Server Supabase client is not configured" });
    }

    const authHeader = String(req.headers.authorization ?? "");
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) {
      return res.status(401).json({ error: "Missing bearer token" });
    }

    const { data: authData, error: authError } = await serverSupabase.auth.getUser(token);
    if (authError || !authData?.user) {
      return res.status(401).json({ error: "Invalid auth token" });
    }

    const callerId = String(authData.user.id ?? "").trim();
    const { data: callerProfile, error: callerError } = await serverSupabase
      .from("profiles")
      .select("id, role, organization_id")
      .eq("id", callerId)
      .single();
    if (callerError) {
      return res.status(403).json({ error: `Could not load caller profile: ${callerError.message}` });
    }

    const callerRole = String((callerProfile as any)?.role ?? "").toLowerCase();
    if (!["staff", "admin", "owner"].includes(callerRole)) {
      return res.status(403).json({ error: "Only staff/admin/owner can update matches" });
    }

    const foundItemId = String(req.body?.foundItemId ?? "").trim();
    const actor = String(req.body?.actor ?? "").toLowerCase();
    if (!foundItemId) {
      return res.status(400).json({ error: "Missing required field: foundItemId" });
    }
    if (actor !== "admin") {
      return res.status(400).json({ error: "actor must be 'admin'" });
    }

    const { data: foundItemData, error: foundItemError } = await serverSupabase
      .from("found_items")
      .select("id, office_id, item_name, description, category, brand, color, found_location, status")
      .eq("id", foundItemId)
      .single();
    if (foundItemError) {
      return res.status(404).json({ error: `Found item not found: ${foundItemError.message}` });
    }

    const foundItem = foundItemData as MatchableFoundItem;
    const officeId = String(foundItem?.office_id ?? "").trim();
    if (!officeId) {
      return res.status(400).json({ error: "Found item has no office_id" });
    }

    const { data: officeData, error: officeError } = await serverSupabase
      .from("offices")
      .select("organization_id")
      .eq("office_id", officeId)
      .single();
    if (officeError) {
      return res.status(400).json({ error: `Could not resolve office organization: ${officeError.message}` });
    }

    const organizationId = String((officeData as any)?.organization_id ?? "").trim();
    if (!organizationId) {
      return res.json({
        ok: true,
        foundItemId,
        organizationId: null,
        reportCount: 0,
        keptCount: 0,
        insertedCount: 0,
        reason: "office has no organization_id",
      });
    }

    if (String((callerProfile as any)?.organization_id ?? "").trim() !== organizationId) {
      return res.status(403).json({ error: "Caller is not in the same organization as the found item office" });
    }

    const { data: orgProfiles, error: profilesError } = await serverSupabase
      .from("profiles")
      .select("id")
      .eq("organization_id", organizationId);
    if (profilesError) {
      return res.status(500).json({ error: `Failed to query org profiles: ${profilesError.message}` });
    }

    const studentIds = (orgProfiles ?? [])
      .map((p: any) => String(p?.id ?? "").trim())
      .filter(Boolean);
    if (studentIds.length === 0) {
      return res.json({
        ok: true,
        foundItemId,
        organizationId,
        reportCount: 0,
        keptCount: 0,
        insertedCount: 0,
      });
    }

    const { data: reportsData, error: reportsError } = await serverSupabase
      .from("lost_item_reports")
      .select("id, student_id, item_name, description, category, brand, color, lost_location, status")
      .in("student_id", studentIds)
      .eq("status", "active");
    if (reportsError) {
      return res.status(500).json({ error: `Failed to query lost reports: ${reportsError.message}` });
    }

    const reports = (reportsData ?? []) as MatchableLostReport[];
    const scored = reports
      .map((report) => ({ report, matchScore: calculateMatchScore(report, foundItem) }))
      .filter((row) => row.matchScore >= MATCH_THRESHOLD)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, MATCH_LIMIT);

    const statusCounts = reports.reduce<Record<string, number>>((acc, report) => {
      const key = String(report.status ?? "null");
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const { error: deleteError } = await serverSupabase
      .from("potential_matches")
      .delete()
      .eq("lost_item_id", foundItemId);
    if (deleteError) {
      return res.status(500).json({ error: `Failed to clear existing matches: ${deleteError.message}` });
    }

    let insertedCount = 0;
    if (scored.length > 0) {
      const candidateRows = scored.map((row) => ({
        report_id: String(row.report.id),
        lost_item_id: foundItemId,
      }));

      const uniqueRows = Array.from(
        new Map(
          candidateRows.map((row) => [`${row.report_id}:${row.lost_item_id}`, row] as const)
        ).values()
      );

      const reportIds = uniqueRows.map((row) => row.report_id);
      let rowsToInsert = uniqueRows;
      if (reportIds.length > 0) {
        const { data: existingPairs, error: existingPairsError } = await serverSupabase
          .from("potential_matches")
          .select("report_id,lost_item_id")
          .eq("lost_item_id", foundItemId)
          .in("report_id", reportIds);
        if (existingPairsError) {
          return res.status(500).json({ error: `Failed to verify existing matches: ${existingPairsError.message}` });
        }

        const existingSet = new Set(
          (existingPairs ?? []).map((row: any) => `${String(row.report_id)}:${String(row.lost_item_id)}`)
        );
        rowsToInsert = uniqueRows.filter(
          (row) => !existingSet.has(`${row.report_id}:${row.lost_item_id}`)
        );
      }

      if (rowsToInsert.length === 0) {
        return res.json({
          ok: true,
          foundItemId,
          organizationId,
          reportCount: reports.length,
          statusCounts,
          keptCount: scored.length,
          insertedCount: 0,
          skippedExistingCount: uniqueRows.length,
        });
      }

      const { data: insertedRows, error: insertError } = await serverSupabase
        .from("potential_matches")
        .insert(rowsToInsert)
        .select("match_id");
      if (insertError) {
        return res.status(500).json({ error: `Failed to insert potential matches: ${insertError.message}` });
      }
      insertedCount = (insertedRows ?? []).length;
    }

    console.log("[admin potential matches] update complete", {
      callerId,
      foundItemId,
      organizationId,
      reportCount: reports.length,
      statusCounts,
      keptCount: scored.length,
      insertedCount,
    });

    return res.json({
      ok: true,
      foundItemId,
      organizationId,
      reportCount: reports.length,
      statusCounts,
      keptCount: scored.length,
      insertedCount,
    });
  } catch (err: any) {
    console.error("admin potential match update error:", err?.stack ?? err?.message ?? err);
    return res.status(500).json({ error: err?.message ?? "Failed to update potential matches" });
  }
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
