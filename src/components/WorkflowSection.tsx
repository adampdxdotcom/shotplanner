import React, { useState, useEffect, useMemo } from "react";
import { WorkflowItem, ParsedWorkflow, MediaAsset, GenerationParameters, ParameterNodeMappings, ShotItem, SceneProjectFile } from "../types";
import { getAssetMediaUrl } from "../utils/assetUrl";
import { formatShotNumber, generateSaveVideoPrefix } from "../utils/formatters";
import { copyToClipboard } from "../utils/clipboard";
import { GenerationParametersSection } from "./GenerationParametersSection";
import { JsonViewerWithSearch } from "./JsonViewerWithSearch";
import { 
  Workflow, 
  Upload, 
  Layers, 
  Type, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  Music, 
  ArrowRight, 
  Code, 
  Check, 
  Copy,
  FileJson,
  AlertTriangle,
  RefreshCw
} from "lucide-react";

/**
 * Performs live in-memory injection of active shot assets, prompt, and parameters
 * into the workflow canvas JSON for instant preview and copy.
 */
function generateLiveInjectedWorkflow(
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
  const effectivePrompt = activeShot?.expanded_prompt || "";

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
  const saveVideoPrefix = generateSaveVideoPrefix(activeSceneName, shotNumStr);

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
        (classType === "SaveVideo" || node.type === "SaveVideo" || strId === "92" || title.toLowerCase().includes("save video")) &&
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

  // 2. Flat API Dictionary format
  if (effectivePromptNodeId && cloned[effectivePromptNodeId]) {
    const pNode = cloned[effectivePromptNodeId];
    pNode.inputs = pNode.inputs || {};
    if ("value" in pNode.inputs || pNode.class_type === "PrimitiveStringMultiline") {
      pNode.inputs.value = effectivePrompt;
    } else {
      pNode.inputs.text = effectivePrompt;
    }
  } else if (effectivePrompt) {
    for (const [, nData] of Object.entries<any>(cloned)) {
      if (nData && ["PrimitiveStringMultiline", "CLIPTextEncode", "StringLiteral", "ShowText"].includes(nData.class_type)) {
        nData.inputs = nData.inputs || {};
        if ("value" in nData.inputs || nData.class_type === "PrimitiveStringMultiline") {
          nData.inputs.value = effectivePrompt;
        } else {
          nData.inputs.text = effectivePrompt;
        }
        break;
      }
    }
  }

  for (const [nodeId, nodeData] of Object.entries<any>(cloned)) {
    if (!nodeData || typeof nodeData !== "object") continue;
    const classType = nodeData.class_type || "";
    nodeData.inputs = nodeData.inputs || {};

    if (["LoadImage", "LoadImageMask", "LoadImageFromUrl", "LoadImageBase64"].includes(classType) || classType.toLowerCase().includes("image") || nodeId in effectiveMappings) {
      if (effectiveMappings[nodeId] && String(effectiveMappings[nodeId]).trim()) {
        nodeData.inputs.image = String(effectiveMappings[nodeId]).trim();
      } else {
        const currentImg = nodeData.inputs.image;
        if (!currentImg || currentImg === "example.png" || bypassMissing) {
          nodeData.inputs.image = placeholder;
        }
      }
    } else if (["LoadVideo", "VHS_LoadVideo", "VHS_LoadVideoPath"].includes(classType)) {
      if (effectiveMappings[nodeId] && String(effectiveMappings[nodeId]).trim()) {
        nodeData.inputs.video = String(effectiveMappings[nodeId]).trim();
      } else if (bypassMissing && (!nodeData.inputs.video || String(nodeData.inputs.video).includes("default"))) {
        nodeData.inputs.video = placeholder;
      }
    } else if (["LoadAudio", "VHS_LoadAudio"].includes(classType)) {
      if (effectiveMappings[nodeId] && String(effectiveMappings[nodeId]).trim()) {
        nodeData.inputs.audio = String(effectiveMappings[nodeId]).trim();
      } else if (bypassMissing && (!nodeData.inputs.audio || String(nodeData.inputs.audio).includes("default"))) {
        nodeData.inputs.audio = placeholder;
      }
    } else if (
      classType === "SaveVideo" ||
      nodeId === "92" ||
      (nodeData._meta && String(nodeData._meta.title).toLowerCase().includes("save video"))
    ) {
      if (saveVideoPrefix) {
        nodeData.inputs.filename_prefix = saveVideoPrefix;
      }
    }
  }

  if (effectiveParams && effectiveParamNodes) {
    if (effectiveParamNodes.steps && cloned[effectiveParamNodes.steps] && effectiveParams.steps !== undefined) {
      const sNode = cloned[effectiveParamNodes.steps];
      sNode.inputs = sNode.inputs || {};
      sNode.inputs.steps = Number(effectiveParams.steps);
    }
    if (effectiveParamNodes.megapixels && cloned[effectiveParamNodes.megapixels] && effectiveParams.megapixels !== undefined) {
      const mNode = cloned[effectiveParamNodes.megapixels];
      mNode.inputs = mNode.inputs || {};
      mNode.inputs.megapixels = Number(effectiveParams.megapixels);
    }
    if (effectiveParamNodes.frames && cloned[effectiveParamNodes.frames] && effectiveParams.frames !== undefined) {
      const fNode = cloned[effectiveParamNodes.frames];
      fNode.inputs = fNode.inputs || {};
      let matchedKey = "frames";
      for (const k of ["frames", "length", "num_frames", "duration", "frame_count", "video_length", "videolength", "latentvideo", "emptylatent", "vhs", "minimax", "value", "int"]) {
        if (k in fNode.inputs) {
          matchedKey = k;
          break;
        }
      }
      fNode.inputs[matchedKey] = Number(effectiveParams.frames);
    }
  }

  return cloned;
}

interface WorkflowSectionProps {
  activeSceneName: string;
  workflows: WorkflowItem[];
  selectedWorkflowFile: string;
  onSelectWorkflow: (filename: string) => void;
  onRefreshWorkflows: () => void;
  parsedWorkflow: ParsedWorkflow | null;
  selectedPromptNodeId: string;
  onSelectPromptNodeId: (nodeId: string) => void;
  nodeMappings: Record<string, string>; // { [nodeId]: filename }
  onUpdateMapping: (nodeId: string, filename: string) => void;
  uploadedAssets: MediaAsset[];
  bypassMissing: boolean;
  onToggleBypass: (val: boolean) => void;
  generationParams: GenerationParameters;
  onUpdateParam: (key: keyof GenerationParameters, value: number) => void;
  parameterNodeMappings: ParameterNodeMappings;
  onUpdateParameterMapping: (key: keyof ParameterNodeMappings, nodeId: string) => void;
  activeShotId: string | null;
  onSelectShot: (id: string | null) => void;
  sceneProject: SceneProjectFile;
  onUpdateShot: (updater: (prev: ShotItem) => ShotItem) => void;
}

export const WorkflowSection: React.FC<WorkflowSectionProps> = ({
  workflows,
  selectedWorkflowFile,
  onSelectWorkflow,
  onRefreshWorkflows,
  parsedWorkflow,
  selectedPromptNodeId,
  onSelectPromptNodeId,
  nodeMappings,
  onUpdateMapping,
  uploadedAssets,
  bypassMissing,
  onToggleBypass,
  generationParams,
  onUpdateParam,
  parameterNodeMappings,
  onUpdateParameterMapping,
  activeShotId,
  onSelectShot,
  sceneProject,
  onUpdateShot,
  activeSceneName
}) => {
  const [uploading, setUploading] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);

  const promptNodes = parsedWorkflow?.nodes_info?.prompt_nodes || [];
  const imageNodes = parsedWorkflow?.nodes_info?.image_loader_nodes || [];
  const videoNodes = parsedWorkflow?.nodes_info?.video_loader_nodes || [];
  const audioNodes = parsedWorkflow?.nodes_info?.audio_loader_nodes || [];

  const activeShot = sceneProject.shots.find((s) => s.id === activeShotId);

  // Compute live in-memory injected workflow JSON for the active shot
  const liveInjectedWorkflow = useMemo(() => {
    return generateLiveInjectedWorkflow(
      parsedWorkflow?.raw_json,
      activeShot,
      selectedPromptNodeId,
      nodeMappings,
      bypassMissing,
      generationParams,
      parameterNodeMappings,
      activeSceneName || sceneProject.scene_name,
      imageNodes
    );
  }, [
    parsedWorkflow?.raw_json,
    activeShot,
    selectedPromptNodeId,
    nodeMappings,
    bypassMissing,
    generationParams,
    parameterNodeMappings,
    activeSceneName,
    sceneProject.scene_name,
    imageNodes
  ]);

  const handleCopyJson = async () => {
    const targetJson = liveInjectedWorkflow || parsedWorkflow?.raw_json;
    if (!targetJson) return;
    try {
      const textToCopy = JSON.stringify(targetJson, null, 2);
      const success = await copyToClipboard(textToCopy);
      if (success) {
        setCopiedJson(true);
        setTimeout(() => setCopiedJson(false), 2000);
      }
    } catch (err) {
      console.error("Failed to copy JSON:", err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      setUploadError("Only .json ComfyUI workflow files are allowed.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("scene_name", activeSceneName);

    try {
      const res = await fetch("/api/workflows/upload", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        onRefreshWorkflows();
        onSelectWorkflow(data.filename);
        if (activeShotId) {
          onUpdateShot(prev => ({ ...prev, workflow_file: data.filename }));
        }
      } else {
        setUploadError(data.error || "Failed to upload workflow");
      }
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div id="workflow-section" className="space-y-5 flex flex-col min-h-0">
      {/* Workflow Screen Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm font-medium text-zinc-300 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-indigo-400" />
            Shot Context:
          </label>
          <select 
            value={activeShotId || ""}
            onChange={(e) => onSelectShot(e.target.value || null)}
            className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none min-w-[280px]"
          >
            <option key="empty" value="">-- Select a Shot to Map Workflow --</option>
            {sceneProject.shots.map(s => (
              <option key={s.id} value={s.id}>
                Shot {s.shot_number.toString().padStart(2, '0')}: {s.shot_name || s.shot_type || "Shot"} {s.workflow_file ? `[${s.workflow_file}]` : `[Scene Default]`}
              </option>
            ))}
          </select>
          {activeShot && (
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <span className="px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-medium">
                Shot {activeShot.shot_number.toString().padStart(2, '0')}
              </span>
              {activeShot.workflow_file ? (
                <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  Custom WF: {activeShot.workflow_file}
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                  Using Scene Default WF
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {!activeShotId ? (
        <div className="flex flex-col items-center justify-center p-12 bg-zinc-900/40 border-2 border-dashed border-zinc-800 rounded-xl">
          <Layers className="w-12 h-12 text-zinc-600 mb-4" />
          <h2 className="text-xl font-semibold text-zinc-300 mb-2">No Shot Selected</h2>
          <p className="text-sm text-zinc-500 text-center max-w-md">
            Select a shot from the dropdown above to assign a ComfyUI workflow template and map its image loader nodes.
          </p>
        </div>
      ) : (
        <div className="bg-zinc-900/60 border-2 border-zinc-700 rounded-xl p-5 shadow-sm space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Workflow className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">Workflow &amp; Dynamic Node Mapping</h2>
                <p className="text-xs text-zinc-400">Select standard visual canvas workflow JSON, inspect all loader nodes (active &amp; bypassed), and map uploaded media assets to Node IDs.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Upload Button */}
              <label className={`cursor-pointer px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs ${!activeShotId || uploading ? "opacity-50 cursor-not-allowed" : ""}`}>
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                <span>{uploading ? "Uploading..." : "Upload Visual Workflow JSON"}</span>
                <input 
                  type="file" 
                  accept=".json" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                  disabled={!activeShotId || uploading}
                />
              </label>

              {parsedWorkflow && (
                <button
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-950 border-2 border-zinc-700 rounded-lg transition-colors flex items-center gap-1"
                  title="Inspect flat dictionary JSON"
                >
                  <Code className="w-3.5 h-3.5" />
                  <span>{showRawJson ? "Hide JSON" : "Show JSON"}</span>
                </button>
              )}
            </div>
          </div>

      {uploadError && (
        <div className="p-3 rounded-lg bg-red-950/30 border border-red-800/40 text-xs text-red-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Workflow Selection Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
        <div className="md:col-span-2 space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <FileJson className="w-3.5 h-3.5 text-amber-400" />
            Selected Workflow (/assets/workflows/)
          </label>
          <div className="flex items-center gap-2">
            <select
              value={selectedWorkflowFile}
              onChange={(e) => {
                const val = e.target.value;
                onSelectWorkflow(val);
                if (activeShotId) {
                  onUpdateShot(prev => ({ ...prev, workflow_file: val }));
                }
              }}
              className="flex-1 bg-zinc-950 border-2 border-zinc-700 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none transition-colors"
            >
              {workflows.length === 0 && <option key="empty" value="">No workflows found in /assets/workflows</option>}
              {workflows.map((wf, i) => (
                <option key={`wf-${wf.filename}-${i}`} value={wf.filename}>
                  {wf.title} ({wf.filename} • {wf.node_count} nodes)
                </option>
              ))}
            </select>

            <button
              onClick={onRefreshWorkflows}
              className="p-2 text-zinc-400 hover:text-zinc-200 bg-zinc-950 border-2 border-zinc-700 rounded-lg transition-colors"
              title="Refresh workflows list"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Missing Asset Bypass Toggle */}
        <div className="bg-zinc-950/50 p-2.5 rounded-lg border-2 border-zinc-700/80 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-300">Missing Asset Bypass</span>
            <input
              type="checkbox"
              id="bypass-toggle"
              checked={bypassMissing}
              onChange={(e) => onToggleBypass(e.target.checked)}
              className="rounded bg-zinc-800 border-zinc-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
            />
          </div>
          <p className="text-[11px] text-zinc-400">
            Auto-injects <code className="text-zinc-200 bg-zinc-800 px-1 py-0.5 rounded">empty.png</code> for unmapped slots so ComfyUI won't fail.
          </p>
        </div>
      </div>

      {/* Raw JSON inspection collapsible with search */}
      {showRawJson && parsedWorkflow && (
        <JsonViewerWithSearch
          data={liveInjectedWorkflow || parsedWorkflow.raw_json}
          activeShotNumber={activeShot ? activeShot.shot_number : "01"}
          isVisualWorkflow={Array.isArray(liveInjectedWorkflow?.nodes)}
          nodeCount={
            Array.isArray(liveInjectedWorkflow?.nodes)
              ? liveInjectedWorkflow.nodes.length
              : Object.keys(liveInjectedWorkflow || parsedWorkflow.raw_json || {}).length
          }
        />
      )}

      {/* Dynamic Node Mapping UI */}
      {parsedWorkflow && (
        <div className="space-y-4 pt-1">
          {/* 1. Prompt Text Node Target */}
          <div className="bg-zinc-950/40 p-3.5 rounded-lg border-2 border-zinc-700/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-indigo-400" />
                Target Text Prompt Node (inputs.value or inputs.text)
              </span>
              <span className="text-[11px] text-zinc-400">
                {promptNodes.length} candidate prompt node(s) detected
              </span>
            </div>

            {promptNodes.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {promptNodes.map((pNode) => {
                  const isSelected = selectedPromptNodeId === pNode.id;
                  return (
                    <button
                      key={pNode.id}
                      onClick={() => {
                        onSelectPromptNodeId(pNode.id);
                        if (activeShotId) {
                          onUpdateShot(prev => ({ ...prev, prompt_node_id: pNode.id }));
                        }
                      }}
                      className={`p-2.5 rounded-lg text-left border transition-all ${
                        isSelected 
                          ? "bg-indigo-950/40 border-indigo-500 text-indigo-200 ring-1 ring-indigo-500/50" 
                          : "bg-zinc-900/40 border-zinc-800 text-zinc-300 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-zinc-100">Node #{pNode.id}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                      </div>
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">{pNode.title || pNode.class_type}</p>
                      <p className="text-[10px] text-zinc-400 font-mono truncate mt-1">Class: {pNode.class_type}</p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-2.5 rounded bg-zinc-900 text-zinc-400 text-xs">
                No standard string multiline nodes detected. Custom prompt node ID can be mapped directly.
              </div>
            )}
          </div>

          {/* 2. Generation Parameters (Dynamic Workflow Overrides) */}
          <GenerationParametersSection
            detectedNodes={parsedWorkflow.detected_nodes || parsedWorkflow.nodes_info?.detected_nodes}
            generationParams={generationParams}
            onChangeParam={onUpdateParam}
            parameterNodeMappings={parameterNodeMappings}
            onChangeParameterMapping={onUpdateParameterMapping}
          />

          {/* 3. Media Loader Nodes Dynamic Mapping */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                Dynamic Media Loader Node Mappings (inputs.image / inputs.video / inputs.audio)
              </span>
              <span className="text-[11px] text-zinc-400">
                {imageNodes.length + videoNodes.length + audioNodes.length} media loader node(s) detected
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Image Loaders */}
              {imageNodes.map((node, idx) => {
                const assignedFile = activeShot?.assigned_slots[idx] || nodeMappings[node.id] || "";
                const mappedAsset = uploadedAssets.find(a => a.filename === assignedFile);
                return (
                  <div key={node.id} className="bg-zinc-950/60 p-3 rounded-lg border-2 border-zinc-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded bg-amber-500/10 text-amber-400">
                          <ImageIcon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-zinc-200 font-mono">Node #{node.id} — {node.title}</p>
                          <p className="text-[10px] text-zinc-400 font-mono">class_type: {node.class_type} | default: "{node.current_file || 'example.png'}"</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      {mappedAsset && (
                        <img 
                          src={getAssetMediaUrl(mappedAsset)} 
                          alt={mappedAsset.subject_name} 
                          className="w-7 h-7 rounded object-cover border border-zinc-700 shrink-0" 
                        />
                      )}
                      <select
                        value={assignedFile}
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateMapping(node.id, val);
                          if (activeShotId) {
                            onUpdateShot(prev => ({
                              ...prev,
                              assigned_slots: {
                                ...prev.assigned_slots,
                                [idx]: val
                              }
                            }));
                          }
                        }}
                        className="flex-1 bg-zinc-900 border-2 border-zinc-700 focus:border-amber-500 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 outline-none"
                      >
                        <option key="empty" value="">-- Assign Uploaded Asset (or Use Bypass) --</option>
                        {uploadedAssets.map((asset, i) => (
                          <option key={`asset-${asset.filename}-${i}`} value={asset.filename}>
                            [{asset.type}] {asset.subject_name} ({asset.filename})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}

              {/* Video Loaders */}
              {videoNodes.map((node) => {
                const assignedFile = nodeMappings[node.id] || "";
                return (
                  <div key={node.id} className="bg-zinc-950/60 p-3 rounded-lg border-2 border-zinc-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded bg-indigo-500/10 text-indigo-400">
                          <VideoIcon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-zinc-200 font-mono">Node #{node.id} — {node.title}</p>
                          <p className="text-[10px] text-zinc-400 font-mono">class_type: {node.class_type}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <select
                        value={assignedFile}
                        onChange={(e) => onUpdateMapping(node.id, e.target.value)}
                        className="flex-1 bg-zinc-900 border-2 border-zinc-700 focus:border-indigo-500 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 outline-none"
                      >
                        <option key="empty" value="">-- Assign Uploaded Video --</option>
                        {uploadedAssets.filter(a => a.media_type === "video").map((asset, i) => (
                          <option key={`vid-${asset.filename}-${i}`} value={asset.filename}>
                            [Video] {asset.subject_name} ({asset.filename})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}

              {/* Audio Loaders */}
              {audioNodes.map((node) => {
                const assignedFile = nodeMappings[node.id] || "";
                return (
                  <div key={node.id} className="bg-zinc-950/60 p-3 rounded-lg border-2 border-zinc-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded bg-emerald-500/10 text-emerald-400">
                          <Music className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-zinc-200 font-mono">Node #{node.id} — {node.title}</p>
                          <p className="text-[10px] text-zinc-400 font-mono">class_type: {node.class_type}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <select
                        value={assignedFile}
                        onChange={(e) => onUpdateMapping(node.id, e.target.value)}
                        className="flex-1 bg-zinc-900 border-2 border-zinc-700 focus:border-emerald-500 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 outline-none"
                      >
                        <option key="empty" value="">-- Assign Uploaded Audio --</option>
                        {uploadedAssets.filter(a => a.media_type === "audio").map((asset, i) => (
                          <option key={`aud-${asset.filename}-${i}`} value={asset.filename}>
                            [Audio] {asset.subject_name} ({asset.filename})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      </div>
      )}
    </div>
  );
};
