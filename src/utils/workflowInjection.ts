import { ShotItem, GenerationParameters, ParameterNodeMappings } from "../types";
import { formatShotNumber, generateSaveVideoPrefix } from "./formatters";

// Re-export and import shared ComfyUI node classifiers
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
} from "../shared/comfyNodeClassifiers";
import {
  isExactImageLoader,
  isExactVideoLoader,
  isExactAudioLoader,
  isExactPromptNode,
  isExactNegativePromptNode,
  isSaveVideoNode
} from "../shared/comfyNodeClassifiers";

// Import shared aspect ratio utilities
export { formatAspectRatioForComfyUI, getDimensionsFromAspectRatio } from "../shared/aspectRatioUtils";
import { formatAspectRatioForComfyUI } from "../shared/aspectRatioUtils";

export function generateLiveInjectedWorkflow(
  rawJson: any,
  activeShot: ShotItem | undefined,
  selectedPromptNodeId: string,
  nodeMappings: Record<string, string>,
  bypassMissing: boolean,
  generationParams: GenerationParameters,
  parameterNodeMappings: ParameterNodeMappings,
  activeSceneName: string,
  imageNodes: { id: string }[]
): any {
  if (!rawJson) return null;
  const cloned = JSON.parse(JSON.stringify(rawJson));
  const placeholder = "empty.png";

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

  const effectiveParams = activeShot?.generation_params || generationParams;
  const effectiveParamNodes = activeShot?.parameter_node_mappings || parameterNodeMappings;
  const shotNumStr = activeShot ? formatShotNumber(activeShot.shot_number) : "01";
  const saveVideoPrefix = generateSaveVideoPrefix(activeSceneName || "Scene", shotNumStr);

  // 1. Visual Canvas format (nodes array)
  if (Array.isArray(cloned.nodes)) {
    // Identify prompt node
    let targetPromptId: string | null = null;
    if (activeShot?.prompt_node_id || selectedPromptNodeId) {
      targetPromptId = String(activeShot?.prompt_node_id || selectedPromptNodeId);
    } else {
      const pNode = cloned.nodes.find((n: any) => n && isExactPromptNode(String(n.type ?? ""), String(n.title ?? "")));
      if (pNode) targetPromptId = String(pNode.id ?? "");
    }

    for (const node of cloned.nodes) {
      if (!node || typeof node !== "object") continue;
      const strId = String(node.id ?? "");
      const classType = String(node.type ?? "");
      const metaTitle = String(node.title ?? "");

      // Prompt Node Injection
      if (targetPromptId && strId === targetPromptId && effectivePrompt) {
        if (Array.isArray(node.widgets_values) && node.widgets_values.length > 0) {
          node.widgets_values[0] = effectivePrompt;
        } else {
          node.widgets_values = [effectivePrompt];
        }
        if (node.widgets_values_named && typeof node.widgets_values_named === "object") {
          node.widgets_values_named.value = effectivePrompt;
          node.widgets_values_named.text = effectivePrompt;
        }
      }

      const isImgLoader = isExactImageLoader(classType, metaTitle);
      const isVidLoader = isExactVideoLoader(classType, metaTitle);
      const isAudLoader = isExactAudioLoader(classType, metaTitle);
      const hasExplicitMapping = Boolean(effectiveMappings && strId in effectiveMappings && effectiveMappings[strId] && String(effectiveMappings[strId]).trim());

      // Image Loader Nodes Injection
      if (isImgLoader || (hasExplicitMapping && !isVidLoader && !isAudLoader)) {
        if (hasExplicitMapping) {
          const assigned = String(effectiveMappings[strId]).trim();
          if (Array.isArray(node.widgets_values) && node.widgets_values.length > 0) {
            node.widgets_values[0] = assigned;
          } else {
            node.widgets_values = [assigned, "image"];
          }
          if (node.widgets_values_named && typeof node.widgets_values_named === "object") {
            node.widgets_values_named.image = assigned;
          }
          // Explicitly set active mode when asset is assigned
          node.mode = 0;
        } else if (isImgLoader) {
          // Explicitly bypass in ComfyUI visual graph when no asset is assigned
          node.mode = 4;
          if (bypassMissing) {
            if (Array.isArray(node.widgets_values) && node.widgets_values.length > 0) {
              if (!node.widgets_values[0] || node.widgets_values[0] === "example.png") {
                node.widgets_values[0] = placeholder;
              }
            } else {
              node.widgets_values = [placeholder, "image"];
            }
            if (node.widgets_values_named && typeof node.widgets_values_named === "object") {
              node.widgets_values_named.image = placeholder;
            }
          }
        }
      }

      // Video Loader Nodes Injection
      else if (isVidLoader) {
        if (hasExplicitMapping) {
          const assigned = String(effectiveMappings[strId]).trim();
          if (Array.isArray(node.widgets_values) && node.widgets_values.length > 0) {
            node.widgets_values[0] = assigned;
          } else {
            node.widgets_values = [assigned];
          }
          if (node.widgets_values_named && typeof node.widgets_values_named === "object") {
            node.widgets_values_named.video = assigned;
          }
          node.mode = 0;
        } else {
          // Explicitly bypass when unassigned
          node.mode = 4;
          if (bypassMissing) {
            if (Array.isArray(node.widgets_values) && node.widgets_values.length > 0 && (!node.widgets_values[0] || String(node.widgets_values[0]).includes("default"))) {
              node.widgets_values[0] = placeholder;
            }
          }
        }
      }

      // Audio Loader Nodes Injection
      else if (isAudLoader) {
        if (hasExplicitMapping) {
          const assigned = String(effectiveMappings[strId]).trim();
          if (Array.isArray(node.widgets_values) && node.widgets_values.length > 0) {
            node.widgets_values[0] = assigned;
          } else {
            node.widgets_values = [assigned];
          }
          if (node.widgets_values_named && typeof node.widgets_values_named === "object") {
            node.widgets_values_named.audio = assigned;
          }
          node.mode = 0;
        } else {
          // Explicitly bypass when unassigned
          node.mode = 4;
          if (bypassMissing) {
            if (Array.isArray(node.widgets_values) && node.widgets_values.length > 0 && (!node.widgets_values[0] || String(node.widgets_values[0]).includes("default"))) {
              node.widgets_values[0] = placeholder;
            }
          }
        }
      }

      // SaveVideo Node Target Injection
      if (isSaveVideoNode(classType, metaTitle) && saveVideoPrefix && saveVideoPrefix.trim()) {
        const cleanSavePrefix = saveVideoPrefix.trim();
        if (Array.isArray(node.widgets_values) && node.widgets_values.length > 0) {
          node.widgets_values[0] = cleanSavePrefix;
        } else {
          node.widgets_values = [cleanSavePrefix];
        }
        if (node.widgets_values_named && typeof node.widgets_values_named === "object") {
          node.widgets_values_named.filename_prefix = cleanSavePrefix;
        }
      }

      // Generation Parameter Overrides: ONLY if explicitly mapped
      if (effectiveParams && effectiveParamNodes) {
        if (effectiveParamNodes.steps && String(effectiveParamNodes.steps) === strId && effectiveParams.steps !== undefined && effectiveParams.steps !== null) {
          const val = parseInt(String(effectiveParams.steps), 10);
          if (!isNaN(val)) {
            if (node.widgets_values_named && typeof node.widgets_values_named === "object" && "steps" in node.widgets_values_named) {
              node.widgets_values_named.steps = val;
            } else if (classType === "KSampler" || classType === "KSamplerAdvanced") {
              if (Array.isArray(node.widgets_values) && node.widgets_values.length > 2) {
                node.widgets_values[2] = val;
              }
            } else if (Array.isArray(node.widgets_values) && node.widgets_values.length === 1) {
              node.widgets_values[0] = val;
            }
          }
        }
        if (effectiveParamNodes.megapixels && String(effectiveParamNodes.megapixels) === strId && effectiveParams.megapixels !== undefined && effectiveParams.megapixels !== null) {
          const val = parseFloat(String(effectiveParams.megapixels));
          if (!isNaN(val)) {
            const isResolutionSelector = classType === "ResolutionSelector" || metaTitle.toLowerCase().includes("resolution selector");
            if (isResolutionSelector && Array.isArray(node.widgets_values)) {
              // ComfyUI ResolutionSelector widgets_values: [aspect_ratio_str, megapixels_float, multiplier_int]
              // Update aspect ratio at index 0 from active shot
              if (activeShot?.aspect_ratio) {
                node.widgets_values[0] = formatAspectRatioForComfyUI(activeShot.aspect_ratio);
              }
              // Update megapixels at index 1
              if (node.widgets_values.length > 1) {
                node.widgets_values[1] = val;
              }
              // Multiplier at index 2 is left untouched
              if (node.widgets_values_named && typeof node.widgets_values_named === "object") {
                if ("aspect_ratio" in node.widgets_values_named && activeShot?.aspect_ratio) {
                  node.widgets_values_named.aspect_ratio = formatAspectRatioForComfyUI(activeShot.aspect_ratio);
                }
                if ("megapixels" in node.widgets_values_named) {
                  node.widgets_values_named.megapixels = val;
                }
              }
            } else if (node.widgets_values_named && typeof node.widgets_values_named === "object" && "megapixels" in node.widgets_values_named) {
              node.widgets_values_named.megapixels = val;
            } else if (node.widgets_values_named && typeof node.widgets_values_named === "object" && "width" in node.widgets_values_named && "height" in node.widgets_values_named) {
              const origW = Number(node.widgets_values_named.width) || 768;
              const origH = Number(node.widgets_values_named.height) || 1024;
              const currentPixels = origW * origH;
              const targetPixels = val * 1024 * 1024;
              const scaleFactor = Math.sqrt(targetPixels / Math.max(1, currentPixels));
              node.widgets_values_named.width = Math.max(64, Math.round((origW * scaleFactor) / 16) * 16);
              node.widgets_values_named.height = Math.max(64, Math.round((origH * scaleFactor) / 16) * 16);
            } else if (Array.isArray(node.widgets_values)) {
              if (node.widgets_values.length >= 2 && (classType === "EmptyLatentImage" || classType.includes("Latent") || metaTitle.toLowerCase().includes("latent") || metaTitle.toLowerCase().includes("resolution"))) {
                const origW = Number(node.widgets_values[0]) || 768;
                const origH = Number(node.widgets_values[1]) || 1024;
                const currentPixels = origW * origH;
                const targetPixels = val * 1024 * 1024;
                const scaleFactor = Math.sqrt(targetPixels / Math.max(1, currentPixels));
                node.widgets_values[0] = Math.max(64, Math.round((origW * scaleFactor) / 16) * 16);
                node.widgets_values[1] = Math.max(64, Math.round((origH * scaleFactor) / 16) * 16);
              } else if (node.widgets_values.length === 1) {
                node.widgets_values[0] = val;
              }
            }
          }
        }
        if (effectiveParamNodes.frames && String(effectiveParamNodes.frames) === strId && effectiveParams.frames !== undefined && effectiveParams.frames !== null) {
          const rawVal = parseFloat(String(effectiveParams.frames));
          if (!isNaN(rawVal)) {
            // Keep float precision for seconds, but also support integer frames if node expects int
            const isFloatNode = classType.toLowerCase().includes("float") || 
              String(node.title || "").toLowerCase().includes("float") ||
              String(node.title || "").toLowerCase().includes("second") ||
              String(node.title || "").toLowerCase().includes("duration");
            const val = isFloatNode ? rawVal : (Number.isInteger(rawVal) ? rawVal : rawVal);

            if (node.widgets_values_named && typeof node.widgets_values_named === "object") {
              let matchedNamedKey: string | null = null;
              for (const k of ["value", "seconds", "duration", "frames", "length", "num_frames", "frame_count", "video_length"]) {
                if (k in node.widgets_values_named) {
                  matchedNamedKey = k;
                  break;
                }
              }
              if (matchedNamedKey) {
                node.widgets_values_named[matchedNamedKey] = val;
              }
            }
            if (classType === "VideoLengthConfig") {
              if (Array.isArray(node.widgets_values) && node.widgets_values.length > 1) {
                node.widgets_values[1] = val;
              } else if (Array.isArray(node.widgets_values) && node.widgets_values.length === 1) {
                node.widgets_values[0] = val;
              }
            } else if (Array.isArray(node.widgets_values) && node.widgets_values.length >= 1) {
              node.widgets_values[0] = val;
            }
          }
        }
      }
    }

    return cloned;
  }

  // 2. Flat API Prompt Dictionary format ({ [node_id]: { class_type, inputs: {...} } })
  if (cloned && typeof cloned === "object") {
    let targetPromptId: string | null = null;
    if (activeShot?.prompt_node_id || selectedPromptNodeId) {
      targetPromptId = String(activeShot?.prompt_node_id || selectedPromptNodeId);
    } else {
      for (const [nId, nData] of Object.entries<any>(cloned)) {
        if (nData && isExactPromptNode(nData.class_type || "", nData._meta?.title || "")) {
          targetPromptId = String(nId);
          break;
        }
      }
    }

    if (targetPromptId && cloned[targetPromptId] && effectivePrompt) {
      const pNode = cloned[targetPromptId];
      pNode.inputs = pNode.inputs || {};
      if ("value" in pNode.inputs || pNode.class_type === "PrimitiveStringMultiline") {
        pNode.inputs.value = effectivePrompt;
      } else if ("text" in pNode.inputs || pNode.class_type === "CLIPTextEncode") {
        pNode.inputs.text = effectivePrompt;
      } else {
        pNode.inputs.value = effectivePrompt;
      }
    }

    for (const [nodeId, nodeData] of Object.entries<any>(cloned)) {
      if (!nodeData || typeof nodeData !== "object") continue;
      const classType = nodeData.class_type || "";
      const metaTitle = nodeData._meta?.title || "";
      nodeData.inputs = nodeData.inputs || {};

      const isImg = isExactImageLoader(classType, metaTitle);
      const isVid = isExactVideoLoader(classType, metaTitle);
      const isAud = isExactAudioLoader(classType, metaTitle);
      const hasExplicitMapping = Boolean(effectiveMappings && nodeId in effectiveMappings && effectiveMappings[nodeId] && String(effectiveMappings[nodeId]).trim());

      if (isImg || (hasExplicitMapping && !isVid && !isAud)) {
        if (hasExplicitMapping) {
          nodeData.inputs.image = String(effectiveMappings[nodeId]).trim();
        } else if (isImg && bypassMissing) {
          const currentImg = nodeData.inputs.image;
          if (!currentImg || currentImg === "example.png") {
            nodeData.inputs.image = placeholder;
          }
        }
      } else if (isVid) {
        if (hasExplicitMapping) {
          const assigned = String(effectiveMappings[nodeId]).trim();
          nodeData.inputs.video = assigned;
          if ("video_path" in nodeData.inputs) nodeData.inputs.video_path = assigned;
        } else if (bypassMissing && (!nodeData.inputs.video || String(nodeData.inputs.video).includes("default"))) {
          nodeData.inputs.video = placeholder;
        }
      } else if (isAud) {
        if (hasExplicitMapping) {
          nodeData.inputs.audio = String(effectiveMappings[nodeId]).trim();
        } else if (bypassMissing && (!nodeData.inputs.audio || String(nodeData.inputs.audio).includes("default"))) {
          nodeData.inputs.audio = placeholder;
        }
      } else if (isSaveVideoNode(classType, metaTitle)) {
        if (saveVideoPrefix && saveVideoPrefix.trim()) {
          nodeData.inputs.filename_prefix = saveVideoPrefix.trim();
        }
      }
    }

    // Parameter Overrides (API format)
    if (effectiveParams && effectiveParamNodes) {
      if (effectiveParamNodes.steps && cloned[effectiveParamNodes.steps] && effectiveParams.steps !== undefined && effectiveParams.steps !== null) {
        const sNode = cloned[effectiveParamNodes.steps];
        sNode.inputs = sNode.inputs || {};
        const val = parseInt(String(effectiveParams.steps), 10);
        if (!isNaN(val)) {
          if ("steps" in sNode.inputs) sNode.inputs.steps = val;
          else if ("value" in sNode.inputs) sNode.inputs.value = val;
        }
      }
      if (effectiveParamNodes.megapixels && cloned[effectiveParamNodes.megapixels] && effectiveParams.megapixels !== undefined && effectiveParams.megapixels !== null) {
        const mNode = cloned[effectiveParamNodes.megapixels];
        mNode.inputs = mNode.inputs || {};
        const val = parseFloat(String(effectiveParams.megapixels));
        if (!isNaN(val)) {
          const classType = mNode.class_type || "";
          const metaTitle = mNode._meta?.title || "";
          const isResolutionSelector = classType === "ResolutionSelector" || metaTitle.toLowerCase().includes("resolution selector");
          
          if (isResolutionSelector) {
            if (activeShot?.aspect_ratio) {
              mNode.inputs.aspect_ratio = formatAspectRatioForComfyUI(activeShot.aspect_ratio);
            }
            mNode.inputs.megapixels = val;
          } else if ("megapixels" in mNode.inputs) {
            mNode.inputs.megapixels = val;
          } else if ("width" in mNode.inputs && "height" in mNode.inputs && typeof mNode.inputs.width === "number" && typeof mNode.inputs.height === "number") {
            const origW = mNode.inputs.width;
            const origH = mNode.inputs.height;
            const currentPixels = origW * origH;
            const targetPixels = val * 1024 * 1024;
            const scaleFactor = Math.sqrt(targetPixels / Math.max(1, currentPixels));
            mNode.inputs.width = Math.max(64, Math.round((origW * scaleFactor) / 16) * 16);
            mNode.inputs.height = Math.max(64, Math.round((origH * scaleFactor) / 16) * 16);
          } else if ("value" in mNode.inputs) {
            mNode.inputs.value = val;
          }
        }
      }
      if (effectiveParamNodes.frames && cloned[effectiveParamNodes.frames] && effectiveParams.frames !== undefined && effectiveParams.frames !== null) {
        const fNode = cloned[effectiveParamNodes.frames];
        fNode.inputs = fNode.inputs || {};
        const val = parseFloat(String(effectiveParams.frames));
        if (!isNaN(val)) {
          let matchedKey: string | null = null;
          for (const k of ["value", "seconds", "duration", "frames", "length", "num_frames", "frame_count", "video_length"]) {
            if (k in fNode.inputs) {
              matchedKey = k;
              break;
            }
          }
          if (matchedKey) {
            fNode.inputs[matchedKey] = val;
          } else if ("value" in fNode.inputs) {
            fNode.inputs.value = val;
          } else {
            fNode.inputs.value = val;
          }
        }
      }
    }

    return cloned;
  }

  return cloned;
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

      if (isExactPromptNode(classType, title)) {
        promptInjected = node.widgets_values?.[0] || node.widgets_values_named?.value || node.widgets_values_named?.text || "";
      } else if (isSaveVideoNode(classType, title)) {
        saveVideoPrefix = node.widgets_values?.[0] || node.widgets_values_named?.filename_prefix || "";
      } else if (isExactImageLoader(classType, title) || isExactVideoLoader(classType, title) || isExactAudioLoader(classType, title)) {
        const val = node.widgets_values?.[0] || node.widgets_values_named?.image || node.widgets_values_named?.video || node.widgets_values_named?.audio || "";
        const isBypassed = val === "empty.png" || !val;
        loaders.push({
          nodeId: strId,
          title,
          classType,
          assignedAsset: val || "",
          status: isBypassed ? (val === "empty.png" ? "bypassed" : "empty") : "assigned"
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
    appliedParameters,
    warnings
  };
}
