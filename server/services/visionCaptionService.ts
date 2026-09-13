import fs from "fs";
import path from "path";
import { assetService } from "./assetService";
import { getImageBase64ForVision } from "./thumbnailService";
import { callLocalLLM } from "./llm_service";

export interface VisionCaptionOptions {
  thumbnailPath?: string;
  thumbnail_path?: string;
  imageBase64?: string;
  image_base64?: string;
  image?: string;
  contextType?: "character" | "scene" | "shot" | "asset" | string;
  context_type?: string;
  subjectName?: string;
  subject_name?: string;
  lm_studio_url?: string;
  lmStudioUrl?: string;
  model?: string;
}

export interface VisionCaptionResult {
  success: boolean;
  caption: string;
  words_count: number;
  subject_substituted: boolean;
  model_used: string;
  raw_output?: string;
}

/**
 * Cleans and post-processes raw caption text from the vision model,
 * enforcing length bounds, removing conversational noise, and ensuring
 * the subject name substitution rule is honored.
 */
export function sanitizeCaptionOutput(raw: string, subjectName?: string): string {
  let text = (raw || "").trim();

  // Strip wrapping quotes and backticks
  text = text.replace(/^["'`]+|["'`]+$/g, "");

  // Strip markdown bold/italics
  text = text.replace(/\*\*/g, "").replace(/\*/g, "");

  // Strip common conversational vision preambles iteratively
  const preambleRegex = /^(caption|description|visual description|image description|the image shows|the photo shows|in this image|in this photo|this image depicts|we see|here is|there is|a photo of|an image of)\s*[:\-–—]?\s*/i;
  let previousText = "";
  while (text !== previousText && preambleRegex.test(text)) {
    previousText = text;
    text = text.replace(preambleRegex, "").trim();
  }

  const cleanSubject = (subjectName || "").trim();
  let substituted = false;

  if (cleanSubject && !["subject", "unknown", "none", ""].includes(cleanSubject.toLowerCase())) {
    // If text begins with generic descriptors like "A woman", "A man", "A person", "The person", "The subject"
    const genericSubjectRegex = /^(a|an|the)\s+(person|man|woman|character|guy|girl|individual|figure|subject)\s+(wearing|dressed in|in|standing|sitting|holding|with)\b/i;
    if (genericSubjectRegex.test(text)) {
      text = text.replace(genericSubjectRegex, `${cleanSubject} $3`);
      substituted = true;
    } else if (!text.toLowerCase().includes(cleanSubject.toLowerCase())) {
      // Prepend subject if context suggests attire or action without naming
      if (/^(wearing|dressed in|in|with)\b/i.test(text)) {
        text = `${cleanSubject} ${text}`;
        substituted = true;
      }
    }
  }

  // Remove trailing periods for cleaner prompt interpolation
  text = text.replace(/\.+$/, "").trim();

  // Limit to roughly 15 words if model was overly verbose
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 20) {
    text = words.slice(0, 16).join(" ");
  }

  return text;
}

/**
 * Executes a vision inference call against LM Studio using the OpenAI-compatible
 * chat completions multimodal schema.
 */
export async function generateVisionCaption(options: VisionCaptionOptions): Promise<VisionCaptionResult> {
  const contextType = (options.contextType || options.context_type || "asset").toLowerCase();
  const subjectName = (options.subjectName || options.subject_name || "").trim();
  const rawUrl = options.lm_studio_url || options.lmStudioUrl || "http://localhost:1234/v1";
  const model = options.model || "local-model";

  // 1. Resolve image to compact base64 data URI
  let imageBase64Uri = options.imageBase64 || options.image_base64 || options.image;

  if (!imageBase64Uri) {
    const rawPath = options.thumbnailPath || options.thumbnail_path;
    if (!rawPath) {
      throw new Error("Missing thumbnailPath or imageBase64 in caption request.");
    }

    let filePath: string | null = null;
    if (fs.existsSync(rawPath)) {
      filePath = rawPath;
    } else {
      // Lookup in asset directory
      filePath = assetService.getAssetFilePath(path.basename(rawPath));
      if (!filePath && fs.existsSync(path.resolve(rawPath))) {
        filePath = path.resolve(rawPath);
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error(`Image asset not found at path: ${rawPath}`);
    }

    imageBase64Uri = await getImageBase64ForVision(filePath, 384);
  } else if (!imageBase64Uri.startsWith("data:")) {
    // Wrap raw base64 string
    imageBase64Uri = `data:image/jpeg;base64,${imageBase64Uri}`;
  }

  // 2. Build system instructions tailored to the subject and context
  const hasSubject = subjectName.length > 0 && !["subject", "unknown", "none"].includes(subjectName.toLowerCase());

  let roleContext = "";
  if (contextType === "character") {
    roleContext = hasSubject
      ? `The subject of this image is named "${subjectName}". If this is a person, refer to them as "${subjectName}". Describe only visible attire, outerwear, glasses/accessories, and stance.`
      : "Describe only visible clothing, outerwear, glasses, accessories, and stance. Do not use generic pronouns.";
  } else if (contextType === "scene") {
    roleContext = hasSubject
      ? `This is a scene reference for "${subjectName}". Describe architectural layout, furniture, lighting, and textures. Do not mention people or cameras.`
      : "Describe the environmental space, architectural features, key lighting, and textures. Do not mention cameras.";
  } else {
    roleContext = hasSubject
      ? `The primary subject is "${subjectName}". Describe key materials, distinctive styling, or lighting.`
      : "Describe key materials, prominent colors, styling, or lighting.";
  }

  const systemPrompt = `You are a concise visual captioning assistant for an AI video generation studio.
Strict rules:
1. Provide a single descriptive phrase between 5 and 15 words.
2. Focus strictly on attire, clothing, outerwear, handheld objects, lighting, and layout.
3. ${roleContext}
4. Strictly DO NOT describe human facial features, skin tone, eye color, age, gender classifications, or body anatomy.
5. Ban all conversational filler, markdown formatting, quotes, and preamble phrases like "The photo shows" or "In this image".
6. Return ONLY the descriptive phrase.`;

  const userPromptText = hasSubject
    ? `Describe the visual styling and attire in this image for ${subjectName} in 5-15 words.`
    : `Provide a 5-15 word visual description of the attire, objects, or scene in this image.`;

  // 3. Dispatch to centralized Local LLM orchestrator with multimodal image message
  const localRes = await callLocalLLM({
    url: rawUrl,
    model,
    temperature: 0.2,
    max_tokens: 60,
    timeoutMs: 45000,
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: userPromptText
          },
          {
            type: "image_url",
            image_url: {
              url: imageBase64Uri
            }
          }
        ]
      }
    ]
  });

  const rawContent = localRes.content;
  const sanitized = sanitizeCaptionOutput(rawContent, subjectName);
  const wordsCount = sanitized.split(/\s+/).filter(Boolean).length;
  const subjectSubstituted = Boolean(hasSubject && sanitized.toLowerCase().includes(subjectName.toLowerCase()));

  return {
    success: true,
    caption: sanitized,
    words_count: wordsCount,
    subject_substituted: subjectSubstituted,
    model_used: localRes.model || model,
    raw_output: rawContent
  };
}
