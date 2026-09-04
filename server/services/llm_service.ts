import { SCENE_REFERENCE_DIRECTIVE } from "../config/constants";
import { ExpandPromptResult, PromptDebugInfo, ScenePlanningDTO, ShotItem } from "../types";
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
  active_shot?: ShotItem;
  scene_name?: string;
  shot_number?: string | number;
  shot_type?: string;
  camera_movement?: string;
  lens_focal_length?: string;
  aspect_ratio?: string;
  ots_anchor_subject?: string;
  ots_focus_subject?: string;
  ots_side?: "Left" | "Right";
  framing_directive?: string;
  // Dynamic template and parameter overrides
  custom_system_prompt?: string;
  temperature?: number;
  max_tokens?: number;
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
export function buildDefaultSystemPrompt(params?: {
  lens?: string;
  aspect_ratio?: string;
  camera_constraint?: string;
}): string {
  const lens = params?.lens || "{{LENS}}";
  const aspect = params?.aspect_ratio || "{{ASPECT_RATIO}}";
  const cameraConstraint = params?.camera_constraint || "{{CAMERA_CONSTRAINT}}";

  return `You are an expert AI Screenwriter and Prompt Engineer specializing in advanced multimodal video generation frameworks (MiniMax-H3 / Ref2VA pipelines).

Your task is to generate ONLY the integrated_multimodal_description content. Do not generate headers, footers, or subject definitions. Use exact asset tags (<Picture N>, <Video N>) provided in the context.

### Strict Output Constraints:
- Spatial Initialization: Always define the subject's exact spatial position and initial posture at the very beginning (e.g., "[Shot 1] Live-action, cinematic... At the start of the shot, [Subject] is positioned at...").
- Exact Tags: Differentiate between facial likeness and styling using the exact tags provided (e.g., "<Picture 1>"). Do NOT invent new tags or reference off-screen characters.
- Cinematography & Optical Rendering: Reflect the visual characteristics of the selected lens (${lens}) and framing (${aspect}) in depth-of-field, perspective compression, and environmental sharpness, while strictly adhering to camera motion constraints.
- Framing Directives: When a Framing Directive is provided in context, utilize the specific anchor and focus subject likenesses provided in the Global Subject Definitions to execute this framing.
- Camera Motion Hard Constraint: ${cameraConstraint}
- Dialogue: If dialogue is present, format as <d>[Language] Dialogue text</d> with speaker tags like (S1).
- No Boilerplate: Output ONLY the narrative visual description. Do NOT output "Global Subject Definitions:", "overall_soundscape:", or "non_diegetic_music:".`;
}

export async function expandPrompt(
  options: ExpandPromptOptions
): Promise<ExpandPromptResult> {
  const startTime = Date.now();
  const {
    basic_stub,
    assets = [],
    lm_studio_url = "http://localhost:1234/v1",
    model,
    provider = "auto",
    prompt_prefix = "",
    scene_planning,
    planning,
    active_shot,
    scene_name,
    shot_number,
    shot_type,
    camera_movement,
    lens_focal_length,
    aspect_ratio,
    ots_anchor_subject,
    ots_focus_subject,
    ots_side,
    framing_directive,
    custom_system_prompt,
    temperature,
    max_tokens
  } = options;

  if (!basic_stub) {
    throw new Error("Basic prompt stub is required");
  }
  if (assets.length === 0) {
    throw new Error("At least one uploaded asset is required to generate a prompt.");
  }

  // 1. Resolve cinematography context
  const effectiveShotType =
    active_shot?.shot_type ||
    scene_planning?.shot_type ||
    planning?.shot_type ||
    shot_type ||
    "";

  const effectiveCameraMovement = (
    active_shot?.camera_movement ||
    camera_movement ||
    scene_planning?.camera_movement ||
    planning?.camera_movement ||
    ""
  ).trim();

  const effectiveLens = (
    active_shot?.lens_focal_length ||
    scene_planning?.lens_focal_length ||
    planning?.lens_focal_length ||
    lens_focal_length ||
    ""
  ).trim();

  const effectiveAspectRatio = (
    active_shot?.aspect_ratio ||
    scene_planning?.aspect_ratio ||
    planning?.aspect_ratio ||
    aspect_ratio ||
    ""
  ).trim();

  // 2. Programmatic Header Construction
  const resolvedPromptPrefix =
    (prompt_prefix || "").trim() ||
    generatePromptPrefix(scene_planning || planning || { 
      scene_name, 
      shot_number, 
      shot_type: effectiveShotType, 
      camera_movement: effectiveCameraMovement,
      lens_focal_length: effectiveLens,
      aspect_ratio: effectiveAspectRatio
    });

  const anchorSubject = (
    active_shot?.ots_anchor_subject ||
    ots_anchor_subject ||
    (scene_planning as any)?.ots_anchor_subject ||
    (planning as any)?.ots_anchor_subject ||
    ""
  ).trim();

  const focusSubject = (
    active_shot?.ots_focus_subject ||
    ots_focus_subject ||
    (scene_planning as any)?.ots_focus_subject ||
    (planning as any)?.ots_focus_subject ||
    ""
  ).trim();

  const sideChoice = (
    active_shot?.ots_side ||
    ots_side ||
    (scene_planning as any)?.ots_side ||
    (planning as any)?.ots_side ||
    ""
  ).trim();

  const isOTS =
    effectiveShotType === "Over-the-shoulder (OTS)" ||
    effectiveShotType === "Over-the-Shoulder (OTS)" ||
    effectiveShotType === "Over-the-Shoulder" ||
    effectiveShotType.toLowerCase().includes("over-the-shoulder") ||
    effectiveShotType.toLowerCase().includes("ots");

  let resolvedFramingDirective = (framing_directive || "").trim();
  if (!resolvedFramingDirective && isOTS && (anchorSubject || focusSubject)) {
    const positionSuffix = (sideChoice === "Left" || sideChoice === "Right") ? ` (positioned on ${sideChoice})` : "";
    if (anchorSubject && focusSubject) {
      resolvedFramingDirective = `Framing: Over-the-shoulder (OTS) angle looking past the shoulder of ${anchorSubject} toward ${focusSubject}${positionSuffix}.`;
    } else if (anchorSubject) {
      resolvedFramingDirective = `Framing: Over-the-shoulder (OTS) angle looking past the shoulder of ${anchorSubject}${positionSuffix}.`;
    } else if (focusSubject) {
      resolvedFramingDirective = `Framing: Over-the-shoulder (OTS) angle looking toward ${focusSubject}${positionSuffix}.`;
    }
  }

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
    !isOTS &&
    (nonLocationAssets.length === 1 ||
      singleSubjectKeywords.test(basic_stub) ||
      singleSubjectKeywords.test(resolvedPromptPrefix));

  const mandatoryHeader = buildMandatoryHeader({
    promptPrefix: resolvedPromptPrefix,
    subjectDefinitions,
    framingDirective: resolvedFramingDirective,
    isSceneRefPresent,
    isSingleSubject
  });

  // 3. Camera Motion & Optics Hard Constraints
  const isStatic =
    effectiveCameraMovement.toLowerCase().includes("locked") ||
    effectiveCameraMovement.toLowerCase().includes("static");

  const cameraConstraintInstruction = effectiveCameraMovement
    ? isStatic
      ? `The camera is strictly LOCKED OFF / STATIC. The camera must remain completely fixed and motionless with ZERO camera motion. You are STRICTLY FORBIDDEN from describing any camera movement (NO push-ins, NO pull-backs, NO zooms, NO pans, NO tilts, and NO tracking).`
      : `The camera movement is strictly "${effectiveCameraMovement}". Describe camera motion naturally matching ONLY this specified movement (Motion Type + Amplitude + Speed). Contradictory camera movements (such as push-ins or zooms when panning, or moving when static) are STRICTLY FORBIDDEN.`
    : `Describe camera motion naturally (Motion Type + Amplitude + Speed, e.g., "The camera pushes in with small amplitude at slow speed...").`;

  // Optics / Lens & Framing Directives
  let lensInstruction = "";
  if (effectiveLens && effectiveLens !== "None") {
    const lLow = effectiveLens.toLowerCase();
    if (lLow.includes("24mm") || lLow.includes("wide")) {
      lensInstruction = `Optics / Lens: ${effectiveLens}. Capture an expansive environmental field of view, deep focus, and sharp contextual background detail with subtle wide-angle perspective depth.`;
    } else if (lLow.includes("35mm") || lLow.includes("natural")) {
      lensInstruction = `Optics / Lens: ${effectiveLens}. Render natural human-eye perspective with balanced depth, grounded composition, and realistic environmental scale.`;
    } else if (lLow.includes("50mm") || lLow.includes("standard")) {
      lensInstruction = `Optics / Lens: ${effectiveLens}. Deliver classic standard prime optics with crisp subject sharpness and natural, smooth depth-of-field falloff.`;
    } else if (lLow.includes("85mm") || lLow.includes("portrait")) {
      lensInstruction = `Optics / Lens: ${effectiveLens}. Emphasize portrait telephoto compression with shallow depth-of-field, prominent subject isolation, and creamy background bokeh.`;
    } else if (lLow.includes("135mm") || lLow.includes("compression")) {
      lensInstruction = `Optics / Lens: ${effectiveLens}. Deliver dramatic telephoto perspective compression, pulling background geometry closer with cinematic optical softness behind the subject.`;
    } else if (lLow.includes("macro") || lLow.includes("close-up")) {
      lensInstruction = `Optics / Lens: ${effectiveLens}. Deliver ultra-shallow focus plane with magnified micro-textures, intricate surface details, and extreme background softness.`;
    } else {
      lensInstruction = `Optics / Lens: ${effectiveLens}. Render authentic depth-of-field and optical perspective consistent with this lens choice.`;
    }
  }

  let aspectInstruction = "";
  if (effectiveAspectRatio && effectiveAspectRatio !== "None") {
    const arLow = effectiveAspectRatio.toLowerCase();
    if (arLow.includes("2.39:1") || arLow.includes("anamorphic") || arLow.includes("scope")) {
      aspectInstruction = `Framing Canvas: ${effectiveAspectRatio}. Compose for cinematic anamorphic ultra-widescreen scope with expansive horizontal blocking.`;
    } else if (arLow.includes("9:16") || arLow.includes("vertical")) {
      aspectInstruction = `Framing Canvas: ${effectiveAspectRatio}. Compose for vertical mobile orientation, framing the subject with deliberate vertical balance and headroom.`;
    } else if (arLow.includes("1:1") || arLow.includes("square")) {
      aspectInstruction = `Framing Canvas: ${effectiveAspectRatio}. Compose with centered geometric balance tailored to a 1:1 square canvas.`;
    } else if (arLow.includes("4:3")) {
      aspectInstruction = `Framing Canvas: ${effectiveAspectRatio}. Compose for classic 4:3 academy framing with tight, focused subject staging.`;
    } else {
      aspectInstruction = `Framing Canvas: ${effectiveAspectRatio}. Maintain clean widescreen framing.`;
    }
  }

  const opticsContextBlock = (lensInstruction || aspectInstruction)
    ? `\nCINEMATOGRAPHY & OPTICS DIRECTIVE:\n${[lensInstruction, aspectInstruction].filter(Boolean).join(" ")}\n`
    : "";

  // 4. Programmatic Footer Construction
  const mandatoryFooter = buildMandatoryFooter();

  // 5. Structured Request to LLM for Integrated Multimodal Description ONLY
  const effectiveTemperature = typeof temperature === "number" ? temperature : 0.7;
  const effectiveMaxTokens = typeof max_tokens === "number" && max_tokens > 0 ? max_tokens : 800;

  let systemPrompt = "";
  if (custom_system_prompt && custom_system_prompt.trim()) {
    systemPrompt = custom_system_prompt.trim()
      .replace(/\{\{LENS\}\}/g, effectiveLens || "standard 50mm")
      .replace(/\{\{ASPECT_RATIO\}\}/g, effectiveAspectRatio || "16:9 widescreen")
      .replace(/\{\{CAMERA_CONSTRAINT\}\}/g, cameraConstraintInstruction);
  } else {
    systemPrompt = buildDefaultSystemPrompt({
      lens: effectiveLens || "standard 50mm",
      aspect_ratio: effectiveAspectRatio || "16:9 widescreen",
      camera_constraint: cameraConstraintInstruction
    });
  }

  const cameraContextBlock = effectiveCameraMovement
    ? `\nCAMERA MOVEMENT DIRECTIVE:\n${isStatic ? "LOCKED OFF (STATIC) - The camera must remain completely stationary. Strictly FORBID any camera push-in, zoom, pan, tilt, or tracking." : `The camera movement is "${effectiveCameraMovement}". Execute ONLY this movement without introducing conflicting motions.`}\n`
    : "";

  const framingContextBlock = resolvedFramingDirective
    ? `\nFRAMING DIRECTIVE:\n${resolvedFramingDirective}\nA Framing Directive is provided; utilize the specific anchor and focus subject likenesses provided in the Global Subject Definitions to execute this framing.\n`
    : "";

  const userPrompt = `CREATIVE CONCEPT / STUB:
"${basic_stub}"

SHOT PLANNING CONTEXT:
${resolvedPromptPrefix || "Shot 01"}
${cameraContextBlock}${opticsContextBlock}${framingContextBlock}
AVAILABLE MULTIMODAL REFERENCE ASSETS:
${subjectDefinitions || "No reference definitions"}

Generate ONLY the integrated_multimodal_description paragraph incorporating the reference tags naturally while strictly adhering to all camera, optics, and framing constraints.`;

  let rawLlmDescription = "";
  let providerUsed = "Local LM Studio";
  let modelUsedActual = model || "local-model";
  const storedGeminiKey = getStoredGeminiKey();

  // Route to requested LLM provider or try local with fallback
  if (provider === "gemini") {
    if (!storedGeminiKey) {
      throw new Error("Gemini API key is not configured. Please save your API key in Settings.");
    }
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
    const result = await generateWithGeminiAPI(storedGeminiKey, fullPrompt);
    rawLlmDescription = result.text;
    modelUsedActual = result.modelUsed;
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
          temperature: effectiveTemperature,
          max_tokens: effectiveMaxTokens
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (lmRes.ok) {
        const data = await lmRes.json();
        rawLlmDescription = data.choices?.[0]?.message?.content?.trim() || "";
        modelUsedActual = data.model || model || "local-model";
        providerUsed = `Local LM Studio (${modelUsedActual})`;
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
        modelUsedActual = result.modelUsed;
        providerUsed = `Gemini (${result.modelUsed} Fallback)`;
      } catch (geminiErr) {}
    }
  }

  // Fallback if both LLM endpoints are unreachable
  if (!rawLlmDescription) {
    const tagsList = assets.map((_: any, i: number) => `<Picture ${i + 1}>`).slice(0, 3).join(" and ");
    const framingStub = resolvedFramingDirective ? `Framed with ${resolvedFramingDirective.replace(/^Framing:\s*/i, "")} ` : "";
    const cameraStub = isStatic
      ? "The camera remains completely locked off and static on a tripod."
      : effectiveCameraMovement
      ? `The camera executes a smooth ${effectiveCameraMovement.toLowerCase()} with subtle amplitude at slow speed.`
      : "The camera pushes in with small amplitude at slow speed.";
    rawLlmDescription = `[Shot 1] Live-action, cinematic 4K sequence capturing ${basic_stub.trim()}. ${framingStub}Featuring ${
      tagsList || "<Picture 1>"
    } with authentic facial expressions, realistic skin texture, and seamless character identity preservation. ${cameraStub}`;
    modelUsedActual = "Deterministic Rules Engine";
    providerUsed = "Smart Offline Generator";
  }

  // Clean raw LLM response (strip any surrounding markdown code ticks if returned)
  let cleanDescription = rawLlmDescription.trim();
  if (cleanDescription.startsWith("```")) {
    cleanDescription = cleanDescription.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim();
  }
  // Strip conversational preambles often outputted by local models
  cleanDescription = cleanDescription
    .replace(/^(?:here(?:'s| is) (?:the )?(?:integrated )?(?:multimodal )?description[^:\n]*:?\s*)/i, "")
    .replace(/^(?:certainly!?|sure!?|here you go:?)\s*/i, "")
    .trim();

  // 4. Assembly Line Concatenation: FinalPrompt = Header + LLM_Description + Footer
  const finalPrompt = assembleFinalPrompt({
    header: mandatoryHeader,
    description: cleanDescription,
    footer: mandatoryFooter
  });

  const latencyMs = Date.now() - startTime;
  const debug: PromptDebugInfo = {
    system_prompt_sent: systemPrompt,
    user_prompt_sent: userPrompt,
    raw_llm_output: rawLlmDescription,
    temperature_used: effectiveTemperature,
    max_tokens_used: effectiveMaxTokens,
    model_used: modelUsedActual,
    provider: providerUsed,
    latency_ms: latencyMs,
    timestamp: new Date().toISOString()
  };

  return {
    expanded_prompt: finalPrompt,
    provider: providerUsed,
    description_only: cleanDescription,
    debug
  };
}
