import { ShotItem, GenerationParameters, ParameterNodeMappings } from "../types";
import { formatShotNumber, generateSaveVideoPrefix } from "./formatters";

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

  const effectivePromptNodeId = activeShot?.prompt_node_id || selectedPromptNodeId;
  
  // Resolve effective prompt with hero take prioritization
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
    for (const node of cloned.nodes) {
      if (!node || typeof node !== "object") continue;
      const strId = String(node.id ?? "");
      const classType = String(node.type ?? "");
      const title = String(node.title ?? "");

      // Prompt Node Injection
      if (
        (effectivePromptNodeId && strId === String(effectivePromptNodeId)) ||
        (!effectivePromptNodeId && (["PrimitiveStringMultiline", "CLIPTextEncode", "StringLiteral", "ShowText"].includes(classType) || title.toLowerCase().includes("prompt")))
      ) {
        if (effectivePrompt) {
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
      }

      // Image Loader Nodes Injection
      if (
        ["LoadImage", "LoadImageMask", "LoadImageFromUrl", "LoadImageBase64"].includes(classType) ||
        classType.toLowerCase().includes("image") ||
        strId in effectiveMappings
      ) {
        if (effectiveMappings[strId] && String(effectiveMappings[strId]).trim()) {
          const assigned = String(effectiveMappings[strId]).trim();
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
        } else {
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
      else if (["LoadVideo", "VHS_LoadVideo", "VHS_LoadVideoPath"].includes(classType)) {
        if (effectiveMappings[strId] && String(effectiveMappings[strId]).trim()) {
          const assigned = String(effectiveMappings[strId]).trim();
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

      // Audio Loader Nodes Injection
      else if (["LoadAudio", "VHS_LoadAudio"].includes(classType)) {
        if (effectiveMappings[strId] && String(effectiveMappings[strId]).trim()) {
          const assigned = String(effectiveMappings[strId]).trim();
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

      // SaveVideo Node Target Injection
      if (
        (classType === "SaveVideo" || node.type === "SaveVideo" || strId === "92" || title.toLowerCase().includes("save video") || classType.includes("VHS_VideoCombine")) &&
        saveVideoPrefix
      ) {
        if (Array.isArray(node.widgets_values) && node.widgets_values.length > 0) {
          node.widgets_values[0] = saveVideoPrefix;
        } else {
          node.widgets_values = [saveVideoPrefix];
        }
        if (node.widgets_values_named && typeof node.widgets_values_named === "object") {
          node.widgets_values_named.filename_prefix = saveVideoPrefix;
        }
      }

      // Generation Parameter Overrides (Visual Canvas)
      if (effectiveParams && effectiveParamNodes) {
        // Steps
        if (effectiveParamNodes.steps === strId && effectiveParams.steps !== undefined) {
          const val = parseInt(String(effectiveParams.steps), 10);
          if (!isNaN(val)) {
            if (Array.isArray(node.widgets_values) && node.widgets_values.length > 0) {
              node.widgets_values[0] = val;
            } else {
              node.widgets_values = [val];
            }
            if (node.widgets_values_named && typeof node.widgets_values_named === "object") {
              node.widgets_values_named.steps = val;
            }
          }
        }
        // Megapixels
        if (effectiveParamNodes.megapixels === strId && effectiveParams.megapixels !== undefined) {
          const val = parseFloat(String(effectiveParams.megapixels));
          if (!isNaN(val)) {
            if (Array.isArray(node.widgets_values) && node.widgets_values.length > 0) {
              node.widgets_values[0] = val;
            } else {
              node.widgets_values = [val];
            }
            if (node.widgets_values_named && typeof node.widgets_values_named === "object") {
              node.widgets_values_named.megapixels = val;
            }
          }
        }
        // Frames
        if (effectiveParamNodes.frames === strId && effectiveParams.frames !== undefined) {
          const val = parseInt(String(effectiveParams.frames), 10);
          if (!isNaN(val)) {
            if (Array.isArray(node.widgets_values)) {
              if (node.widgets_values.length > 1) node.widgets_values[1] = val;
              else if (node.widgets_values.length > 0) node.widgets_values[0] = val;
              else node.widgets_values = [val];
            }
            if (node.widgets_values_named && typeof node.widgets_values_named === "object") {
              for (const k of ["frames", "length", "num_frames", "duration", "frame_count", "video_length", "videolength", "latentvideo", "emptylatent", "vhs", "minimax", "value", "int"]) {
                if (k in node.widgets_values_named) {
                  node.widgets_values_named[k] = val;
                  break;
                }
              }
            }
          }
        }
      }
    }

    return cloned;
  }

  // 2. Flat API Prompt Dictionary format ({ [node_id]: { class_type, inputs: {...} } })
  if (cloned && typeof cloned === "object") {
    for (const [nodeId, nodeData] of Object.entries(cloned)) {
      if (!nodeData || typeof nodeData !== "object") continue;
      const n = nodeData as any;
      const classType = String(n.class_type || n._meta?.title || "");
      if (!n.inputs || typeof n.inputs !== "object") {
        n.inputs = {};
      }

      // Prompt Node Injection
      if (
        (effectivePromptNodeId && String(nodeId) === String(effectivePromptNodeId)) ||
        (!effectivePromptNodeId && (["PrimitiveStringMultiline", "CLIPTextEncode", "StringLiteral", "ShowText"].includes(classType) || classType.toLowerCase().includes("prompt")))
      ) {
        if (effectivePrompt) {
          if ("text" in n.inputs) n.inputs.text = effectivePrompt;
          else if ("value" in n.inputs) n.inputs.value = effectivePrompt;
          else if ("string" in n.inputs) n.inputs.string = effectivePrompt;
          else n.inputs.text = effectivePrompt;
        }
      }

      // Image Loaders
      if (
        ["LoadImage", "LoadImageMask", "LoadImageFromUrl", "LoadImageBase64"].includes(classType) ||
        classType.toLowerCase().includes("image") ||
        String(nodeId) in effectiveMappings
      ) {
        if (effectiveMappings[String(nodeId)] && String(effectiveMappings[String(nodeId)]).trim()) {
          n.inputs.image = String(effectiveMappings[String(nodeId)]).trim();
        } else if (bypassMissing) {
          if (!n.inputs.image || n.inputs.image === "example.png") {
            n.inputs.image = placeholder;
          }
        }
      }

      // Video Loaders
      if (["LoadVideo", "VHS_LoadVideo", "VHS_LoadVideoPath"].includes(classType)) {
        if (effectiveMappings[String(nodeId)] && String(effectiveMappings[String(nodeId)]).trim()) {
          const assigned = String(effectiveMappings[String(nodeId)]).trim();
          n.inputs.video = assigned;
          if ("video_path" in n.inputs) n.inputs.video_path = assigned;
        } else if (bypassMissing) {
          n.inputs.video = placeholder;
        }
      }

      // Audio Loaders
      if (["LoadAudio", "VHS_LoadAudio"].includes(classType)) {
        if (effectiveMappings[String(nodeId)] && String(effectiveMappings[String(nodeId)]).trim()) {
          n.inputs.audio = String(effectiveMappings[String(nodeId)]).trim();
        } else if (bypassMissing) {
          n.inputs.audio = placeholder;
        }
      }

      // SaveVideo Prefix
      if (
        (classType === "SaveVideo" || String(nodeId) === "92" || classType.includes("VHS_VideoCombine")) &&
        saveVideoPrefix
      ) {
        n.inputs.filename_prefix = saveVideoPrefix;
      }

      // Parameter Overrides (API format)
      if (effectiveParams && effectiveParamNodes) {
        if (effectiveParamNodes.steps === String(nodeId) && effectiveParams.steps !== undefined) {
          const val = parseInt(String(effectiveParams.steps), 10);
          if (!isNaN(val)) {
            if ("steps" in n.inputs) n.inputs.steps = val;
            else if ("value" in n.inputs) n.inputs.value = val;
          }
        }
        if (effectiveParamNodes.megapixels === String(nodeId) && effectiveParams.megapixels !== undefined) {
          const val = parseFloat(String(effectiveParams.megapixels));
          if (!isNaN(val)) {
            if ("megapixels" in n.inputs) n.inputs.megapixels = val;
            else if ("value" in n.inputs) n.inputs.value = val;
          }
        }
        if (effectiveParamNodes.frames === String(nodeId) && effectiveParams.frames !== undefined) {
          const val = parseInt(String(effectiveParams.frames), 10);
          if (!isNaN(val)) {
            for (const k of ["frames", "length", "num_frames", "duration", "frame_count", "video_length", "value"]) {
              if (k in n.inputs) {
                n.inputs[k] = val;
                break;
              }
            }
          }
        }
      }
    }

    return cloned;
  }

  return cloned;
}
