import { GoogleGenAI } from '@google/genai';
import { getStoredGeminiKey } from './geminiService';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { ensureSceneDirectories } from '../config/constants';
import { assetService } from './assetService';
import { AssetRecord } from '../types';

export const HEADSHOT_TEMPLATES: Record<string, string> = {
  "Facing": "Front-facing studio portrait with direct eye contact. Preserve facial likeness, hair texture, and identity from the reference image. Request maximum resolution/quality. Clean neutral background.",
  "3/4 Profile": "Angled 3/4 perspective with cinematic soft lighting. Preserve facial likeness, hair texture, and identity from the reference image. Request maximum resolution/quality. Deep cinematic depth of field.",
  "Full Profile": "Side profile silhouette or detailed profile portrait. Preserve facial likeness, hair texture, and identity from the reference image. Request maximum resolution/quality. Dramatic lighting.",
  "Cinematic / Mood": "Dramatic high-key portrait emphasizing character aura and mood. Preserve facial likeness, hair texture, and identity from the reference image. Request maximum resolution/quality. Moody cinematic lighting."
};

export async function generateVariations(
  imageBase64: string,
  imageMimeType: string,
  characterName: string,
  aspectRatio: string,
  variationKeys: string[]
) {
  const apiKey = getStoredGeminiKey();
  if (!apiKey) throw new Error("Gemini API key not configured");

  const ai = new GoogleGenAI({ 
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
  });

  const promises = variationKeys.map(async (key) => {
    const template = HEADSHOT_TEMPLATES[key];
    if (!template) return null;

    const promptText = `Generate a character portrait for "${characterName}". ${template}`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
        contents: {
          parts: [
            { text: promptText },
            { inlineData: { data: imageBase64, mimeType: imageMimeType } },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio as any,
          }
        }
      });
      
      let base64Image = "";
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          base64Image = part.inlineData.data;
          break;
        }
      }

      if (!base64Image) throw new Error("No image generated");

      return {
        key,
        base64: base64Image,
        mimeType: "image/png" // GenAI usually returns jpeg/png
      };
    } catch (err: any) {
      console.error(`Failed to generate variation ${key}:`, err);
      return { key, error: err.message };
    }
  });

  const results = await Promise.all(promises);
  return results.filter(r => r !== null);
}

export async function saveSelectedVariations(
  selections: { base64: string; key: string }[],
  characterName: string,
  sceneName: string,
  tags: string[] = []
) {
  const dirs = ensureSceneDirectories(sceneName);
  
  // ensure thumbnails dir exists
  const thumbDir = path.join(dirs.images, 'thumbnails');
  if (!fs.existsSync(thumbDir)) {
    fs.mkdirSync(thumbDir, { recursive: true });
  }

  const savedRecords: AssetRecord[] = [];

  for (const sel of selections) {
    const timestamp = Date.now() + Math.floor(Math.random() * 1000);
    const safeTag = sel.key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const safeChar = characterName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    
    const filename = `headshot_${safeChar}_${safeTag}_${timestamp}.png`;
    const fullPath = path.join(dirs.images, filename);
    const thumbPath = path.join(thumbDir, filename);

    const buffer = Buffer.from(sel.base64, 'base64');
    fs.writeFileSync(fullPath, buffer);

    try {
      // generate thumbnail
      await sharp(buffer).resize(256).toFile(thumbPath);
    } catch (err) {
      console.error(`Failed to generate thumbnail for ${filename}`, err);
      // Fallback: write the full image to the thumbnail path if sharp fails
      fs.writeFileSync(thumbPath, buffer);
    }

    // register in asset service
    const record: AssetRecord = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      original_name: filename,
      filename,
      type: "Headshot",
      media_type: "image",
      subject_name: characterName,
      description: `Generated headshot variation: ${sel.key}${tags.length ? ' - ' + tags.join(', ') : ''}`,
      size_bytes: buffer.length,
      created_at: Date.now()
    };

    const savedRecord = assetService.upsertAsset(record, filename);
    savedRecords.push(savedRecord);
  }

  return savedRecords;
}
