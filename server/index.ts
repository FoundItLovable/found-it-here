import dotenv from "dotenv";
import path from "path";

// Load the project's .env.local reliably from the process CWD (project root)
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), debug: true });

import express from "express";
import { geminiStatus } from "./gemini";

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

// Log incoming requests to help diagnose routing issues
app.use((req, _res, next) => {
  console.log("Incoming request:", req.method, req.url);
  next();
});

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
import { listModels } from "./gemini";

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
