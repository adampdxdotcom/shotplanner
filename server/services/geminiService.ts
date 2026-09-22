import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { GEMINI_CONFIG_FILE } from "../config/constants";
import { writeJsonAtomicSync } from "../utils/atomicFs";

export function getStoredGeminiKey(): string {
  if (fs.existsSync(GEMINI_CONFIG_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(GEMINI_CONFIG_FILE, "utf-8"));
      if (typeof data.api_key === "string" && data.api_key.trim()) {
        return data.api_key.trim();
      }
    } catch (e) {}
  }
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    return process.env.GEMINI_API_KEY.trim();
  }
  return "";
}

export function saveGeminiKey(apiKey: string): void {
  writeJsonAtomicSync(GEMINI_CONFIG_FILE, { api_key: apiKey.trim() });
}

export function removeGeminiKey(): void {
  if (fs.existsSync(GEMINI_CONFIG_FILE)) {
    try {
      fs.unlinkSync(GEMINI_CONFIG_FILE);
    } catch (e) {
      writeJsonAtomicSync(GEMINI_CONFIG_FILE, { api_key: "" });
    }
  }
}

export async function generateWithGeminiAPI(
  apiKey: string,
  promptText: string,
  imageData?: { mimeType: string; base64Data: string } | null
) {
  const genAI = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  let contents: any = promptText;
  if (imageData && imageData.base64Data) {
    contents = [
      {
        inlineData: {
          mimeType: imageData.mimeType || "image/jpeg",
          data: imageData.base64Data
        }
      },
      promptText
    ];
  }

  const result = await genAI.models.generateContent({
    model: "gemini-3.7-flash",
    contents
  });
  return { text: result.text || "", modelUsed: "gemini-3.7-flash" };
}
