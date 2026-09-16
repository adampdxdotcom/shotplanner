import React, { useState } from "react";
import { Sliders, Gauge, Film, Layers, AlertCircle, CheckCircle2, Edit3, RotateCcw } from "lucide-react";
import { DetectedNodes, GenerationParameters, ParameterNodeMappings } from "../types";

interface GenerationParametersSectionProps {
  detectedNodes?: DetectedNodes;
  generationParams: GenerationParameters;
  onChangeParam: (key: keyof GenerationParameters, value: number) => void;
  parameterNodeMappings: ParameterNodeMappings;
  onChangeParameterMapping: (key: keyof ParameterNodeMappings, nodeId: string) => void;
}

export const GenerationParametersSection: React.FC<GenerationParametersSectionProps> = ({
  detectedNodes = { steps: null, megapixels: null, frames: null },
  generationParams,
  onChangeParam,
  parameterNodeMappings,
  onChangeParameterMapping
}) => {
  const [editingNode, setEditingNode] = useState<{ steps?: boolean; megapixels?: boolean; frames?: boolean }>({});

  const toggleEditNode = (key: keyof ParameterNodeMappings) => {
    setEditingNode(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleResetToAuto = (key: keyof ParameterNodeMappings) => {
    const autoNode = detectedNodes[key] || "";
    onChangeParameterMapping(key, autoNode);
    setEditingNode(prev => ({ ...prev, [key]: false }));
  };

  return (
    <div className="bg-white dark:bg-zinc-950/60 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700/80 space-y-4 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20 border">
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
      </div>

      {/* Parameter Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* 1. Sampling Steps */}
        {(() => {
          const autoNode = detectedNodes.steps;
          const activeNode = parameterNodeMappings.steps;
          const isMapped = !!activeNode;
          const isEditing = editingNode.steps;

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
                        value={generationParams.steps}
                        onChange={(e) => onChangeParam("steps", Math.max(1, parseInt(e.target.value) || 1))}
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
                    value={generationParams.steps}
                    onChange={(e) => onChangeParam("steps", parseInt(e.target.value))}
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
          const autoNode = detectedNodes.megapixels;
          const activeNode = parameterNodeMappings.megapixels;
          const isMapped = !!activeNode;
          const isEditing = editingNode.megapixels;

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
                        value={generationParams.megapixels}
                        onChange={(e) => onChangeParam("megapixels", Math.max(0.1, parseFloat(e.target.value) || 0.1))}
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
                    value={generationParams.megapixels}
                    onChange={(e) => onChangeParam("megapixels", parseFloat(e.target.value))}
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

        {/* 3. Duration / Frames */}
        {(() => {
          const autoNode = detectedNodes.frames;
          const activeNode = parameterNodeMappings.frames;
          const isMapped = !!activeNode;
          const isEditing = editingNode.frames;

          return (
            <div className="bg-zinc-50/80 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3.5 space-y-3 flex flex-col justify-between shadow-xs">
              {/* Title & Badge */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 flex items-center gap-1.5">
                    <Film className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Duration / Frames
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
                  Target field: <code className="text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded font-mono">frames / length / duration</code>
                </p>
              </div>

              {/* Slider & Value when Mapped */}
              {isMapped ? (
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-600 dark:text-zinc-400">Total frames:</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={300}
                        value={generationParams.frames}
                        onChange={(e) => onChangeParam("frames", Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-14 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 focus:border-emerald-500 rounded px-1.5 py-0.5 text-xs text-right font-mono text-emerald-700 dark:text-emerald-300 outline-none shadow-2xs"
                      />
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">f (~{(generationParams.frames / 24).toFixed(1)}s)</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={12}
                    max={161}
                    step={1}
                    value={generationParams.frames}
                    onChange={(e) => onChangeParam("frames", parseInt(e.target.value))}
                    className="w-full accent-emerald-600 dark:accent-emerald-500 cursor-pointer h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none"
                  />
                  <div className="flex justify-between text-[9px] text-zinc-500 dark:text-zinc-400 font-mono">
                    <span>12f (0.5s)</span>
                    <span>81f (3.4s)</span>
                    <span>161f (6.7s)</span>
                  </div>
                </div>
              ) : (
                /* Fallback alert with node input when not auto-detected */
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded p-2.5 space-y-2">
                  <div className="flex items-start gap-1.5 text-amber-800 dark:text-amber-300 text-[11px]">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <span>No Duration / Frames node found. Enter node number:</span>
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
      </div>
    </div>
  );
};
