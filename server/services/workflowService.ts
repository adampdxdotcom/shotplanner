import fs from "fs";
import path from "path";
import { WORKFLOWS_DIR, formatSceneFolderName, ASSETS_DIR, getSceneDirectories } from "../config/constants";
import { ParsedWorkflowData, WorkflowNodeInfo } from "../types";
import { assembleFinalPrompt, hasSceneReferencePhoto } from "../utils/formatters";
import { assetService } from "./assetService";

// Helper to accurately identify true image loader nodes
export function isExactImageLoader(classType: string, title?: string): boolean {
  const ct = (classType || "").trim();
  const t = (title || "").trim().toLowerCase();

  // Exclude latent generators, scalers, previews, saves, blends, crops, upscalers, converters
  if (/latent|save|preview|scale|crop|blend|upscale|filter|transform|convert|composite/i.test(ct)) {
    return false;
  }

  // Known ComfyUI image loader nodes
  if ([
    "LoadImage",
    "LoadImageMask",
    "LoadImageFromUrl",
    "LoadImageBase64",
    "LoadImageOutput",
    "CR Load Image",
    "LoadImagePath"
  ].includes(ct)) {
    return true;
  }

  if (/^LoadImage/i.test(ct) || /^ImageLoader/i.test(ct)) {
    return true;
  }

  if (t === "load image" || t.startsWith("load image")) {
    return true;
  }

  return false;
}

// Helper to accurately identify true video loader nodes
export function isExactVideoLoader(classType: string, title?: string): boolean {
  const ct = (classType || "").trim();
  const t = (title || "").trim().toLowerCase();

  if (/save|combine|preview|linear|cfg|encode|decode/i.test(ct)) {
    return false;
  }

  if ([
    "LoadVideo",
    "VHS_LoadVideo",
    "VHS_LoadVideoPath",
    "VHS_LoadVideoFFmpeg",
    "LoadVideoPath"
  ].includes(ct)) {
    return true;
  }

  if (/^LoadVideo/i.test(ct) || /^VideoLoader/i.test(ct) || /^VHS_LoadVideo/i.test(ct)) {
    return true;
  }

  if (t === "load video" || t.startsWith("load video")) {
    return true;
  }

  return false;
}

// Helper to accurately identify true audio loader nodes
export function isExactAudioLoader(classType: string, title?: string): boolean {
  const ct = (classType || "").trim();
  const t = (title || "").trim().toLowerCase();

  // Exclude loaders of models like AudioVAELoader, AudioModelLoader, SaveAudio
  if (/vae|model|save|preview|combine|filter/i.test(ct)) {
    return false;
  }

  if ([
    "LoadAudio",
    "VHS_LoadAudio",
    "LoadAudioPath"
  ].includes(ct)) {
    return true;
  }

  if (/^LoadAudio/i.test(ct) || /^AudioLoader/i.test(ct) || /^VHS_LoadAudio/i.test(ct)) {
    return true;
  }

  if (t === "load audio" || t.startsWith("load audio")) {
    return true;
  }

  return false;
}

// Helper to accurately identify positive prompt nodes
export function isExactPromptNode(classType: string, title?: string): boolean {
  const ct = (classType || "").trim();
  const t = (title || "").trim().toLowerCase();

  // Never treat negative prompt nodes as positive prompt
  if (t.includes("negative") || t.includes("neg prompt")) {
    return false;
  }

  if ([
    "PrimitiveStringMultiline",
    "CLIPTextEncode",
    "CLIPTextEncodeFlux",
    "CLIPTextEncodeSDXL",
    "StringLiteral",
    "ShowText"
  ].includes(ct)) {
    return true;
  }

  if (t === "prompt" || t.includes("positive prompt") || t.includes("input text (prompt)") || t === "input prompt") {
    return true;
  }

  return false;
}

// Helper to accurately identify save video output nodes
export function isSaveVideoNode(classType: string, title?: string): boolean {
  const ct = (classType || "").trim();
  const t = (title || "").trim().toLowerCase();

  if (ct === "SaveVideo" || ct === "VHS_VideoCombine") {
    return true;
  }
  if (t === "save video" || t.includes("save generated video") || t === "savevideo") {
    return true;
  }
  return false;
}

export function parseWorkflowData(workflow: any): ParsedWorkflowData {
  const promptNodes: WorkflowNodeInfo[] = [];
  const imageLoaderNodes: WorkflowNodeInfo[] = [];
  const videoLoaderNodes: WorkflowNodeInfo[] = [];
  const audioLoaderNodes: WorkflowNodeInfo[] = [];
  const otherNodes: WorkflowNodeInfo[] = [];

  const detectedNodes: { steps: string | null; megapixels: string | null; frames: string | null } = {
    steps: null,
    megapixels: null,
    frames: null
  };
  const detectedValues: Record<string, any> = {};

  // Case 1: Standard ComfyUI Visual Canvas Format ({"nodes": [...], "links": [...]})
  if (workflow && typeof workflow === "object" && Array.isArray(workflow.nodes)) {
    for (const node of workflow.nodes) {
      if (!node || typeof node !== "object") continue;
      const nodeId = String(node.id ?? "");
      const classType = String(node.type ?? "");
      const metaTitle = node.title || node.properties?.["Node name for S&R"] || `${classType} (#${nodeId})`;
      const widgetsValues = Array.isArray(node.widgets_values) ? node.widgets_values : [];
      const mode = node.mode ?? 0; // 0: active, 2: muted, 4: bypassed

      const nodeInfo: WorkflowNodeInfo = {
        id: nodeId,
        class_type: classType,
        title: metaTitle,
        mode,
        inputs: {
          widgets_values: widgetsValues,
          inputs: node.inputs || []
        }
      };

      // Check for Prompt Nodes
      if (isExactPromptNode(classType, metaTitle)) {
        const currentVal = widgetsValues.length > 0 ? widgetsValues[0] : "";
        promptNodes.push({ ...nodeInfo, current_value: typeof currentVal === "string" ? currentVal : "" });
      }
      // Check for Image Loader Nodes
      else if (isExactImageLoader(classType, metaTitle)) {
        let currentFile = "example.png";
        if (widgetsValues.length > 0 && typeof widgetsValues[0] === "string") {
          currentFile = widgetsValues[0];
        } else if (node.widgets_values_named && typeof node.widgets_values_named.image === "string") {
          currentFile = node.widgets_values_named.image;
        }
        imageLoaderNodes.push({ ...nodeInfo, current_file: currentFile });
      }
      // Check for Video Loader Nodes
      else if (isExactVideoLoader(classType, metaTitle)) {
        const currentFile = widgetsValues.length > 0 && typeof widgetsValues[0] === "string" ? widgetsValues[0] : "";
        videoLoaderNodes.push({ ...nodeInfo, current_file: currentFile });
      }
      // Check for Audio Loader Nodes
      else if (isExactAudioLoader(classType, metaTitle)) {
        const currentFile = widgetsValues.length > 0 && typeof widgetsValues[0] === "string" ? widgetsValues[0] : "";
        audioLoaderNodes.push({ ...nodeInfo, current_file: currentFile });
      } else {
        otherNodes.push(nodeInfo);
      }

      // Explicit, safe parameter detection (only if specifically a steps/length/megapixels node)
      const titleLower = metaTitle.toLowerCase();
      if (
        detectedNodes.steps === null &&
        (titleLower === "steps" || titleLower.includes("step count") || (node.widgets_values_named && "steps" in node.widgets_values_named))
      ) {
        detectedNodes.steps = nodeId;
        if (node.widgets_values_named && typeof node.widgets_values_named.steps === "number") {
          detectedValues.steps = node.widgets_values_named.steps;
        }
      }
      if (
        detectedNodes.megapixels === null &&
        (titleLower.includes("megapixel") || (node.widgets_values_named && "megapixels" in node.widgets_values_named))
      ) {
        detectedNodes.megapixels = nodeId;
        if (node.widgets_values_named && typeof node.widgets_values_named.megapixels === "number") {
          detectedValues.megapixels = node.widgets_values_named.megapixels;
        }
      }
      if (
        detectedNodes.frames === null &&
        (classType === "VideoLengthConfig" || titleLower.includes("video length") || titleLower.includes("frame count") || (node.widgets_values_named && ("frames" in node.widgets_values_named || "length" in node.widgets_values_named)))
      ) {
        detectedNodes.frames = nodeId;
        if (node.widgets_values_named) {
          detectedValues.frames = node.widgets_values_named.frames ?? node.widgets_values_named.length;
        } else if (classType === "VideoLengthConfig" && widgetsValues.length > 1) {
          detectedValues.frames = widgetsValues[1];
        }
      }
    }

    return {
      promptNodes,
      imageLoaderNodes,
      videoLoaderNodes,
      audioLoaderNodes,
      otherNodes,
      detectedNodes,
      detectedValues,
      totalNodes: workflow.nodes.length
    };
  }

  // Case 2: Flat Dictionary API format
  for (const [nodeId, nodeData] of Object.entries<any>(workflow)) {
    if (!nodeData || typeof nodeData !== "object") continue;
    const classType = nodeData.class_type || "";
    const meta = nodeData._meta || {};
    const title = meta.title || `${classType} (#${nodeId})`;
    const inputs = nodeData.inputs || {};
    const nodeInfo: WorkflowNodeInfo = { id: String(nodeId), class_type: classType, title, inputs };

    if (isExactPromptNode(classType, title)) {
      promptNodes.push({ ...nodeInfo, current_value: inputs.value ?? inputs.text ?? "" });
    } else if (isExactImageLoader(classType, title)) {
      imageLoaderNodes.push({ ...nodeInfo, current_file: inputs.image || "example.png" });
    } else if (isExactVideoLoader(classType, title)) {
      videoLoaderNodes.push({ ...nodeInfo, current_file: inputs.video || "" });
    } else if (isExactAudioLoader(classType, title)) {
      audioLoaderNodes.push({ ...nodeInfo, current_file: inputs.audio || "" });
    } else {
      otherNodes.push(nodeInfo);
    }

    if (detectedNodes.steps === null && inputs && typeof inputs === "object" && "steps" in inputs) {
      detectedNodes.steps = String(nodeId);
      detectedValues.steps = inputs.steps;
    }
    if (detectedNodes.megapixels === null && inputs && typeof inputs === "object" && "megapixels" in inputs) {
      detectedNodes.megapixels = String(nodeId);
      detectedValues.megapixels = inputs.megapixels;
    }
    if (detectedNodes.frames === null && inputs && typeof inputs === "object") {
      if ("frames" in inputs) {
        detectedNodes.frames = String(nodeId);
        detectedValues.frames = inputs.frames;
      } else if (classType === "VideoLengthConfig" && "length" in inputs) {
        detectedNodes.frames = String(nodeId);
        detectedValues.frames = inputs.length;
      }
    }
  }

  return {
    promptNodes,
    imageLoaderNodes,
    videoLoaderNodes,
    audioLoaderNodes,
    otherNodes,
    detectedNodes,
    detectedValues,
    totalNodes: Object.keys(workflow).length
  };
}

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
  saveVideoPrefix: string = ""
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
          if (node.mode === 2 || node.mode === 4) {
            node.mode = 0;
          }
        } else if (isImgLoader && bypassMissing) {
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
          if (node.mode === 2 || node.mode === 4) node.mode = 0;
        } else if (bypassMissing) {
          if (Array.isArray(node.widgets_values) && node.widgets_values.length > 0 && (!node.widgets_values[0] || String(node.widgets_values[0]).includes("default"))) {
            node.widgets_values[0] = placeholder;
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
          if (node.mode === 2 || node.mode === 4) node.mode = 0;
        } else if (bypassMissing) {
          if (Array.isArray(node.widgets_values) && node.widgets_values.length > 0 && (!node.widgets_values[0] || String(node.widgets_values[0]).includes("default"))) {
            node.widgets_values[0] = placeholder;
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
            if (node.widgets_values_named && typeof node.widgets_values_named === "object" && "megapixels" in node.widgets_values_named) {
              node.widgets_values_named.megapixels = val;
            } else if (Array.isArray(node.widgets_values) && node.widgets_values.length === 1) {
              node.widgets_values[0] = val;
            }
          }
        }
        if (parameterNodeMappings.frames && String(parameterNodeMappings.frames) === strId && parameterOverrides.frames !== undefined && parameterOverrides.frames !== null) {
          const val = parseInt(String(parameterOverrides.frames), 10);
          if (!isNaN(val)) {
            if (node.widgets_values_named && typeof node.widgets_values_named === "object") {
              for (const k of ["frames", "length", "num_frames", "duration", "frame_count", "video_length"]) {
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
            } else if (Array.isArray(node.widgets_values) && node.widgets_values.length === 1) {
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
        if ("megapixels" in mNode.inputs) mNode.inputs.megapixels = val;
        else if ("value" in mNode.inputs) mNode.inputs.value = val;
      }
    }
    if (parameterNodeMappings.frames && modifiedWf[parameterNodeMappings.frames] && parameterOverrides.frames !== undefined && parameterOverrides.frames !== null) {
      const fNode = modifiedWf[parameterNodeMappings.frames];
      fNode.inputs = fNode.inputs || {};
      const val = parseInt(String(parameterOverrides.frames), 10);
      if (!isNaN(val)) {
        let matchedKey: string | null = null;
        for (const k of ["frames", "length", "num_frames", "duration", "frame_count", "video_length"]) {
          if (k in fNode.inputs) {
            matchedKey = k;
            break;
          }
        }
        if (matchedKey) {
          fNode.inputs[matchedKey] = val;
        } else if ("value" in fNode.inputs) {
          fNode.inputs.value = val;
        }
      }
    }
  }

  return modifiedWf;
}

/**
 * Converts ComfyUI visual graph (with .nodes and .links arrays) to ComfyUI API prompt dictionary format.
 * If already in API dictionary format, returns it as-is.
 */
export function convertWorkflowToApiPrompt(workflowJson: any): Record<string, any> {
  if (!workflowJson || typeof workflowJson !== "object") return {};

  if (workflowJson.prompt && typeof workflowJson.prompt === "object" && !Array.isArray(workflowJson.prompt)) {
    return workflowJson.prompt;
  }

  // If already an API format dictionary (e.g. { "3": { "class_type": "KSampler", "inputs": {} } })
  const keys = Object.keys(workflowJson);
  const isDirectApi = keys.length > 0 && keys.every(k => {
    const val = workflowJson[k];
    return typeof val === "object" && val !== null && ("class_type" in val || "inputs" in val);
  });
  if (isDirectApi) {
    return workflowJson;
  }

  if (!Array.isArray(workflowJson.nodes)) {
    return workflowJson;
  }

  // Link lookup map: link_id -> [from_node_id_str, from_slot_index_num]
  const linkMap = new Map<number | string, [string, number]>();
  if (Array.isArray(workflowJson.links)) {
    for (const link of workflowJson.links) {
      if (!Array.isArray(link) || link.length < 5) continue;
      const [linkId, fromNodeId, fromSlot] = link;
      linkMap.set(linkId, [String(fromNodeId), Number(fromSlot)]);
    }
  }

  const apiPrompt: Record<string, any> = {};

  for (const node of workflowJson.nodes) {
    if (!node || node.mode === 2 || node.mode === 4) continue; // Skip bypassed / muted nodes
    const nodeId = String(node.id);
    const classType = node.type;
    if (!classType) continue;

    const inputs: Record<string, any> = {};

    // 1. Linked inputs from other nodes
    if (Array.isArray(node.inputs)) {
      for (const input of node.inputs) {
        if (!input || !input.name) continue;
        if (input.link !== null && input.link !== undefined && linkMap.has(input.link)) {
          inputs[input.name] = linkMap.get(input.link);
        }
      }
    }

    // 2. Named widget values
    if (node.widgets_values_named && typeof node.widgets_values_named === "object") {
      for (const [wName, wVal] of Object.entries(node.widgets_values_named)) {
        if (!(wName in inputs)) {
          inputs[wName] = wVal;
        }
      }
    }

    // 3. Positional widget values
    if (Array.isArray(node.widgets_values) && node.widgets_values.length > 0) {
      if (classType === "CLIPTextEncode" || classType === "PrimitiveStringMultiline" || classType === "ShowText") {
        if (!("text" in inputs) && !("value" in inputs)) {
          inputs["text"] = node.widgets_values[0];
        }
      } else if (classType === "LoadImage" || classType === "LoadImageMask") {
        if (!("image" in inputs)) inputs["image"] = node.widgets_values[0];
        if (node.widgets_values.length > 1 && !("upload" in inputs)) inputs["upload"] = node.widgets_values[1];
      } else if (classType === "VHS_LoadVideo" || classType === "LoadVideo") {
        if (!("video" in inputs)) inputs["video"] = node.widgets_values[0];
      } else if (classType === "VHS_LoadAudio" || classType === "LoadAudio") {
        if (!("audio" in inputs)) inputs["audio"] = node.widgets_values[0];
      } else if (classType === "SaveVideo" || classType === "VHS_VideoCombine") {
        if (!("filename_prefix" in inputs)) inputs["filename_prefix"] = node.widgets_values[0];
      } else if (classType === "KSampler" || classType === "KSamplerAdvanced") {
        const ksamplerKeys = ["seed", "control_after_generate", "steps", "cfg", "sampler_name", "scheduler", "denoise"];
        ksamplerKeys.forEach((key, idx) => {
          if (idx < node.widgets_values.length && !(key in inputs)) {
            inputs[key] = node.widgets_values[idx];
          }
        });
      } else if (classType === "EmptyLatentImage") {
        const latentKeys = ["width", "height", "batch_size"];
        latentKeys.forEach((key, idx) => {
          if (idx < node.widgets_values.length && !(key in inputs)) {
            inputs[key] = node.widgets_values[idx];
          }
        });
      } else if (classType === "VAELoader") {
        if (!("vae_name" in inputs)) inputs["vae_name"] = node.widgets_values[0];
      } else if (classType === "CheckpointLoaderSimple") {
        if (!("ckpt_name" in inputs)) inputs["ckpt_name"] = node.widgets_values[0];
      } else if (classType === "LoraLoader") {
        if (!("lora_name" in inputs)) inputs["lora_name"] = node.widgets_values[0];
        if (node.widgets_values.length > 1 && !("strength_model" in inputs)) inputs["strength_model"] = node.widgets_values[1];
        if (node.widgets_values.length > 2 && !("strength_clip" in inputs)) inputs["strength_clip"] = node.widgets_values[2];
      } else {
        if (Array.isArray(node.inputs)) {
          let widgetIdx = 0;
          for (const input of node.inputs) {
            if (input.widget && !(input.name in inputs) && widgetIdx < node.widgets_values.length) {
              inputs[input.name] = node.widgets_values[widgetIdx++];
            }
          }
        }
      }
    }

    apiPrompt[nodeId] = {
      class_type: classType,
      inputs: inputs,
      _meta: {
        title: node.title || classType
      }
    };
  }

  return apiPrompt;
}

export function listWorkflows(sceneName?: string) {
  const workflowMap = new Map<string, { filename: string; path: string; node_count: number; title: string }>();

  const scanDir = (dirPath: string, folderLabel?: string, publicPathPrefix?: string) => {
    if (!fs.existsSync(dirPath)) return;
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && /\.json$/i.test(entry.name)) {
          const f = entry.name;
          if (workflowMap.has(f.toLowerCase())) continue;
          const fullPath = path.join(dirPath, f);
          try {
            const content = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
            const parsed = parseWorkflowData(content);
            const prefix = folderLabel ? `[${folderLabel}] ` : "";
            workflowMap.set(f.toLowerCase(), {
              filename: f,
              path: publicPathPrefix ? `${publicPathPrefix}/${f}` : `/assets/workflows/${f}`,
              node_count: parsed.totalNodes,
              title: `${prefix}${f.replace(/\.json$/i, "").replace(/[_-]/g, " ")}`
            });
          } catch {
            workflowMap.set(f.toLowerCase(), {
              filename: f,
              path: publicPathPrefix ? `${publicPathPrefix}/${f}` : `/assets/workflows/${f}`,
              node_count: 0,
              title: `${folderLabel ? `[${folderLabel}] ` : ""}${f.replace(/\.json$/i, "")}`
            });
          }
        }
      }
    } catch (e) {
      console.warn(`[Workflow Scan Error] Failed reading ${dirPath}:`, e);
    }
  };

  // 1. If scene specified, scan scene workflows first
  if (sceneName) {
    const sceneFolder = formatSceneFolderName(sceneName);
    scanDir(getSceneDirectories(sceneName).workflows, sceneFolder, `/assets/${sceneFolder}/workflows`);
    scanDir(path.join(WORKFLOWS_DIR, sceneFolder), sceneFolder, `/assets/workflows/${sceneFolder}`);
  }

  // 2. Scan all scenes under ASSETS_DIR (<scene>/workflows)
  if (fs.existsSync(ASSETS_DIR)) {
    try {
      const dirs = fs.readdirSync(ASSETS_DIR, { withFileTypes: true });
      for (const d of dirs) {
        if (d.isDirectory() && d.name !== "workflows" && d.name !== "uploads") {
          const sceneWfDir = path.join(ASSETS_DIR, d.name, "workflows");
          scanDir(sceneWfDir, d.name, `/assets/${d.name}/workflows`);
        }
      }
    } catch {}
  }

  // 3. Scan subdirectories under WORKFLOWS_DIR
  if (fs.existsSync(WORKFLOWS_DIR)) {
    try {
      const dirs = fs.readdirSync(WORKFLOWS_DIR, { withFileTypes: true });
      for (const d of dirs) {
        if (d.isDirectory()) {
          scanDir(path.join(WORKFLOWS_DIR, d.name), d.name, `/assets/workflows/${d.name}`);
        }
      }
    } catch {}
  }

  // 4. Scan root WORKFLOWS_DIR and process.cwd() workflows if exists
  scanDir(WORKFLOWS_DIR, undefined, "/assets/workflows");
  const topLevelWfDir = path.join(process.cwd(), "workflows");
  if (fs.existsSync(topLevelWfDir) && topLevelWfDir !== WORKFLOWS_DIR) {
    scanDir(topLevelWfDir, undefined, "/workflows");
  }

  const workflowItems = Array.from(workflowMap.values());
  const files = workflowItems.map((item) => item.filename);
  return { workflows: files, workflow_items: workflowItems };
}

export function buildShotWorkflow(
  projectData: Record<string, any>,
  shot: Record<string, any>,
  sceneName?: string
): Record<string, any> {
  const effectiveScene =
    sceneName ||
    projectData.scene_name ||
    projectData.scene_planning?.scene_name ||
    "scene01";
  const cleanScene = effectiveScene.replace(/[^a-zA-Z0-9_-]/g, "_");

  const targetWfName =
    shot.workflow_file ||
    shot.workflow_filename ||
    projectData.workflow_file ||
    projectData.selectedWorkflowFile ||
    "default.json";

  // Attempt to load workflow
  let rawWf: any = { nodes: [], links: [] };
  const sceneWfPath = path.join(WORKFLOWS_DIR, cleanScene, targetWfName);
  const rootWfPath = path.join(WORKFLOWS_DIR, targetWfName);

  if (fs.existsSync(sceneWfPath)) {
    try {
      rawWf = JSON.parse(fs.readFileSync(sceneWfPath, "utf-8"));
    } catch {}
  } else if (fs.existsSync(rootWfPath)) {
    try {
      rawWf = JSON.parse(fs.readFileSync(rootWfPath, "utf-8"));
    } catch {}
  }

  const inspected = parseWorkflowData(rawWf);
  const imgLoaders = inspected.imageLoaderNodes || (inspected as any).image_loader_nodes || [];
  const vidLoaders = inspected.videoLoaderNodes || (inspected as any).video_loader_nodes || [];
  const audLoaders = inspected.audioLoaderNodes || (inspected as any).audio_loader_nodes || [];
  const allLoaders = [...imgLoaders, ...vidLoaders, ...audLoaders];
  const promptNodes = inspected.promptNodes || (inspected as any).prompt_nodes || [];
  const detectedNodes = inspected.detectedNodes || (inspected as any).detected_nodes || { steps: null, megapixels: null, frames: null };

  const effectiveMappings: Record<string, string> = {};
  if (projectData.nodeMappings) Object.assign(effectiveMappings, projectData.nodeMappings);
  if (projectData.node_mappings) Object.assign(effectiveMappings, projectData.node_mappings);
  if (shot.node_mappings) Object.assign(effectiveMappings, shot.node_mappings);

  const assignedSlots = shot.assigned_slots || {};
  for (const [slotKey, fn] of Object.entries(assignedSlots)) {
    if (!fn || typeof fn !== "string" || !fn.trim()) continue;
    const cleanFn = fn.trim();
    const slotIdx = parseInt(slotKey, 10);
    if (isNaN(slotIdx)) continue;

    if (slotIdx >= 0 && slotIdx <= 8) {
      if (slotIdx < imgLoaders.length) {
        effectiveMappings[imgLoaders[slotIdx].id] = cleanFn;
      } else if (slotIdx < allLoaders.length) {
        effectiveMappings[allLoaders[slotIdx].id] = cleanFn;
      }
    } else if (slotIdx === 9 || slotIdx === 10) {
      const audIdx = slotIdx - 9;
      if (audIdx < audLoaders.length) {
        effectiveMappings[audLoaders[audIdx].id] = cleanFn;
      } else if (slotIdx < allLoaders.length) {
        effectiveMappings[allLoaders[slotIdx].id] = cleanFn;
      }
    } else if (slotIdx === 11) {
      if (vidLoaders.length > 0) {
        effectiveMappings[vidLoaders[0].id] = cleanFn;
      } else if (slotIdx < allLoaders.length) {
        effectiveMappings[allLoaders[slotIdx].id] = cleanFn;
      }
    } else if (slotIdx < allLoaders.length) {
      effectiveMappings[allLoaders[slotIdx].id] = cleanFn;
    }
  }

  // Shared assets fallback
  const sharedAssets = projectData.shared_assets || [];
  if (Array.isArray(sharedAssets)) {
    sharedAssets.forEach((sa: any) => {
      if (sa && sa.filename) {
        const sIdx = sa.slot_index;
        const saFn = String(sa.filename).trim();
        if (typeof sIdx === "number" && assignedSlots[sIdx] === undefined && assignedSlots[String(sIdx)] === undefined) {
          if (sIdx >= 0 && sIdx <= 8 && sIdx < imgLoaders.length) {
            const nId = imgLoaders[sIdx].id;
            if (!effectiveMappings[nId]) effectiveMappings[nId] = saFn;
          } else if ((sIdx === 9 || sIdx === 10) && sIdx - 9 < audLoaders.length) {
            const nId = audLoaders[sIdx - 9].id;
            if (!effectiveMappings[nId]) effectiveMappings[nId] = saFn;
          } else if (sIdx === 11 && vidLoaders.length > 0) {
            const nId = vidLoaders[0].id;
            if (!effectiveMappings[nId]) effectiveMappings[nId] = saFn;
          }
        }
      }
    });
  }

  const effectivePromptNodeId =
    shot.prompt_node_id ||
    projectData.selectedPromptNodeId ||
    projectData.prompt_node_id ||
    (promptNodes.length > 0 ? promptNodes[0].id : "");

  const effectivePrompt = shot.expanded_prompt || shot.prompt || shot.basic_stub || projectData.expanded_prompt || "";

  const rawParams =
    shot.generation_parameters ||
    shot.generation_params ||
    shot.generationParams ||
    shot.parameter_overrides ||
    projectData.generation_parameters ||
    projectData.generation_params ||
    projectData.generationParams ||
    projectData.parameter_overrides;

  const effectiveParams: Record<string, any> = {};
  const effectiveParamNodes: Record<string, string> = {};

  const explicitParamNodes =
    shot.parameter_node_mappings ||
    shot.parameterNodeMappings ||
    projectData.parameter_node_mappings ||
    projectData.parameterNodeMappings;
  if (explicitParamNodes && typeof explicitParamNodes === "object") {
    Object.entries(explicitParamNodes).forEach(([pk, pn]) => {
      if (pn) effectiveParamNodes[pk] = String(pn);
    });
  } else if (detectedNodes) {
    if (detectedNodes.steps) effectiveParamNodes.steps = detectedNodes.steps;
    if (detectedNodes.megapixels) effectiveParamNodes.megapixels = detectedNodes.megapixels;
    if (detectedNodes.frames) effectiveParamNodes.frames = detectedNodes.frames;
  }

  if (rawParams && typeof rawParams === "object") {
    Object.entries(rawParams).forEach(([pk, pv]: [string, any]) => {
      if (pv && typeof pv === "object") {
        if (pv.value !== undefined && pv.value !== null) effectiveParams[pk] = pv.value;
        if (pv.node_id) effectiveParamNodes[pk] = String(pv.node_id);
      } else if (pv !== undefined && pv !== null) {
        effectiveParams[pk] = pv;
      }
    });
  }

  const shotNum = shot.shot_number ?? 1;
  const shotNumStr = String(shotNum).padStart(2, "0");
  const saveVideoPrefix = shot.save_video_prefix || projectData.save_video_prefix || `${cleanScene}_shot_${shotNumStr}`;
  const bypassMissing = shot.bypass_missing ?? shot.bypassMissing ?? projectData.bypass_missing ?? projectData.bypassMissing ?? true;
  const safePlaceholder = shot.safe_placeholder || projectData.safe_placeholder || "empty.png";

  return injectAndPrepareWorkflowData(
    rawWf,
    effectivePromptNodeId,
    effectivePrompt,
    effectiveMappings,
    Boolean(bypassMissing),
    safePlaceholder,
    effectiveParams,
    effectiveParamNodes,
    "",
    saveVideoPrefix
  );
}
