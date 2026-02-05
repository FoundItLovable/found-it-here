import { GoogleGenerativeAI } from "@google/generative-ai";

export async function geminiStatus() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY missing");
  }
  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: "gemini-3-flash-preview",
  });

  try {
    const resp = await model.generateContent("ping");
    // Extract the primary text from the model response.
    // Support multiple possible shapes from the client library.
    const textFromResp =
      // new-style: resp.response.candidates[].content.parts[].text
      (resp as any)?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      // older-style: resp.candidates[].content.parts[].text
      (resp as any)?.candidates?.[0]?.content?.parts?.[0]?.text ||
      // fallback: resp.text
      (resp as any)?.text ||
      null;

    return String(textFromResp ?? "");
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error("generateContent failed:", err.stack ?? err.message);
    } else {
      console.error("generateContent failed:", err);
    }
    throw err;
  }
}

export async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY missing");
  }

  // Use the public REST endpoint to list models for the current API version.
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`ListModels failed: ${resp.status} ${body}`);
  }
  return resp.json();
}

