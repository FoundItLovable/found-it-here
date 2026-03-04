import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { categoryLabels } from "../shared/categoryLabels";

export type AnalyzeResult = {
  name: string;
  description: string;
  category: string;
  color: string;
  brand: string;
  foundLocation: string;
  foundDate: string; // YYYY-MM-DD or empty
  highValue: boolean;
  confidence?: number;
  raw?: string;
};

const ALLOWED_CATEGORIES = Object.keys(categoryLabels).map((value) => value.toLowerCase());
const ALLOWED_CATEGORY_SET = new Set(ALLOWED_CATEGORIES);
const CATEGORY_SYNONYMS: Record<string, string> = {
  phone: "electronics",
  smartphone: "electronics",
  iphone: "electronics",
  laptop: "electronics",
  tablet: "electronics",
  charger: "electronics",
  coat: "clothing",
  jacket: "clothing",
  shirt: "clothing",
  pants: "clothing",
  shoes: "clothing",
  glasses: "accessories",
  watch: "accessories",
  wallet: "accessories",
  purse: "accessories",
  id: "documents",
  passport: "documents",
  document: "documents",
  keys: "keys",
  key: "keys",
  backpack: "bags",
  bag: "bags",
  luggage: "bags",
};

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

function _extractTextFromResp(resp: unknown): string {
  return (
    (resp as any)?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
    (resp as any)?.candidates?.[0]?.content?.parts?.[0]?.text ||
    (resp as any)?.text ||
    String(resp ?? "")
  );
}

function _normalizeParsed(v: any): AnalyzeResult {
  return {
    name: String(v.name ?? "").trim(),
    description: String(v.description ?? "").trim(),
    category: _normalizeCategory(v.category),
    color: _normalizeCommaList(v.color),
    brand: _normalizeBrand(v.brand),
    foundLocation: String(v.foundLocation ?? "").trim(),
    foundDate: String(v.foundDate ?? "").trim(),
    highValue: Boolean(v.highValue ?? false),
    confidence: typeof v.confidence === "number" ? v.confidence : undefined,
    raw: typeof v.raw === "string" ? v.raw : undefined,
  };
}

function _normalizeCategory(input: unknown): string {
  const value = String(input ?? "").toLowerCase().trim();
  if (!value) return "other";
  if (ALLOWED_CATEGORY_SET.has(value)) return value;
  if (CATEGORY_SYNONYMS[value]) return CATEGORY_SYNONYMS[value];
  for (const [needle, category] of Object.entries(CATEGORY_SYNONYMS)) {
    if (value.includes(needle)) return category;
  }
  return "other";
}

function _normalizeCommaList(input: unknown): string {
  if (Array.isArray(input)) {
    return input
      .map((part) => String(part ?? "").trim())
      .filter(Boolean)
      .join(",");
  }

  return String(input ?? "")
    .split(/[;,/|]+/g)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(",");
}

function _normalizeBrand(input: unknown): string {
  const value = String(input ?? "").trim();
  return value || "unknow";
}

function _tryParseModelJson(text: string): { success: true; value: any } | { success: false } {
  const t = (text ?? "").trim();
  // 1) try JSON.parse directly
  try {
    const v = JSON.parse(t);
    return { success: true, value: v };
  } catch {}

  // 2) find first {...} block
  const m = t.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      const v = JSON.parse(m[0]);
      return { success: true, value: v };
    } catch {}
  }

  // 3) heuristic extraction by key lines
  const lines = t.split(/\r?\n/);
  const out: any = {};
  const keys = ["name", "description", "category", "color", "brand", "foundLocation", "foundDate", "highValue", "confidence"];
  for (const k of keys) {
    const rx = new RegExp(`${k}\\s*[:=]\\s*(.+)`, "i");
    const L = lines.find((l) => rx.test(l));
    if (L) out[k] = L.replace(rx, "$1").trim();
  }
  if (Object.keys(out).length > 0) {
    // coerce types
    if (out.highValue !== undefined) out.highValue = String(out.highValue).toLowerCase() === "true" || String(out.highValue).toLowerCase() === "yes";
    if (out.confidence !== undefined) out.confidence = Number(out.confidence) || undefined;
    return { success: true, value: out };
  }

  return { success: false };
}

export async function analyzeImage(imageUrl: string): Promise<AnalyzeResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY missing");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
  // Fetch image bytes so Gemini analyzes the actual image content.
  let safeMimeType = "image/jpeg";
  let imageBase64 = "";
  try {
    const imageResp = await fetch(imageUrl);
    if (!imageResp.ok) {
      console.warn("analyzeImage: image fetch failed", imageResp.status, imageUrl);
      return {
        name: "",
        description: "",
        category: "other",
        color: "",
        brand: "unknow",
        foundLocation: "",
        foundDate: "",
        highValue: false,
        raw: `UNFETCHABLE: ${imageResp.status}`,
      };
    }
    const contentType = imageResp.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("image/")) {
      console.warn("analyzeImage: URL not an image", contentType, imageUrl);
      return {
        name: "",
        description: "",
        category: "other",
        color: "",
        brand: "unknow",
        foundLocation: "",
        foundDate: "",
        highValue: false,
        raw: `NOT_IMAGE: ${contentType}`,
      };
    }
    const arrayBuffer = await imageResp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length === 0) {
      return {
        name: "",
        description: "",
        category: "other",
        color: "",
        brand: "unknow",
        foundLocation: "",
        foundDate: "",
        highValue: false,
        raw: "EMPTY_IMAGE",
      };
    }
    safeMimeType = contentType.split(";")[0].trim() || "image/jpeg";
    imageBase64 = buffer.toString("base64");
  } catch (fetchErr) {
    console.error("analyzeImage: could not reach image URL", fetchErr, imageUrl);
    return {
      name: "",
      description: "",
      category: "other",
      color: "",
      brand: "unknow",
      foundLocation: "",
      foundDate: "",
      highValue: false,
      raw: `UNFETCHABLE_ERROR: ${String(fetchErr)}`,
    };
  }

  const prompt = `You are an assistant which analyzes a single photograph of a found item.\nProcess the provided image content only.\nReturn exactly one JSON object and nothing else (no explanation, no markdown).\nRequired keys: name, description, category, color, brand, foundLocation, foundDate, highValue, confidence.\nName rule: keep name short and to the point (2-4 words max). Let description carry most details.\nCategory rule: category must be exactly one of [${ALLOWED_CATEGORIES.join(", ")}]. If unsure, return "other".\nColor rule: color must be a comma-separated list with no numbering and no spaces after commas (example: "black,silver"). Use empty string if unknown.\nBrand rule: if brand cannot be identified, set brand to "unknow".\nUse empty string for unknown string fields (except brand), false for unknown boolean, and confidence 0 when unsure. Dates must be YYYY-MM-DD or empty string. If you cannot determine the content from the image, return empty strings and confidence 0, and set brand to "unknow".`;

  const resp = await model.generateContent([
    prompt,
    {
      inlineData: {
        data: imageBase64,
        mimeType: safeMimeType,
      },
    } as any,
  ] as any);
  const text = _extractTextFromResp(resp).trim();

  console.log("analyzeImage: model text:", text);

  const parsed = _tryParseModelJson(text);
  if (parsed.success) {
    try {
      return _normalizeParsed(parsed.value);
    } catch (e) {
      // fall through to raw fallback
      console.error("normalizeParsed failed:", e);
    }
  }

  // Fallback: return empty fields and include raw text for debugging
  return {
    name: "",
    description: "",
    category: "other",
    color: "",
    brand: "unknow",
    foundLocation: "",
    foundDate: "",
    highValue: false,
    raw: text,
  };
}

export async function analyzeImageFile(base64: string, filename: string, mimeType: string, fallbackImageUrl?: string): Promise<AnalyzeResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");

  const sanitizedBase64 = String(base64 ?? "").replace(/^data:[^;]+;base64,/, "").trim();
  const safeMimeType = typeof mimeType === "string" && mimeType.startsWith("image/")
    ? mimeType
    : "image/jpeg";

  const buffer = Buffer.from(sanitizedBase64, "base64");
  const tmpDir = os.tmpdir();
  const tmpPath = path.join(tmpDir, `${Date.now()}-${filename}`);
  try {
    await fs.writeFile(tmpPath, buffer);
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const prompt = `You are an assistant which analyzes a single photograph of a found item.\nProcess the uploaded image content only.\nReturn exactly one JSON object and nothing else (no explanation, no markdown).\nRequired keys: name, description, category, color, brand, foundLocation, foundDate, highValue, confidence.\nName rule: keep name short and to the point (2-4 words max). Let description carry most details.\nCategory rule: category must be exactly one of [${ALLOWED_CATEGORIES.join(", ")}]. If unsure, return "other".\nColor rule: color must be a comma-separated list with no numbering and no spaces after commas (example: "black,silver"). Use empty string if unknown.\nBrand rule: if brand cannot be identified, set brand to "unknow".\nUse empty string for unknown string fields (except brand), false for unknown boolean, and confidence 0 when unsure.`;
    let resp: any;

    // Prefer inline image bytes because files.upload is not available in all SDK versions.
    if (typeof (genAI as any)?.files?.upload === "function") {
      try {
        const uploaded = await (genAI as any).files.upload({ file: tmpPath, config: { mimeType: safeMimeType } });
        const fileUri = (uploaded as any)?.uri || (uploaded as any)?.data?.uri || (uploaded as any)?.file?.uri || (uploaded as any)?.fileUri;
        if (fileUri) {
          const filePrompt = `${prompt}\nUploaded file URI: ${fileUri}`;
          resp = await model.generateContent(filePrompt as any);
        } else {
          console.warn("analyzeImageFile: upload returned no uri, falling back to inlineData");
        }
      } catch (e) {
        console.warn("files.upload path failed, falling back to inlineData:", e);
      }
    }

    if (!resp) {
      resp = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: sanitizedBase64,
            mimeType: safeMimeType,
          },
        } as any,
      ] as any);
    }

    const text = _extractTextFromResp(resp).trim();
    console.log("analyzeImageFile: model text:", text?.slice?.(0, 1000));

    const parsed = _tryParseModelJson(text);
    if (parsed.success) return _normalizeParsed(parsed.value);

    return { name: "", description: "", category: "other", color: "", brand: "unknow", foundLocation: "", foundDate: "", highValue: false, raw: text };
  } finally {
    try {
      await fs.unlink(tmpPath);
    } catch {}
  }
}
