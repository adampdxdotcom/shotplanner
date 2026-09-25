/**
 * Shared ComfyUI node classifiers and heuristics for client and server.
 */

// Known image loader node class types in ComfyUI ecosystem
export const KNOWN_IMAGE_LOADER_CLASSES = [
  "LoadImage",
  "LoadImageMask",
  "LoadImageFromUrl",
  "LoadImageBase64",
  "LoadImageOutput",
  "CR Load Image",
  "LoadImagePath"
];

// Known video loader node class types in ComfyUI ecosystem
export const KNOWN_VIDEO_LOADER_CLASSES = [
  "LoadVideo",
  "VHS_LoadVideo",
  "VHS_LoadVideoPath",
  "VHS_LoadVideoFFmpeg",
  "LoadVideoPath"
];

// Known audio loader node class types in ComfyUI ecosystem
export const KNOWN_AUDIO_LOADER_CLASSES = [
  "LoadAudio",
  "VHS_LoadAudio",
  "LoadAudioPath"
];

// Known save video / video combine node class types
export const KNOWN_SAVE_VIDEO_CLASSES = [
  "SaveVideo",
  "VHS_VideoCombine"
];

// Known prompt / text conditioning node class types
export const KNOWN_PROMPT_CLASSES = [
  "PrimitiveStringMultiline",
  "CLIPTextEncode",
  "CLIPTextEncodeFlux",
  "CLIPTextEncodeSDXL",
  "StringLiteral",
  "ShowText"
];

// Known LoRA loader node class types in ComfyUI ecosystem
export const KNOWN_LORA_CLASSES = [
  "LoraLoader",
  "LoraLoaderModelOnly",
  "LoraLoaderAdvanced",
  "LoraLoaderBlockWeight",
  "CR Load LoRA",
  "CR Apply LoRA Stack",
  "Power Lora Loader (rgthree)",
  "easy loraStack",
  "WANLoraLoader",
  "WanVideoLoraLoader",
  "LoraLoaderWanVideo",
  "FluxLoraLoader",
  "LoraLoaderDiffusionModels"
];

/**
 * Accurately identifies whether a node is a LoRA loader or LoRA stack node.
 * Excludes LoRA trainers, converters, savers, and extractors.
 */
export function isExactLoraLoader(classType: string, title?: string): boolean {
  const ct = (classType || "").trim();
  const t = (title || "").trim().toLowerCase();

  // Exclude non-loader operations (e.g. LoraSave, LoraTrain, LoraExtract)
  if (/save|train|extract|convert|dataset|caption/i.test(ct)) {
    return false;
  }

  if (KNOWN_LORA_CLASSES.includes(ct)) {
    return true;
  }

  if (/^LoraLoader/i.test(ct) || /^LoadLora/i.test(ct) || /LoraLoader$/i.test(ct) || /^WanVideoLora/i.test(ct)) {
    return true;
  }

  if (t === "load lora" || t.startsWith("load lora") || t === "lora loader" || t.startsWith("lora loader") || t.includes("lora slot")) {
    return true;
  }

  return false;
}

/**
 * Accurately identifies whether a node is a true input image loader.
 * Excludes latent generators, scalers, previews, saves, blends, crops, upscalers, converters.
 */
export function isExactImageLoader(classType: string, title?: string): boolean {
  const ct = (classType || "").trim();
  const t = (title || "").trim().toLowerCase();

  // Exclude non-loader operations
  if (/latent|save|preview|scale|crop|blend|upscale|filter|transform|convert|composite/i.test(ct)) {
    return false;
  }

  if (KNOWN_IMAGE_LOADER_CLASSES.includes(ct)) {
    return true;
  }

  if (/^LoadImage/i.test(ct) || /^ImageLoader/i.test(ct)) {
    return true;
  }

  if (t === "load image" || t.startsWith("load image")) {
    return true;
  }

  return false;
}

/**
 * Accurately identifies whether a node is a true input video loader.
 * Excludes combiners, previews, and encoders/decoders.
 */
export function isExactVideoLoader(classType: string, title?: string): boolean {
  const ct = (classType || "").trim();
  const t = (title || "").trim().toLowerCase();

  if (/save|combine|preview|linear|cfg|encode|decode/i.test(ct)) {
    return false;
  }

  if (KNOWN_VIDEO_LOADER_CLASSES.includes(ct)) {
    return true;
  }

  if (/^LoadVideo/i.test(ct) || /^VideoLoader/i.test(ct) || /^VHS_LoadVideo/i.test(ct)) {
    return true;
  }

  if (t === "load video" || t.startsWith("load video")) {
    return true;
  }

  return false;
}

/**
 * Accurately identifies whether a node is a true input audio loader.
 * Excludes audio VAEs, model loaders, saves, and filters.
 */
export function isExactAudioLoader(classType: string, title?: string): boolean {
  const ct = (classType || "").trim();
  const t = (title || "").trim().toLowerCase();

  if (/vae|model|save|preview|combine|filter/i.test(ct)) {
    return false;
  }

  if (KNOWN_AUDIO_LOADER_CLASSES.includes(ct)) {
    return true;
  }

  if (/^LoadAudio/i.test(ct) || /^AudioLoader/i.test(ct) || /^VHS_LoadAudio/i.test(ct)) {
    return true;
  }

  if (t === "load audio" || t.startsWith("load audio")) {
    return true;
  }

  return false;
}

/**
 * Accurately identifies whether a node is a save/combine video output node.
 */
export function isSaveVideoNode(classType: string, title?: string): boolean {
  const ct = (classType || "").trim();
  const t = (title || "").trim().toLowerCase();

  if (KNOWN_SAVE_VIDEO_CLASSES.includes(ct)) {
    return true;
  }

  if (t === "save video" || t.includes("save generated video") || t === "savevideo") {
    return true;
  }

  return false;
}

/**
 * Accurately identifies whether a node is a positive prompt / conditioning node.
 * Strictly excludes negative prompt nodes and title substrings indicating unwanted content.
 */
export function isExactPromptNode(classType: string, title?: string): boolean {
  const ct = (classType || "").trim();
  const t = (title || "").trim().toLowerCase();

  // Never treat negative prompt nodes as positive prompt
  if (t.includes("negative") || t.includes("neg prompt") || t.includes("neg_prompt") || t.includes("unwanted")) {
    return false;
  }

  if (KNOWN_PROMPT_CLASSES.includes(ct)) {
    return true;
  }

  if (t === "prompt" || t.includes("positive prompt") || t.includes("input text (prompt)") || t === "input prompt") {
    return true;
  }

  return false;
}

/**
 * Accurately identifies whether a node is a negative prompt / conditioning node.
 */
export function isExactNegativePromptNode(classType: string, title?: string): boolean {
  const ct = (classType || "").trim();
  const t = (title || "").trim().toLowerCase();

  if (t.includes("negative") || t.includes("neg prompt") || t.includes("neg_prompt") || t.includes("unwanted")) {
    return true;
  }

  if (ct === "CLIPTextEncode" && (t.includes("neg") || t === "negative")) {
    return true;
  }

  return false;
}

