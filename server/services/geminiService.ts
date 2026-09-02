import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { GEMINI_CONFIG_FILE } from "../config/constants";

export function getStoredGeminiKey(): string | undefined {
  if (fs.existsSync(GEMINI_CONFIG_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(GEMINI_CONFIG_FILE, "utf-8"));
      return data.api_key || "";
    } catch (e) {}
  }
  return "";
}

export function saveGeminiKey(apiKey: string): void {
  fs.writeFileSync(GEMINI_CONFIG_FILE, JSON.stringify({ api_key: apiKey }, null, 2));
}

export async function generateWithGeminiAPI(apiKey: string, promptText: string) {
  const genAI = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
  const result = await genAI.models.generateContent({
    model: "gemini-3.7-flash",
    contents: promptText
  });
  return { text: result.text || "", modelUsed: "gemini-3.7-flash" };
}
