import { callLocalLLM } from "./llm_service";
import { generateWithGeminiAPI, getStoredGeminiKey } from "./geminiService";

export interface ParsedSceneSketchShot {
  shot_number: number;
  shot_name: string;
  basic_stub: string;
  detected_characters: string[];
  shot_type: string;
  camera_movement: string;
  lens_focal_length: string;
  lighting?: string;
  aspect_ratio?: string;
}

export interface ParseSceneSketchResult {
  scene_title: string;
  shots: ParsedSceneSketchShot[];
  raw_llm_output?: string;
  model_used: string;
  provider_used: string;
}

export interface ParseSceneSketchOptions {
  sketch_text: string;
  lm_studio_url?: string;
  model?: string;
  provider?: string;
  temperature?: number;
  max_tokens?: number;
}

const ALLOWED_SHOT_TYPES = [
  "Extreme Wide Shot",
  "Wide Shot",
  "Medium Wide Shot",
  "Medium Shot",
  "Medium Close-Up",
  "Close-Up",
  "Extreme Close-Up",
  "Over-the-shoulder (OTS)",
  "Low Angle",
  "High Angle",
  "Bird's Eye View"
];

const ALLOWED_CAMERA_MOVEMENTS = [
  "Locked Off",
  "Slow Push In",
  "Pull Out",
  "Pan Left",
  "Pan Right",
  "Tilt Up",
  "Tilt Down",
  "Tracking Shot",
  "Handheld Drift",
  "Orbit Shot",
  "Zoom In",
  "Zoom Out"
];

const ALLOWED_LENS_PRESETS = [
  "24mm Wide-Angle",
  "35mm Natural",
  "50mm Standard Prime",
  "85mm Portrait Telephoto",
  "135mm Cinematic Compression",
  "Macro / Close-Up"
];

/**
 * Builds the strict structural scene breakdown prompt for the local LLM.
 */
export function buildSceneSketchPrompt(sketchText: string): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `You are an expert film director and cinematography scene breakdown assistant.
Your task is to take raw, freeform scene sketch text or script beats and parse it into an array of sequential visual shots.

CRITICAL RULES:
1. FAITHFUL EXTRACTION ONLY: Do NOT write flowery creative prose or expand prompts. Extract the user's action/beat faithfully into "basic_stub". Keep the user's original words, dialogue, and specific staging intact.
2. CINEMATOGRAPHY SELECTION: For each shot, select the most appropriate option from the canonical allowed lists below:
   - Allowed shot_type: ${JSON.stringify(ALLOWED_SHOT_TYPES)}
   - Allowed camera_movement: ${JSON.stringify(ALLOWED_CAMERA_MOVEMENTS)}
   - Allowed lens_focal_length: ${JSON.stringify(ALLOWED_LENS_PRESETS)}
3. ENTITY & CHARACTER EXTRACTION: In "detected_characters", list all proper names of characters, people, or distinct named entities mentioned in that shot (e.g. ["Marcus", "Elena"]). Do NOT guess IDs or traits. If no named character is mentioned, return an empty array [].
4. SHOT NAMES: Provide a concise 2-4 word descriptor in "shot_name" (e.g. "Hallway Standoff", "Reactor Close-up", "Elena Enters").
5. OUTPUT FORMAT: Output ONLY valid JSON matching the exact JSON schema provided below. Do not wrap in markdown quotes if possible, and output no commentary before or after.`;

  const userPrompt = `Break down the following scene sketch text into sequential shots according to the schema.

JSON SCHEMA:
{
  "scene_title": "Short title of the scene if detected, otherwise empty string",
  "shots": [
    {
      "shot_number": 1,
      "shot_name": "Short 2-4 word descriptor",
      "basic_stub": "Exact user action or visual beat for this shot.",
      "detected_characters": ["Name1", "Name2"],
      "shot_type": "Medium Close-Up",
      "camera_movement": "Slow Push In",
      "lens_focal_length": "50mm Standard Prime"
    }
  ]
}

SCENE SKETCH TEXT TO PARSE:
"""
${sketchText.trim()}
"""`;

  return { systemPrompt, userPrompt };
}

/**
 * Helper to clean and parse JSON from LLM outputs that might contain markdown blocks or leading/trailing text.
 */
function extractJsonFromText(rawText: string): any {
  let text = (rawText || "").trim();

  // Strip markdown code fences if present
  if (text.includes("```")) {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (match && match[1]) {
      text = match[1].trim();
    } else {
      text = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim();
    }
  }

  // Attempt direct parse
  try {
    return JSON.parse(text);
  } catch (_err) {
    // Look for outermost JSON brackets if surrounded by conversational text
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const jsonSubstring = text.substring(firstBrace, lastBrace + 1);
      return JSON.parse(jsonSubstring);
    }
    throw new Error("Failed to parse structured JSON from LLM output");
  }
}

/**
 * Normalizes values to match canonical presets or fallback gracefully.
 */
function normalizeShot(rawShot: any, index: number): ParsedSceneSketchShot {
  const shot_number = typeof rawShot.shot_number === "number" && rawShot.shot_number > 0
    ? rawShot.shot_number
    : index + 1;

  const shot_name = (rawShot.shot_name || rawShot.name || rawShot.title || `Shot ${shot_number}`).trim();
  const basic_stub = (rawShot.basic_stub || rawShot.stub || rawShot.description || rawShot.text || "").trim();

  // Clean characters array
  let detected_characters: string[] = [];
  if (Array.isArray(rawShot.detected_characters)) {
    detected_characters = rawShot.detected_characters
      .map((c: any) => String(c).trim())
      .filter((c: string) => c.length > 0 && !c.toLowerCase().includes("unnamed"));
  } else if (Array.isArray(rawShot.characters)) {
    detected_characters = rawShot.characters
      .map((c: any) => String(c).trim())
      .filter((c: string) => c.length > 0);
  }

  // Normalize shot_type
  let shot_type = rawShot.shot_type || rawShot.framing || "Medium Shot";
  const matchedType = ALLOWED_SHOT_TYPES.find(st => st.toLowerCase() === shot_type.toLowerCase());
  if (matchedType) {
    shot_type = matchedType;
  }

  // Normalize camera_movement
  let camera_movement = rawShot.camera_movement || rawShot.camera || "Locked Off";
  const matchedMove = ALLOWED_CAMERA_MOVEMENTS.find(cm => cm.toLowerCase() === camera_movement.toLowerCase() || camera_movement.toLowerCase().includes(cm.toLowerCase()));
  if (matchedMove) {
    camera_movement = matchedMove;
  }

  // Normalize lens_focal_length
  let lens_focal_length = rawShot.lens_focal_length || rawShot.lens || "50mm Standard Prime";
  const matchedLens = ALLOWED_LENS_PRESETS.find(lp => lp.toLowerCase().includes(lens_focal_length.toLowerCase()) || lens_focal_length.toLowerCase().includes(lp.toLowerCase().split(" ")[0]));
  if (matchedLens) {
    lens_focal_length = matchedLens;
  }

  return {
    shot_number,
    shot_name,
    basic_stub,
    detected_characters,
    shot_type,
    camera_movement,
    lens_focal_length
  };
}

/**
 * Main service function to parse scene sketch text into structured shots using Local LLM (or Gemini).
 */
export async function parseSceneSketch(options: ParseSceneSketchOptions): Promise<ParseSceneSketchResult> {
  const { sketch_text, lm_studio_url, model, provider, temperature, max_tokens } = options;

  if (!sketch_text || !sketch_text.trim()) {
    throw new Error("Scene sketch text is required.");
  }

  const { systemPrompt, userPrompt } = buildSceneSketchPrompt(sketch_text);
  const effectiveTemp = typeof temperature === "number" ? temperature : 0.2; // Low temperature for deterministic structuring
  const effectiveMaxTokens = typeof max_tokens === "number" ? max_tokens : 2048;

  let rawLlmOutput = "";
  let modelUsed = model || "local-model";
  let providerUsed = "Local LM Studio";

  if (provider === "gemini") {
    const storedGeminiKey = getStoredGeminiKey();
    if (!storedGeminiKey) {
      throw new Error("Google Gemini API key is not configured. Please save your API key in Settings.");
    }
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
    const result = await generateWithGeminiAPI(storedGeminiKey, fullPrompt);
    rawLlmOutput = result.text;
    modelUsed = result.modelUsed;
    providerUsed = `Gemini (${result.modelUsed})`;
  } else {
    const localRes = await callLocalLLM({
      url: lm_studio_url,
      model: model || "local-model",
      systemPrompt,
      userPrompt,
      temperature: effectiveTemp,
      max_tokens: effectiveMaxTokens,
      timeoutMs: 90000
    });
    rawLlmOutput = localRes.content;
    modelUsed = localRes.model || model || "local-model";
    providerUsed = `Local LM Studio (${modelUsed})`;
  }

  if (!rawLlmOutput || !rawLlmOutput.trim()) {
    throw new Error("LLM service returned an empty response during scene sketch parsing.");
  }

  const parsedJson = extractJsonFromText(rawLlmOutput);
  const scene_title = typeof parsedJson.scene_title === "string" ? parsedJson.scene_title.trim() : "";

  let rawShots = Array.isArray(parsedJson.shots)
    ? parsedJson.shots
    : Array.isArray(parsedJson)
    ? parsedJson
    : [];

  if (rawShots.length === 0 && parsedJson.basic_stub) {
    rawShots = [parsedJson];
  }

  const normalizedShots: ParsedSceneSketchShot[] = rawShots.map((shot: any, index: number) =>
    normalizeShot(shot, index)
  );

  return {
    scene_title,
    shots: normalizedShots,
    raw_llm_output: rawLlmOutput,
    model_used: modelUsed,
    provider_used: providerUsed
  };
}
