import React, { useState, useMemo } from "react";
import { Sliders, Gauge, Film, Layers, AlertCircle, CheckCircle2, Edit3, RotateCcw, Cpu, Type, FileText } from "lucide-react";
import { DetectedNodes, GenerationParameters, ParameterNodeMappings, ParsedWorkflow, WorkflowNodeInfo, ShotItem } from "../types";
import { NodeScannerModal } from "./workflow/NodeScannerModal";
import { extractAllWorkflowNodes } from "../utils/workflowNodes";

interface GenerationParametersSectionProps {
  detectedNodes?: DetectedNodes;
  generationParams: GenerationParameters;
  onChangeParam: (key: keyof GenerationParameters, value: number) => void;
  parameterNodeMappings: ParameterNodeMappings;
  onChangeParameterMapping: (key: keyof ParameterNodeMappings, nodeId: string) => void;
  parsedWorkflow?: ParsedWorkflow | null;
  workflowFilename?: string;
  workflowNodes?: WorkflowNodeInfo[];
  promptNodes?: any[];
  selectedPromptNodeId?: string;
  onSelectPromptNodeId?: (id: string) => void;
  activeShot?: ShotItem;
}

export const GenerationParametersSection: React.FC<GenerationParametersSectionProps> = ({
  detectedNodes = { steps: null, megapixels: null, frames: null },
  generationParams,
  onChangeParam,
  parameterNodeMappings,
  onChangeParameterMapping,
  parsedWorkflow,
  workflowFilename,
  workflowNodes: explicitNodes,
  promptNodes = [],
  selectedPromptNodeId = "",
  onSelectPromptNodeId,
  activeShot
}) => {
  const [editingNode, setEditingNode] = useState<{ steps?: boolean; megapixels?: boolean; frames?: boolean; prompt?: boolean }>({});
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Compute all available workflow nodes for inspection
  const allNodes = useMemo(() => {
    if (explicitNodes && explicitNodes.length > 0) return explicitNodes;
    return extractAllWorkflowNodes(parsedWorkflow || null);
  }, [explicitNodes, parsedWorkflow]);

  const toggleEditNode = (key: keyof ParameterNodeMappings) => {
    setEditingNode(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleResetToAuto = (key: keyof ParameterNodeMappings) => {
    const autoNode = detectedNodes[key] || "";
    onChangeParameterMapping(key, autoNode);
    setEditingNode(prev => ({ ...prev, [key]: false }));
  };

  return (
    <div className="space-y-3">
      {/* Header with Blue 'Node Scanner' Button in the upper right hand corner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20 border">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
              Generation Parameters (Dynamic Workflow Overrides)
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Auto-detected node overrides injected during Step C before server dispatch.
            </p>
          </div>
        </div>

        {/* Blue Node Scanner Button */}
        <button
          id="node-scanner-trigger-btn"
          type="button"
          onClick={() => setIsScannerOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium text-xs shadow-xs transition-colors cursor-pointer self-start sm:self-center shrink-0"
          title="Open Workflow Node Scanner to inspect and map all nodes"
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>Node Scanner</span>
          {allNodes.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-blue-700 text-[10px] font-mono text-blue-100">
              {allNodes.length}
            </span>
          )}
        </button>
      </div>

      {/* Parameter Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Sampling Steps */}
        {(() => {
          const autoNode = detectedNodes.steps ? String(detectedNodes.steps) : "";
          const activeNode = parameterNodeMappings.steps || autoNode;
          const isMapped = !!activeNode;
          const isEditing = editingNode.steps;
          const stepsValue = generationParams.steps ?? 30;

          return (
            <div className="bg-zinc-50/80 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3.5 space-y-3 flex flex-col justify-between shadow-xs">
              {/* Title & Badge */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    Sampling Steps
                  </span>
                  {isMapped ? (
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-mono bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-500/30 border">
                      <CheckCircle2 className="w-2.5 h-2.5 text-indigo-600 dark:text-indigo-400" />
                      Node #{activeNode}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-mono bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-500/30 border">
                      <AlertCircle className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                      Unmapped
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  Target field: <code className="text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded font-mono">inputs.steps</code>
                </p>
              </div>

              {/* Slider & Value when Mapped */}
              {isMapped ? (
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-600 dark:text-zinc-400">Steps count:</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={stepsValue}
                        onChange={(e) => {
                          if (!parameterNodeMappings.steps && activeNode) {
                            onChangeParameterMapping("steps", activeNode);
                          }
                          onChangeParam("steps", Math.max(1, parseInt(e.target.value) || 1));
                        }}
                        className="w-14 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 focus:border-indigo-500 rounded px-1.5 py-0.5 text-xs text-right font-mono text-indigo-700 dark:text-indigo-300 outline-none shadow-2xs"
                      />
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">steps</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={60}
                    step={1}
                    value={stepsValue}
                    onChange={(e) => {
                      if (!parameterNodeMappings.steps && activeNode) {
                        onChangeParameterMapping("steps", activeNode);
                      }
                      onChangeParam("steps", parseInt(e.target.value));
                    }}
                    className="w-full accent-indigo-600 dark:accent-indigo-500 cursor-pointer h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none"
                  />
                  <div className="flex justify-between text-[9px] text-zinc-500 dark:text-zinc-400 font-mono">
                    <span>5 min</span>
                    <span>30 def</span>
                    <span>60 max</span>
                  </div>
                </div>
              ) : (
                /* Fallback alert with node input when not auto-detected */
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded p-2.5 space-y-2">
                  <div className="flex items-start gap-1.5 text-amber-800 dark:text-amber-300 text-[11px]">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <span>No Sampling Steps node found. Enter node number:</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="e.g. 131"
                      value={activeNode || ""}
                      onChange={(e) => onChangeParameterMapping("steps", e.target.value.trim())}
                      className="flex-1 bg-white dark:bg-zinc-950 border border-amber-300 dark:border-amber-700/60 focus:border-amber-500 rounded px-2 py-1 text-xs text-zinc-900 dark:text-zinc-200 font-mono outline-none shadow-2xs"
                    />
                  </div>
                </div>
              )}

              {/* Node ID Edit / Override controls */}
              {isMapped && (
                <div className="border-t border-zinc-200 dark:border-zinc-800/60 pt-2 flex items-center justify-between text-[10px]">
                  {isEditing ? (
                    <div className="flex items-center gap-1.5 w-full">
                      <span className="text-zinc-500 dark:text-zinc-400 text-[10px]">Node ID:</span>
                      <input
                        type="text"
                        value={activeNode}
                        onChange={(e) => onChangeParameterMapping("steps", e.target.value.trim())}
                        className="w-16 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded px-1.5 py-0.5 text-[10px] font-mono text-zinc-900 dark:text-zinc-200 outline-none shadow-2xs"
                        placeholder="Node #"
                      />
                      <button
                        onClick={() => toggleEditNode("steps")}
                        className="px-1.5 py-0.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 rounded text-[10px] cursor-pointer"
                      >
                        Done
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-zinc-500 dark:text-zinc-400">
                        {activeNode === autoNode ? "Auto-detected" : "Manual override"}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => toggleEditNode("steps")}
                          className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 flex items-center gap-0.5 cursor-pointer"
                          title="Change target Node ID"
                        >
                          <Edit3 className="w-2.5 h-2.5" />
                          <span>Change</span>
                        </button>
                        {autoNode && activeNode !== autoNode && (
                          <button
                            onClick={() => handleResetToAuto("steps")}
                            className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-0.5 cursor-pointer"
                            title="Reset to auto-detected node"
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                            <span>Auto</span>
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* 2. Megapixels */}
        {(() => {
          const autoNode = detectedNodes.megapixels ? String(detectedNodes.megapixels) : "";
          const activeNode = parameterNodeMappings.megapixels || autoNode;
          const isMapped = !!activeNode;
          const isEditing = editingNode.megapixels;
          const megapixelsValue = generationParams.megapixels ?? 0.5;

          return (
            <div className="bg-zinc-50/80 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3.5 space-y-3 flex flex-col justify-between shadow-xs">
              {/* Title & Badge */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    Megapixels Resolution
                  </span>
                  {isMapped ? (
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-mono bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-500/30 border">
                      <CheckCircle2 className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                      Node #{activeNode}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-mono bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-500/30 border">
                      <AlertCircle className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                      Unmapped
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  Target field: <code className="text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded font-mono">inputs.megapixels</code>
                </p>
              </div>

              {/* Slider & Value when Mapped */}
              {isMapped ? (
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-600 dark:text-zinc-400">Resolution limit:</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0.1}
                        max={2.0}
                        step={0.05}
                        value={megapixelsValue}
                        onChange={(e) => {
                          if (!parameterNodeMappings.megapixels && activeNode) {
                            onChangeParameterMapping("megapixels", activeNode);
                          }
                          onChangeParam("megapixels", Math.max(0.1, parseFloat(e.target.value) || 0.1));
                        }}
                        className="w-14 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 focus:border-amber-500 rounded px-1.5 py-0.5 text-xs text-right font-mono text-amber-700 dark:text-amber-300 outline-none shadow-2xs"
                      />
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">MP</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={1.0}
                    step={0.05}
                    value={megapixelsValue}
                    onChange={(e) => {
                      if (!parameterNodeMappings.megapixels && activeNode) {
                        onChangeParameterMapping("megapixels", activeNode);
                      }
                      onChangeParam("megapixels", parseFloat(e.target.value));
                    }}
                    className="w-full accent-amber-600 dark:accent-amber-500 cursor-pointer h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none"
                  />
                  <div className="flex justify-between text-[9px] text-zinc-500 dark:text-zinc-400 font-mono">
                    <span>0.1 MP</span>
                    <span>0.5 MP</span>
                    <span>1.0 MP</span>
                  </div>
                </div>
              ) : (
                /* Fallback alert with node input when not auto-detected */
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded p-2.5 space-y-2">
                  <div className="flex items-start gap-1.5 text-amber-800 dark:text-amber-300 text-[11px]">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <span>No Megapixels node found. Enter node number:</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="e.g. 115"
                      value={activeNode || ""}
                      onChange={(e) => onChangeParameterMapping("megapixels", e.target.value.trim())}
                      className="flex-1 bg-white dark:bg-zinc-950 border border-amber-300 dark:border-amber-700/60 focus:border-amber-500 rounded px-2 py-1 text-xs text-zinc-900 dark:text-zinc-200 font-mono outline-none shadow-2xs"
                    />
                  </div>
                </div>
              )}

              {/* Node ID Edit / Override controls */}
              {isMapped && (
                <div className="border-t border-zinc-200 dark:border-zinc-800/60 pt-2 flex items-center justify-between text-[10px]">
                  {isEditing ? (
                    <div className="flex items-center gap-1.5 w-full">
                      <span className="text-zinc-500 dark:text-zinc-400 text-[10px]">Node ID:</span>
                      <input
                        type="text"
                        value={activeNode}
                        onChange={(e) => onChangeParameterMapping("megapixels", e.target.value.trim())}
                        className="w-16 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded px-1.5 py-0.5 text-[10px] font-mono text-zinc-900 dark:text-zinc-200 outline-none shadow-2xs"
                        placeholder="Node #"
                      />
                      <button
                        onClick={() => toggleEditNode("megapixels")}
                        className="px-1.5 py-0.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 rounded text-[10px] cursor-pointer"
                      >
                        Done
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-zinc-500 dark:text-zinc-400">
                        {activeNode === autoNode ? "Auto-detected" : "Manual override"}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => toggleEditNode("megapixels")}
                          className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 flex items-center gap-0.5 cursor-pointer"
                          title="Change target Node ID"
                        >
                          <Edit3 className="w-2.5 h-2.5" />
                          <span>Change</span>
                        </button>
                        {autoNode && activeNode !== autoNode && (
                          <button
                            onClick={() => handleResetToAuto("megapixels")}
                            className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 flex items-center gap-0.5 cursor-pointer"
                            title="Reset to auto-detected node"
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                            <span>Auto</span>
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* 3. Total Seconds / Duration */}
        {(() => {
          const autoNode = detectedNodes.frames ? String(detectedNodes.frames) : "";
          const activeNode = parameterNodeMappings.frames || autoNode;
          const isMapped = !!activeNode;
          const isEditing = editingNode.frames;
          // generationParams.frames now stores total seconds as a float (e.g. 3.4, 4.2)
          const secondsValue = generationParams.frames !== undefined ? Number(generationParams.frames) : 3.4;
          const calculatedFrames = Math.round(secondsValue * 24);

          return (
            <div className="bg-zinc-50/80 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3.5 space-y-3 flex flex-col justify-between shadow-xs">
              {/* Title & Badge */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 flex items-center gap-1.5">
                    <Film className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Total Seconds
                  </span>
                  {isMapped ? (
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-mono bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-500/30 border">
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                      Node #{activeNode}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-mono bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-500/30 border">
                      <AlertCircle className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                      Unmapped
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  Target field: <code className="text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded font-mono">seconds / float / duration</code>
                </p>
              </div>

              {/* Slider & Value when Mapped */}
              {isMapped ? (
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-600 dark:text-zinc-400">Total seconds:</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0.1}
                        max={30.0}
                        step={0.1}
                        value={secondsValue}
                        onChange={(e) => {
                          if (!parameterNodeMappings.frames && activeNode) {
                            onChangeParameterMapping("frames", activeNode);
                          }
                          const val = parseFloat(e.target.value);
                          onChangeParam("frames", isNaN(val) ? 0.5 : val);
                        }}
                        className="w-16 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 focus:border-emerald-500 rounded px-1.5 py-0.5 text-xs text-right font-mono text-emerald-700 dark:text-emerald-300 outline-none shadow-2xs"
                      />
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">s (~{calculatedFrames}f)</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={10.0}
                    step={0.1}
                    value={secondsValue}
                    onChange={(e) => {
                      if (!parameterNodeMappings.frames && activeNode) {
                        onChangeParameterMapping("frames", activeNode);
                      }
                      onChangeParam("frames", parseFloat(e.target.value));
                    }}
                    className="w-full accent-emerald-600 dark:accent-emerald-500 cursor-pointer h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none"
                  />
                  <div className="flex justify-between text-[9px] text-zinc-500 dark:text-zinc-400 font-mono">
                    <span>0.5s / 12f</span>
                    <span>3.4s / 81f</span>
                    <span>6.7s / 161f</span>
                  </div>
                </div>
              ) : (
                /* Fallback alert with node input when not auto-detected */
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded p-2.5 space-y-2">
                  <div className="flex items-start gap-1.5 text-amber-800 dark:text-amber-300 text-[11px]">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <span>No Float / Duration node found. Enter node number:</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="e.g. 131"
                      value={activeNode || ""}
                      onChange={(e) => onChangeParameterMapping("frames", e.target.value.trim())}
                      className="flex-1 bg-white dark:bg-zinc-950 border border-amber-300 dark:border-amber-700/60 focus:border-amber-500 rounded px-2 py-1 text-xs text-zinc-900 dark:text-zinc-200 font-mono outline-none shadow-2xs"
                    />
                  </div>
                </div>
              )}

              {/* Node ID Edit / Override controls */}
              {isMapped && (
                <div className="border-t border-zinc-200 dark:border-zinc-800/60 pt-2 flex items-center justify-between text-[10px]">
                  {isEditing ? (
                    <div className="flex items-center gap-1.5 w-full">
                      <span className="text-zinc-500 dark:text-zinc-400 text-[10px]">Node ID:</span>
                      <input
                        type="text"
                        value={activeNode}
                        onChange={(e) => onChangeParameterMapping("frames", e.target.value.trim())}
                        className="w-16 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded px-1.5 py-0.5 text-[10px] font-mono text-zinc-900 dark:text-zinc-200 outline-none shadow-2xs"
                        placeholder="Node #"
                      />
                      <button
                        onClick={() => toggleEditNode("frames")}
                        className="px-1.5 py-0.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 rounded text-[10px] cursor-pointer"
                      >
                        Done
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-zinc-500 dark:text-zinc-400">
                        {activeNode === autoNode ? "Auto-detected" : "Manual override"}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => toggleEditNode("frames")}
                          className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 flex items-center gap-0.5 cursor-pointer"
                          title="Change target Node ID"
                        >
                          <Edit3 className="w-2.5 h-2.5" />
                          <span>Change</span>
                        </button>
                        {autoNode && activeNode !== autoNode && (
                          <button
                            onClick={() => handleResetToAuto("frames")}
                            className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 flex items-center gap-0.5 cursor-pointer"
                            title="Reset to auto-detected node"
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                            <span>Auto</span>
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* 4. Prompt Stub Display Card */}
        {(() => {
          const autoPromptNode = promptNodes.length > 0 ? String(promptNodes[0].id) : null;
          const isMapped = !!selectedPromptNodeId;
          const isEditing = editingNode.prompt;
          const stubText = activeShot?.basic_stub || activeShot?.expanded_prompt || "";

          return (
            <div className="bg-zinc-50/80 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3.5 space-y-3 flex flex-col justify-between shadow-xs">
              {/* Title & Badge */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    Prompt
                  </span>
                  {isMapped ? (
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-mono bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-500/30 border">
                      <CheckCircle2 className="w-2.5 h-2.5 text-indigo-600 dark:text-indigo-400" />
                      Node #{selectedPromptNodeId}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-mono bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-500/30 border">
                      <AlertCircle className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                      Not Injected
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  Target field: <code className="text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded font-mono">inputs.text</code>
                </p>
              </div>

              {/* Prompt Stub Display */}
              <div className="space-y-1 bg-white/80 dark:bg-zinc-950/80 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800/80 flex-1 flex flex-col justify-center min-h-[72px]">
                <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400 pb-0.5">
                  <span className="font-semibold uppercase tracking-wider flex items-center gap-1">
                    <FileText className="w-3 h-3 text-indigo-500" />
                    Shot Stub
                  </span>
                  {activeShot && (
                    <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                      Shot #{activeShot.shot_number}
                    </span>
                  )}
                </div>
                <p 
                  className="text-[11px] text-zinc-800 dark:text-zinc-200 font-mono leading-relaxed line-clamp-3 overflow-hidden" 
                  title={stubText || "No stub available"}
                >
                  {stubText ? (
                    `"${stubText}"`
                  ) : (
                    <span className="italic text-zinc-400 dark:text-zinc-500">No prompt stub configured for this shot</span>
                  )}
                </p>
              </div>

              {/* Node ID Edit / Override controls */}
              <div className="border-t border-zinc-200 dark:border-zinc-800/60 pt-2 flex items-center justify-between text-[10px]">
                {isEditing ? (
                  <div className="flex items-center gap-1.5 w-full">
                    <span className="text-zinc-500 dark:text-zinc-400 text-[10px]">Node ID:</span>
                    <input
                      type="text"
                      value={selectedPromptNodeId || ""}
                      onChange={(e) => onSelectPromptNodeId?.(e.target.value.trim())}
                      className="w-16 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded px-1.5 py-0.5 text-[10px] font-mono text-zinc-900 dark:text-zinc-200 outline-none shadow-2xs"
                      placeholder="Node #"
                    />
                    <button
                      onClick={() => setEditingNode(prev => ({ ...prev, prompt: false }))}
                      className="px-1.5 py-0.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 rounded text-[10px] cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {autoPromptNode && selectedPromptNodeId === autoPromptNode ? "Auto-detected" : "Manual override"}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setEditingNode(prev => ({ ...prev, prompt: true }))}
                        className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 flex items-center gap-0.5 cursor-pointer"
                        title="Change target Node ID"
                      >
                        <Edit3 className="w-2.5 h-2.5" />
                        <span>Change</span>
                      </button>
                      {autoPromptNode && selectedPromptNodeId !== autoPromptNode && (
                        <button
                          onClick={() => {
                            onSelectPromptNodeId?.(autoPromptNode);
                            setEditingNode(prev => ({ ...prev, prompt: false }));
                          }}
                          className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-0.5 cursor-pointer"
                          title="Reset to auto-detected node"
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                          <span>Auto</span>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Node Scanner Modal */}
      <NodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        workflowFilename={workflowFilename}
        nodes={allNodes}
        parameterNodeMappings={parameterNodeMappings}
        onSelectParameterMapping={onChangeParameterMapping}
        detectedNodes={detectedNodes}
      />
    </div>
  );
};
