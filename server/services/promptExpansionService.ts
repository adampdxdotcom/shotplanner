import { SCENE_REFERENCE_DIRECTIVE } from "../config/constants";
import { ScenePlanningDTO } from "../types";
import { assembleFinalPrompt, generatePromptPrefix, hasSceneReferencePhoto } from "../utils/formatters";
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

export function buildSubjectDefinitionsHeader(assetList: any[]): string {
  if (!assetList || assetList.length === 0) return "";
  const lines = ["Global Subject Definitions:\n"];

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
  return lines.join("\n") + "\n\n";
}

export async function expandPrompt(options: ExpandPromptOptions): Promise<{ expanded_prompt: string; provider: string }> {
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

  const resolvedPromptPrefix =
    (prompt_prefix || "").trim() ||
    generatePromptPrefix(scene_planning || planning || { scene_name, shot_number, shot_type, camera_movement });

  const definitionsHeader = buildSubjectDefinitionsHeader(assets);
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
  const isSingleSubject = nonLocationAssets.length === 1 || singleSubjectKeywords.test(basic_stub) || singleSubjectKeywords.test(resolvedPromptPrefix);

  const systemPrompt = `Each prompt is isolated, the AI does not know about other scenes. Do not reference other shots in the prompt.

You are an expert AI Screenwriter and Prompt Engineer specializing in advanced multimodal video generation frameworks (specifically MiniMax-H3 / Ref2VA pipelines). Your primary job is to translate creative concepts, character references, and narrative beats into structured, high-precision video generation prompts that strictly adhere to professional prompt-writing guides.

### Your Core Responsibilities:
1. Scene & Shot Planning Header: At the very top (first line) of the prompt, you MUST place the Scene & Shot Planning Header: "${resolvedPromptPrefix || "Shot 01 - Medium Shot - Locked Off"}".
2. Header Subject Definitions: Immediately after the Scene & Shot Planning Header, you MUST include a "Global Subject Definitions:" block defining every selected reference asset (matching its tag, subject, and description).
3. Directives Block: Scene fidelity and on-screen subject count constraints must be followed exactly if provided.
4. Structural Compliance: Ensure every prompt follows the exact required syntax (alignment instructions, shot numbering, timing, and the three mandatory core fields: integrated_multimodal_description, overall_soundscape, and non_diegetic_music).
5. Multimodal Synchronization: Seamlessly integrate visual choreography, camera movements (using precise motion types, amplitudes, and speeds), dialogue tags (<d>), voiceovers, on-screen text, and audio cues along a clear timeline.
6. Cinematic Translation: Convert abstract creative directions into granular, observable physical actions and visual states that an AI video model can accurately interpret without drifting or hallucinations.

### Strict Prompt Constraints:
* Spatial Initialization: The \`integrated_multimodal_description\` MUST always define the subject's exact spatial position and posture at the very beginning of the description (e.g., "At the start of the shot, [Subject] is seated/standing at [position], angled toward [direction]...").
* Tag Granularity (Face vs. Wardrobe): You MUST differentiate between identity and wardrobe tags when referencing pictures. Reference facial likeness tags specifically for expressions/features (e.g., "Featuring facial likeness from <Picture 3>..."). Do NOT accidentally carry over wardrobe from headshot tags if a different outfit is specified in the prompt description.
* Strict Tag Filtering: You MUST NEVER include <Picture N> tags in the description block for characters who are off-screen.

# Mandatory Output Structure

Your output MUST strictly follow this exact format:

${resolvedPromptPrefix ? `${resolvedPromptPrefix}\n\n` : ""}Global Subject Definitions:
[Subject Name] (<Picture N>): [What this asset defines: facial features, physique, wardrobe, or environment setup]
[Subject Name] (<Picture M>): [What this asset defines]
Location(<Picture K>): [Environment and lighting details]

[Any injected directives like Scene Fidelity or Subject Count will be placed here]

[Alignment instruction if applicable: e.g., For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.]

integrated_multimodal_description: [Shot 1] Live-action, cinematic... (incorporating the <Picture N> tags naturally).

overall_soundscape: 1–4 English sentences summarizing ambient sounds, physical actions, and non-verbal human sounds. (Use N/A for absolute silence).

non_diegetic_music: 1–3 English sentences describing background music heard only by the audience. (Use N/A if none).

# Video Prompt Writing Guide Summary (MiniMax-H3)

## 1. Task Architecture & Alignment Instructions
* T2VA (Text-to-Video-Audio): No alignment instruction; starts directly with the three core fields after the definitions block.
* I2VA (Image-to-Video-Audio): Must begin with:
  'For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.'
* FL2VA (First-Last-Frame): Must begin with:
  'How the reference pictures align with the target video — Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; Picture 2 (from Shot N) aligns with the S.SS-second mark of the target video.'
* L2VA (Last-Frame): Must begin with:
  'How the reference pictures align with the target video — <Picture 1> (from [Shot N]) aligns with the S.SS-second mark of the target video.'

## 2. Key Formatting Rules
* Shot Indexing: Do not timestamp [Shot 1]. Subsequent shots must include sequential numbers and increasing cut times (e.g., '[Shot 2] At 00:03.500, the camera cuts to...').
* Camera Motion: Format as natural action using three dimensions: Motion Type + Amplitude + Speed (e.g., 'The camera pushes in with small amplitude at slow speed...').
* Dialogue & Speakers: Assign stable IDs like (S1), (S2). Place dialogue inside <d>[Language] Text here</d>. Voiceovers require 'says in an off-screen voiceover' followed by 'while his/her lips remain completely closed'.
* On-Screen Text: Place visible signs, banners, or subtitles in English double quotation marks preserving original text verbatim (e.g., "Hello").

Unless otherwise noted, specify a neutral background. Output ONLY the completed prompt with the Scene & Shot Header and Global Subject Definitions at the top.`;

  const sceneDirectiveRequirement = isSceneRefPresent
    ? `\n\n### SCENE FIDELITY DIRECTIVE:\nA Scene Reference photo is present. You MUST include this exact sentence on its own separate line in the prompt:\n"${SCENE_REFERENCE_DIRECTIVE}"\n`
    : "";

  const singleSubjectDirective = "There is only one person visible on screen in this shot. All other characters remain strictly off-screen.";
  const singleSubjectRequirement = isSingleSubject
    ? `\n\n### ON-SCREEN SUBJECT COUNT DIRECTIVE:\nThis shot features a single subject. You MUST include this exact sentence on its own separate line in the prompt:\n"${singleSubjectDirective}"\n`
    : "";

  const userMessage = `USER BASIC STUB / CONCEPT:
"${basic_stub}"

${resolvedPromptPrefix ? `### SCENE & SHOT DIRECTION (MUST BE AT TOP OF PROMPT):\n${resolvedPromptPrefix}\n\n` : ""}### SELECTED REFERENCE ASSETS:
${definitionsHeader || "No reference assets provided."}${sceneDirectiveRequirement}${singleSubjectRequirement}

Please expand this basic stub into a structured MiniMax-H3 prompt. Begin with the Scene & Shot Header ("${resolvedPromptPrefix}"), followed by the "Global Subject Definitions:" header defined above, the injected directives if required, alignment instructions (if applicable), integrated_multimodal_description, overall_soundscape, and non_diegetic_music.`;

  let generatedPrompt = "";
  let providerUsed = "Local LM Studio";

  const storedGeminiKey = getStoredGeminiKey();

  // If explicit Gemini provider requested
  if (provider === "gemini") {
    if (!storedGeminiKey) {
      throw new Error("Gemini API key is not configured. Please save your API key in Settings.");
    }
    const fullPrompt = `${systemPrompt}\n\n${userMessage}`;
    const result = await generateWithGeminiAPI(storedGeminiKey, fullPrompt);
    generatedPrompt = result.text;
    providerUsed = `Gemini (${result.modelUsed})`;
  } else {
    // Try calling LM Studio endpoint if provided
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
            { role: "user", content: userMessage }
          ],
          temperature: 0.7,
          max_tokens: 1000
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (lmRes.ok) {
        const data = await lmRes.json();
        generatedPrompt = data.choices?.[0]?.message?.content?.trim() || "";
        providerUsed = "Local LM Studio";
      }
    } catch (e) {
      // LM Studio offline
    }

    // If LM Studio failed and Gemini key exists, fallback to Gemini
    if (!generatedPrompt && storedGeminiKey) {
      try {
        const fullPrompt = `${systemPrompt}\n\n${userMessage}`;
        const result = await generateWithGeminiAPI(storedGeminiKey, fullPrompt);
        generatedPrompt = result.text;
        providerUsed = `Gemini (${result.modelUsed} Fallback)`;
      } catch (geminiErr) {}
    }
  }

  // Dynamic smart expansion fallback if both are offline
  if (!generatedPrompt) {
    const tagsList = assets.map((_: any, i: number) => `<Picture ${i + 1}>`).slice(0, 3).join(" and ");
    generatedPrompt = `${definitionsHeader}integrated_multimodal_description: [Shot 1] Live-action, cinematic 4K sequence capturing ${basic_stub.trim()}. Featuring ${tagsList || "<Picture 1>"} with authentic facial expressions, realistic skin texture, and seamless character identity preservation. The camera pushes in with small amplitude at slow speed.

overall_soundscape: Soft room ambience and atmospheric audio.

non_diegetic_music: N/A`;
    providerUsed = "Smart Offline Generator";
  } else if (definitionsHeader && !generatedPrompt.toLowerCase().includes("global subject definitions")) {
    generatedPrompt = definitionsHeader + generatedPrompt;
  }

  // Ensure strict structural compliance and inject directives
  generatedPrompt = assembleFinalPrompt(generatedPrompt, resolvedPromptPrefix, isSceneRefPresent, isSingleSubject);

  return {
    expanded_prompt: generatedPrompt,
    provider: providerUsed
  };
}
