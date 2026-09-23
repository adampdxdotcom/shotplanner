import fs from "fs";
import path from "path";
import { SceneProjectFile, ShotItem, UniverseCharacterProfile, MediaAsset } from "../types";
import { UniverseService } from "./universeService";
import { assetService } from "./assetService";
import { getImageBase64ForVision } from "./thumbnailService";
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
  attached_asset_filename?: string;
  attached_asset?: {
    id?: string;
    filename: string;
    subject_name?: string;
    type?: string;
  };
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
      if (sp.overarching_goal) {
        sections.push(`OVERARCHING SCENE GOAL & NARRATIVE OBJECTIVE:\n"${sp.overarching_goal}"`);
      }
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
    const gen = activeShot.generation_params;
    const genDetails = gen
      ? `Sampling: ${gen.steps ?? 30} steps | Resolution: ${gen.megapixels ?? 0.5} MP | Duration: ${gen.frames ?? 3.4}s`
      : 'Sampling: 30 steps | Resolution: 0.5 MP | Duration: 3.4s (defaults)';

    sections.push(
      `### CURRENTLY SELECTED SHOT (#${activeShot.shot_number}: "${activeShot.shot_name || 'Untitled'}")\n` +
      `- Action / Stub: ${activeShot.basic_stub || '(None)'}\n` +
      `- Framing: ${activeShot.shot_type || 'Medium Shot'}\n` +
      `- Camera Movement: ${activeShot.camera_movement || 'Locked Off'}\n` +
      `- Lens / Focal Length: ${activeShot.lens_focal_length || '50mm Standard Prime'}\n` +
      `- Camera Angle: ${activeShot.camera_angle || 'Eye Level'}\n` +
      `- Workflow Generation Settings: ${genDetails}\n` +
      (activeShot.dialogue_line ? `- Dialogue: "${activeShot.dialogue_line}"\n` : '') +
      (activeShot.lighting_setup ? `- Lighting: ${activeShot.lighting_setup}\n` : '') +
      (activeShot.expanded_prompt ? `- Prompt: ${activeShot.expanded_prompt}\n` : '')
    );
  }

  // 3. Scene Shots Breakdown
  if (shots.length > 0) {
    const shotsSummary = shots.map(s => {
      const isSelected = s.id === activeShot?.id ? " [CURRENT FOCUS]" : "";
      const g = s.generation_params;
      const gStr = g ? ` [Workflow: ${g.steps ?? 30}st/${g.megapixels ?? 0.5}MP/${g.frames ?? 3.4}s]` : "";
      return `Shot #${s.shot_number} ("${s.shot_name || 'Shot ' + s.shot_number}")${isSelected}: [${s.shot_type || 'Medium'}] [${s.camera_movement || 'Static'}] [${s.lens_focal_length || '50mm'}]${gStr} - Action: "${s.basic_stub || 'No action specified'}"`;
    }).join("\n");
    sections.push(`### SCENE SHOT LIST (${shots.length} shots total):\n${shotsSummary}`);
  }

  // 4. Scene Characters & Wardrobes
  const sceneCharsRaw = sceneProject?.characters || (sceneProject as any)?.scene_characters;
  let charList: any[] = [];
  if (Array.isArray(sceneCharsRaw)) {
    charList = sceneCharsRaw;
  } else if (sceneCharsRaw && typeof sceneCharsRaw === "object") {
    charList = Object.keys(sceneCharsRaw).map(k => ({
      name: k,
      ...sceneCharsRaw[k]
    }));
  }

  if (charList.length > 0) {
    const charSummary = charList.map((c: any) => {
      const name = c.name || c.character_name || "Unknown";
      const outfit = c.scene_outfit_ref ? `Outfit: ${c.scene_outfit_ref}` : null;
      const notes = c.notes || c.wardrobe_notes || c.visual_traits || null;
      const quickSlots: string[] = Array.isArray(c.quick_slots) ? c.quick_slots.filter(Boolean) : [];
      const quickCount = quickSlots.length;
      const refStatus = quickCount > 0 
        ? `${quickCount}/4 Cast Card reference photos configured ([${quickSlots.join(", ")}]) - Ready to be staged to shot slots 0-${quickCount - 1}` 
        : "NO reference photos in Cast Card slots 1-4 (EMPTY - Needs reference photos assigned or uploaded in Cast/Character Hub)";
      const details = [outfit, notes ? `Notes: ${notes}` : null, `Cast Photos: ${refStatus}`].filter(Boolean).join(" | ");
      return `- ${name}: ${details || "Standard scene attire"}`;
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

  // 6. Registered Media Assets / Locations & Cached Visual Intelligence
  try {
    const allAssets: MediaAsset[] = assetService.getAllAssets(sceneProject?.scene_name);
    const visualCache = sceneProject?.visual_analysis_cache || {};

    if (allAssets.length > 0) {
      // Group a concise sample of assets with any cached visual scan notes
      const assetList = allAssets.slice(0, 25).map(a => {
        const tag = (a as any).semantic_type || a.type ? `[${(a as any).semantic_type || a.type}]` : "";
        const sub = a.subject_name ? `(${a.subject_name})` : "";
        const cached = visualCache[a.filename];
        let visualNote = "";
        if (cached) {
          const parts: string[] = [];
          if (cached.summary) parts.push(`Summary: "${cached.summary}"`);
          if (cached.lighting?.key_direction || cached.lighting?.quality) {
            parts.push(`Lighting: ${[cached.lighting.quality, cached.lighting.key_direction].filter(Boolean).join(", ")}`);
          }
          if (cached.wardrobe?.garments || cached.wardrobe?.colors) {
            parts.push(`Wardrobe: ${[cached.wardrobe.colors, cached.wardrobe.garments].filter(Boolean).join(" ")}`);
          }
          if (cached.cinematography?.framing || cached.cinematography?.lens_feel) {
            parts.push(`Camera: ${[cached.cinematography.framing, cached.cinematography.lens_feel].filter(Boolean).join(" / ")}`);
          }
          visualNote = ` -> [SCANNED VISUAL KNOWLEDGE: ${parts.join(" | ")}]`;
        }
        return `- ${a.filename} ${tag} ${sub}${visualNote}`.trim();
      }).join("\n");
      sections.push(`### MEDIA ASSETS & REFERENCES (Sample):\n${assetList}`);
    }

    // Explicitly highlight any additional cached visual analyses if not already listed
    const cachedEntries = Object.entries(visualCache);
    if (cachedEntries.length > 0) {
      const visualSummary = cachedEntries.map(([fn, v]) => {
        const lightInfo = v.lighting ? `Lighting: ${v.lighting.quality || ''} ${v.lighting.color_temperature || ''}` : '';
        const wardrobeInfo = v.wardrobe ? `Wardrobe: ${v.wardrobe.garments || ''} (${v.wardrobe.colors || ''})` : '';
        const domColors = Array.isArray(v.environment_palette?.dominant_colors)
          ? v.environment_palette.dominant_colors.join(", ")
          : v.environment_palette?.dominant_colors || "";
        const envInfo = v.environment_palette ? `Palette/Mood: ${v.environment_palette.mood || ''} [${domColors}]` : '';
        const details = [v.summary, lightInfo, wardrobeInfo, envInfo].filter(Boolean).join(" | ");
        return `- ${fn}: ${details}`;
      }).join("\n");
      sections.push(`### SCANNED VISUAL INTELLIGENCE REGISTRY (Pre-analyzed project images):\n${visualSummary}`);
    }
  } catch (err) {
    console.warn("[AssistantService] Could not read assets:", err);
  }

  return sections.join("\n\n");
}

/**
 * Trims conversation messages to a rolling window (default 16 turns) to protect LLM context limits.
 */
function getRollingChatWindow<T extends { role: string; content: string }>(
  messages: T[],
  maxTurns = 16
): T[] {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [];
  }
  if (messages.length <= maxTurns) {
    return [...messages];
  }
  return messages.slice(-maxTurns);
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
    max_tokens = 1000,
    attached_asset_filename,
    attached_asset
  } = options;

  if (!messages || messages.length === 0) {
    throw new Error("Chat messages are required.");
  }

  // Load image asset file for multimodal vision pipeline if requested (scaled to 384px for token efficiency)
  let imagePayload: { mimeType: string; base64Data: string; filename: string } | null = null;
  const targetFilename = attached_asset_filename || attached_asset?.filename;

  if (targetFilename) {
    const filePath = assetService.getAssetFilePath(targetFilename);
    if (filePath && fs.existsSync(filePath)) {
      try {
        const visionDataUri = await getImageBase64ForVision(filePath, 384);
        const parts = visionDataUri.split(",");
        const mimeMatch = visionDataUri.match(/^data:(image\/[a-zA-Z+]+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
        const base64Data = parts[1] || "";

        imagePayload = {
          mimeType,
          base64Data,
          filename: targetFilename
        };
        console.log(`[Assistant Vision Pipeline] Loaded scaled 384px image asset '${targetFilename}' (${mimeType})`);
      } catch (e: any) {
        console.warn(`[Assistant Vision Pipeline] Failed to process asset file '${targetFilename}' for vision:`, e?.message || e);
      }
    } else {
      console.warn(`[Assistant Vision Pipeline] Asset file '${targetFilename}' not found on disk.`);
    }
  }

  // Rolling window of recent conversation turns to keep LLM context limits safe
  const windowedMessages = getRollingChatWindow(messages, 16);

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

PROMPT STUBS, EXPANSIONS & PROMPT VARIATIONS:
- You have full visibility into every shot's current \`basic_stub\` and \`expanded_prompt\` in the Project Dossier.
- Prompt Variations System: Each shot supports multiple prompt variations (e.g. Variation 1, Variation 2).
- When a user asks you to expand a shot prompt (e.g., "Expand shot 1", "Expand the prompt for shot #2") or when you recommend expanding a shot:
  1. Always present the current shot's \`basic_stub\` clearly in your response so the user sees the exact starting concept.
  2. Ask the user if they would like to make any adjustments, tweaks, or additions to the stub, or if they would like to proceed with the current stub.
  3. Provide an \`expand_shot_prompt\` action card (with the shot's current stub or adjusted stub in \`guidance\`) so the user can immediately trigger the expansion with one click if they are ready.
  4. Always explain to the user that running the prompt expansion will automatically save the result as a new Prompt Variation tab in the shot's Prompt Builder, preserving their previous variations for comparison.
- If the user asks you to modify the stub first and then expand (e.g., "Add rain and expand Shot 1"), present the revised stub, ask for confirmation, and provide the \`expand_shot_prompt\` card with the revised stub in \`guidance\`.

WORKFLOW GENERATION PARAMETERS (Sampling Steps, Megapixels, Total Seconds):
- Every shot maintains its own independent generation parameters on the Workflow tab:
  - \`steps\` (Sampling Steps: integer, e.g. 20 to 60, default 30)
  - \`megapixels\` (Resolution: number, e.g. 0.5, 1.0, 1.5 MP, default 0.5)
  - \`frames\` (Total Duration in Seconds: number, e.g. 3.4, 5.0, 6.7 seconds, default 3.4)
- When the user asks to adjust render sampling, quality/steps, resolution/megapixels, or duration/total seconds for a shot (e.g. "Set shot 1 to 40 steps and 5 seconds" or "Increase resolution to 1.0 MP and sampling to 35 on shot 2"), include \`generation_params\` in \`update_shot\` (or \`add_shot\`).
- Modifying generation parameters is strictly per-shot and will only affect the specified shot.

BEHAVIOR GUIDELINES:
- Be concise, cinematic, and directly helpful.
- When referencing characters, shots, or camera settings, ground your answers in the Project Dossier above.
- Overarching Scene Goal: If an Overarching Scene Goal is provided in the Project Dossier, use it as your creative north star. When the user asks for advice, critique, pacing feedback, or next-shot ideas, evaluate how each shot serves this overarching goal of the sequence, ensuring dramatic progression and visual cohesion.
- Conversational Memory & Continuity: You have access to recent conversation history for this scene. Actively reference earlier decisions, shot critiques, alternative camera angles, wardrobe changes, and creative ideas discussed throughout this scene when answering questions or refining shots.
- Reference Photos & Cast Card Staging Awareness:
  1. Prompt expansion relies on reference photos (<Picture 1>, <Picture 2>, etc.). When you propose an \`update_shot\` or \`add_shot\` featuring a character, the system will automatically bundle and stage that character's up-to-4 Cast Card reference photos into the shot's image slots (Slots 0–3).
  2. If a character featured in a proposed shot HAS reference photos in their Cast Card slots 1–4, acknowledge that their reference photos will be staged to the shot.
  3. If a character featured in a proposed shot has NO reference photos in slots 1–4 (empty Cast Card), explicitly alert the user: "Note: [Character] does not have reference photos on their Cast Card yet. You can assign or upload reference photos in the Cast Card or Character Hub to enable reference-guided prompt expansion."
- If asked for shot recommendations, provide specific cinematography parameters: Shot Type / Framing, Camera Movement, Lens Focal Length, and a brief description of the action.
- Use standard camera movements: "Locked Off", "Slow Push In", "Pull Out", "Pan Left", "Pan Right", "Tilt Up", "Tilt Down", "Tracking Shot", "Crane / Jib Shot", "Handheld Organic".
- Never output sections or headings titled "Suggested Directives" or output generic prompt directive blocks; keep all suggestions grounded in concrete cinematography parameters and structured action blocks.
- Use clean formatting (bullet points, bold labels) for readability.
- If the user asks something outside the known project data, politely acknowledge what is known and offer creative suggestions that match the established tone.

PROPOSING ACTIONS & MUTATIONS:
When you recommend changing scene planning, character profiles/wardrobe, existing shots, adding new shots, or when the user asks you to modify the project, you MUST append a structured action JSON block using triple backticks (\`\`\`action ... \`\`\`) at the very end of your response so the user can review and apply each change with one click (or apply all at once).

Single or Multi-Action Array:
You can output either a single JSON action object OR a JSON array of multiple coordinated actions (e.g. creating/updating a character and updating Shot #4 to include them).

Action formats:

1. Update Scene Planning:
\`\`\`action
{
  "type": "update_scene_planning",
  "title": "Establish Neo-Noir Rain Atmosphere",
  "changes": {
    "overarching_goal": "Elena tracks down the rogue courier in the alley, escalating from stealth surveillance to a tense confrontation.",
    "visual_theme": "Cyberpunk Neo-Noir, High Contrast Chiaroscuro",
    "environment_description": "Rain-slicked alleyway in Sector 4 with flickering holographic ads",
    "lighting_style": "Deep cyan ambient with warm neon amber highlights",
    "camera_gear": "ARRI Alexa Mini LF with Cooke Anamorphic /i Full Frame Plus",
    "audio_style": "Low industrial synth drone and persistent rhythmic rainfall",
    "custom_instructions": "Focus on reflections in puddles and subtle lens flares"
  }
}
\`\`\`

2. Update Character Profile & Wardrobe:
\`\`\`action
{
  "type": "update_character",
  "character_name": "Elena",
  "title": "Equip tactical cyberdeck and weatherworn trenchcoat",
  "changes": {
    "scene_outfit_ref": "Distressed graphite trenchcoat with glowing cyan collar embroidery and combat boots",
    "notes": "Hardened freelance netrunner with visible titanium neural port at right temple"
  }
}
\`\`\`

3. Update Shot:
\`\`\`action
{
  "type": "update_shot",
  "shot_number": 1,
  "title": "Switch to intimate portrait lens with slow push-in",
  "changes": {
    "shot_type": "Close-Up (CU)",
    "lens_focal_length": "85mm Portrait Telephoto",
    "camera_movement": "Slow Push In",
    "lighting_setup": "Moody side rim light with deep shadows",
    "characters": ["Elena"],
    "basic_stub": "Elena gazes through the rain-streaked window as neon reflects across her titanium neural port.",
    "generation_params": {
      "steps": 35,
      "megapixels": 1.0,
      "frames": 4.5
    }
  }
}
\`\`\`

4. Add Shot:
\`\`\`action
{
  "type": "add_shot",
  "title": "Establish Elena in the rain with wide anamorphic sweep",
  "shot": {
    "shot_name": "Wide establishing angle",
    "characters": ["Elena"],
    "shot_type": "Extreme Wide Shot (EWS)",
    "lens_focal_length": "24mm Wide-Angle",
    "camera_movement": "Pan Left",
    "aspect_ratio": "16:9 Widescreen",
    "basic_stub": "Wide shot across the neon rain-soaked alley as steam rises from subway vents and Elena walks into frame.",
    "generation_params": {
      "steps": 30,
      "megapixels": 0.5,
      "frames": 3.4
    }
  }
}
\`\`\`

5. Remote ComfyUI Staging:
\`\`\`action
{
  "type": "stage_shot_assets",
  "shot_number": 3,
  "title": "Stage Shot #3 assets to remote ComfyUI host",
  "destination_path": "/workspace/ComfyUI/input/scene_01"
}
\`\`\`

6. Prompt Expansion Dispatcher:
\`\`\`action
{
  "type": "expand_shot_prompt",
  "shot_number": 2,
  "title": "Dispatch LLM prompt expansion for Shot #2",
  "guidance": "Synthesize anamorphic bokeh, rim lighting, and atmospheric rain droplets"
}
\`\`\`

7. Save Visual Analysis (Image Inspection):
When an image asset is inspected or attached for visual analysis, you MUST include a \`save_visual_analysis\` action so the visual breakdown is automatically cached into the project file for future turns:
\`\`\`action
{
  "type": "save_visual_analysis",
  "filename": "character_headshot.png",
  "title": "Cache visual analysis for character_headshot.png",
  "analysis": {
    "summary": "Close-up portrait of a mid-30s woman with dark hair and sharp jawline under warm directional lighting.",
    "subject": {
      "identified_name": "Elena",
      "apparent_age": "Mid-30s",
      "expression": "Focused, serious",
      "hair": "Dark brown pulled back",
      "features": "High cheekbones, sharp jawline, light eye color"
    },
    "wardrobe": {
      "garments": "Dark graphite high-collar jacket",
      "colors": "Charcoal gray, matte black",
      "era_style": "Near-future tactical",
      "accessories": "Subtle silver ear stud"
    },
    "lighting": {
      "key_direction": "Key light from camera left at 45 degrees",
      "quality": "Diffused soft light with subtle fill",
      "color_temperature": "Warm tungsten (~3200K)",
      "contrast_ratio": "Medium contrast"
    },
    "cinematography": {
      "framing": "Close-Up (CU)",
      "lens_feel": "85mm Portrait lens with smooth background bokeh",
      "depth_of_field": "Shallow depth of field",
      "camera_angle": "Eye Level"
    },
    "environment_palette": {
      "setting": "Studio backdrop with subtle warm gradient",
      "dominant_colors": ["#2A2A2A", "#8B5A2B", "#1A1A1A"],
      "mood": "Intimate, cinematic portraiture"
    }
  }
}
\`\`\`

8. Multi-Action Coordinated Batch (Array format):
\`\`\`action
[
  {
    "type": "update_character",
    "character_name": "Marcus",
    "title": "Update tactical field operative attire",
    "changes": {
      "scene_outfit_ref": "Matte black tactical flak jacket with radio harness"
    }
  },
  {
    "type": "update_shot",
    "shot_number": 2,
    "title": "Frame Marcus stepping into the alley",
    "changes": {
      "basic_stub": "Marcus steps into the dim alleyway, radio harness catching the flickers of amber neon.",
      "shot_type": "Medium Shot (MS)"
    }
  },
  {
    "type": "stage_shot_assets",
    "shot_number": 2,
    "title": "Stage Shot #2 assets to remote ComfyUI"
  }
]
\`\`\`
Only include fields that are changing or relevant. Always keep your conversational explanation before the code block.`;

  let reply = "";
  let modelUsed = model || "local-model";
  let providerUsed = "Local LM Studio";

  if (provider === "gemini") {
    const storedGeminiKey = getStoredGeminiKey();
    if (!storedGeminiKey) {
      throw new Error("Google Gemini API key is not configured. Please save your API key in Settings.");
    }
    // Assemble conversational history for Gemini (using rolling window)
    const conversationHistory = windowedMessages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
    const fullPrompt = `${systemPrompt}\n\nCONVERSATION HISTORY:\n${conversationHistory}\n\nASSISTANT:`;
    const result = await generateWithGeminiAPI(
      storedGeminiKey,
      fullPrompt,
      imagePayload ? { mimeType: imagePayload.mimeType, base64Data: imagePayload.base64Data } : null
    );
    reply = result.text;
    modelUsed = result.modelUsed;
    providerUsed = `Gemini (${result.modelUsed})`;
  } else {
    // Format messages for OpenAI-compatible Local LLM endpoint (using rolling window)
    // LM Studio Jinja templates strictly enforce that ONLY index 0 can be role: "system".
    // Subsequent system messages (such as state mutation feedback) are mapped to role: "user"
    // with a [System Notice] prefix so conversation history remains compliant.
    const llmMessages = [
      { role: "system" as const, content: systemPrompt },
      ...windowedMessages.map((m, idx) => {
        if (m.role === "assistant") {
          return { role: "assistant" as const, content: m.content };
        }
        if (m.role === "system") {
          return { role: "user" as const, content: `[System Notice]: ${m.content}` };
        }
        
        // Attach multimodal image payload to the final user turn if present
        const isLastMessage = idx === windowedMessages.length - 1;
        if (isLastMessage && imagePayload) {
          return {
            role: "user" as const,
            content: [
              { type: "text" as const, text: m.content },
              {
                type: "image_url" as const,
                image_url: {
                  url: `data:${imagePayload.mimeType};base64,${imagePayload.base64Data}`
                }
              }
            ]
          };
        }

        return { role: "user" as const, content: m.content };
      })
    ];

    const localRes = await callLocalLLM({
      url: lm_studio_url,
      model: model || "local-model",
      messages: llmMessages,
      temperature,
      max_tokens,
      timeoutMs: 300000
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
