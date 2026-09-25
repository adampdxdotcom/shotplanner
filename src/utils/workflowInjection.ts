import { ShotItem, GenerationParameters, ParameterNodeMappings, ShotLoraAssignment } from "../types";
import { formatShotNumber, generateSaveVideoPrefix } from "./formatters";
import { injectWorkflowGraph } from "../shared/workflowInjectionEngine";

// Re-export shared ComfyUI node classifiers & aspect ratio utilities for client convenience
export {
  isExactImageLoader,
  isExactVideoLoader,
  isExactAudioLoader,
  isExactLoraLoader,
  isExactPromptNode,
  isExactNegativePromptNode,
  isSaveVideoNode,
  KNOWN_IMAGE_LOADER_CLASSES,
  KNOWN_VIDEO_LOADER_CLASSES,
  KNOWN_AUDIO_LOADER_CLASSES,
  KNOWN_LORA_CLASSES,
  KNOWN_PROMPT_CLASSES,
  KNOWN_SAVE_VIDEO_CLASSES
} from "../shared/comfyNodeClassifiers";
import {
  isExactImageLoader,
  isExactVideoLoader,
  isExactAudioLoader,
  isExactLoraLoader,
  isExactPromptNode,
  isSaveVideoNode
} from "../shared/comfyNodeClassifiers";

export { formatAspectRatioForComfyUI, getDimensionsFromAspectRatio } from "../shared/aspectRatioUtils";

/**
 * Generates an injected ComfyUI workflow tailored to the active shot context on the client.
 * Uses the shared AST injection engine.
 */
export function generateLiveInjectedWorkflow(
  rawJson: any,
  activeShot: ShotItem | undefined,
  selectedPromptNodeId: string,
  nodeMappings: Record<string, string>,
  bypassMissing: boolean,
  generationParams: GenerationParameters,
  parameterNodeMappings: ParameterNodeMappings,
  activeSceneName: string,
  imageNodes: { id: string }[],
  loraAssignments?: Record<string, ShotLoraAssignment>
): any {
  if (!rawJson) return null;

  let effectivePrompt = "";
  if (activeShot) {
    const heroTake = activeShot.takes?.find((t: any) => t.is_hero || t.isHero);
    effectivePrompt = (
      heroTake?.expanded_prompt ||
      activeShot.expanded_prompt ||
      (heroTake as any)?.prompt ||
      (activeShot as any)?.prompt ||
      activeShot.basic_stub ||
      ""
    ).trim();
  }

  // Merge shot assigned_slots and nodeMappings
  const effectiveMappings: Record<string, string> = {
    ...nodeMappings,
    ...(activeShot?.node_mappings || {})
  };

  imageNodes.forEach((node, idx) => {
    if (activeShot?.assigned_slots && activeShot.assigned_slots[idx]) {
      effectiveMappings[node.id] = activeShot.assigned_slots[idx];
    }
  });

  const effectiveLoraSlots: Record<string, ShotLoraAssignment> = {
    ...(loraAssignments || {}),
    ...(activeShot?.lora_slots || {})
  };

  const effectiveParams = activeShot?.generation_params || generationParams;
  const effectiveParamNodes = activeShot?.parameter_node_mappings || parameterNodeMappings;
  const shotNumStr = activeShot ? formatShotNumber(activeShot.shot_number) : "01";
  const saveVideoPrefix = generateSaveVideoPrefix(activeSceneName || "Scene", shotNumStr);

  return injectWorkflowGraph({
    workflowData: rawJson,
    promptNodeId: activeShot?.prompt_node_id || selectedPromptNodeId,
    finalPrompt: effectivePrompt,
    nodeMappings: effectiveMappings,
    loraAssignments: effectiveLoraSlots,
    bypassMissing,
    safePlaceholder: "empty.png",
    parameterOverrides: effectiveParams,
    parameterNodeMappings: effectiveParamNodes,
    saveVideoPrefix,
    aspectRatio: activeShot?.aspect_ratio
  });
}

export interface WorkflowInspectionAnalysis {
  isValid: boolean;
  promptInjected: string;
  saveVideoPrefix: string;
  totalNodes: number;
  mappedLoadersCount: number;
  unmappedLoadersCount: number;
  loaders: {
    nodeId: string;
    title: string;
    classType: string;
    assignedAsset: string;
    status: "assigned" | "bypassed" | "empty";
  }[];
  loraSlots: {
    nodeId: string;
    title: string;
    classType: string;
    loraName: string;
    strengthModel: number;
    strengthClip: number;
    status: "assigned" | "bypassed" | "empty";
  }[];
  appliedParameters: {
    name: string;
    value: any;
    targetNodeId: string;
  }[];
  warnings: string[];
}

/**
 * Validates and inspects an injected workflow graph for debugging and user preview.
 */
export function inspectWorkflowGraph(
  injectedJson: any,
  rawJson: any,
  activeShot?: ShotItem
): WorkflowInspectionAnalysis {
  const warnings: string[] = [];
  const loaders: WorkflowInspectionAnalysis["loaders"] = [];
  const loraSlots: WorkflowInspectionAnalysis["loraSlots"] = [];
  const appliedParameters: WorkflowInspectionAnalysis["appliedParameters"] = [];

  let promptInjected = "";
  let saveVideoPrefix = "";
  let totalNodes = 0;

  if (!injectedJson) {
    return {
      isValid: false,
      promptInjected: "",
      saveVideoPrefix: "",
      totalNodes: 0,
      mappedLoadersCount: 0,
      unmappedLoadersCount: 0,
      loaders: [],
      loraSlots: [],
      appliedParameters: [],
      warnings: ["No workflow JSON provided."]
    };
  }

  if (Array.isArray(injectedJson.nodes)) {
    totalNodes = injectedJson.nodes.length;
    for (const node of injectedJson.nodes) {
      if (!node) continue;
      const strId = String(node.id ?? "");
      const classType = String(node.type ?? "");
      const title = String(node.title ?? classType);
      const mode = node.mode ?? 0;

      if (isExactPromptNode(classType, title)) {
        promptInjected = node.widgets_values?.[0] || node.widgets_values_named?.value || node.widgets_values_named?.text || "";
      } else if (isSaveVideoNode(classType, title)) {
        saveVideoPrefix = node.widgets_values?.[0] || node.widgets_values_named?.filename_prefix || "";
      } else if (isExactImageLoader(classType, title) || isExactVideoLoader(classType, title) || isExactAudioLoader(classType, title)) {
        const val = node.widgets_values?.[0] || node.widgets_values_named?.image || node.widgets_values_named?.video || node.widgets_values_named?.audio || "";
        const isBypassed = val === "empty.png" || !val || mode === 4;
        loaders.push({
          nodeId: strId,
          title,
          classType,
          assignedAsset: val || "",
          status: isBypassed ? (val === "empty.png" || mode === 4 ? "bypassed" : "empty") : "assigned"
        });
      } else if (isExactLoraLoader(classType, title)) {
        const loraVal = node.widgets_values?.[0] || node.widgets_values_named?.lora_name || node.widgets_values_named?.lora || "";
        const strModel = typeof node.widgets_values?.[1] === "number" ? node.widgets_values[1] : (typeof node.widgets_values_named?.strength_model === "number" ? node.widgets_values_named.strength_model : 1.0);
        const strClip = typeof node.widgets_values?.[2] === "number" ? node.widgets_values[2] : (typeof node.widgets_values_named?.strength_clip === "number" ? node.widgets_values_named.strength_clip : 1.0);
        const isBypassed = mode === 4 || !loraVal || loraVal === "None";

        loraSlots.push({
          nodeId: strId,
          title,
          classType,
          loraName: loraVal || "",
          strengthModel: strModel,
          strengthClip: strClip,
          status: isBypassed ? "bypassed" : "assigned"
        });
      }
    }
  } else if (typeof injectedJson === "object") {
    const entries = Object.entries<any>(injectedJson);
    totalNodes = entries.length;
    for (const [nodeId, nodeData] of entries) {
      if (!nodeData || typeof nodeData !== "object") continue;
      const classType = nodeData.class_type || "";
      const title = nodeData._meta?.title || classType;
      const inputs = nodeData.inputs || {};

      if (isExactPromptNode(classType, title)) {
        promptInjected = inputs.text || inputs.value || "";
      } else if (isSaveVideoNode(classType, title)) {
        saveVideoPrefix = inputs.filename_prefix || "";
      } else if (isExactImageLoader(classType, title) || isExactVideoLoader(classType, title) || isExactAudioLoader(classType, title)) {
        const val = inputs.image || inputs.video || inputs.audio || "";
        const isBypassed = val === "empty.png" || !val;
        loaders.push({
          nodeId,
          title,
          classType,
          assignedAsset: val || "",
          status: isBypassed ? (val === "empty.png" ? "bypassed" : "empty") : "assigned"
        });
      } else if (isExactLoraLoader(classType, title)) {
        const loraVal = inputs.lora_name || inputs.lora || "";
        const strModel = typeof inputs.strength_model === "number" ? inputs.strength_model : 1.0;
        const strClip = typeof inputs.strength_clip === "number" ? inputs.strength_clip : 1.0;
        const isBypassed = !loraVal || loraVal === "None";

        loraSlots.push({
          nodeId,
          title,
          classType,
          loraName: loraVal || "",
          strengthModel: strModel,
          strengthClip: strClip,
          status: isBypassed ? "bypassed" : "assigned"
        });
      }
    }
  }

  const mappedLoadersCount = loaders.filter(l => l.status === "assigned").length;
  const unmappedLoadersCount = loaders.filter(l => l.status !== "assigned").length;

  if (!promptInjected && activeShot?.basic_stub) {
    warnings.push("No prompt node detected in workflow graph.");
  }
  if (unmappedLoadersCount > 0) {
    warnings.push(`${unmappedLoadersCount} media loader(s) unassigned (bypassed with placeholders).`);
  }

  return {
    isValid: totalNodes > 0,
    promptInjected,
    saveVideoPrefix,
    totalNodes,
    mappedLoadersCount,
    unmappedLoadersCount,
    loaders,
    loraSlots,
    appliedParameters,
    warnings
  };
}
