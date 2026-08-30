export const SCENE_REFERENCE_DIRECTIVE = "Do not embellish the setting. Use the exact likeness of location.";

export function formatShotNumber(raw: string | number): string {
  const str = String(raw !== undefined && raw !== null ? raw : "").trim().replace(/^shot\s*/i, "");
  if (!str) return "01";
  const num = parseInt(str, 10);
  if (!isNaN(num)) {
    return num.toString().padStart(2, "0");
  }
  return str;
}

export function sanitizeFilenamePart(str: string): string {
  if (!str) return "";
  return str
    .replace(/[/\\:*?"<>|']/g, "") // strip invalid filesystem chars
    .replace(/[\s-]+/g, "_") // replace spaces and hyphens with _
    .replace(/_+/g, "_") // collapse multiple consecutive underscores
    .replace(/^_+|_+$/g, ""); // trim leading and trailing underscores
}

export function generateSaveVideoPrefix(sceneName?: string, shotNumber?: string | number): string {
  const sanitizedScene = sanitizeFilenamePart(sceneName || "");
  const rawShot = shotNumber !== undefined && shotNumber !== null ? String(shotNumber).trim() : "";
  const paddedShot = rawShot ? formatShotNumber(rawShot) : "";

  if (sanitizedScene && paddedShot) {
    return `video/${sanitizedScene}_Shot_${paddedShot}_`;
  }
  if (sanitizedScene) {
    return `video/${sanitizedScene}_`;
  }
  if (paddedShot) {
    return `video/Shot_${paddedShot}_`;
  }
  return "";
}

export function generatePromptPrefix(plan?: Partial<ScenePlanning> | null): string {
  if (!plan) return "";
  const parts: string[] = [];
  
  if (plan.scene_name && plan.scene_name.trim()) {
    parts.push(plan.scene_name.trim());
  }
  
  const rawShot = plan.shot_number !== undefined && plan.shot_number !== null ? String(plan.shot_number).trim() : "";
  const shotNum = formatShotNumber(rawShot || "01");
  parts.push(`Shot ${shotNum}`);
  
  if (plan.shot_type && plan.shot_type.trim()) {
    parts.push(plan.shot_type.trim());
  }
  
  if (plan.camera_movement && plan.camera_movement.trim()) {
    parts.push(plan.camera_movement.trim());
  }
  
  return parts.join(" - ");
}

export function assembleFinalPrompt(
  expandedPrompt: string,
  promptPrefix: string,
  isSceneRefPresent: boolean = false
): string {
  let prompt = (expandedPrompt || "").trim();
  const cleanPrefix = (promptPrefix || "").trim().replace(/\.+$/, "");

  if (cleanPrefix) {
    // If prompt doesn't start with the clean prefix, prepend it to the top
    if (!prompt.startsWith(cleanPrefix)) {
      prompt = prompt ? `${cleanPrefix}\n\n${prompt}` : cleanPrefix;
    }
  }

  // Ensure Scene Reference Directive is on its own line if scene reference is present
  if (isSceneRefPresent && !prompt.includes(SCENE_REFERENCE_DIRECTIVE)) {
    prompt = prompt ? `${prompt}\n\n${SCENE_REFERENCE_DIRECTIVE}` : SCENE_REFERENCE_DIRECTIVE;
  }

  return prompt;
}

export function hasSceneReferencePhoto(assets: Array<{ type?: string; media_type?: string; filename?: string; subject_name?: string }>): boolean {
  if (!assets || !Array.isArray(assets)) return false;
  return assets.some(a => {
    if (!a) return false;
    const isImage = !a.media_type || a.media_type === "image";
    const typeStr = (a.type || "").toLowerCase();
    const sname = (a.subject_name || "").toLowerCase();
    const fname = (a.filename || "").toLowerCase();
    return isImage && (
      typeStr === "scene reference" ||
      typeStr.includes("scene") ||
      typeStr.includes("location") ||
      typeStr.includes("environment") ||
      sname.includes("location") ||
      fname.startsWith("scene_") ||
      fname.includes("scene_reference")
    );
  });
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
  assets?: MediaAsset[];
  subjects?: string[];
  lm_studio_url?: string;
  local_llm_url?: string;
  config?: Partial<AppConfig>;
  llm_provider?: LLMProvider;
}

export interface ShotItem {
  id: string;
  shot_name?: string;
  shot_number: number;
  shot_type: string;
  camera_movement: string;
  basic_stub: string;
  expanded_prompt: string;
  assigned_slots: Record<number, string>;
  staged: boolean;
  updated_at: string;
  workflow_file?: string;
  prompt_node_id?: string;
  node_mappings?: Record<string, string>;
  generation_params?: GenerationParameters;
  parameter_node_mappings?: ParameterNodeMappings;
}

export interface ToastMessage {
  id: string;
  text: string;
  type: "success" | "error" | "info";
}

export type LLMProvider = "lm_studio" | "gemini";

export interface ScenePlanning {
  scene_name: string;
  shot_number: string | number;
  shot_type: string;
  camera_movement: string;
}

export interface AppConfig {
  remote_host: string;
  ssh_port: number;
  ssh_username: string;
  ssh_password: string;
  ssh_key_path: string;
  ssh_private_key?: string;
  remote_comfyui_root: string;
  comfyui_api_url: string;
  remote_api_token: string;
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
  save_video_prefix?: string;
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
  remote_workflow_path?: string;
  staged_workflow_filename?: string;
  save_video_prefix?: string;
  transferred_count?: number;
  skipped_count?: number;
  total_checked?: number;
  uploaded_files?: string[];
  skipped_files?: string[];
  transferred_files: TransferredFileItem[];
  updated_workflow_json?: Record<string, any>;
  message: string;
  error?: string;
}

export { getAssetMediaUrl } from "./utils/assetUrl";

