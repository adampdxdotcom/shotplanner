import React, { useState, useEffect } from "react";
import { WorkflowItem, ParsedWorkflow, MediaAsset, GenerationParameters, ParameterNodeMappings } from "../types";
import { getAssetMediaUrl } from "../utils/assetUrl";
import { GenerationParametersSection } from "./GenerationParametersSection";
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

interface WorkflowSectionProps {
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
  sceneProject: import("../types").SceneProjectFile;
  onUpdateShot: (updater: (prev: import("../types").ShotItem) => import("../types").ShotItem) => void;
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
  onUpdateShot
}) => {
  const [uploading, setUploading] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);

  const handleCopyJson = async () => {
    if (!parsedWorkflow?.raw_json) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(parsedWorkflow.raw_json, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
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

  const promptNodes = parsedWorkflow?.nodes_info?.prompt_nodes || [];
  const imageNodes = parsedWorkflow?.nodes_info?.image_loader_nodes || [];
  const videoNodes = parsedWorkflow?.nodes_info?.video_loader_nodes || [];
  const audioNodes = parsedWorkflow?.nodes_info?.audio_loader_nodes || [];

  const activeShot = sceneProject.shots.find((s) => s.id === activeShotId);

  return (
    <div id="workflow-section" className="space-y-5 flex flex-col min-h-0">
      {/* Workflow Screen Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-zinc-300">Shot Context:</label>
          <select 
            value={activeShotId || ""}
            onChange={(e) => onSelectShot(e.target.value || null)}
            className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none min-w-[250px]"
          >
            <option key="empty" value="">-- Select a Shot to Map Workflow --</option>
            {sceneProject.shots.map(s => (
              <option key={s.id} value={s.id}>
                Shot {s.shot_number.toString().padStart(2, '0')} - {s.shot_type}
              </option>
            ))}
          </select>
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

      {/* Raw JSON inspection collapsible */}
      {showRawJson && parsedWorkflow && (
        <div className="p-3 rounded-lg bg-zinc-950 border-2 border-zinc-700 text-xs space-y-2">
          <div className="flex items-center justify-between text-zinc-300 border-b border-zinc-800/80 pb-2">
            <div className="flex items-center gap-2">
              <FileJson className="w-4 h-4 text-amber-400" />
              <span className="font-mono font-medium text-xs text-zinc-200">
                {Array.isArray(parsedWorkflow.raw_json?.nodes)
                  ? `Standard Visual Workflow Canvas (${parsedWorkflow.raw_json.nodes.length} nodes)`
                  : `Flat ComfyUI Graph (${Object.keys(parsedWorkflow.raw_json || {}).length} nodes)`}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                {Array.isArray(parsedWorkflow.raw_json?.nodes)
                  ? "Visual UI Workflow JSON"
                  : "API Prompt Format JSON"}
              </span>
            </div>

            <button
              onClick={handleCopyJson}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-200 border border-zinc-600 transition-colors"
              title="Copy JSON to clipboard"
            >
              {copiedJson ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Copy JSON</span>
                </>
              )}
            </button>
          </div>
          <pre className="max-h-64 overflow-auto font-mono text-[11px] text-zinc-300 bg-zinc-900/80 p-3 rounded-lg border border-zinc-800">
            {JSON.stringify(parsedWorkflow.raw_json, null, 2)}
          </pre>
        </div>
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
