import { normalizeShotChanges } from "../utils/cameraPresets";

/**
 * Assistant Action Protocol Types & Parser for Phases 1, 2, 3 & 4
 * Supports:
 * - update_shot
 * - add_shot
 * - update_scene_planning
 * - update_character
 * - stage_shot_assets (Phase 3 Workflow Action)
 * - expand_shot_prompt (Phase 3 Execution Action)
 * Includes Safety Validations & Feedback Loop Types for Phase 4
 */

export interface UpdateShotActionChanges {
  shot_name?: string;
  shot_type?: string;
  camera_movement?: string;
  lens_focal_length?: string;
  aspect_ratio?: string;
  basic_stub?: string;
  expanded_prompt?: string;
  lighting_setup?: string;
  camera_angle?: string;
  dialogue_line?: string;
  characters?: string[];
  character?: string;
  assigned_slots?: Record<string | number, string>;
  generation_params?: {
    steps?: number;
    megapixels?: number;
    frames?: number;
  };
}

export interface UpdateShotAction {
  type: "update_shot";
  title?: string;
  description?: string;
  shot_number: number | string;
  changes: UpdateShotActionChanges;
}

export interface AddShotAction {
  type: "add_shot";
  title?: string;
  description?: string;
  shot?: {
    shot_name?: string;
    shot_type?: string;
    camera_movement?: string;
    lens_focal_length?: string;
    aspect_ratio?: string;
    basic_stub?: string;
    expanded_prompt?: string;
    lighting_setup?: string;
    camera_angle?: string;
    characters?: string[];
    character?: string;
    ots_anchor_subject?: string;
    ots_focus_subject?: string;
    assigned_slots?: Record<string | number, string>;
    generation_params?: {
      steps?: number;
      megapixels?: number;
      frames?: number;
    };
  };
}

export interface UpdateScenePlanningChanges {
  overarching_goal?: string;
  visual_theme?: string;
  environment_description?: string;
  lighting_style?: string;
  camera_gear?: string;
  audio_style?: string;
  custom_instructions?: string;
  scene_name?: string;
}

export interface UpdateScenePlanningAction {
  type: "update_scene_planning";
  title?: string;
  description?: string;
  changes: UpdateScenePlanningChanges;
}

export interface UpdateCharacterChanges {
  name?: string;
  notes?: string;
  scene_outfit_ref?: string;
  default_outfit_ref?: string;
  quick_slots?: string[];
  is_location?: boolean;
}

export interface UpdateCharacterAction {
  type: "update_character";
  title?: string;
  description?: string;
  character_name: string;
  changes: UpdateCharacterChanges;
}

// Phase 3: Workflow & Execution Actions
export interface StageShotAssetsAction {
  type: "stage_shot_assets";
  title?: string;
  description?: string;
  shot_number: number | string;
  destination_path?: string;
}

export interface ExpandShotPromptAction {
  type: "expand_shot_prompt";
  title?: string;
  description?: string;
  shot_number: number | string;
  guidance?: string;
}

// Phase 4: Vision & Visual Analysis Action
export interface SaveVisualAnalysisAction {
  type: "save_visual_analysis";
  title?: string;
  description?: string;
  filename: string;
  analysis: {
    summary: string;
    subject?: {
      identified_name?: string;
      apparent_age?: string;
      expression?: string;
      hair?: string;
      features?: string;
    };
    wardrobe?: {
      garments?: string;
      colors?: string;
      era_style?: string;
      accessories?: string;
    };
    lighting?: {
      key_direction?: string;
      quality?: string;
      color_temperature?: string;
      contrast_ratio?: string;
    };
    cinematography?: {
      framing?: string;
      lens_feel?: string;
      depth_of_field?: string;
      camera_angle?: string;
    };
    environment_palette?: {
      setting?: string;
      dominant_colors?: string[];
      mood?: string;
    };
  };
}

export type AssistantAction = 
  | UpdateShotAction 
  | AddShotAction 
  | UpdateScenePlanningAction 
  | UpdateCharacterAction
  | StageShotAssetsAction
  | ExpandShotPromptAction
  | SaveVisualAnalysisAction;

export interface ParsedAssistantMessage {
  cleanContent: string;
  actions: AssistantAction[];
}

/**
 * Validates whether an action targets an existing shot number in the active scene.
 * Returns { valid: true } or { valid: false, reason: string }
 */
export function validateActionSafety(
  action: AssistantAction, 
  existingShotNumbers: number[]
): { valid: boolean; reason?: string } {
  if (action.type === "update_shot" || action.type === "stage_shot_assets" || action.type === "expand_shot_prompt") {
    const rawNum = action.shot_number;
    const num = typeof rawNum === "string" ? parseInt(rawNum, 10) : rawNum;
    if (isNaN(num)) {
      return { valid: false, reason: `Invalid shot number format: "${rawNum}".` };
    }
    if (!existingShotNumbers.includes(num)) {
      return { 
        valid: false, 
        reason: `Target Shot #${num} does not exist in the active scene (available: ${existingShotNumbers.length ? existingShotNumbers.join(', ') : 'none'}).` 
      };
    }
  }

  if (action.type === "update_character") {
    const name = action.character_name || (action as any).name;
    if (!name || typeof name !== "string" || !name.trim()) {
      return { valid: false, reason: "Character name cannot be blank." };
    }
  }

  return { valid: true };
}

/**
 * Extracts ```action or ```json blocks from message content that contain valid assistant actions.
 * Automatically normalizes camera, lens, framing, and movement changes into canonical presets.
 */
export function parseAssistantActions(content: string): ParsedAssistantMessage {
  if (!content) return { cleanContent: "", actions: [] };

  const actions: AssistantAction[] = [];
  
  // Match code blocks with ```action ... ``` or ```json ... ``` containing a valid type
  const actionBlockRegex = /```(?:action|json)\s*([\s\S]*?)\s*```/gi;
  
  let cleanContent = content;

  let match;
  while ((match = actionBlockRegex.exec(content)) !== null) {
    const rawJson = match[1];
    try {
      const parsed = JSON.parse(rawJson);
      
      if (Array.isArray(parsed)) {
        let anyValid = false;
        parsed.forEach(item => {
          if (isValidAction(item)) {
            normalizeActionInPlace(item);
            actions.push(item);
            anyValid = true;
          }
        });
        if (anyValid) {
          cleanContent = cleanContent.replace(match[0], "").trim();
        }
      } else if (isValidAction(parsed)) {
        normalizeActionInPlace(parsed);
        actions.push(parsed);
        cleanContent = cleanContent.replace(match[0], "").trim();
      }
    } catch {
      // If parsing fails, leave the message intact for standard markdown render
    }
  }

  // Remove any legacy "Suggested Directives" headings and bullet lists from message body
  cleanContent = cleanContent
    .replace(/(?:#{1,4}\s*)?Suggested Directives:?[\r\n]+(?:[-*•]\s*.*[\r\n]*)+/gi, "")
    .replace(/\*\*Suggested Directives:?\*\*[\r\n]+(?:[-*•]\s*.*[\r\n]*)+/gi, "")
    .replace(/(?:#{1,4}\s*)?Suggested Directives:?/gi, "")
    .trim();

  return { cleanContent, actions };
}

function normalizeActionInPlace(action: any) {
  if (action.type === "update_scene_plan") {
    action.type = "update_scene_planning";
  }
  if (action.type === "update_scene_planning") {
    // If changes were passed at root of action, move to changes object
    if (!action.changes && (action.overarching_goal || action.visual_theme || action.environment_description || action.lighting_style || action.camera_gear || action.audio_style || action.custom_instructions)) {
      const { type, title, description, ...changes } = action;
      action.changes = changes;
    }
  } else if (action.type === "update_shot" && action.changes) {
    action.changes = normalizeShotChanges(action.changes) as any;
  } else if (action.type === "add_shot") {
    const raw = action.shot || action.changes || {};
    action.shot = normalizeShotChanges(raw) as any;
  }
}

function isValidAction(obj: any): obj is AssistantAction {
  if (!obj || typeof obj !== "object") return false;
  const actionType = obj.type === "update_scene_plan" ? "update_scene_planning" : obj.type;
  if (actionType === "update_shot" && (typeof obj.shot_number === "number" || typeof obj.shot_number === "string") && obj.changes) {
    return true;
  }
  if (actionType === "add_shot" && (obj.shot || obj.changes)) {
    return true;
  }
  if (actionType === "update_scene_planning" && (obj.changes || obj.overarching_goal || obj.visual_theme || obj.environment_description || obj.lighting_style || obj.camera_gear || obj.audio_style || obj.custom_instructions)) {
    return true;
  }
  if (actionType === "update_character" && (obj.character_name || obj.name) && (obj.changes || typeof obj.notes === "string")) {
    return true;
  }
  if (actionType === "stage_shot_assets" && (typeof obj.shot_number === "number" || typeof obj.shot_number === "string")) {
    return true;
  }
  if (actionType === "expand_shot_prompt" && (typeof obj.shot_number === "number" || typeof obj.shot_number === "string")) {
    return true;
  }
  if (actionType === "save_visual_analysis" && typeof obj.filename === "string" && obj.analysis) {
    return true;
  }
  return false;
}
