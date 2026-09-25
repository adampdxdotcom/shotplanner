/**
 * Pure Unified ComfyUI Workflow Graph Injection Engine
 * Shared across client (src/) and server (server/) to guarantee 100% parity in AST manipulation.
 */

import {
  isExactPromptNode,
  isExactImageLoader,
  isExactVideoLoader,
  isExactAudioLoader,
  isExactLoraLoader,
  isSaveVideoNode
} from "./comfyNodeClassifiers";
import { formatAspectRatioForComfyUI } from "./aspectRatioUtils";

export interface WorkflowInjectionOptions {
  workflowData: any;
  promptNodeId?: string | null;
  finalPrompt?: string;
  nodeMappings?: Record<string, string>;
  loraAssignments?: Record<string, { lora_name?: string; strength_model?: number; strength_clip?: number; bypassed?: boolean } | string> | null;
  bypassMissing?: boolean;
  safePlaceholder?: string;
  parameterOverrides?: {
    steps?: number | string | null;
    megapixels?: number | string | null;
    frames?: number | string | null;
    [key: string]: any;
  } | null;
  parameterNodeMappings?: {
    steps?: string | null;
    megapixels?: string | null;
    frames?: string | null;
    [key: string]: any;
  } | null;
  saveVideoPrefix?: string;
  aspectRatio?: string;
}

/**
 * Pure AST graph traversal and injection algorithm for ComfyUI.
 * Operates on both Visual Canvas ({ nodes: [...] }) and Flat API Prompt Dictionary formats.
 */
export function injectWorkflowGraph(options: WorkflowInjectionOptions): any {
  const {
    workflowData,
    promptNodeId,
    finalPrompt = "",
    nodeMappings = {},
    loraAssignments = {},
    bypassMissing = true,
    safePlaceholder = "empty.png",
    parameterOverrides = {},
    parameterNodeMappings = {},
    saveVideoPrefix = "",
    aspectRatio
  } = options;

  if (!workflowData) return null;
  const cloned = JSON.parse(JSON.stringify(workflowData));
  const placeholder = safePlaceholder || "empty.png";

  const effectiveMappings: Record<string, string> = { ...nodeMappings };
  const effectiveLoraAssignments: Record<string, any> = { ...(loraAssignments || {}) };
  const effectiveOverrides = parameterOverrides || {};
  const effectiveParamMappings = parameterNodeMappings || {};

  // -------------------------------------------------------------------------
  // Case 1: Visual Canvas Format ({ nodes: [...], links: [...] })
  // -------------------------------------------------------------------------
  if (cloned && typeof cloned === "object" && Array.isArray(cloned.nodes)) {
    let targetPromptId: string | null = null;
    if (promptNodeId) {
      targetPromptId = String(promptNodeId);
    } else {
      const pNode = cloned.nodes.find((n: any) => n && isExactPromptNode(String(n.type ?? ""), String(n.title ?? "")));
      if (pNode) targetPromptId = String(pNode.id ?? "");
    }

    for (const node of cloned.nodes) {
      if (!node || typeof node !== "object") continue;
      const strId = String(node.id ?? "");
      const classType = String(node.type ?? "");
      const metaTitle = String(node.title ?? "");

      // 1. Prompt Node Injection
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
      const isLora = isExactLoraLoader(classType, metaTitle);
      const hasExplicitMapping = Boolean(effectiveMappings && strId in effectiveMappings && effectiveMappings[strId] && String(effectiveMappings[strId]).trim());
      const hasExplicitLora = Boolean(effectiveLoraAssignments && strId in effectiveLoraAssignments && effectiveLoraAssignments[strId]);

      // 2. Image Loaders & explicitly mapped image nodes
      if (isImgLoader || (hasExplicitMapping && !isVidLoader && !isAudLoader && !isLora)) {
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
          // Mode 0: Active
          node.mode = 0;
        } else if (isImgLoader) {
          // Mode 4: Bypassed
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

      // 3. Video Loaders
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
          node.mode = 4;
          if (bypassMissing) {
            if (Array.isArray(node.widgets_values) && node.widgets_values.length > 0 && (!node.widgets_values[0] || String(node.widgets_values[0]).includes("default"))) {
              node.widgets_values[0] = placeholder;
            }
          }
        }
      }

      // 4. Audio Loaders
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
          node.mode = 4;
          if (bypassMissing) {
            if (Array.isArray(node.widgets_values) && node.widgets_values.length > 0 && (!node.widgets_values[0] || String(node.widgets_values[0]).includes("default"))) {
              node.widgets_values[0] = placeholder;
            }
          }
        }
      }

      // 5. LoRA Loader Nodes & explicit LoRA bindings
      else if (isLora || hasExplicitLora) {
        if (hasExplicitLora) {
          const loraCfg = effectiveLoraAssignments[strId];
          const loraName = typeof loraCfg === "string" ? loraCfg.trim() : (loraCfg?.lora_name || "").trim();
          const isBypassed = typeof loraCfg === "object" && loraCfg?.bypassed === true;
          const strModel = typeof loraCfg === "object" && typeof loraCfg?.strength_model === "number" ? loraCfg.strength_model : undefined;
          const strClip = typeof loraCfg === "object" && typeof loraCfg?.strength_clip === "number" ? loraCfg.strength_clip : undefined;

          if (isBypassed || !loraName) {
            node.mode = 4; // Mode 4: Bypassed
          } else {
            node.mode = 0; // Mode 0: Active
            if (Array.isArray(node.widgets_values) && node.widgets_values.length > 0) {
              node.widgets_values[0] = loraName;
              if (strModel !== undefined && node.widgets_values.length > 1) node.widgets_values[1] = strModel;
              if (strClip !== undefined && node.widgets_values.length > 2) node.widgets_values[2] = strClip;
            } else {
              node.widgets_values = [loraName, strModel ?? 1.0, strClip ?? 1.0];
            }
            if (node.widgets_values_named && typeof node.widgets_values_named === "object") {
              node.widgets_values_named.lora_name = loraName;
              if (strModel !== undefined) node.widgets_values_named.strength_model = strModel;
              if (strClip !== undefined) node.widgets_values_named.strength_clip = strClip;
            }
          }
        } else if (isLora && bypassMissing) {
          const currentVal = Array.isArray(node.widgets_values) && node.widgets_values.length > 0 ? String(node.widgets_values[0] || "") : "";
          if (!currentVal || currentVal === "None" || currentVal.toLowerCase().includes("none") || currentVal.toLowerCase().includes("placeholder")) {
            node.mode = 4;
          }
        }
      }

      // 5. SaveVideo Node Target Detection & Filename Prefix Injection
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

      // 6. Generation Parameter Overrides
      if (effectiveOverrides && effectiveParamMappings) {
        // Steps override
        if (effectiveParamMappings.steps && String(effectiveParamMappings.steps) === strId && effectiveOverrides.steps !== undefined && effectiveOverrides.steps !== null) {
          const val = parseInt(String(effectiveOverrides.steps), 10);
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

        // Megapixels override
        if (effectiveParamMappings.megapixels && String(effectiveParamMappings.megapixels) === strId && effectiveOverrides.megapixels !== undefined && effectiveOverrides.megapixels !== null) {
          const val = parseFloat(String(effectiveOverrides.megapixels));
          if (!isNaN(val)) {
            const isResolutionSelector = classType === "ResolutionSelector" || metaTitle.toLowerCase().includes("resolution selector");
            if (isResolutionSelector && Array.isArray(node.widgets_values)) {
              // ComfyUI ResolutionSelector widgets_values: [aspect_ratio_str, megapixels_float, multiplier_int]
              if (aspectRatio) {
                node.widgets_values[0] = formatAspectRatioForComfyUI(aspectRatio);
              }
              if (node.widgets_values.length > 1) {
                node.widgets_values[1] = val;
              }
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

        // Frames override
        if (effectiveParamMappings.frames && String(effectiveParamMappings.frames) === strId && effectiveOverrides.frames !== undefined && effectiveOverrides.frames !== null) {
          const rawVal = parseFloat(String(effectiveOverrides.frames));
          if (!isNaN(rawVal)) {
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

  // -------------------------------------------------------------------------
  // Case 2: Flat API Prompt Dictionary format ({ [node_id]: { class_type, inputs } })
  // -------------------------------------------------------------------------
  if (cloned && typeof cloned === "object") {
    let targetPromptId: string | null = null;
    if (promptNodeId && cloned[promptNodeId]) {
      targetPromptId = String(promptNodeId);
    } else {
      for (const [nId, nData] of Object.entries<any>(cloned)) {
        if (nData && isExactPromptNode(nData.class_type || "", nData._meta?.title || "")) {
          targetPromptId = String(nId);
          break;
        }
      }
    }

    if (targetPromptId && cloned[targetPromptId] && finalPrompt) {
      const pNode = cloned[targetPromptId];
      pNode.inputs = pNode.inputs || {};
      if ("value" in pNode.inputs || pNode.class_type === "PrimitiveStringMultiline") {
        pNode.inputs.value = finalPrompt;
      } else if ("text" in pNode.inputs || pNode.class_type === "CLIPTextEncode") {
        pNode.inputs.text = finalPrompt;
      } else {
        pNode.inputs.value = finalPrompt;
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
      const isLora = isExactLoraLoader(classType, metaTitle);
      const hasExplicitMapping = Boolean(effectiveMappings && nodeId in effectiveMappings && effectiveMappings[nodeId] && String(effectiveMappings[nodeId]).trim());
      const hasExplicitLora = Boolean(effectiveLoraAssignments && nodeId in effectiveLoraAssignments && effectiveLoraAssignments[nodeId]);

      if (isImg || (hasExplicitMapping && !isVid && !isAud && !isLora)) {
        if (hasExplicitMapping) {
          nodeData.inputs.image = String(effectiveMappings[nodeId]).trim();
        } else if (isImg && bypassMissing) {
          const currentImg = nodeData.inputs.image;
          if (!currentImg || currentImg === "example.png" || currentImg === "placeholder.png") {
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
          const assigned = String(effectiveMappings[nodeId]).trim();
          nodeData.inputs.audio = assigned;
        } else if (bypassMissing && (!nodeData.inputs.audio || String(nodeData.inputs.audio).includes("default"))) {
          nodeData.inputs.audio = placeholder;
        }
      } else if (isLora || hasExplicitLora) {
        if (hasExplicitLora) {
          const loraCfg = effectiveLoraAssignments[nodeId];
          const loraName = typeof loraCfg === "string" ? loraCfg.trim() : (loraCfg?.lora_name || "").trim();
          const strModel = typeof loraCfg === "object" && typeof loraCfg?.strength_model === "number" ? loraCfg.strength_model : undefined;
          const strClip = typeof loraCfg === "object" && typeof loraCfg?.strength_clip === "number" ? loraCfg.strength_clip : undefined;

          if (loraName) {
            nodeData.inputs.lora_name = loraName;
            if (strModel !== undefined) nodeData.inputs.strength_model = strModel;
            if (strClip !== undefined) nodeData.inputs.strength_clip = strClip;
          }
        }
      } else if (isSaveVideoNode(classType, metaTitle)) {
        if (saveVideoPrefix && saveVideoPrefix.trim()) {
          nodeData.inputs.filename_prefix = saveVideoPrefix.trim();
        }
      }
    }

    // Parameter Overrides (API format)
    if (effectiveOverrides && effectiveParamMappings) {
      if (effectiveParamMappings.steps && cloned[effectiveParamMappings.steps] && effectiveOverrides.steps !== undefined && effectiveOverrides.steps !== null) {
        const sNode = cloned[effectiveParamMappings.steps];
        sNode.inputs = sNode.inputs || {};
        const val = parseInt(String(effectiveOverrides.steps), 10);
        if (!isNaN(val)) {
          if ("steps" in sNode.inputs) sNode.inputs.steps = val;
          else if ("value" in sNode.inputs) sNode.inputs.value = val;
        }
      }
      if (effectiveParamMappings.megapixels && cloned[effectiveParamMappings.megapixels] && effectiveOverrides.megapixels !== undefined && effectiveOverrides.megapixels !== null) {
        const mNode = cloned[effectiveParamMappings.megapixels];
        mNode.inputs = mNode.inputs || {};
        const val = parseFloat(String(effectiveOverrides.megapixels));
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
      if (effectiveParamMappings.frames && cloned[effectiveParamMappings.frames] && effectiveOverrides.frames !== undefined && effectiveOverrides.frames !== null) {
        const fNode = cloned[effectiveParamMappings.frames];
        fNode.inputs = fNode.inputs || {};
        const val = parseFloat(String(effectiveOverrides.frames));
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
