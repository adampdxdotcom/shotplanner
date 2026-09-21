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
      } else if (classType === "ResolutionSelector") {
        const resKeys = ["aspect_ratio", "megapixels", "multiplier"];
        resKeys.forEach((key, idx) => {
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
