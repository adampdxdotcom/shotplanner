/**
 * Canonical Domain Types & Shared Data Models
 * Shared across client (src/) and server (server/) to prevent type definition drift.
 */

export const SCENE_REFERENCE_DIRECTIVE =
  "A scene reference image is provided. Please match the location, lighting, and general environment of the provided reference image.";

// ---------------------------------------------------------------------------
// Characters & Universe
// ---------------------------------------------------------------------------

export interface CharacterProfile {
  id: string;
  name: string;
  notes: string;
  quick_slots: string[];
  scene_outfit_ref: string;
  is_location?: boolean;
  in_universe?: boolean;
  universe_slots?: string[];
  default_outfit_ref?: string;
  source_scene?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UniverseCharacterProfile extends CharacterProfile {
  source_scene?: string;
  created_at?: string;
  updated_at?: string;
  universe_slots?: string[];
  default_outfit_ref?: string;
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

// ---------------------------------------------------------------------------
// Generation Parameters & Mappings
// ---------------------------------------------------------------------------

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

export interface DetectedNodes {
  steps: string | null;
  megapixels: string | null;
  frames: string | null;
}

// ---------------------------------------------------------------------------
// Variations, Takes, Staging & First Frames
// ---------------------------------------------------------------------------

export interface PromptVariation {
  id: string;
  variation_number: number;
  created_at: string;
  basic_stub?: string;
  expanded_prompt: string;
  provider?: string;
  label?: string;
}

export interface ShotTake {
  id: string;
  take_number: number;
  created_at: string;
  video_url?: string;
  video_filename?: string;
  expanded_prompt: string;
  basic_stub?: string;
  variation_id?: string;
  generation_params?: GenerationParameters;
  sampling_steps?: number;
  assigned_slots?: Record<number, string>;
  lora_slots?: Record<string, ShotLoraAssignment>;
  review_status?: "unreviewed" | "approved" | "needs_work" | "good" | "bad" | string;
  rating?: "good" | "bad" | null;
  notes?: string;
  file_size?: number;
  aspect_ratio?: string;
  is_hero: boolean;
}

export interface StagedActorRecipeItem {
  id: string;
  characterName: string;
  cutoutDataUrl?: string;
  originalCutoutDataUrl?: string;
  maskDataUrl?: string;
  referenceAssetFilename?: string;
  cutoutAssetFilename?: string;
  maskAssetFilename?: string;
  xPercent: number;
  yPercent: number;
  scale: number;
  isFlipped: boolean;
  zIndex: number;
  plane?: "foreground" | "midground" | "background";
  posture?: string;
  facing?: "facing_camera" | "turn_left" | "turn_right" | "profile_left" | "profile_right" | "back_camera";
}

export interface StagingLayerRecipe {
  backgroundAssetFilename?: string;
  backgroundUrl?: string;
  actors: StagedActorRecipeItem[];
  aspectRatio?: string;
  cameraFraming?: string;
  lightingAtmosphere?: string;
  compositeAssetFilename?: string;
  targetSlotIndex?: number;
  updatedAt?: string;
}

export interface ShotFirstFrame {
  source: "last_frame_chain" | "generated_staging" | "manual_upload";
  asset_filename: string;
  preview_url?: string;
  source_shot_id?: string;
  source_shot_number?: number;
  source_take_number?: number;
  aspect_ratio?: string;
  locked: boolean;
  notes?: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Shots & Planning
// ---------------------------------------------------------------------------

export interface ShotLoraAssignment {
  lora_name: string;
  strength_model?: number;
  strength_clip?: number;
  bypassed?: boolean;
}

export interface WorkflowLoraSlot {
  id: string;
  node_id?: string;
  class_type: string;
  title: string;
  lora_name?: string;
  strength_model?: number;
  strength_clip?: number;
  mode?: number; // 0: active, 4: bypassed
  is_bypassed?: boolean;
  category?: string;
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
  prompt_variations?: PromptVariation[];
  active_variation_id?: string;
  assigned_slots?: Record<number, string>;
  lora_slots?: Record<string, ShotLoraAssignment>;
  status?: "unstaged" | "staged" | "rendering" | "rendered";
  staged?: boolean;
  latest_prompt_id?: string;
  updated_at?: string;
  characters?: string[];
  ots_anchor_subject?: string;
  ots_focus_subject?: string;
  ots_side?: "Left" | "Right";
  workflow_file?: string;
  monitored_workflow?: string;
  prompt_node_id?: string;
  node_mappings?: Record<string, string>;
  generation_params?: GenerationParameters;
  parameter_node_mappings?: ParameterNodeMappings | Record<string, string>;
  takes?: ShotTake[];
  active_take_id?: string;
  hero_take_id?: string;
  first_frame?: ShotFirstFrame;
  staging_recipe?: StagingLayerRecipe;
}

export interface ScenePlanningDetails {
  overarching_goal?: string;
  visual_theme?: string;
  environment_description?: string;
  lighting_style?: string;
  camera_gear?: string;
  audio_style?: string;
  custom_instructions?: string;
  mood_genre?: string;
  time_of_day?: string;
  location_description?: string;
  [key: string]: any;
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
  overarching_goal?: string;
  mood_genre?: string;
  time_of_day?: string;
  location_description?: string;
}

export type ScenePlanning = ScenePlanningDTO;

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export type AssetType =
  | "Headshot"
  | "Body Reference"
  | "Scene Reference"
  | "Start Frame"
  | "Object Reference"
  | "Style Reference"
  | "Voiceover Audio"
  | "Motion Reference Video"
  | string;

export interface MediaAsset {
  id: string;
  original_name: string;
  filename: string;
  media_type: "image" | "audio" | "video";
  type: string;
  asset_type?: string;
  subject_name: string;
  description: string;
  tags?: string[];
  size_bytes: number;
  created_at: number;
  uploaded_at?: number;
  preview_url?: string;
  thumbnail_url?: string;
  thumbnail_path?: string;
  slot_index?: number;
  scene_name?: string;
  path?: string;
  is_universe?: boolean;
}

export type AssetRecord = MediaAsset;

// ---------------------------------------------------------------------------
// Scene Project File & Assistant Chat
// ---------------------------------------------------------------------------

export interface AssistantChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  attached_image?: {
    filename: string;
    preview_url?: string;
    subject_name?: string;
  };
}

/**
 * Structured deep visual analysis cached per image asset to enable instant, zero-cost multimodal recall.
 */
export interface ImageVisualAnalysis {
  filename: string;
  scanned_at: string;
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
    quality?: "hard" | "soft" | "diffused" | "dramatic" | string;
    color_temperature?: "warm" | "cool" | "neutral" | string;
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
    location_type?: string;
    dominant_colors?: string[] | string;
    mood?: string;
  };
}

export interface SceneProjectFile {
  schema_version: "1.0";
  scene_id: string;
  scene_name: string;
  workflow_file: string;
  selectedWorkflowFile?: string;
  shared_assets: {
    slot_index: number;
    filename: string;
    label: string;
    is_location?: boolean;
  }[];
  shots: ShotItem[];
  assets?: MediaAsset[];
  subjects?: string[];
  characters?: Record<string, CharacterProfile>;
  scene_planning?: ScenePlanningDetails;
  visual_analysis_cache?: Record<string, ImageVisualAnalysis>;
  lm_studio_url?: string;
  local_llm_url?: string;
  local_model?: string;
  selected_ollama_model?: string;
  vision_enabled?: boolean;
  auto_caption_enabled?: boolean;
  config?: Partial<AppConfig>;
  llm_provider?: LLMProvider;
  generation_params?: GenerationParameters;
  parameter_node_mappings?: ParameterNodeMappings;
  lora_slots?: Record<string, ShotLoraAssignment>;
  takes?: ShotTake[];
  active_take_id?: string;
  hero_take_id?: string;
  staging_recipe?: StagingLayerRecipe;
  assistant_chat_history?: AssistantChatMessage[];
}

// ---------------------------------------------------------------------------
// Workflows
// ---------------------------------------------------------------------------

export interface WorkflowItem {
  filename: string;
  path: string;
  node_count: number;
  title: string;
}

export interface RemoteWorkflowItem {
  filename: string;
  path: string;
  folder?: string;
  size_bytes?: number;
  modified_at?: string | number;
  node_count?: number;
  source?: "ssh" | "api";
}

export interface RemoteWorkflowsResult {
  success: boolean;
  workflows: RemoteWorkflowItem[];
  message: string;
  source: "ssh" | "api" | "none";
  host?: string;
}

export interface WorkflowNodeInfo {
  id: string;
  class_type: string;
  title: string;
  category?: string;
  mode?: number;
  inputs?: Record<string, any>;
  current_value?: string;
  current_file?: string;
  lora_details?: {
    lora_name?: string;
    strength_model?: number;
    strength_clip?: number;
    bypassed?: boolean;
  };
}

export interface ParsedWorkflowData {
  promptNodes: WorkflowNodeInfo[];
  imageLoaderNodes: WorkflowNodeInfo[];
  videoLoaderNodes: WorkflowNodeInfo[];
  audioLoaderNodes: WorkflowNodeInfo[];
  loraLoaderNodes?: WorkflowNodeInfo[];
  loraSlots?: WorkflowLoraSlot[];
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

export interface ParsedWorkflow {
  filename: string;
  is_visual?: boolean;
  node_count?: number;
  detected_nodes?: DetectedNodes;
  detected_values?: Record<string, any>;
  nodes_info: {
    prompt_nodes: WorkflowNodeInfo[];
    image_loader_nodes: WorkflowNodeInfo[];
    video_loader_nodes: WorkflowNodeInfo[];
    audio_loader_nodes: WorkflowNodeInfo[];
    lora_loader_nodes?: WorkflowNodeInfo[];
    lora_slots?: WorkflowLoraSlot[];
    other_nodes?: WorkflowNodeInfo[];
    all_nodes?: WorkflowNodeInfo[];
    total_nodes: number;
    detected_nodes?: DetectedNodes;
  };
  raw_json: Record<string, any>;
  workflow?: Record<string, any>;
  raw_workflow?: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Comfy Queue & System Stats
// ---------------------------------------------------------------------------

export interface ComfyQueueItem {
  index: number;
  prompt_id: string;
  client_id?: string;
  status: "running" | "pending";
  scene_name?: string;
  shot_number?: number | string;
  nodes_count?: number;
  output_prefix?: string;
  timestamp?: number;
}

export interface ComfyQueueStatus {
  success: boolean;
  is_executing: boolean;
  queue_remaining: number;
  running: ComfyQueueItem[];
  pending: ComfyQueueItem[];
  error?: string;
}

export interface ComfyDeviceStats {
  name: string;
  type: string;
  index: number;
  vram_total: number;
  vram_free: number;
  vram_total_gb: string;
  vram_free_gb: string;
  vram_used_gb: string;
  vram_usage_percent: number;
  torch_vram_total?: number;
  torch_vram_free?: number;
}

export interface ComfySystemStats {
  success: boolean;
  os?: string;
  python_version?: string;
  devices: ComfyDeviceStats[];
  error?: string;
}

// ---------------------------------------------------------------------------
// LLM & Prompt Debug
// ---------------------------------------------------------------------------

export type LLMProvider = "lm_studio" | "gemini";

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

export interface ParsedSceneSketchShot {
  shot_number: number;
  shot_name: string;
  basic_stub: string;
  detected_characters: string[];
  shot_type: string;
  camera_movement: string;
  lens_focal_length: string;
  aspect_ratio?: string;
}

export interface ParseSceneSketchResult {
  scene_title: string;
  shots: ParsedSceneSketchShot[];
  raw_llm_output?: string;
  model_used: string;
  provider_used: string;
  clean_import?: boolean;
}

// ---------------------------------------------------------------------------
// Config, Model Hub & Integrations
// ---------------------------------------------------------------------------

export interface AppConfig {
  remote_host: string;
  ssh_port: number;
  ssh_username: string;
  ssh_password: string;
  ssh_key_path: string;
  ssh_private_key?: string;
  ssh_public_key?: string;
  remote_comfyui_root: string;
  comfyui_api_url: string;
  remote_api_token: string;
  lm_studio_url: string;
  local_model?: string;
  selected_ollama_model?: string;
  runpod_api_key?: string;
  runpod_auto_connect?: boolean;
  gemini_api_key?: string;
  civitai_api_key?: string;
  huggingface_token?: string;
  llm_provider?: LLMProvider;
  default_llm_provider?: LLMProvider;
  llm_custom_system_prompt?: string;
  llm_temperature?: number;
  llm_max_tokens?: number;
  vision_enabled?: boolean;
  auto_caption_enabled?: boolean;
}

export interface RunpodPodPort {
  ip: string;
  isIpPublic: boolean;
  privatePort: number;
  publicPort: number;
  type: string;
}

export interface RunpodPodItem {
  id: string;
  name: string;
  desiredStatus: string;
  uptimeInSeconds?: number;
  gpuCount?: number;
  gpuDisplayName?: string;
  memoryInGb?: number;
  vcpuCount?: number;
  imageName?: string;
  volumeInGb?: number;
  containerDiskInGb?: number;
  costPerHr?: number;
  ip?: string;
  sshPort?: number;
  comfyUrl?: string;
  proxyUrl?: string;
  ports?: RunpodPodPort[];
}

export interface ModelCategoryPreset {
  id: string;
  label: string;
  subfolder: string;
  description?: string;
}

export interface CivitaiFavorite {
  version_id: number;
  model_id: number;
  name: string;
  model_name?: string;
  version_name: string;
  category: string;
  base_model: string;
  image_url?: string;
  preview_image_url?: string;
  file_size?: string;
  file_size_formatted?: string;
  file_size_bytes?: number;
  filename?: string;
  download_url?: string;
  default_destination_folder?: string;
  suggested_remote_path?: string;
  trigger_words?: string[];
  trained_words?: string[];
  trainedWords?: string[];
  description?: string;
  clean_description?: string;
  download_command?: string;
  tags?: string[];
  added_at?: string;
}

export interface CivitaiModelVersionOption {
  id: number;
  name: string;
  baseModel?: string;
  downloadUrl?: string;
  createdAt?: string;
}

export interface CivitaiModelMetadata {
  model_id: number;
  model_name: string;
  version_id: number;
  version_name: string;
  category: string;
  base_model: string;
  file_size_bytes: number;
  file_size_formatted: string;
  filename: string;
  preview_image_url: string;
  download_url: string;
  default_destination_folder: string;
  suggested_remote_path: string;
  files?: any[];
  trained_words?: string[];
  trainedWords?: string[];
  description?: string;
  clean_description?: string;
  download_command?: string;
  tags?: string[];
  allow_commercial_use?: boolean | string;
  nsfw?: boolean;
  versions?: CivitaiModelVersionOption[];
}

export interface HuggingFaceFileOption {
  filename: string;
  downloadUrl: string;
  sizeBytes?: number;
  sizeFormatted?: string;
  isPrimary?: boolean;
}

export interface HuggingFaceModelMetadata {
  repo_id: string;
  model_name: string;
  author: string;
  pipeline_tag?: string;
  tags: string[];
  filename: string;
  file_size_bytes?: number;
  file_size_formatted?: string;
  download_url: string;
  raw_url: string;
  detected_category: string;
  category_preset_key: string;
  default_destination_folder: string;
  suggested_remote_path: string;
  is_gated?: boolean;
  private?: boolean;
  available_files?: HuggingFaceFileOption[];
  description?: string;
}

// ---------------------------------------------------------------------------
// Execution, SSH & File Transfer
// ---------------------------------------------------------------------------

export interface SSHKeyPair {
  private_key: string;
  public_key: string;
}

export interface ExecutionStepLog {
  step: "A" | "B" | "C" | "D" | string;
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

export interface TransferFileSummary {
  filename: string;
  file: string;
  size_bytes: number;
  status: "transferred" | "missing_locally" | string;
  remote_path: string;
  message: string;
}

export interface TransferResult {
  success: boolean;
  remote_dir: string;
  remote_workflow_path?: string;
  remote_workflow_paths?: string[];
  staged_workflow_filename?: string;
  staged_workflow_filenames?: string[];
  base_template_used?: string;
  save_video_prefix?: string;
  transferred_count?: number;
  skipped_count?: number;
  total_checked?: number;
  uploaded_files?: string[];
  skipped_files?: string[];
  verified_files?: string[];
  unverified_files?: string[];
  transferred_files: TransferredFileItem[];
  updated_workflow_json?: Record<string, any>;
  message: string;
  error?: string;
}

export interface ToastMessage {
  id: string;
  text: string;
  type: "success" | "error" | "info";
}

// ---------------------------------------------------------------------------
// System-Level LoRA Library & Remote Status
// ---------------------------------------------------------------------------

export interface SystemLora {
  id: string;
  name: string;
  filename: string;
  version_name?: string;
  base_model?: string;
  category?: "lora" | "lycoris" | "dora" | "locon" | "style" | "character" | "concept" | string;
  trigger_words?: string[];
  default_destination_folder?: string;
  suggested_remote_path?: string;
  download_url?: string;
  source?: "civitai" | "huggingface" | "custom" | "local";
  model_id?: number;
  version_id?: number;
  preview_image_url?: string;
  file_size_formatted?: string;
  file_size_bytes?: number;
  description?: string;
  notes?: string;
  preferred_strength_model?: number;
  preferred_strength_clip?: number;
  is_favorite?: boolean;
  added_at?: string;
  updated_at?: string;
}

export interface RemoteLoraFileStatus {
  filename: string;
  exists_on_remote: boolean;
  remote_path?: string;
  size_bytes?: number;
  size_formatted?: string;
  last_modified?: string;
}

export interface RemoteLoraStatusReport {
  success: boolean;
  remote_host: string;
  scanned_directory: string;
  total_remote_files: number;
  loras_status: Record<string, RemoteLoraFileStatus>;
  error?: string;
}

export interface TransferLoraResult {
  success: boolean;
  message: string;
  filename: string;
  destination_path?: string;
  file_size?: string;
  duration_seconds?: number;
  error?: string;
}

export interface CivitaiSearchItem {
  id: number;
  name: string;
  type: string;
  nsfw: boolean;
  tags?: string[];
  creator?: {
    username: string;
    image?: string;
  };
  stats?: {
    downloadCount: number;
    favoriteCount: number;
    ratingCount: number;
    rating: number;
  };
  modelVersions?: Array<{
    id: number;
    name: string;
    baseModel?: string;
    description?: string;
    trainedWords?: string[];
    downloadUrl?: string;
    files?: Array<{
      id: number;
      name: string;
      sizeKB: number;
      primary?: boolean;
    }>;
    images?: Array<{
      url: string;
      nsfwLevel?: number;
      width?: number;
      height?: number;
    }>;
  }>;
}

export interface CivitaiSearchResponse {
  success: boolean;
  items: CivitaiSearchItem[];
  metadata?: {
    totalItems?: number;
    currentPage?: number;
    pageSize?: number;
    totalPages?: number;
    nextPage?: string;
  };
  error?: string;
}


