import React, { useState, useMemo } from "react";
import { 
  X, 
  Search, 
  Copy, 
  Check, 
  Sliders, 
  Gauge, 
  Film, 
  Layers, 
  Cpu, 
  Filter, 
  Sparkles, 
  Info,
  CheckCircle2,
  Tag
} from "lucide-react";
import { WorkflowNodeInfo, ParameterNodeMappings, DetectedNodes } from "../../types";
import { copyToClipboard } from "../../utils/clipboard";

interface NodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflowFilename?: string;
  nodes: WorkflowNodeInfo[];
  parameterNodeMappings?: ParameterNodeMappings;
  onSelectParameterMapping?: (key: keyof ParameterNodeMappings, nodeId: string) => void;
  detectedNodes?: DetectedNodes;
}

export const NodeScannerModal: React.FC<NodeScannerModalProps> = ({
  isOpen,
  onClose,
  workflowFilename,
  nodes,
  parameterNodeMappings,
  onSelectParameterMapping,
  detectedNodes = { steps: null, megapixels: null, frames: null }
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lastMappedAction, setLastMappedAction] = useState<{ id: string; target: string } | null>(null);

  const [activeLoraMenuNodeId, setActiveLoraMenuNodeId] = useState<string | null>(null);

  // Compute unique categories and counts
  const { categories, categoryCounts } = useMemo(() => {
    const counts: Record<string, number> = { all: nodes.length };
    const cats = new Set<string>();

    nodes.forEach(n => {
      const cat = n.category || "Utility / Other";
      cats.add(cat);
      counts[cat] = (counts[cat] || 0) + 1;
    });

    return {
      categories: ["all", ...Array.from(cats)],
      categoryCounts: counts
    };
  }, [nodes]);

  // Filtered nodes based on search and category
  const filteredNodes = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    return nodes.filter(node => {
      // Category filter
      if (selectedCategory !== "all" && (node.category || "Utility / Other") !== selectedCategory) {
        return false;
      }

      // Search filter
      if (!term) return true;

      const idMatch = node.id.toLowerCase().includes(term);
      const titleMatch = (node.title || "").toLowerCase().includes(term);
      const classMatch = (node.class_type || "").toLowerCase().includes(term);
      const catMatch = (node.category || "").toLowerCase().includes(term);

      return idMatch || titleMatch || classMatch || catMatch;
    });
  }, [nodes, searchTerm, selectedCategory]);

  const handleCopyNodeId = async (id: string) => {
    const ok = await copyToClipboard(id);
    if (ok) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    }
  };

  const handleMapNode = (key: keyof ParameterNodeMappings, nodeId: string) => {
    if (onSelectParameterMapping) {
      onSelectParameterMapping(key, nodeId);
      setLastMappedAction({ id: nodeId, target: String(key) });
      setTimeout(() => setLastMappedAction(null), 2500);
    }
  };

  const handleToggleLoraSlot = (slotNum: number, nodeId: string) => {
    const key = `lora_${slotNum}` as keyof ParameterNodeMappings;
    if (!onSelectParameterMapping) return;

    if (parameterNodeMappings?.[key] === nodeId) {
      onSelectParameterMapping(key, "");
    } else {
      onSelectParameterMapping(key, nodeId);
      setLastMappedAction({ id: nodeId, target: `LoRA ${slotNum}` });
      setTimeout(() => setLastMappedAction(null), 2500);
    }
    setActiveLoraMenuNodeId(null);
  };

  if (!isOpen) return null;

  return (
    <div 
      id="node-scanner-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-5 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        id="node-scanner-modal"
        className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/80 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20 shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Workflow Node Scanner
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {nodes.length} Nodes
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-md sm:max-w-xl">
                {workflowFilename ? `Active: ${workflowFilename}` : "Inspect node titles, numeric IDs, and map generation overrides"}
              </p>
            </div>
          </div>

          <button
            id="node-scanner-close-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Category Filter Controls */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              id="node-scanner-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Node ID (#), Title, Class Type (e.g. KSampler, Latent, Lora), or Category..."
              className="w-full pl-10 pr-10 py-2 bg-zinc-100 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-700/80 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            {categories.map((cat) => {
              const count = categoryCounts[cat] || 0;
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer border ${
                    isSelected
                      ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                      : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                  }`}
                >
                  <span className="capitalize">{cat === "all" ? "All Nodes" : cat}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected 
                      ? "bg-blue-700 text-blue-100" 
                      : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* LoRA Slots Configuration Rack (Slots 1 to 5) */}
        <div className="px-4 py-2.5 bg-purple-50/70 dark:bg-purple-950/30 border-b border-purple-200/80 dark:border-purple-900/50 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2 shrink-0">
            <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
            <span className="font-bold text-purple-900 dark:text-purple-200">
              LoRA Node Slots (1 to 5):
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {[1, 2, 3, 4, 5].map((slotNum) => {
              const slotKey = `lora_${slotNum}` as keyof ParameterNodeMappings;
              const mappedId = parameterNodeMappings?.[slotKey];
              const mappedNode = mappedId ? nodes.find(n => n.id === mappedId) : null;

              return (
                <div
                  key={slotNum}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono border transition-all ${
                    mappedId
                      ? "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-900/60 dark:text-purple-200 dark:border-purple-700 shadow-2xs"
                      : "bg-white/80 dark:bg-zinc-900/80 text-zinc-400 dark:text-zinc-500 border-dashed border-zinc-300 dark:border-zinc-700"
                  }`}
                >
                  <span className="font-bold text-purple-700 dark:text-purple-300">LoRA {slotNum}:</span>
                  {mappedId ? (
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[120px]" title={mappedNode?.title || `#${mappedId}`}>
                      #{mappedId}
                    </span>
                  ) : (
                    <span className="italic text-zinc-400 dark:text-zinc-500 text-[10px]">Empty</span>
                  )}

                  {mappedId && onSelectParameterMapping && (
                    <button
                      type="button"
                      onClick={() => onSelectParameterMapping(slotKey, "")}
                      className="ml-0.5 p-0.5 text-purple-400 hover:text-purple-800 dark:hover:text-purple-200 hover:bg-purple-200 dark:hover:bg-purple-800/60 rounded cursor-pointer transition-colors"
                      title={`Unmap LoRA Slot ${slotNum}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Node List / Table Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-zinc-50/50 dark:bg-zinc-950/40 divide-y divide-zinc-200/50 dark:divide-zinc-800/50">
          {filteredNodes.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-2">
              <Layers className="w-8 h-8 text-zinc-400" />
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No nodes found matching criteria</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Try clearing your search query or selecting &quot;All Nodes&quot;.</p>
            </div>
          ) : (
            filteredNodes.map((node) => {
              const isStepsMapped = parameterNodeMappings?.steps === node.id;
              const isMegapixelsMapped = parameterNodeMappings?.megapixels === node.id;
              const isFramesMapped = parameterNodeMappings?.frames === node.id;

              // Compute mapped LoRA slots for this node (1 to 5)
              const mappedLoraSlots: number[] = [];
              for (let i = 1; i <= 5; i++) {
                if (parameterNodeMappings?.[`lora_${i}`] === node.id) {
                  mappedLoraSlots.push(i);
                }
              }

              const isAutoSteps = detectedNodes.steps === node.id;
              const isAutoMegapixels = detectedNodes.megapixels === node.id;
              const isAutoFrames = detectedNodes.frames === node.id;

              const isAnyLoraMapped = mappedLoraSlots.length > 0;
              const isAnyMapped = isStepsMapped || isMegapixelsMapped || isFramesMapped || isAnyLoraMapped;

              return (
                <div
                  key={node.id}
                  id={`node-row-${node.id}`}
                  className={`pt-2.5 first:pt-0 p-3 rounded-xl transition-all border ${
                    isAnyMapped
                      ? isAnyLoraMapped
                        ? "bg-purple-50/60 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/60 shadow-2xs"
                        : "bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/60 shadow-2xs"
                      : "bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Node Identification */}
                    <div className="flex items-start gap-2.5 min-w-0">
                      {/* Node ID Pill with Copy button */}
                      <button
                        type="button"
                        onClick={() => handleCopyNodeId(node.id)}
                        title="Click to copy Node ID"
                        className="px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                      >
                        <span>#{node.id}</span>
                        {copiedId === node.id ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3 text-zinc-400 opacity-60 group-hover:opacity-100" />
                        )}
                      </button>

                      {/* Title, Class, and Category */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 break-all">
                            {node.title || node.class_type}
                          </span>
                          
                          {node.category && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                              node.category === "LoRA Loader"
                                ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800 font-semibold"
                                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
                            }`}>
                              {node.category}
                            </span>
                          )}

                          {/* Active Mapping Badges */}
                          {isStepsMapped && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 flex items-center gap-1">
                              <Sliders className="w-2.5 h-2.5" /> Mapped: Steps
                            </span>
                          )}
                          {isMegapixelsMapped && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                              <Gauge className="w-2.5 h-2.5" /> Mapped: Megapixels
                            </span>
                          )}
                          {isFramesMapped && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border border-teal-300 dark:border-teal-800 flex items-center gap-1">
                              <Film className="w-2.5 h-2.5" /> Mapped: Seconds
                            </span>
                          )}
                          {mappedLoraSlots.map((s) => (
                            <span key={s} className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-800 flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5" /> LoRA Slot {s} ✓
                            </span>
                          ))}

                          {/* Auto-detected hints */}
                          {(isAutoSteps || isAutoMegapixels || isAutoFrames) && !isStepsMapped && !isMegapixelsMapped && !isFramesMapped && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-dashed border-zinc-300 dark:border-zinc-700">
                              Auto-detected candidate
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                          Class: <span className="text-zinc-700 dark:text-zinc-300">{node.class_type}</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Action Map Buttons */}
                    {onSelectParameterMapping && (
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center flex-wrap relative">
                        {/* LoRA Slot Selector Popover / Button */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setActiveLoraMenuNodeId(activeLoraMenuNodeId === node.id ? null : node.id)}
                            className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 border transition-all cursor-pointer ${
                              isAnyLoraMapped
                                ? "bg-purple-600 text-white border-purple-600 shadow-2xs"
                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-400"
                            }`}
                            title="Map or unmap this node to a LoRA Slot (1 to 5)"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>{isAnyLoraMapped ? `LoRA #${mappedLoraSlots[0]} ✓` : "+ LoRA"}</span>
                          </button>

                          {/* 5-Slot LoRA Selector Dropdown */}
                          {activeLoraMenuNodeId === node.id && (
                            <div className="absolute right-0 top-full mt-1.5 z-20 w-44 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl p-1.5 space-y-1 animate-in fade-in">
                              <div className="px-2 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                Assign LoRA Slot (1–5)
                              </div>
                              {[1, 2, 3, 4, 5].map((slotNum) => {
                                const isMappedThisSlot = parameterNodeMappings?.[`lora_${slotNum}`] === node.id;
                                const otherMappedId = parameterNodeMappings?.[`lora_${slotNum}`];

                                return (
                                  <button
                                    key={slotNum}
                                    type="button"
                                    onClick={() => handleToggleLoraSlot(slotNum, node.id)}
                                    className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                                      isMappedThisSlot
                                        ? "bg-purple-600 text-white font-bold"
                                        : "text-zinc-700 dark:text-zinc-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-600"
                                    }`}
                                  >
                                    <span>LoRA Slot {slotNum}</span>
                                    {isMappedThisSlot ? (
                                      <Check className="w-3 h-3" />
                                    ) : otherMappedId ? (
                                      <span className="text-[10px] text-zinc-400">#{otherMappedId}</span>
                                    ) : (
                                      <span className="text-[10px] text-zinc-400">Free</span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleMapNode("steps", node.id)}
                          className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 border transition-all cursor-pointer ${
                            isStepsMapped
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400"
                          }`}
                          title="Map this node to Sampling Steps override"
                        >
                          <Sliders className="w-3 h-3" />
                          <span>{isStepsMapped ? "Steps ✓" : "Steps"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleMapNode("megapixels", node.id)}
                          className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 border transition-all cursor-pointer ${
                            isMegapixelsMapped
                              ? "bg-amber-600 text-white border-amber-600"
                              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400"
                          }`}
                          title="Map this node to Megapixels / Resolution override"
                        >
                          <Gauge className="w-3 h-3" />
                          <span>{isMegapixelsMapped ? "MP ✓" : "Megapixels"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleMapNode("frames", node.id)}
                          className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 border transition-all cursor-pointer ${
                            isFramesMapped
                              ? "bg-teal-600 text-white border-teal-600"
                              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-teal-500 hover:text-teal-600 dark:hover:text-teal-400"
                          }`}
                          title="Map this node to Seconds / Duration override"
                        >
                          <Film className="w-3 h-3" />
                          <span>{isFramesMapped ? "Sec ✓" : "Seconds"}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/50 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-500" />
            <span>Click any node parameter button to map it directly to generation settings.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
