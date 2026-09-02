
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
  review_status?: "unreviewed" | "approved" | "needs_work";
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
}

export interface ShotItem {
  id: string;
  shot_number: number;
  shot_name?: string;
  shot_type?: string;
  camera_movement?: string;
  lens_focal_length?: string;
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
  slot_index?: number;
  scene_name?: string;
  path?: string;
}

export interface WorkflowNodeInfo {
  id: string;
  class_type: string;
  title: string;
  mode?: number;
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

export const SCENE_REFERENCE_DIRECTIVE = "A scene reference image is provided. Please match the location, lighting, and general environment of the provided reference image.";
