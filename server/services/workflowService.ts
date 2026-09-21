/**
 * Workflow Service Facade
 * Provides a unified entry point for ComfyUI workflow parsing, conversion,
 * injection, template resolution, and shot orchestration.
 */

// Shared node classifiers and aspect ratio helpers
export {
  isExactImageLoader,
  isExactVideoLoader,
  isExactAudioLoader,
  isExactPromptNode,
  isExactNegativePromptNode,
  isSaveVideoNode,
  KNOWN_IMAGE_LOADER_CLASSES,
  KNOWN_VIDEO_LOADER_CLASSES,
  KNOWN_AUDIO_LOADER_CLASSES,
  KNOWN_PROMPT_CLASSES,
  KNOWN_SAVE_VIDEO_CLASSES
} from "../../src/shared/comfyNodeClassifiers";

export {
  formatAspectRatioForComfyUI,
  getDimensionsFromAspectRatio
} from "../../src/shared/aspectRatioUtils";

// Modular workflow sub-services
export {
  parseWorkflowData,
  categorizeWorkflowNode
} from "./workflow/workflowParser";

export {
  convertWorkflowToApiPrompt
} from "./workflow/workflowGraphConverter";

export {
  injectAndPrepareWorkflowData
} from "./workflow/workflowInjector";

export {
  listWorkflows,
  resolveWorkflowTemplate,
  type ResolvedWorkflowTemplate
} from "./workflow/workflowResolver";

export {
  buildShotWorkflow
} from "./workflow/workflowBuilder";
