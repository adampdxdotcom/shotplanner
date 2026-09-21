import {
  isExactPromptNode,
  isExactImageLoader,
  isExactVideoLoader,
  isExactAudioLoader,
  isSaveVideoNode
} from "../../../src/shared/comfyNodeClassifiers";
import { formatAspectRatioForComfyUI } from "../../../src/shared/aspectRatioUtils";
import { assembleFinalPrompt, hasSceneReferencePhoto } from "../../utils/formatters";
import { assetService } from "../assetService";

/**
 * Injects prompt, node mappings, media assets, generation parameters, and save video prefixes
 * into a ComfyUI workflow (both visual canvas and flat API dictionary format).
 */
export function injectAndPrepareWorkflowData(
  workflowData: any,
  promptNodeId: string | null | undefined,
  expandedPrompt: string,
  nodeMappings: Record<string, string>,
  bypassMissing: boolean = true,
  safePlaceholder: string = "empty.png",
  parameterOverrides: Record<string, any> = {},
  parameterNodeMappings: Record<string, string> = {},
  promptPrefix: string = "",
  saveVideoPrefix: string = "",
  aspectRatio?: string
): any {
  const modifiedWf = JSON.parse(JSON.stringify(workflowData));
  const placeholder = safePlaceholder || "empty.png";

  const rawDb = assetService.getRawDatabase();
  const mappedFilenames = Object.values(nodeMappings).filter(Boolean);
  const mappedAssets = mappedFilenames.map((fn) => rawDb.find((a) => a.filename === fn)).filter(Boolean);
  const isSceneRefPresent = hasSceneReferencePhoto(mappedAssets) || hasSceneReferencePhoto(rawDb);

  const finalPrompt = assembleFinalPrompt(expandedPrompt, promptPrefix, isSceneRefPresent);

  // Case 1: Visual Canvas Format ({"nodes": [...], "links": [...]})
  if (modifiedWf && typeof modifiedWf === "object" && Array.isArray(modifiedWf.nodes)) {
    // 1. Identify specific prompt target node upfront
    let targetPromptId: string | null = null;
    if (promptNodeId) {
      targetPromptId = String(promptNodeId);
    } else {
      const pNode = modifiedWf.nodes.find((n: any) => n && isExactPromptNode(String(n.type ?? ""), String(n.title ?? "")));
      if (pNode) targetPromptId = String(pNode.id ?? "");
    }

    for (const node of modifiedWf.nodes) {
      if (!node || typeof node !== "object") continue;
      const strId = String(node.id ?? "");
      const classType = String(node.type ?? "");
      const metaTitle = String(node.title ?? "");

      // Designated Prompt Node Injection
      if (targetPromptId && strId === targetPromptId && finalPrompt) {
        if (Array.isArray(node.widgets_values) && node.widgets_values.length > 0) {
          node.widgets_values[0] = finalPrompt;
        } else {
          node.widgets_values = [finalPrompt];
        }
        if (node.widgets_values_named && typeof node.widgets_values_named === "object") {
          node.widgets_values_named.value = finalPrompt;
          node.widgets_values_named.text = finalPrompt;
        }
      }

      const isImgLoader = isExactImageLoader(classType, metaTitle);
      const isVidLoader = isExactVideoLoader(classType, metaTitle);
      const isAudLoader = isExactAudioLoader(classType, metaTitle);
      const hasExplicitMapping = Boolean(nodeMappings && strId in nodeMappings && nodeMappings[strId] && String(nodeMappings[strId]).trim());

      // Image Loaders & Explicitly mapped image nodes
      if (isImgLoader || (hasExplicitMapping && !isVidLoader && !isAudLoader)) {
        if (hasExplicitMapping) {
          const assigned = String(nodeMappings[strId]).trim();
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
          // Explicitly set bypassed mode (mode: 4) when unassigned
          node.mode = 4;
          if (bypassMissing) {
            // Only bypass true unassigned image loaders
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

      // Video Loaders
      else if (isVidLoader) {
        if (hasExplicitMapping) {
          const assigned = String(nodeMappings[strId]).trim();
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
          node.mode = 4;
          if (bypassMissing) {
            if (Array.isArray(node.widgets_values) && node.widgets_values.length > 0 && (!node.widgets_values[0] || String(node.widgets_values[0]).includes("default"))) {
              node.widgets_values[0] = placeholder;
            }
          }
        }
      }

      // Audio Loaders
      else if (isAudLoader) {
        if (hasExplicitMapping) {
          const assigned = String(nodeMappings[strId]).trim();
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
          node.mode = 4;
          if (bypassMissing) {
            if (Array.isArray(node.widgets_values) && node.widgets_values.length > 0 && (!node.widgets_values[0] || String(node.widgets_values[0]).includes("default"))) {
              node.widgets_values[0] = placeholder;
            }
          }
        }
      }

      // Generation Parameter Overrides: ONLY if this specific node ID was explicitly mapped
      if (parameterOverrides && parameterNodeMappings) {
        if (parameterNodeMappings.steps && String(parameterNodeMappings.steps) === strId && parameterOverrides.steps !== undefined && parameterOverrides.steps !== null) {
          const val = parseInt(String(parameterOverrides.steps), 10);
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
        if (parameterNodeMappings.megapixels && String(parameterNodeMappings.megapixels) === strId && parameterOverrides.megapixels !== undefined && parameterOverrides.megapixels !== null) {
          const val = parseFloat(String(parameterOverrides.megapixels));
          if (!isNaN(val)) {
            const isResolutionSelector = classType === "ResolutionSelector" || metaTitle.toLowerCase().includes("resolution selector");
            if (isResolutionSelector && Array.isArray(node.widgets_values)) {
              // ComfyUI ResolutionSelector widgets_values: [aspect_ratio_str, megapixels_float, multiplier_int]
              // Update aspect ratio at index 0 from shot aspect ratio
              if (aspectRatio) {
                node.widgets_values[0] = formatAspectRatioForComfyUI(aspectRatio);
              }
              // Update megapixels at index 1
              if (node.widgets_values.length > 1) {
                node.widgets_values[1] = val;
              }
              // Multiplier at index 2 is left untouched
              if (node.widgets_values_named && typeof node.widgets_values_named === "object") {
                if ("aspect_ratio" in node.widgets_values_named && aspectRatio) {
                  node.widgets_values_named.aspect_ratio = formatAspectRatioForComfyUI(aspectRatio);
                }
                if ("megapixels" in node.widgets_values_named) {
                  node.widgets_values_named.megapixels = val;
                }
              }
            } else if (node.widgets_values_named && typeof node.widgets_values_named === "object" && "megapixels" in node.widgets_values_named) {
              node.widgets_values_named.megapixels = val;
            } else if (Array.isArray(node.widgets_values) && node.widgets_values.length === 1) {
              node.widgets_values[0] = val;
            }
          }
        }
        if (parameterNodeMappings.frames && String(parameterNodeMappings.frames) === strId && parameterOverrides.frames !== undefined && parameterOverrides.frames !== null) {
          const val = parseFloat(String(parameterOverrides.frames));
          if (!isNaN(val)) {
            if (node.widgets_values_named && typeof node.widgets_values_named === "object") {
              for (const k of ["value", "seconds", "duration", "frames", "length", "num_frames", "frame_count", "video_length"]) {
                if (k in node.widgets_values_named) {
                  node.widgets_values_named[k] = val;
                  break;
                }
              }
            } else if (classType === "VideoLengthConfig") {
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

      // SaveVideo Node Target Detection & Filename Prefix Injection
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
    }

    return modifiedWf;
  }

  // Case 2: Flat API Dictionary format
  let targetPromptId: string | null = null;
  if (promptNodeId && modifiedWf[promptNodeId]) {
    targetPromptId = String(promptNodeId);
  } else {
    for (const [nId, nData] of Object.entries<any>(modifiedWf)) {
      if (nData && isExactPromptNode(nData.class_type || "", nData._meta?.title || "")) {
        targetPromptId = String(nId);
        break;
      }
    }
  }

  if (targetPromptId && modifiedWf[targetPromptId] && finalPrompt) {
    const pNode = modifiedWf[targetPromptId];
    pNode.inputs = pNode.inputs || {};
    if ("value" in pNode.inputs || pNode.class_type === "PrimitiveStringMultiline") {
      pNode.inputs.value = finalPrompt;
    } else if ("text" in pNode.inputs || pNode.class_type === "CLIPTextEncode") {
      pNode.inputs.text = finalPrompt;
    } else {
      pNode.inputs.value = finalPrompt;
    }
  }

  for (const [nodeId, nodeData] of Object.entries<any>(modifiedWf)) {
    if (!nodeData || typeof nodeData !== "object") continue;
    const classType = nodeData.class_type || "";
    const metaTitle = nodeData._meta?.title || "";
    nodeData.inputs = nodeData.inputs || {};

    const isImg = isExactImageLoader(classType, metaTitle);
    const isVid = isExactVideoLoader(classType, metaTitle);
    const isAud = isExactAudioLoader(classType, metaTitle);
    const hasExplicitMapping = Boolean(nodeMappings && nodeId in nodeMappings && nodeMappings[nodeId] && String(nodeMappings[nodeId]).trim());

    if (isImg || (hasExplicitMapping && !isVid && !isAud)) {
      if (hasExplicitMapping) {
        nodeData.inputs.image = String(nodeMappings[nodeId]).trim();
      } else if (isImg && bypassMissing) {
        const currentImg = nodeData.inputs.image;
        if (!currentImg || currentImg === "example.png") {
          nodeData.inputs.image = placeholder;
        }
      }
    } else if (isVid) {
      if (hasExplicitMapping) {
        nodeData.inputs.video = String(nodeMappings[nodeId]).trim();
      } else if (bypassMissing && (!nodeData.inputs.video || String(nodeData.inputs.video).includes("default"))) {
        nodeData.inputs.video = placeholder;
      }
    } else if (isAud) {
      if (hasExplicitMapping) {
        nodeData.inputs.audio = String(nodeMappings[nodeId]).trim();
      } else if (bypassMissing && (!nodeData.inputs.audio || String(nodeData.inputs.audio).includes("default"))) {
        nodeData.inputs.audio = placeholder;
      }
    } else if (isSaveVideoNode(classType, metaTitle)) {
      if (saveVideoPrefix && saveVideoPrefix.trim()) {
        nodeData.inputs.filename_prefix = saveVideoPrefix.trim();
      }
    }
  }

  if (parameterOverrides && parameterNodeMappings) {
    if (parameterNodeMappings.steps && modifiedWf[parameterNodeMappings.steps] && parameterOverrides.steps !== undefined && parameterOverrides.steps !== null) {
      const sNode = modifiedWf[parameterNodeMappings.steps];
      sNode.inputs = sNode.inputs || {};
      const val = parseInt(String(parameterOverrides.steps), 10);
      if (!isNaN(val)) {
        if ("steps" in sNode.inputs) sNode.inputs.steps = val;
        else if ("value" in sNode.inputs) sNode.inputs.value = val;
      }
    }
    if (parameterNodeMappings.megapixels && modifiedWf[parameterNodeMappings.megapixels] && parameterOverrides.megapixels !== undefined && parameterOverrides.megapixels !== null) {
      const mNode = modifiedWf[parameterNodeMappings.megapixels];
      mNode.inputs = mNode.inputs || {};
      const val = parseFloat(String(parameterOverrides.megapixels));
      if (!isNaN(val)) {
        const classType = mNode.class_type || "";
        const metaTitle = mNode._meta?.title || "";
        const isResolutionSelector = classType === "ResolutionSelector" || metaTitle.toLowerCase().includes("resolution selector");
        if (isResolutionSelector) {
          if (aspectRatio) {
            mNode.inputs.aspect_ratio = formatAspectRatioForComfyUI(aspectRatio);
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
    if (parameterNodeMappings.frames && modifiedWf[parameterNodeMappings.frames] && parameterOverrides.frames !== undefined && parameterOverrides.frames !== null) {
      const fNode = modifiedWf[parameterNodeMappings.frames];
      fNode.inputs = fNode.inputs || {};
      const val = parseFloat(String(parameterOverrides.frames));
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

  return modifiedWf;
}
