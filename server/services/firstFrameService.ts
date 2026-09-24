import { GoogleGenAI } from "@google/genai";
import { getStoredGeminiKey } from "./geminiService";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { ensureSceneDirectories, ASSETS_DIR } from "../config/constants";
import { assetService } from "./assetService";
import { generateThumbnailFile } from "./thumbnailService";
import { AssetRecord } from "../types";
import { createScopedLogger } from "../utils/logger";

const log = createScopedLogger("FirstFrame");

/**
 * Pre-flight safety re-prompting translator.
 * Rewrites high-intensity dramatic film action into theatrical stunt, stage combat,
 * and cinematic lighting vocabulary to prevent commercial API safety filter false positives.
 */
export async function sanitizeSafetyPrompt(promptText: string): Promise<{
  originalPrompt: string;
  sanitizedPrompt: string;
  isModified: boolean;
  replacementsApplied: string[];
}> {
  if (!promptText || !promptText.trim()) {
    return { originalPrompt: "", sanitizedPrompt: "", isModified: false, replacementsApplied: [] };
  }

  // Common intense film terms mapped to Hollywood stagecraft & theatrical stunt terminology
  const STUNT_DICTIONARY: [RegExp, string, string][] = [
    [/\b(blood|bloody|bleeding)\b/gi, "dramatic crimson theatrical stage paint FX", "blood -> theatrical stage paint"],
    [/\b(stabbing|stabbed|stabs)\b/gi, "theatrical stage combat close-contact choreography", "stabbing -> stage combat choreography"],
    [/\b(shoot|shoots|shooting|gunfire|shootout)\b/gi, "cinematic high-tension confrontation, hero holding cinematic studio prop replica", "gunfire -> cinematic prop confrontation"],
    [/\b(gun|pistol|rifle|firearm|weapon)\b/gi, "holstered cinematic stunt prop replica", "weapon -> stunt prop replica"],
    [/\b(kill|killing|murder|murdered|slain)\b/gi, "dramatic climax confrontation with intense cinematic lighting", "violence -> dramatic confrontation"],
    [/\b(dead body|corpse)\b/gi, "actor lying motionless in dramatic moody stage lighting", "corpse -> actor lying motionless"],
    [/\b(explosion|exploding|blown up)\b/gi, "controlled cinematic pyrotechnic stage flare and golden backlight", "explosion -> controlled pyrotechnic flare"],
    [/\b(wound|wounds|injured|injury|severed)\b/gi, "cinematic stunt makeup effect", "injury -> stunt makeup FX"],
    [/\b(strangle|choke|choking)\b/gi, "dramatic stage grip choreography", "choke -> stage grip choreography"],
    [/\b(knife|blade|dagger)\b/gi, "theatrical rubber stunt prop", "knife -> rubber stunt prop"]
  ];

  let transformed = promptText;
  const applied: string[] = [];

  // 1. Try Gemini AI-assisted theatrical re-prompting if API key available
  const apiKey = getStoredGeminiKey();
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } }
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: `You are a Hollywood visual effects director and stagecraft supervisor. 
Translate the following dramatic film scene prompt into cinematic film-set staging vocabulary. 
Replace any explicit physical violence, gore, or dangerous actions with theatrical stunt choreography, professional prop replicas, controlled pyrotechnics, and dramatic cinematic lighting, while preserving 100% of the cinematic tension, framing, character pose, mood, wardrobe, and composition.

Output ONLY the translated prompt text with no conversational filler, markdown formatting, or preamble.

Original Prompt:
"${promptText}"`
      });

      const aiSanitized = response.text?.trim();
      if (aiSanitized && aiSanitized.length > 10) {
        return {
          originalPrompt: promptText,
          sanitizedPrompt: aiSanitized,
          isModified: aiSanitized.toLowerCase() !== promptText.toLowerCase(),
          replacementsApplied: ["AI Theatrical Stunt & Lighting Translation"]
        };
      }
    } catch (err: any) {
      log.warn("Gemini AI translation fallback to dictionary rules", { error: err?.message || err });
    }
  }

  // 2. Fallback heuristic dictionary replacement
  for (const [regex, replacement, label] of STUNT_DICTIONARY) {
    if (regex.test(transformed)) {
      transformed = transformed.replace(regex, replacement);
      applied.push(label);
    }
  }

  return {
    originalPrompt: promptText,
    sanitizedPrompt: transformed,
    isModified: transformed !== promptText,
    replacementsApplied: applied
  };
}

/**
 * Loads an image file or asset by filename or path, returning base64 and mime type.
 */
export function resolveImageBase64(input: {
  filename?: string;
  base64?: string;
  mimeType?: string;
}): { base64: string; mimeType: string } | null {
  if (input.base64) {
    return {
      base64: input.base64.replace(/^data:image\/\w+;base64,/, ""),
      mimeType: input.mimeType || (input.base64.startsWith("/9j/") ? "image/jpeg" : "image/png")
    };
  }

  if (input.filename) {
    const filePath = assetService.getAssetFilePath(input.filename);
    if (filePath && fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".webp" ? "image/webp" : "image/png";
      return {
        base64: buffer.toString("base64"),
        mimeType
      };
    }
  }

  return null;
}

export interface GenerateFirstFrameCandidateParams {
  prompt: string;
  actorImage?: { filename?: string; base64?: string; mimeType?: string; label?: string };
  wardrobeImage?: { filename?: string; base64?: string; mimeType?: string; label?: string };
  locationImage?: { filename?: string; base64?: string; mimeType?: string; label?: string };
  aspectRatio?: string;
  candidateCount?: number;
  sceneName?: string;
  shotNumber?: number;
}

export interface GeneratedCandidate {
  id: string;
  index: number;
  base64: string;
  mimeType: string;
  promptUsed: string;
  aspectRatio: string;
}

/**
 * Multimodal First Frame Generator using Gemini Flash Image models.
 * Synthesizes Actor facial identity, Wardrobe reference, and Location backdrop into a cinematic Frame 0.
 */
export async function generateMultimodalFirstFrame(
  params: GenerateFirstFrameCandidateParams
): Promise<{
  candidates: GeneratedCandidate[];
  promptUsed: string;
  isSanitized: boolean;
}> {
  const apiKey = getStoredGeminiKey();
  if (!apiKey) throw new Error("Gemini API key is not configured in Settings.");

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } }
  });

  const {
    prompt,
    actorImage,
    wardrobeImage,
    locationImage,
    aspectRatio = "16:9",
    candidateCount = 2,
    sceneName = "scene01",
    shotNumber = 1
  } = params;

  // 1. Sanitize prompt for theatrical safety
  const safetyResult = await sanitizeSafetyPrompt(prompt);
  const promptToUse = safetyResult.sanitizedPrompt || prompt;

  // 2. Resolve image references
  const actorRef = actorImage ? resolveImageBase64(actorImage) : null;
  const wardrobeRef = wardrobeImage ? resolveImageBase64(wardrobeImage) : null;
  const locationRef = locationImage ? resolveImageBase64(locationImage) : null;

  // Build multimodal instruction
  let instruction = `You are a world-class cinematic director of photography and concept artist.
Generate a photorealistic, ultra-high-definition film still representing Frame 0 (the exact opening starting keyframe) for Shot ${shotNumber} of the film scene "${sceneName}".

COMPOSITION & STAGING DIRECTIVES:
- Director's Shot Prompt: ${promptToUse}
- Framing & Aspect Ratio: ${aspectRatio}
- Color Grading & Atmosphere: Cinematic lighting, volumetric depth, natural film grain, photorealistic texture, masterpiece quality.
`;

  const parts: any[] = [];

  if (actorRef) {
    parts.push({ inlineData: { data: actorRef.base64, mimeType: actorRef.mimeType } });
    instruction += `\n- Character Facial Likeness Reference: Maintain strict facial structure, eye shape, hairstyle, and facial features from the character reference image.`;
  }

  if (wardrobeRef) {
    parts.push({ inlineData: { data: wardrobeRef.base64, mimeType: wardrobeRef.mimeType } });
    instruction += `\n- Wardrobe & Costume Reference: Dress the character in the style, materials, and clothing shown in the wardrobe reference image.`;
  }

  if (locationRef) {
    parts.push({ inlineData: { data: locationRef.base64, mimeType: locationRef.mimeType } });
    instruction += `\n- Location & Environment Reference: Place the character inside the environment, architecture, and lighting atmosphere shown in the location reference image.`;
  }

  parts.push({ text: instruction });

  const modelsToTry = ["gemini-3.1-flash-image", "gemini-2.5-flash-image"];
  const count = Math.max(1, Math.min(4, candidateCount));
  const candidates: GeneratedCandidate[] = [];

  // Generate candidates in parallel
  const candidatePromises = Array.from({ length: count }).map(async (_, idx) => {
    let lastError: any = null;
    let base64Output = "";

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: { parts },
          config: {
            imageConfig: {
              aspectRatio: aspectRatio as any
            }
          }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData && part.inlineData.data) {
            base64Output = part.inlineData.data;
            break;
          }
        }

        if (base64Output) {
          return {
            id: `cand_${Date.now()}_${idx + 1}`,
            index: idx + 1,
            base64: base64Output,
            mimeType: "image/png",
            promptUsed: promptToUse,
            aspectRatio
          };
        }
      } catch (err: any) {
        lastError = err;
        log.warn(`Model ${model} attempt ${idx + 1} failed`, { error: err?.message || err });
      }
    }

    if (!base64Output) {
      throw new Error(lastError?.message || `Generation failed for candidate ${idx + 1}`);
    }
    return null;
  });

  const results = await Promise.allSettled(candidatePromises);

  for (const res of results) {
    if (res.status === "fulfilled" && res.value) {
      candidates.push(res.value);
    }
  }

  if (candidates.length === 0) {
    const errorMsg = results.find(r => r.status === "rejected") as PromiseRejectedResult | undefined;
    throw new Error(errorMsg?.reason?.message || "Failed to generate any first frame candidates from image model.");
  }

  return {
    candidates,
    promptUsed: promptToUse,
    isSanitized: safetyResult.isModified
  };
}

/**
 * Commits an approved candidate to the project asset library as a locked First Frame asset.
 */
export async function commitFirstFrameCandidate({
  base64,
  sceneName,
  shotNumber,
  aspectRatio,
  promptUsed
}: {
  base64: string;
  sceneName: string;
  shotNumber: number;
  aspectRatio?: string;
  promptUsed?: string;
}): Promise<{
  asset: AssetRecord;
  filename: string;
  previewUrl: string;
}> {
  const cleanScene = (sceneName || "scene01").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const paddedShot = String(shotNumber || 1).padStart(2, "0");
  const timestamp = Date.now();
  const filename = `first_frame_${cleanScene}_shot_${paddedShot}_staging_${timestamp}.png`;

  const sceneDirs = ensureSceneDirectories(cleanScene);
  const targetPath = path.join(sceneDirs.images, filename);

  const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(cleanBase64, "base64");

  // Save image buffer to scene disk
  fs.writeFileSync(targetPath, buffer);

  // Generate thumbnail
  let thumbPath: string | undefined = undefined;
  try {
    thumbPath = await generateThumbnailFile(targetPath, undefined, 384);
  } catch (e: any) {
    log.warn("Thumbnail generation error during first frame save", { error: e?.message || e });
  }

  const stats = fs.statSync(targetPath);

  const asset: AssetRecord = {
    id: filename,
    filename,
    original_name: filename,
    media_type: "image",
    type: "Start Frame",
    subject_name: cleanScene,
    description: `Generated Start Frame for Shot ${shotNumber}: ${(promptUsed || "").slice(0, 100)}`,
    tags: ["Start Frame", "First Frame", "Multimodal Staging", `Shot_${paddedShot}`],
    size_bytes: stats.size,
    created_at: timestamp,
    preview_url: `/api/uploads/${filename}`,
    thumbnail_url: `/api/assets/thumb/${filename}`,
    thumbnail_path: thumbPath,
    scene_name: cleanScene,
    path: targetPath
  };

  // Upsert asset to database
  assetService.upsertAsset(asset);
  log.info(`Committed first frame asset for shot ${shotNumber} in scene ${cleanScene}`, {
    filename,
    sizeBytes: stats.size
  });

  return {
    asset,
    filename,
    previewUrl: asset.preview_url
  };
}
