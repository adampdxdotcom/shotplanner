import fs from "fs";
import path from "path";
import { WORKFLOWS_DIR, formatSceneFolderName } from "../config/constants";
import { ParsedWorkflowData, WorkflowNodeInfo } from "../types";
import { assembleFinalPrompt, hasSceneReferencePhoto } from "../utils/formatters";
import { assetService } from "./assetService";

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
      if (
        ["PrimitiveStringMultiline", "CLIPTextEncode", "StringLiteral", "ShowText"].includes(classType) ||
        metaTitle.toLowerCase().includes("prompt")
      ) {
        const currentVal = widgetsValues.length > 0 ? widgetsValues[0] : "";
        promptNodes.push({ ...nodeInfo, current_value: typeof currentVal === "string" ? currentVal : "" });
      }
      // Check for Image Loader Nodes
      else if (
        ["LoadImage", "LoadImageMask", "LoadImageFromUrl", "LoadImageBase64"].includes(classType) ||
        (classType.toLowerCase().includes("image") &&
          !classType.toLowerCase().includes("save") &&
          !classType.toLowerCase().includes("preview"))
      ) {
        let currentFile = "example.png";
        if (widgetsValues.length > 0 && typeof widgetsValues[0] === "string") {
          currentFile = widgetsValues[0];
        } else if (node.widgets_values_named && typeof node.widgets_values_named.image === "string") {
          currentFile = node.widgets_values_named.image;
        }
        imageLoaderNodes.push({ ...nodeInfo, current_file: currentFile });
      }
      // Check for Video Nodes
      else if (
        ["LoadVideo", "VHS_LoadVideo", "VHS_LoadVideoPath"].includes(classType) ||
        classType.toLowerCase().includes("video")
      ) {
        const currentFile = widgetsValues.length > 0 && typeof widgetsValues[0] === "string" ? widgetsValues[0] : "";
        videoLoaderNodes.push({ ...nodeInfo, current_file: currentFile });
      }
      // Check for Audio Nodes
      else if (
        ["LoadAudio", "VHS_LoadAudio"].includes(classType) ||
        classType.toLowerCase().includes("audio")
      ) {
        const currentFile = widgetsValues.length > 0 && typeof widgetsValues[0] === "string" ? widgetsValues[0] : "";
        audioLoaderNodes.push({ ...nodeInfo, current_file: currentFile });
      } else {
        otherNodes.push(nodeInfo);
      }

      // Auto-detect dynamic parameter nodes
      if (
        detectedNodes.steps === null &&
        (classType.toLowerCase().includes("step") ||
          classType.toLowerCase().includes("sampler") ||
          classType.toLowerCase().includes("videolength"))
      ) {
        detectedNodes.steps = nodeId;
        if (widgetsValues.length > 0) detectedValues.steps = widgetsValues[0];
      }
      if (
        detectedNodes.megapixels === null &&
        (classType.toLowerCase().includes("megapixel") || classType.toLowerCase().includes("resolution"))
      ) {
        detectedNodes.megapixels = nodeId;
        if (widgetsValues.length > 0) detectedValues.megapixels = widgetsValues[0];
      }

      // Broad duration/frame pattern matching
      const durationKeywords = ["frame", "length", "duration", "videolength", "emptylatent", "latentvideo", "vhs", "minimax"];
      const isDurationCandidate = durationKeywords.some(
        (kw) => classType.toLowerCase().includes(kw) || metaTitle.toLowerCase().includes(kw)
      );

      if (detectedNodes.frames === null && isDurationCandidate) {
        detectedNodes.frames = nodeId;
        let foundVal: any = null;
        if (node.widgets_values_named && typeof node.widgets_values_named === "object") {
          for (const k of ["frames", "length", "num_frames", "duration", "frame_count", "video_length", "videolength", "latentvideo", "emptylatent", "vhs", "minimax", "value", "int", "count", "amount"]) {
            if (k in node.widgets_values_named && typeof node.widgets_values_named[k] === "number") {
              foundVal = node.widgets_values_named[k];
              break;
            }
          }
        }
        if (foundVal === null) {
          if (widgetsValues.length > 1 && typeof widgetsValues[1] === "number") foundVal = widgetsValues[1];
          else if (widgetsValues.length > 0 && typeof widgetsValues[0] === "number") foundVal = widgetsValues[0];
        }
        if (foundVal !== null) {
          detectedValues.frames = foundVal;
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

    if (["PrimitiveStringMultiline", "CLIPTextEncode", "StringLiteral", "ShowText"].includes(classType)) {
      promptNodes.push({ ...nodeInfo, current_value: inputs.value ?? inputs.text ?? "" });
    } else if (["LoadImage", "LoadImageMask", "LoadImageFromUrl", "LoadImageBase64"].includes(classType)) {
      imageLoaderNodes.push({ ...nodeInfo, current_file: inputs.image || "example.png" });
    } else if (["LoadVideo", "VHS_LoadVideo", "VHS_LoadVideoPath"].includes(classType)) {
      videoLoaderNodes.push({ ...nodeInfo, current_file: inputs.video || "" });
    } else if (["LoadAudio", "VHS_LoadAudio"].includes(classType)) {
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
    const durationKeywords = ["frame", "length", "duration", "videolength", "emptylatent", "latentvideo", "vhs", "minimax"];
    const isDurationCandidate = durationKeywords.some(
      (kw) => classType.toLowerCase().includes(kw) || title.toLowerCase().includes(kw)
    );

    if (detectedNodes.frames === null && inputs && typeof inputs === "object") {
      let matchedKey: string | null = null;
      for (const frameKey of ["frames", "length", "num_frames", "duration", "frame_count", "video_length", "videolength", "latentvideo", "emptylatent", "vhs", "minimax", "value", "int"]) {
        if (frameKey in inputs) {
          matchedKey = frameKey;
          break;
        }
      }
      if (matchedKey || isDurationCandidate) {
        detectedNodes.frames = String(nodeId);
        if (matchedKey && typeof inputs[matchedKey] === "number") {
          detectedValues.frames = inputs[matchedKey];
        } else {
          for (const [k, v] of Object.entries(inputs)) {
            if (typeof v === "number") {
              detectedValues.frames = v;
              break;
            }
          }
        }
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
    for (const node of modifiedWf.nodes) {
      if (!node || typeof node !== "object") continue;
      const strId = String(node.id ?? "");
      const classType = String(node.type ?? "");

      // Prompt Node
      if (
        (promptNodeId && strId === String(promptNodeId)) ||
        (!promptNodeId && (["PrimitiveStringMultiline", "CLIPTextEncode", "StringLiteral", "ShowText"].includes(classType) || String(node.title || "").toLowerCase().includes("prompt")))
      ) {
        if (finalPrompt) {
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
      }

      // Image Loaders
      if (
        ["LoadImage", "LoadImageMask", "LoadImageFromUrl", "LoadImageBase64"].includes(classType) ||
        classType.toLowerCase().includes("image") ||
        strId in nodeMappings
      ) {
        if (nodeMappings[strId] && String(nodeMappings[strId]).trim()) {
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
        } else {
          // Unassigned slot -> bypass with empty.png
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

      // Video Loaders
      else if (["LoadVideo", "VHS_LoadVideo", "VHS_LoadVideoPath"].includes(classType)) {
        if (nodeMappings[strId] && String(nodeMappings[strId]).trim()) {
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
      else if (["LoadAudio", "VHS_LoadAudio"].includes(classType)) {
        if (nodeMappings[strId] && String(nodeMappings[strId]).trim()) {
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

      // Generation Parameter Overrides (Visual Canvas)
      if (parameterOverrides && parameterNodeMappings) {
        if (parameterNodeMappings.steps === strId && parameterOverrides.steps !== undefined) {
          const val = parseInt(String(parameterOverrides.steps), 10);
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
        if (parameterNodeMappings.megapixels === strId && parameterOverrides.megapixels !== undefined) {
          const val = parseFloat(String(parameterOverrides.megapixels));
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
        if (parameterNodeMappings.frames === strId && parameterOverrides.frames !== undefined) {
          const val = parseInt(String(parameterOverrides.frames), 10);
          if (!isNaN(val)) {
            if (Array.isArray(node.widgets_values)) {
              if (node.widgets_values.length > 1) node.widgets_values[1] = val;
              else if (node.widgets_values.length > 0) node.widgets_values[0] = val;
              else node.widgets_values = [val];
            }
            if (node.widgets_values_named && typeof node.widgets_values_named === "object") {
              for (const k of ["frames", "length", "num_frames", "duration", "frame_count"]) {
                if (k in node.widgets_values_named) {
                  node.widgets_values_named[k] = val;
                  break;
                }
              }
            }
          }
        }
      }

      // SaveVideo Node Target Detection & Filename Prefix Injection
      const isSaveVideoNode =
        classType === "SaveVideo" ||
        node.type === "SaveVideo" ||
        strId === "92" ||
        (node.title && String(node.title).toLowerCase().includes("save video"));

      if (isSaveVideoNode && saveVideoPrefix && saveVideoPrefix.trim()) {
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
  if (promptNodeId && modifiedWf[promptNodeId]) {
    const pNode = modifiedWf[promptNodeId];
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
    nodeData.inputs = nodeData.inputs || {};

    if (["LoadImage", "LoadImageMask", "LoadImageFromUrl", "LoadImageBase64"].includes(classType)) {
      if (nodeMappings[nodeId] && String(nodeMappings[nodeId]).trim()) {
        nodeData.inputs.image = String(nodeMappings[nodeId]).trim();
      } else {
        const currentImg = nodeData.inputs.image;
        if (!currentImg || currentImg === "example.png" || bypassMissing) {
          nodeData.inputs.image = placeholder;
        }
      }
    } else if (["LoadVideo", "VHS_LoadVideo", "VHS_LoadVideoPath"].includes(classType)) {
      if (nodeMappings[nodeId] && String(nodeMappings[nodeId]).trim()) {
        nodeData.inputs.video = String(nodeMappings[nodeId]).trim();
      } else if (bypassMissing && (!nodeData.inputs.video || String(nodeData.inputs.video).includes("default"))) {
        nodeData.inputs.video = placeholder;
      }
    } else if (["LoadAudio", "VHS_LoadAudio"].includes(classType)) {
      if (nodeMappings[nodeId] && String(nodeMappings[nodeId]).trim()) {
        nodeData.inputs.audio = String(nodeMappings[nodeId]).trim();
      } else if (bypassMissing && (!nodeData.inputs.audio || String(nodeData.inputs.audio).includes("default"))) {
        nodeData.inputs.audio = placeholder;
      }
    } else if (
      classType === "SaveVideo" ||
      nodeId === "92" ||
      (nodeData._meta && String(nodeData._meta.title).toLowerCase().includes("save video"))
    ) {
      if (saveVideoPrefix && saveVideoPrefix.trim()) {
        nodeData.inputs.filename_prefix = saveVideoPrefix.trim();
      }
    }
  }

  if (parameterOverrides && parameterNodeMappings) {
    if (parameterNodeMappings.steps && modifiedWf[parameterNodeMappings.steps] && parameterOverrides.steps !== undefined) {
      const sNode = modifiedWf[parameterNodeMappings.steps];
      sNode.inputs = sNode.inputs || {};
      sNode.inputs.steps = Number(parameterOverrides.steps);
    }
    if (parameterNodeMappings.megapixels && modifiedWf[parameterNodeMappings.megapixels] && parameterOverrides.megapixels !== undefined) {
      const mNode = modifiedWf[parameterNodeMappings.megapixels];
      mNode.inputs = mNode.inputs || {};
      mNode.inputs.megapixels = Number(parameterOverrides.megapixels);
    }
    if (parameterNodeMappings.frames && modifiedWf[parameterNodeMappings.frames] && parameterOverrides.frames !== undefined) {
      const fNode = modifiedWf[parameterNodeMappings.frames];
      fNode.inputs = fNode.inputs || {};
      let matchedKey = "frames";
      for (const k of ["frames", "length", "num_frames", "duration", "frame_count", "video_length", "videolength", "latentvideo", "emptylatent", "vhs", "minimax", "value", "int"]) {
        if (k in fNode.inputs) {
          matchedKey = k;
          break;
        }
      }
      fNode.inputs[matchedKey] = Number(parameterOverrides.frames);
    }
  }

  return modifiedWf;
}

export function listWorkflows(sceneName?: string) {
  if (!fs.existsSync(WORKFLOWS_DIR)) return { workflows: [], workflow_items: [] };

  const workflowMap = new Map<string, { filename: string; path: string; node_count: number; title: string }>();

  // 1. Check scene-specific workflows folder if specified or default
  const sceneFolders = sceneName
    ? [formatSceneFolderName(sceneName)]
    : fs
        .readdirSync(WORKFLOWS_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

  sceneFolders.forEach((folder) => {
    const sceneWfDir = path.join(WORKFLOWS_DIR, folder);
    if (fs.existsSync(sceneWfDir)) {
      const files = fs.readdirSync(sceneWfDir).filter((f) => f.endsWith(".json"));
      files.forEach((f) => {
        try {
          const content = JSON.parse(fs.readFileSync(path.join(sceneWfDir, f), "utf-8"));
          const parsed = parseWorkflowData(content);
          workflowMap.set(f, {
            filename: f,
            path: `/assets/workflows/${folder}/${f}`,
            node_count: parsed.totalNodes,
            title: `[${folder}] ${f.replace(/\.json$/, "").replace(/[_-]/g, " ")}`
          });
        } catch {
          workflowMap.set(f, {
            filename: f,
            path: `/assets/workflows/${folder}/${f}`,
            node_count: 0,
            title: `[${folder}] ${f.replace(/\.json$/, "")}`
          });
        }
      });
    }
  });

  // 2. Also check root workflows directory
  const rootFiles = fs.readdirSync(WORKFLOWS_DIR, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".json"))
    .map((d) => d.name);

  rootFiles.forEach((f) => {
    if (!workflowMap.has(f)) {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(WORKFLOWS_DIR, f), "utf-8"));
        const parsed = parseWorkflowData(content);
        workflowMap.set(f, {
          filename: f,
          path: `/assets/workflows/${f}`,
          node_count: parsed.totalNodes,
          title: f.replace(/\.json$/, "").replace(/[_-]/g, " ")
        });
      } catch {
        workflowMap.set(f, {
          filename: f,
          path: `/assets/workflows/${f}`,
          node_count: 0,
          title: f.replace(/\.json$/, "")
        });
      }
    }
  });

  const workflowItems = Array.from(workflowMap.values());
  const files = workflowItems.map((item) => item.filename);
  return { workflows: files, workflow_items: workflowItems };
}
