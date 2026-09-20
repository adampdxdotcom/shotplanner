
export interface CharacterProfile {
  id: string;
  name: string;
  notes: string;
  quick_slots: string[];
  scene_outfit_ref: string;
  is_location?: boolean;
}

export interface UniverseCharacterProfile extends CharacterProfile {
  source_scene?: string;
  created_at?: string;
  updated_at?: string;
  universe_slots?: string[];
  default_outfit_ref?: string;
}

export interface GenerationParameters {
  steps: number;
  megapixels: number;
  frames: number;
}

export interface ShotTake {
  id: string;
  take_number: number;
  created_at: string;
  video_url?: string;
  video_filename?: string;
  expanded_prompt: string;
  basic_stub?: string;
  generation_params?: GenerationParameters;
  assigned_slots?: Record<number, string>;
  review_status?: "unreviewed" | "approved" | "needs_work" | "good" | "bad";
  rating?: "good" | "bad" | null;
  notes?: string;
  file_size?: number;
  aspect_ratio?: string;
  is_hero: boolean;
}
export interface SceneProjectFile {
  schema_version: "1.0";
  scene_id: string;
  scene_name: string;
  workflow_file: string;
  shared_assets: {
    slot_index: number;
    filename: string;
    label: string;
    is_location?: boolean;
  }[];
  shots: ShotItem[];
  characters?: Record<string, CharacterProfile> | any[];
  scene_planning?: {
    overarching_goal?: string;
    visual_theme?: string;
    environment_description?: string;
    lighting_style?: string;
    camera_gear?: string;
    audio_style?: string;
    custom_instructions?: string;
    [key: string]: any;
  };
}

export interface ShotItem {
  id: string;
  shot_number: number;
  shot_name?: string;
  shot_type?: string;
  camera_movement?: string;
  lens_focal_length?: string;
  camera_angle?: string;
  dialogue_line?: string;
  lighting_setup?: string;
  aspect_ratio?: string;
  basic_stub?: string;
  expanded_prompt?: string;
  assigned_slots?: Record<number, string>;
  staged?: boolean;
  updated_at?: string;
  ots_anchor_subject?: string;
  ots_focus_subject?: string;
  ots_side?: "Left" | "Right";
  workflow_file?: string;
  prompt_node_id?: string;
  node_mappings?: Record<string, string>;
  generation_params?: GenerationParameters;
  parameter_node_mappings?: Record<string, string>;
  takes?: ShotTake[];
  active_take_id?: string;
  hero_take_id?: string;
}

export interface AssetRecord {
  id: string;
  original_name: string;
  filename: string;
  media_type: "image" | "audio" | "video";
  type: string;
  subject_name: string;
  description: string;
  tags?: string[];
  size_bytes: number;
  created_at: number;
  preview_url?: string;
  thumbnail_url?: string;
  thumbnail_path?: string;
  slot_index?: number;
  scene_name?: string;
  path?: string;
  is_universe?: boolean;
}

export type MediaAsset = AssetRecord;

export interface WorkflowNodeInfo {
  id: string;
  class_type: string;
  title: string;
  mode?: number;
  category?: string;
  current_value?: string;
  current_file?: string;
  inputs?: any;
}

export interface ParsedWorkflowData {
  promptNodes: WorkflowNodeInfo[];
  imageLoaderNodes: WorkflowNodeInfo[];
  videoLoaderNodes: WorkflowNodeInfo[];
  audioLoaderNodes: WorkflowNodeInfo[];
  otherNodes: WorkflowNodeInfo[];
  allNodes?: WorkflowNodeInfo[];
  detectedNodes: {
    steps: string | null;
    megapixels: string | null;
    frames: string | null;
  };
  detectedValues: Record<string, any>;
  totalNodes: number;
}

export interface ScenePlanningDTO {
  scene_name?: string;
  shot_number?: string | number;
  shot_type?: string;
  camera_movement?: string;
  lens_focal_length?: string;
  aspect_ratio?: string;
  ots_anchor_subject?: string;
  ots_focus_subject?: string;
  ots_side?: "Left" | "Right";
}

export interface SSHKeyPair {
  private_key: string;
  public_key: string;
}

export interface TransferFileSummary {
  filename: string;
  file: string;
  size_bytes: number;
  status: "transferred" | "missing_locally";
  remote_path: string;
  message: string;
}

export interface ExecutionStepLog {
  step: string;
  title: string;
  status: "success" | "info" | "error";
  detail: string;
}

export interface PromptDebugInfo {
  system_prompt_sent: string;
  user_prompt_sent: string;
  raw_llm_output: string;
  temperature_used: number;
  max_tokens_used: number;
  model_used: string;
  provider: string;
  latency_ms: number;
  timestamp: string;
}

export interface ExpandPromptResult {
  expanded_prompt: string;
  provider: string;
  description_only?: string;
  debug?: PromptDebugInfo;
}

export interface UniverseInspectionItem {
  name: string;
  is_location?: boolean;
  status: "new" | "identical" | "different";
  incoming: UniverseCharacterProfile;
  existing?: UniverseCharacterProfile;
  diffs: {
    notes?: { local: string; incoming: string };
    default_outfit_ref?: { local: string; incoming: string };
    slots?: { local: string[]; incoming: string[] };
  };
}

export interface UniverseInspectionResult {
  has_universe_data: boolean;
  items: UniverseInspectionItem[];
  total_incoming: number;
  total_conflicts: number;
}

export const SCENE_REFERENCE_DIRECTIVE = "A scene reference image is provided. Please match the location, lighting, and general environment of the provided reference image.";
