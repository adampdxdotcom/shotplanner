import fs from "fs";
import path from "path";
import { assetService } from "./assetService";
import { getImageBase64ForVision } from "./thumbnailService";
import { callLocalLLM, stripThinkingTags } from "./llm_service";
import { getProjectData, saveProjectData } from "./project";
import { ImageVisualAnalysis } from "../types";

export interface VisionCaptionOptions {
  thumbnailPath?: string;
  thumbnail_path?: string;
  imageBase64?: string;
  image_base64?: string;
  image?: string;
  filename?: string;
  file_name?: string;
  sceneName?: string;
  scene_name?: string;
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
  analysis?: ImageVisualAnalysis;
  words_count: number;
  subject_substituted: boolean;
  model_used: string;
  raw_output?: string;
  saved_to_cache?: boolean;
}

/**
 * Cleans and post-processes raw caption text from the vision model,
 * enforcing length bounds, removing conversational noise, and ensuring
 * the subject name substitution rule is honored.
 */
export function sanitizeCaptionOutput(raw: string, subjectName?: string): string {
  let text = stripThinkingTags(raw || "").trim();

  // Strip wrapping quotes, backticks, and markdown formatting
  text = text.replace(/^["'`]+|["'`]+$/g, "");
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

  // Limit to roughly 18 words if model was overly verbose
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 20) {
    text = words.slice(0, 16).join(" ");
  }

  return text;
}

/**
 * Extracts and structures an ImageVisualAnalysis record from model output.
 */
function extractVisualAnalysis(
  rawJsonOrObj: any,
  filename: string,
  fallbackCaption: string,
  subjectName?: string
): ImageVisualAnalysis {
  const base: ImageVisualAnalysis = {
    filename: filename || "scanned_asset.jpg",
    scanned_at: new Date().toISOString(),
    summary: fallbackCaption || "Visual reference scan"
  };

  if (!rawJsonOrObj || typeof rawJsonOrObj !== "object") {
    return base;
  }

  const src = rawJsonOrObj.analysis && typeof rawJsonOrObj.analysis === "object"
    ? rawJsonOrObj.analysis
    : rawJsonOrObj;

  if (src.summary && typeof src.summary === "string") {
    base.summary = src.summary.trim();
  }

  // Subject parsing (supports object or string)
  if (src.subject && typeof src.subject === "object") {
    base.subject = {
      identified_name: src.subject.identified_name || subjectName || undefined,
      apparent_age: src.subject.apparent_age || undefined,
      expression: src.subject.expression || undefined,
      hair: src.subject.hair || undefined,
      features: src.subject.features || undefined
    };
  } else if (typeof src.subject === "string" && src.subject.trim()) {
    base.subject = { identified_name: src.subject.trim() };
  } else if (subjectName) {
    base.subject = { identified_name: subjectName };
  }

  // Wardrobe parsing (supports object or string)
  if (src.wardrobe && typeof src.wardrobe === "object") {
    base.wardrobe = {
      garments: src.wardrobe.garments || undefined,
      colors: src.wardrobe.colors || undefined,
      era_style: src.wardrobe.era_style || undefined,
      accessories: src.wardrobe.accessories || undefined
    };
  } else if (typeof src.wardrobe === "string" && src.wardrobe.trim()) {
    base.wardrobe = { garments: src.wardrobe.trim() };
  }

  // Lighting parsing (supports object or string)
  if (src.lighting && typeof src.lighting === "object") {
    base.lighting = {
      key_direction: src.lighting.key_direction || undefined,
      quality: src.lighting.quality || undefined,
      color_temperature: src.lighting.color_temperature || undefined,
      contrast_ratio: src.lighting.contrast_ratio || undefined
    };
  } else if (typeof src.lighting === "string" && src.lighting.trim()) {
    base.lighting = { quality: src.lighting.trim() };
  }

  // Cinematography parsing (supports object or string)
  if (src.cinematography && typeof src.cinematography === "object") {
    base.cinematography = {
      framing: src.cinematography.framing || undefined,
      lens_feel: src.cinematography.lens_feel || undefined,
      depth_of_field: src.cinematography.depth_of_field || undefined,
      camera_angle: src.cinematography.camera_angle || undefined
    };
  } else if (typeof src.cinematography === "string" && src.cinematography.trim()) {
    base.cinematography = { framing: src.cinematography.trim() };
  }

  // Environment / Palette parsing (supports object or string)
  if (src.environment_palette && typeof src.environment_palette === "object") {
    base.environment_palette = {
      setting: src.environment_palette.setting || undefined,
      location_type: src.environment_palette.location_type || undefined,
      dominant_colors: src.environment_palette.dominant_colors || undefined,
      mood: src.environment_palette.mood || undefined
    };
  } else if (typeof src.environment_palette === "string" && src.environment_palette.trim()) {
    base.environment_palette = { setting: src.environment_palette.trim() };
  } else if (typeof src.setting === "string" && src.setting.trim()) {
    base.environment_palette = { setting: src.setting.trim() };
  }

  return base;
}

/**
 * Attempts to parse single-pass JSON or structured markdown from LLM output,
 * extracting both the short caption and the deep visual analysis object.
 */
function parseSinglePassVisionResponse(
  rawContent: string,
  filename: string,
  subjectName?: string
): { caption: string; analysis: ImageVisualAnalysis } {
  const cleaned = stripThinkingTags(rawContent);

  let parsed: any = null;

  // 1. Try finding JSON block between ```json ... ``` or first { ... }
  const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i) || cleaned.match(/(\{[\s\S]*\})/);
  if (jsonMatch) {
    try {
      const rawJson = jsonMatch[1].trim();
      // Remove trailing commas before closing braces/brackets
      const cleanedJson = rawJson.replace(/,\s*([}\]])/g, "$1");
      parsed = JSON.parse(cleanedJson);
    } catch (e) {
      // Fall through to secondary attempts
    }
  }

  // 2. Direct JSON.parse attempt
  if (!parsed) {
    try {
      const cleanedJson = cleaned.replace(/,\s*([}\]])/g, "$1");
      parsed = JSON.parse(cleanedJson);
    } catch (e) {
      // Not raw JSON
    }
  }

  // 3. Fallback: Parse markdown key-value pairs (e.g. "Caption: ...\nWardrobe: ...")
  if (!parsed) {
    const captionMatch = cleaned.match(/(?:caption|short description|description)\s*:\s*([^\n\r]+)/i);
    const wardrobeMatch = cleaned.match(/(?:wardrobe|attire|clothing)\s*:\s*([^\n\r]+)/i);
    const lightingMatch = cleaned.match(/(?:lighting|light)\s*:\s*([^\n\r]+)/i);
    const framingMatch = cleaned.match(/(?:framing|shot type|cinematography|camera)\s*:\s*([^\n\r]+)/i);
    const settingMatch = cleaned.match(/(?:setting|environment|location|palette)\s*:\s*([^\n\r]+)/i);
    const summaryMatch = cleaned.match(/(?:summary|visual summary|analysis)\s*:\s*([^\n\r]+)/i);

    if (captionMatch || wardrobeMatch || lightingMatch || framingMatch || settingMatch) {
      parsed = {
        caption: captionMatch ? captionMatch[1].trim() : "",
        analysis: {
          summary: summaryMatch ? summaryMatch[1].trim() : (captionMatch ? captionMatch[1].trim() : ""),
          wardrobe: wardrobeMatch ? { garments: wardrobeMatch[1].trim() } : undefined,
          lighting: lightingMatch ? { quality: lightingMatch[1].trim() } : undefined,
          cinematography: framingMatch ? { framing: framingMatch[1].trim() } : undefined,
          environment_palette: settingMatch ? { setting: settingMatch[1].trim() } : undefined
        }
      };
    }
  }

  if (parsed && typeof parsed === "object") {
    const rawCaption = parsed.caption || parsed.short_caption || parsed.description || parsed.summary || "";
    const sanitizedCap = sanitizeCaptionOutput(String(rawCaption), subjectName);
    const analysisObj = extractVisualAnalysis(parsed, filename, sanitizedCap, subjectName);

    return {
      caption: sanitizedCap,
      analysis: analysisObj
    };
  }

  // 4. Fallback: Plain text output from simple vision model
  const fallbackCap = sanitizeCaptionOutput(cleaned, subjectName);
  const baselineAnalysis = extractVisualAnalysis(null, filename, fallbackCap, subjectName);

  return {
    caption: fallbackCap,
    analysis: baselineAnalysis
  };
}

/**
 * Executes a single-pass vision inference call against LM Studio using the OpenAI-compatible
 * chat completions multimodal schema (scaled to 384px thumbnail).
 * Returns both the short 5-15 word UI caption and the deep visual intelligence breakdown,
 * and auto-saves the breakdown into the active scene's visual_analysis_cache.
 */
export async function generateVisionCaption(options: VisionCaptionOptions): Promise<VisionCaptionResult> {
  const contextType = (options.contextType || options.context_type || "asset").toLowerCase();
  const subjectName = (options.subjectName || options.subject_name || "").trim();
  const rawUrl = options.lm_studio_url || options.lmStudioUrl || "http://localhost:1234/v1";
  const model = options.model || "local-model";
  const explicitFilename = options.filename || options.file_name;
  const targetSceneName = options.sceneName || options.scene_name;

  // 1. Resolve image to compact 384px base64 data URI
  let imageBase64Uri = options.imageBase64 || options.image_base64 || options.image;
  let resolvedFilename = explicitFilename || "";

  if (!imageBase64Uri) {
    const rawPath = options.thumbnailPath || options.thumbnail_path;
    if (!rawPath) {
      throw new Error("Missing thumbnailPath or imageBase64 in caption request.");
    }

    let filePath: string | null = null;
    if (fs.existsSync(rawPath)) {
      filePath = rawPath;
    } else {
      filePath = assetService.getAssetFilePath(path.basename(rawPath));
      if (!filePath && fs.existsSync(path.resolve(rawPath))) {
        filePath = path.resolve(rawPath);
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error(`Image asset not found at path: ${rawPath}`);
    }

    if (!resolvedFilename) {
      resolvedFilename = path.basename(filePath);
    }

    imageBase64Uri = await getImageBase64ForVision(filePath, 384);
  } else if (!imageBase64Uri.startsWith("data:")) {
    imageBase64Uri = `data:image/jpeg;base64,${imageBase64Uri}`;
  }

  if (!resolvedFilename) {
    resolvedFilename = "asset_" + Date.now() + ".jpg";
  }

  // 2. Build system instructions requesting single-pass dual output (JSON)
  const hasSubject = subjectName.length > 0 && !["subject", "unknown", "none"].includes(subjectName.toLowerCase());

  let roleContext = "";
  if (contextType === "character") {
    roleContext = hasSubject
      ? `The subject is named "${subjectName}". Describe only visible attire, outerwear, glasses/accessories, and stance.`
      : "Describe only visible clothing, outerwear, glasses, accessories, and stance.";
  } else if (contextType === "scene") {
    roleContext = hasSubject
      ? `This is a scene reference for "${subjectName}". Describe architectural layout, furniture, lighting, and textures.`
      : "Describe the environmental space, architectural features, key lighting, and textures.";
  } else {
    roleContext = hasSubject
      ? `The primary subject is "${subjectName}". Describe key materials, distinctive styling, or lighting.`
      : "Describe key materials, prominent colors, styling, or lighting.";
  }

  const systemPrompt = `You are a visual intelligence and captioning assistant for a cinematic AI studio.
Analyze the provided reference image and return a STRICT JSON object with two fields:
1. "caption": A concise 5 to 15 word descriptive phrase capturing key visible attire, accessories, stance, or setting. ${roleContext} Strictly DO NOT describe human facial features, skin tone, eye color, age, gender classifications, or body anatomy in the caption. Ban conversational filler like "The photo shows".
2. "analysis": A structured visual breakdown object:
   {
     "summary": "1-2 sentence visual summary",
     "wardrobe": { "garments": "...", "colors": "...", "era_style": "...", "accessories": "..." },
     "lighting": { "quality": "hard|soft|diffused|dramatic", "key_direction": "camera left|camera right|overhead|rim|ambient", "color_temperature": "warm|cool|neutral", "contrast_ratio": "high|medium|low" },
     "cinematography": { "framing": "Close-Up|Medium Shot|Wide Shot", "lens_feel": "...", "depth_of_field": "shallow|deep", "camera_angle": "Eye Level|Low Angle|High Angle" },
     "environment_palette": { "setting": "...", "location_type": "interior|exterior", "dominant_colors": ["color1", "color2"], "mood": "..." }
   }

Return ONLY valid JSON. Do NOT output markdown explanations or conversational text.`;

  const userPromptText = hasSubject
    ? `Analyze this image for subject "${subjectName}". Return JSON with "caption" (5-15 words) and "analysis".`
    : `Analyze this image. Return JSON with "caption" (5-15 words) and "analysis".`;

  // 3. Dispatch to centralized Local LLM orchestrator (450 tokens headroom for JSON + reasoning)
  const localRes = await callLocalLLM({
    url: rawUrl,
    model,
    temperature: 0.2,
    max_tokens: 450,
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
  const { caption, analysis } = parseSinglePassVisionResponse(rawContent, resolvedFilename, subjectName);
  const wordsCount = caption.split(/\s+/).filter(Boolean).length;
  const subjectSubstituted = Boolean(hasSubject && caption.toLowerCase().includes(subjectName.toLowerCase()));

  // 4. Silently auto-save deep visual analysis to project visual_analysis_cache if scene is known
  let savedToCache = false;
  if (targetSceneName && resolvedFilename && analysis) {
    try {
      const projectData = getProjectData(targetSceneName);
      if (projectData) {
        if (!projectData.visual_analysis_cache) {
          projectData.visual_analysis_cache = {};
        }
        projectData.visual_analysis_cache[resolvedFilename] = analysis;
        saveProjectData(targetSceneName, projectData);
        savedToCache = true;
        console.log(`[Vision Caption Service] Silently auto-saved visual analysis for '${resolvedFilename}' in scene '${targetSceneName}'`);
      }
    } catch (cacheErr: any) {
      console.warn(`[Vision Caption Service] Could not auto-save visual analysis cache:`, cacheErr?.message || cacheErr);
    }
  }

  return {
    success: true,
    caption,
    analysis,
    words_count: wordsCount,
    subject_substituted: subjectSubstituted,
    model_used: localRes.model || model,
    raw_output: rawContent,
    saved_to_cache: savedToCache
  };
}
