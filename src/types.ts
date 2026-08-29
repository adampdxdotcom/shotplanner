export interface ToastMessage {
  id: string;
  text: string;
  type: "success" | "error" | "info";
}

export interface AppConfig {
  runpod_ip: string;
  ssh_port: number;
  ssh_username: string;
  ssh_password: string;
  ssh_key_path: string;
  ssh_private_key?: string;
  remote_input_dir: string;
  comfyui_api_url: string;
  runpod_api_token: string;
  lm_studio_url: string;
  gemini_api_key?: string;
}

export type AssetType = 
  | "Headshot"
  | "Body Reference"
  | "Scene Reference"
  | "Object Reference"
  | "Style Reference"
  | "Voiceover Audio"
  | "Motion Reference Video";

export interface MediaAsset {
  id: string;
  original_name: string;
  filename: string;
  media_type: "image" | "audio" | "video";
  type: string;
  subject_name: string;
  description: string;
  size_bytes: number;
  created_at: number;
  preview_url?: string;
  slot_index?: number;
}

export interface WorkflowItem {
  filename: string;
  path: string;
  node_count: number;
  title: string;
}

export interface WorkflowNodeInfo {
  id: string;
  class_type: string;
  title: string;
  inputs: Record<string, any>;
  current_value?: string;
  current_file?: string;
}

export interface DetectedNodes {
  steps: string | null;
  megapixels: string | null;
  frames: string | null;
}

export interface GenerationParameters {
  steps: number;
  megapixels: number;
  frames: number;
}

export interface ParameterNodeMappings {
  steps: string;
  megapixels: string;
  frames: string;
}

export interface ParsedWorkflow {
  filename: string;
  detected_nodes?: DetectedNodes;
  nodes_info: {
    prompt_nodes: WorkflowNodeInfo[];
    image_loader_nodes: WorkflowNodeInfo[];
    video_loader_nodes: WorkflowNodeInfo[];
    audio_loader_nodes: WorkflowNodeInfo[];
    total_nodes: number;
    detected_nodes?: DetectedNodes;
  };
  raw_json: Record<string, any>;
}

export interface ExecutionStepLog {
  step: "A" | "B" | "C" | "D";
  title: string;
  status: "success" | "error" | "warning" | "info" | "pending";
  detail: string;
  files?: any[];
  response?: any;
}

export interface ExecutionResult {
  success: boolean;
  prompt_id?: string;
  dry_run?: boolean;
  steps: ExecutionStepLog[];
  modified_workflow: Record<string, any>;
  error?: string;
}

export interface TransferredFileItem {
  filename: string;
  file?: string;
  size_bytes?: number;
  status: "transferred" | "skipped_existing" | "missing_locally" | "error" | string;
  remote_path?: string;
  message?: string;
}

export interface TransferResult {
  success: boolean;
  remote_dir: string;
  transferred_count?: number;
  skipped_count?: number;
  total_checked?: number;
  uploaded_files?: string[];
  skipped_files?: string[];
  transferred_files: TransferredFileItem[];
  message: string;
  error?: string;
}

