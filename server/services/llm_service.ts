import { SCENE_REFERENCE_DIRECTIVE } from "../config/constants";
import { ScenePlanningDTO } from "../types";
import {
  assembleFinalPrompt,
  buildMandatoryFooter,
  buildMandatoryHeader,
  generatePromptPrefix,
  hasSceneReferencePhoto
} from "../utils/formatters";
import { generateWithGeminiAPI, getStoredGeminiKey } from "./geminiService";

export interface ExpandPromptOptions {
  basic_stub: string;
  assets?: any[];
  lm_studio_url?: string;
  model?: string;
  provider?: string;
  prompt_prefix?: string;
  scene_planning?: ScenePlanningDTO;
  planning?: ScenePlanningDTO;
  scene_name?: string;
  shot_number?: string | number;
  shot_type?: string;
  camera_movement?: string;
}

/**
 * Programmatically constructs the Global Subject Definitions block.
 */
export function buildSubjectDefinitionsHeader(assetList: any[]): string {
  if (!assetList || assetList.length === 0) return "";
  const lines = ["Global Subject Definitions:"];

  const sorted = [...assetList].sort((a, b) => {
    if (a.media_type !== b.media_type) {
      const order: Record<string, number> = { image: 0, video: 1, audio: 2 };
      return (order[a.media_type] ?? 0) - (order[b.media_type] ?? 0);
    }
    return (a.slot_index ?? 0) - (b.slot_index ?? 0);
  });

  sorted.forEach((a, idx) => {
    const slotNum = a.slot_index !== undefined ? a.slot_index + 1 : idx + 1;
    const tag =
      a.media_type === "video"
        ? `<Video ${slotNum}>`
        : a.media_type === "audio"
        ? `<Audio ${slotNum}>`
        : `<Picture ${slotNum}>`;
    const cat = (a.type || "Reference").toLowerCase();
    const sname = a.subject_name || `Subject ${slotNum}`;
    const desc = (a.description || "Facial features, styling").replace(/\.$/, "");
    if (
      cat.includes("location") ||
      cat.includes("scene") ||
      cat.includes("environment") ||
      sname.toLowerCase().includes("location")
    ) {
      lines.push(`Location(${tag}): ${desc}.`);
    } else {
      lines.push(`${sname} (${tag}): ${desc}.`);
    }
  });
  return lines.join("\n");
}

/**
 * Assembly Line LLM Prompt Expander.
 * Programmatically constructs the Mandatory Header and Mandatory Footer,
 * queries the LLM only for the integrated description body, and stitches them together.
 */
export async function expandPrompt(
  options: ExpandPromptOptions
): Promise<{ expanded_prompt: string; provider: string; description_only?: string }> {
  const {
    basic_stub,
    assets = [],
    lm_studio_url = "http://localhost:1234/v1",
    model,
    provider = "auto",
    prompt_prefix = "",
    scene_planning,
    planning,
    scene_name,
    shot_number,
    shot_type,
    camera_movement
  } = options;

  if (!basic_stub) {
    throw new Error("Basic prompt stub is required");
  }
  if (assets.length === 0) {
    throw new Error("At least one uploaded asset is required to generate a prompt.");
  }

  // 1. Programmatic Header Construction
  const resolvedPromptPrefix =
    (prompt_prefix || "").trim() ||
    generatePromptPrefix(scene_planning || planning || { scene_name, shot_number, shot_type, camera_movement });

  const subjectDefinitions = buildSubjectDefinitionsHeader(assets);
  const isSceneRefPresent = hasSceneReferencePhoto(assets);

  const nonLocationAssets = assets.filter((a) => {
    const cat = (a.type || "Reference").toLowerCase();
    const sname = (a.subject_name || "").toLowerCase();
    return !(
      cat.includes("location") ||
      cat.includes("scene") ||
      cat.includes("environment") ||
      sname.includes("location")
    );
  });

  const singleSubjectKeywords = /\b(alone|solo|by himself|by herself|one person|single person|just one person)\b/i;
  const isSingleSubject =
    nonLocationAssets.length === 1 ||
    singleSubjectKeywords.test(basic_stub) ||
    singleSubjectKeywords.test(resolvedPromptPrefix);

  const mandatoryHeader = buildMandatoryHeader({
    promptPrefix: resolvedPromptPrefix,
    subjectDefinitions,
    isSceneRefPresent,
    isSingleSubject
  });

  // 2. Programmatic Footer Construction
  const mandatoryFooter = buildMandatoryFooter();

  // 3. Structured Request to LLM for Integrated Multimodal Description ONLY
  const systemPrompt = `You are an expert AI Screenwriter and Prompt Engineer specializing in advanced multimodal video generation frameworks (MiniMax-H3 / Ref2VA pipelines).

Your task is to generate ONLY the integrated_multimodal_description content. Do not generate headers, footers, or subject definitions. Use exact asset tags (<Picture N>, <Video N>) provided in the context.

### Strict Output Constraints:
- Spatial Initialization: Always define the subject's exact spatial position and initial posture at the very beginning (e.g., "[Shot 1] Live-action, cinematic... At the start of the shot, [Subject] is positioned at...").
- Exact Tags: Differentiate between facial likeness and styling using the exact tags provided (e.g., "<Picture 1>"). Do NOT invent new tags or reference off-screen characters.
- Camera Motion: Describe camera motion naturally (Motion Type + Amplitude + Speed, e.g., "The camera pushes in with small amplitude at slow speed...").
- Dialogue: If dialogue is present, format as <d>[Language] Dialogue text</d> with speaker tags like (S1).
- No Boilerplate: Output ONLY the narrative visual description. Do NOT output "Global Subject Definitions:", "overall_soundscape:", or "non_diegetic_music:".`;

  const userPrompt = `CREATIVE CONCEPT / STUB:
"${basic_stub}"

SHOT PLANNING CONTEXT:
${resolvedPromptPrefix || "Shot 01"}

AVAILABLE MULTIMODAL REFERENCE ASSETS:
${subjectDefinitions || "No reference definitions"}

Generate ONLY the integrated_multimodal_description paragraph incorporating the reference tags naturally.`;

  let rawLlmDescription = "";
  let providerUsed = "Local LM Studio";
  const storedGeminiKey = getStoredGeminiKey();

  // Route to requested LLM provider or try local with fallback
  if (provider === "gemini") {
    if (!storedGeminiKey) {
      throw new Error("Gemini API key is not configured. Please save your API key in Settings.");
    }
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
    const result = await generateWithGeminiAPI(storedGeminiKey, fullPrompt);
    rawLlmDescription = result.text;
    providerUsed = `Gemini (${result.modelUsed})`;
  } else {
    // Try LM Studio endpoint
    try {
      let endpoint = lm_studio_url.trim().replace(/\/$/, "");
      if (!endpoint.endsWith("/chat/completions")) {
        if (!endpoint.endsWith("/v1")) endpoint = `${endpoint}/v1`;
        endpoint = `${endpoint}/chat/completions`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const lmRes = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: model || "local-model",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 800
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (lmRes.ok) {
        const data = await lmRes.json();
        rawLlmDescription = data.choices?.[0]?.message?.content?.trim() || "";
        providerUsed = "Local LM Studio";
      }
    } catch (e) {
      // Local endpoint offline
    }

    // Fallback to Gemini if LM Studio is unreachable
    if (!rawLlmDescription && storedGeminiKey) {
      try {
        const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
        const result = await generateWithGeminiAPI(storedGeminiKey, fullPrompt);
        rawLlmDescription = result.text;
        providerUsed = `Gemini (${result.modelUsed} Fallback)`;
      } catch (geminiErr) {}
    }
  }

  // Fallback if both LLM endpoints are unreachable
  if (!rawLlmDescription) {
    const tagsList = assets.map((_: any, i: number) => `<Picture ${i + 1}>`).slice(0, 3).join(" and ");
    rawLlmDescription = `[Shot 1] Live-action, cinematic 4K sequence capturing ${basic_stub.trim()}. Featuring ${
      tagsList || "<Picture 1>"
    } with authentic facial expressions, realistic skin texture, and seamless character identity preservation. The camera pushes in with small amplitude at slow speed.`;
    providerUsed = "Smart Offline Generator";
  }

  // Clean raw LLM response (strip any surrounding markdown code ticks if returned)
  let cleanDescription = rawLlmDescription.trim();
  if (cleanDescription.startsWith("```")) {
    cleanDescription = cleanDescription.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim();
  }

  // 4. Assembly Line Concatenation: FinalPrompt = Header + LLM_Description + Footer
  const finalPrompt = assembleFinalPrompt({
    header: mandatoryHeader,
    description: cleanDescription,
    footer: mandatoryFooter
  });

  return {
    expanded_prompt: finalPrompt,
    provider: providerUsed,
    description_only: cleanDescription
  };
}
