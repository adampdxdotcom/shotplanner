import { SceneProjectFile, ShotItem, UniverseCharacterProfile, MediaAsset } from "../types";
import { UniverseService } from "./universeService";
import { assetService } from "./assetService";
import { callLocalLLM } from "./llm_service";
import { generateWithGeminiAPI, getStoredGeminiKey } from "./geminiService";

const universeService = new UniverseService();

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AssistantChatOptions {
  messages: ChatMessage[];
  scene_project?: Partial<SceneProjectFile>;
  active_shot_id?: string;
  active_section?: string;
  lm_studio_url?: string;
  provider?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface AssistantChatResult {
  reply: string;
  model_used: string;
  provider_used: string;
}

/**
 * Formats full project knowledge into a structured dossier for the assistant.
 */
function buildProjectDossier(
  sceneProject?: Partial<SceneProjectFile>,
  activeShotId?: string,
  activeSection?: string
): string {
  const sections: string[] = [];

  // 1. Scene Overview & Planning
  if (sceneProject && sceneProject.scene_name) {
    sections.push(`### ACTIVE SCENE: "${sceneProject.scene_name}"`);
    const sp = sceneProject.scene_planning;
    if (sp) {
      const planDetails = [
        sp.visual_theme ? `Visual Theme: ${sp.visual_theme}` : null,
        sp.environment_description ? `Environment / Location: ${sp.environment_description}` : null,
        sp.lighting_style ? `Lighting Style: ${sp.lighting_style}` : null,
        sp.camera_gear ? `Camera Gear / Notes: ${sp.camera_gear}` : null,
        sp.audio_style ? `Audio Style: ${sp.audio_style}` : null,
        sp.custom_instructions ? `Director Notes: ${sp.custom_instructions}` : null
      ].filter(Boolean).join("\n- ");

      if (planDetails) {
        sections.push(`Scene Planning & World Details:\n- ${planDetails}`);
      }
    }
  } else {
    sections.push(`### ACTIVE SCENE: (No scene currently loaded)`);
  }

  if (activeSection) {
    sections.push(`Current UI Workspace Tab: "${activeSection}"`);
  }

  // 2. Active Shot Highlight
  const shots = sceneProject?.shots || [];
  let activeShot: ShotItem | undefined;
  if (activeShotId) {
    activeShot = shots.find(s => s.id === activeShotId);
  } else if (shots.length > 0) {
    activeShot = shots[0];
  }

  if (activeShot) {
    sections.push(
      `### CURRENTLY SELECTED SHOT (#${activeShot.shot_number}: "${activeShot.shot_name || 'Untitled'}")\n` +
      `- Action / Stub: ${activeShot.basic_stub || '(None)'}\n` +
      `- Framing: ${activeShot.shot_type || 'Medium Shot'}\n` +
      `- Camera Movement: ${activeShot.camera_movement || 'Locked Off'}\n` +
      `- Lens / Focal Length: ${activeShot.lens_focal_length || '50mm Standard Prime'}\n` +
      `- Camera Angle: ${activeShot.camera_angle || 'Eye Level'}\n` +
      (activeShot.dialogue_line ? `- Dialogue: "${activeShot.dialogue_line}"\n` : '') +
      (activeShot.lighting_setup ? `- Lighting: ${activeShot.lighting_setup}\n` : '') +
      (activeShot.expanded_prompt ? `- Prompt: ${activeShot.expanded_prompt}\n` : '')
    );
  }

  // 3. Scene Shots Breakdown
  if (shots.length > 0) {
    const shotsSummary = shots.map(s => {
      const isSelected = s.id === activeShot?.id ? " [CURRENT FOCUS]" : "";
      return `Shot #${s.shot_number} ("${s.shot_name || 'Shot ' + s.shot_number}")${isSelected}: [${s.shot_type || 'Medium'}] [${s.camera_movement || 'Static'}] [${s.lens_focal_length || '50mm'}] - Action: "${s.basic_stub || 'No action specified'}"`;
    }).join("\n");
    sections.push(`### SCENE SHOT LIST (${shots.length} shots total):\n${shotsSummary}`);
  }

  // 4. Scene Characters & Wardrobes
  const sceneChars = sceneProject?.characters || (sceneProject as any)?.scene_characters || [];
  if (Array.isArray(sceneChars) && sceneChars.length > 0) {
    const charSummary = sceneChars.map((c: any) => {
      const name = c.name || c.character_name || "Unknown";
      const notes = c.wardrobe_notes || c.notes || c.visual_traits || "Standard scene attire";
      return `- ${name}: ${notes}`;
    }).join("\n");
    sections.push(`### SCENE CAST & WARDROBE:\n${charSummary}`);
  }

  // 5. Global Universe Characters
  try {
    const universeChars = universeService.getUniverseCharacters();
    const charNames = Object.keys(universeChars);
    if (charNames.length > 0) {
      const universeSummaries = charNames.map(name => {
        const char = universeChars[name] as any;
        const details = [
          char.notes ? `Notes: ${char.notes}` : null,
          char.bio ? `Bio: ${char.bio}` : null,
          char.visual_traits ? `Traits: ${char.visual_traits}` : null,
          char.wardrobe_notes ? `Wardrobe: ${char.wardrobe_notes}` : null,
          char.default_outfit_ref ? `Default Outfit: ${char.default_outfit_ref}` : null
        ].filter(Boolean).join(" | ");
        return `- ${char.name || name}: ${details || 'Registered character'}`;
      }).join("\n");
      sections.push(`### GLOBAL UNIVERSE CHARACTER ROSTER:\n${universeSummaries}`);
    }
  } catch (err) {
    console.warn("[AssistantService] Could not read universe characters:", err);
  }

  // 6. Registered Media Assets / Locations
  try {
    const allAssets: MediaAsset[] = assetService.getAllAssets(sceneProject?.scene_name);
    if (allAssets.length > 0) {
      // Group a concise sample of assets
      const assetList = allAssets.slice(0, 20).map(a => {
        const tag = (a as any).semantic_type || a.type ? `[${(a as any).semantic_type || a.type}]` : "";
        const sub = a.subject_name ? `(${a.subject_name})` : "";
        return `- ${a.filename} ${tag} ${sub}`.trim();
      }).join("\n");
      sections.push(`### MEDIA ASSETS & REFERENCES (Sample):\n${assetList}`);
    }
  } catch (err) {
    console.warn("[AssistantService] Could not read assets:", err);
  }

  return sections.join("\n\n");
}

/**
 * Main service method to process an assistant chat query.
 */
export async function chatWithAssistant(options: AssistantChatOptions): Promise<AssistantChatResult> {
  const {
    messages,
    scene_project,
    active_shot_id,
    active_section,
    lm_studio_url,
    provider,
    model,
    temperature = 0.5,
    max_tokens = 1000
  } = options;

  if (!messages || messages.length === 0) {
    throw new Error("Chat messages are required.");
  }

  const projectDossier = buildProjectDossier(scene_project, active_shot_id, active_section);

  const systemPrompt = `You are the Production Assistant & Script Supervisor for "Shot Planner" — an AI-assisted virtual filmmaking and video production studio.

YOUR ROLE & CAPABILITIES:
1. SCRIPT SUPERVISOR: You track scene continuity, character presence, wardrobe consistency, dialogue delivery, and shot sequencing.
2. ASSISTANT DIRECTOR: You propose shot framing, camera movements, lenses, and lighting suited to the visual style and dramatic pacing of the scene.
3. STORY & CHARACTER EXPERT: You answer questions about character backgrounds, motivations, visual traits, and universe lore using the provided project dossier.
4. PROMPT POLISHER: You help turn rough shot action stubs into vivid, cinematic descriptions for AI video/image generators (Flux, Minimax, ComfyUI).

PROJECT DOSSIER:
The following is live project data reflecting the current state of the film project:
=========================================
${projectDossier}
=========================================

BEHAVIOR GUIDELINES:
- Be concise, cinematic, and directly helpful.
- When referencing characters, shots, or camera settings, ground your answers in the Project Dossier above.
- If asked for shot recommendations, provide specific cinematography parameters: Shot Type / Framing, Camera Movement, Lens Focal Length, and a brief description of the action.
- Use clean formatting (bullet points, bold labels) for readability.
- If the user asks something outside the known project data, politely acknowledge what is known and offer creative suggestions that match the established tone.`;

  let reply = "";
  let modelUsed = model || "local-model";
  let providerUsed = "Local LM Studio";

  if (provider === "gemini") {
    const storedGeminiKey = getStoredGeminiKey();
    if (!storedGeminiKey) {
      throw new Error("Google Gemini API key is not configured. Please save your API key in Settings.");
    }
    // Assemble conversational history for Gemini
    const conversationHistory = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
    const fullPrompt = `${systemPrompt}\n\nCONVERSATION HISTORY:\n${conversationHistory}\n\nASSISTANT:`;
    const result = await generateWithGeminiAPI(storedGeminiKey, fullPrompt);
    reply = result.text;
    modelUsed = result.modelUsed;
    providerUsed = `Gemini (${result.modelUsed})`;
  } else {
    // Format messages for OpenAI-compatible Local LLM endpoint
    const llmMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages.map(m => ({
        role: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
        content: m.content
      }))
    ];

    const localRes = await callLocalLLM({
      url: lm_studio_url,
      model: model || "local-model",
      messages: llmMessages,
      temperature,
      max_tokens,
      timeoutMs: 60000
    });

    reply = localRes.content;
    modelUsed = localRes.model || model || "local-model";
    providerUsed = `Local LM Studio (${modelUsed})`;
  }

  if (!reply || !reply.trim()) {
    throw new Error("The assistant service returned an empty response. Please check your LLM configuration.");
  }

  return {
    reply: reply.trim(),
    model_used: modelUsed,
    provider_used: providerUsed
  };
}
