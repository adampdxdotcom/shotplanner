import { ParsedWorkflowData, WorkflowNodeInfo, WorkflowLoraSlot } from "../../types";
import {
  isExactPromptNode,
  isExactImageLoader,
  isExactVideoLoader,
  isExactAudioLoader,
  isExactLoraLoader
} from "../../../src/shared/comfyNodeClassifiers";

/**
 * Categorize nodes for UI inspector, parameter discovery, and input mapping.
 */
export function categorizeWorkflowNode(classType: string, metaTitle: string): string {
  const t = (metaTitle || "").toLowerCase();
  const c = (classType || "").toLowerCase();

  if (isExactPromptNode(classType, metaTitle)) return "Prompt";
  if (isExactImageLoader(classType, metaTitle)) return "Image Loader";
  if (isExactVideoLoader(classType, metaTitle)) return "Video Loader";
  if (isExactAudioLoader(classType, metaTitle)) return "Audio Loader";
  if (isExactLoraLoader(classType, metaTitle)) return "LoRA Loader";
  if (c.includes("sampler") || c.includes("scheduler") || t.includes("sampler") || t.includes("step") || c.includes("fluxguidance")) return "Sampler / Steps";
  if (c.includes("latent") || c.includes("resolution") || c.includes("megapixels") || t.includes("resolution") || t.includes("megapixel") || c.includes("scale")) return "Resolution / Latent";
  if (c.includes("video") || c.includes("frame") || c.includes("duration") || c.includes("animatediff") || t.includes("video") || t.includes("frame") || t.includes("length")) return "Video / Frames";
  if (c.includes("loader") || c.includes("checkpoint") || c.includes("vae") || c.includes("clip")) return "Model / VAE";
  if (c.includes("save") || c.includes("preview") || t.includes("save") || t.includes("output")) return "Output / Save";
  return "Utility / Other";
}

/**
 * Parses ComfyUI workflow JSON (supports both visual canvas format and API prompt dict).
 * Discovers prompt nodes, image/video/audio loaders, LoRA slots, and auto-detects steps, resolution, and frame parameters.
 */
export function parseWorkflowData(workflow: any): ParsedWorkflowData {
  const promptNodes: WorkflowNodeInfo[] = [];
  const imageLoaderNodes: WorkflowNodeInfo[] = [];
  const videoLoaderNodes: WorkflowNodeInfo[] = [];
  const audioLoaderNodes: WorkflowNodeInfo[] = [];
  const loraLoaderNodes: WorkflowNodeInfo[] = [];
  const loraSlots: WorkflowLoraSlot[] = [];
  const otherNodes: WorkflowNodeInfo[] = [];
  const allNodes: WorkflowNodeInfo[] = [];

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
      const category = categorizeWorkflowNode(classType, metaTitle);

      const nodeInfo: WorkflowNodeInfo = {
        id: nodeId,
        class_type: classType,
        title: metaTitle,
        category,
        mode,
        inputs: {
          widgets_values: widgetsValues,
          widgets_values_named: node.widgets_values_named || {},
          inputs: node.inputs || []
        }
      };

      // Categorized group collections
      if (category === "Prompt") {
        const currentVal = widgetsValues.length > 0 ? widgetsValues[0] : "";
        promptNodes.push({ ...nodeInfo, current_value: typeof currentVal === "string" ? currentVal : "" });
      } else if (category === "Image Loader") {
        let currentFile = "example.png";
        if (widgetsValues.length > 0 && typeof widgetsValues[0] === "string") {
          currentFile = widgetsValues[0];
        } else if (node.widgets_values_named && typeof node.widgets_values_named.image === "string") {
          currentFile = node.widgets_values_named.image;
        }
        imageLoaderNodes.push({ ...nodeInfo, current_file: currentFile });
      } else if (category === "Video Loader") {
        const currentFile = widgetsValues.length > 0 && typeof widgetsValues[0] === "string" ? widgetsValues[0] : "";
        videoLoaderNodes.push({ ...nodeInfo, current_file: currentFile });
      } else if (category === "Audio Loader") {
        const currentFile = widgetsValues.length > 0 && typeof widgetsValues[0] === "string" ? widgetsValues[0] : "";
        audioLoaderNodes.push({ ...nodeInfo, current_file: currentFile });
      } else if (category === "LoRA Loader") {
        let loraName = "";
        let strModel = 1.0;
        let strClip = 1.0;

        if (node.widgets_values_named && typeof node.widgets_values_named === "object") {
          loraName = node.widgets_values_named.lora_name || node.widgets_values_named.lora || "";
          if (typeof node.widgets_values_named.strength_model === "number") strModel = node.widgets_values_named.strength_model;
          if (typeof node.widgets_values_named.strength_clip === "number") strClip = node.widgets_values_named.strength_clip;
        }
        if (!loraName && widgetsValues.length > 0 && typeof widgetsValues[0] === "string") {
          loraName = widgetsValues[0];
        }
        if (widgetsValues.length > 1 && typeof widgetsValues[1] === "number") {
          strModel = widgetsValues[1];
        }
        if (widgetsValues.length > 2 && typeof widgetsValues[2] === "number") {
          strClip = widgetsValues[2];
        }

        const loraDetails = {
          lora_name: loraName,
          strength_model: strModel,
          strength_clip: strClip,
          bypassed: mode === 4
        };

        const enrichedNode = {
          ...nodeInfo,
          current_file: loraName,
          lora_details: loraDetails
        };

        loraLoaderNodes.push(enrichedNode);
        loraSlots.push({
          id: nodeId,
          node_id: nodeId,
          class_type: classType,
          title: metaTitle,
          lora_name: loraName,
          strength_model: strModel,
          strength_clip: strClip,
          mode,
          is_bypassed: mode === 4,
          category
        });
      } else {
        otherNodes.push(nodeInfo);
      }

      allNodes.push(nodeInfo);

      // Resilient Parameter Auto-Detection
      const titleLower = metaTitle.toLowerCase();
      const classLower = classType.toLowerCase();

      // 1. Steps Detection
      if (detectedNodes.steps === null) {
        if (node.widgets_values_named && typeof node.widgets_values_named.steps === "number") {
          detectedNodes.steps = nodeId;
          detectedValues.steps = node.widgets_values_named.steps;
        } else if (titleLower === "steps" || titleLower.includes("step count") || titleLower.includes("sampling steps")) {
          detectedNodes.steps = nodeId;
          if (typeof widgetsValues[0] === "number") detectedValues.steps = widgetsValues[0];
        } else if (classLower.includes("ksampler") || classLower.includes("basicscheduler")) {
          detectedNodes.steps = nodeId;
          // KSampler widget 2 is usually steps (seed, steps, cfg...)
          if (widgetsValues.length > 2 && typeof widgetsValues[2] === "number") {
            detectedValues.steps = widgetsValues[2];
          } else if (typeof widgetsValues[0] === "number") {
            detectedValues.steps = widgetsValues[0];
          }
        }
      }

      // 2. Megapixels / Resolution Detection
      if (detectedNodes.megapixels === null) {
        if (classType === "ResolutionSelector" || titleLower.includes("resolution selector")) {
          detectedNodes.megapixels = nodeId;
          if (widgetsValues.length > 1 && typeof widgetsValues[1] === "number") {
            detectedValues.megapixels = widgetsValues[1];
          } else if (node.widgets_values_named && typeof node.widgets_values_named.megapixels === "number") {
            detectedValues.megapixels = node.widgets_values_named.megapixels;
          }
        } else if (node.widgets_values_named && typeof node.widgets_values_named.megapixels === "number") {
          detectedNodes.megapixels = nodeId;
          detectedValues.megapixels = node.widgets_values_named.megapixels;
        } else if (titleLower.includes("megapixel") || titleLower.includes("megapixels") || titleLower.includes("resolution")) {
          detectedNodes.megapixels = nodeId;
          if (typeof widgetsValues[0] === "number") detectedValues.megapixels = widgetsValues[0];
          else if (widgetsValues.length > 1 && typeof widgetsValues[1] === "number") detectedValues.megapixels = widgetsValues[1];
        } else if (classLower.includes("emptylatentimage") || classLower.includes("modelsamplingsd3")) {
          detectedNodes.megapixels = nodeId;
          if (widgetsValues.length >= 2 && typeof widgetsValues[0] === "number" && typeof widgetsValues[1] === "number") {
            const mp = Math.round(((widgetsValues[0] * widgetsValues[1]) / (1024 * 1024)) * 100) / 100;
            detectedValues.megapixels = mp;
          }
        }
      }

      // 3. Frames / Duration Detection
      if (detectedNodes.frames === null) {
        if (node.widgets_values_named && ("frames" in node.widgets_values_named || "length" in node.widgets_values_named || "num_frames" in node.widgets_values_named)) {
          detectedNodes.frames = nodeId;
          detectedValues.frames = node.widgets_values_named.frames ?? node.widgets_values_named.length ?? node.widgets_values_named.num_frames;
        } else if (classType === "VideoLengthConfig" || titleLower.includes("video length") || titleLower.includes("frame count") || titleLower.includes("num frames")) {
          detectedNodes.frames = nodeId;
          if (classType === "VideoLengthConfig" && widgetsValues.length > 1) {
            detectedValues.frames = widgetsValues[1];
          } else if (typeof widgetsValues[0] === "number") {
            detectedValues.frames = widgetsValues[0];
          }
        } else if (classLower.includes("wanvideo") || classLower.includes("hunyuanvideolatent") || classLower.includes("animatediff")) {
          detectedNodes.frames = nodeId;
          if (widgetsValues.length > 0 && typeof widgetsValues[widgetsValues.length - 1] === "number") {
            detectedValues.frames = widgetsValues[widgetsValues.length - 1];
          }
        }
      }
    }

    return {
      promptNodes,
      imageLoaderNodes,
      videoLoaderNodes,
      audioLoaderNodes,
      loraLoaderNodes,
      loraSlots,
      otherNodes,
      allNodes,
      detectedNodes,
      detectedValues,
      totalNodes: workflow.nodes.length
    };
  }

  // Case 2: Flat Dictionary API format
  for (const [nodeId, nodeData] of Object.entries<any>(workflow || {})) {
    if (!nodeData || typeof nodeData !== "object") continue;
    const classType = nodeData.class_type || "";
    const meta = nodeData._meta || {};
    const title = meta.title || `${classType} (#${nodeId})`;
    const inputs = nodeData.inputs || {};
    const category = categorizeWorkflowNode(classType, title);
    const nodeInfo: WorkflowNodeInfo = { id: String(nodeId), class_type: classType, title, category, inputs };

    if (category === "Prompt") {
      promptNodes.push({ ...nodeInfo, current_value: inputs.value ?? inputs.text ?? "" });
    } else if (category === "Image Loader") {
      imageLoaderNodes.push({ ...nodeInfo, current_file: inputs.image || "example.png" });
    } else if (category === "Video Loader") {
      videoLoaderNodes.push({ ...nodeInfo, current_file: inputs.video || "" });
    } else if (category === "Audio Loader") {
      audioLoaderNodes.push({ ...nodeInfo, current_file: inputs.audio || "" });
    } else if (category === "LoRA Loader") {
      const loraName = inputs.lora_name || inputs.lora || "";
      const strModel = typeof inputs.strength_model === "number" ? inputs.strength_model : 1.0;
      const strClip = typeof inputs.strength_clip === "number" ? inputs.strength_clip : 1.0;
      const loraDetails = {
        lora_name: loraName,
        strength_model: strModel,
        strength_clip: strClip,
        bypassed: false
      };
      loraLoaderNodes.push({ ...nodeInfo, current_file: loraName, lora_details: loraDetails });
      loraSlots.push({
        id: String(nodeId),
        node_id: String(nodeId),
        class_type: classType,
        title,
        lora_name: loraName,
        strength_model: strModel,
        strength_clip: strClip,
        mode: 0,
        is_bypassed: false,
        category
      });
    } else {
      otherNodes.push(nodeInfo);
    }

    allNodes.push(nodeInfo);

    const classLower = classType.toLowerCase();
    const titleLower = title.toLowerCase();

    if (detectedNodes.steps === null && inputs && typeof inputs === "object") {
      if ("steps" in inputs) {
        detectedNodes.steps = String(nodeId);
        detectedValues.steps = inputs.steps;
      } else if (classLower.includes("ksampler") || classLower.includes("scheduler")) {
        detectedNodes.steps = String(nodeId);
        if (typeof inputs.steps === "number") detectedValues.steps = inputs.steps;
      }
    }
    if (detectedNodes.megapixels === null && inputs && typeof inputs === "object") {
      if ("megapixels" in inputs) {
        detectedNodes.megapixels = String(nodeId);
        detectedValues.megapixels = inputs.megapixels;
      } else if ("width" in inputs && "height" in inputs && typeof inputs.width === "number" && typeof inputs.height === "number") {
        detectedNodes.megapixels = String(nodeId);
        detectedValues.megapixels = Math.round(((inputs.width * inputs.height) / (1024 * 1024)) * 100) / 100;
      }
    }
    if (detectedNodes.frames === null && inputs && typeof inputs === "object") {
      if ("frames" in inputs) {
        detectedNodes.frames = String(nodeId);
        detectedValues.frames = inputs.frames;
      } else if ("num_frames" in inputs) {
        detectedNodes.frames = String(nodeId);
        detectedValues.frames = inputs.num_frames;
      } else if ("length" in inputs) {
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
    loraLoaderNodes,
    loraSlots,
    otherNodes,
    allNodes,
    detectedNodes,
    detectedValues,
    totalNodes: workflow ? Object.keys(workflow).length : 0
  };
}
