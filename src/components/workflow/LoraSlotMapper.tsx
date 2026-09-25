import React, { useState, useEffect, useMemo } from "react";
import { 
  Layers, 
  Sparkles, 
  Sliders, 
  Copy, 
  Check, 
  Download, 
  AlertCircle, 
  CheckCircle2, 
  Power, 
  RefreshCw, 
  Search, 
  SlidersHorizontal,
  ChevronDown,
  Info,
  Flame,
  FileCode,
  Zap,
  Wand2
} from "lucide-react";
import { 
  ShotItem, 
  ShotLoraAssignment, 
  WorkflowLoraSlot, 
  WorkflowNodeInfo, 
  SystemLora, 
  RemoteLoraStatusReport 
} from "../../types";
import { copyToClipboard } from "../../utils/clipboard";
import { lorasApi } from "../../api";
import { CivitaiLoraSearchModal } from "./CivitaiLoraSearchModal";

export interface LoraSlotMapperProps {
  loraNodes: (WorkflowNodeInfo | WorkflowLoraSlot)[];
  activeShot?: ShotItem;
  activeShotId?: string | null;
  onUpdateShot?: (updater: (prev: ShotItem) => ShotItem) => void;
  sceneDefaultLoras?: Record<string, ShotLoraAssignment>;
  onUpdateSceneLoras?: (loraSlots: Record<string, ShotLoraAssignment>) => void;
  onShowToast?: (text: string, type: "success" | "error" | "info") => void;
}

export const LoraSlotMapper: React.FC<LoraSlotMapperProps> = ({
  loraNodes,
  activeShot,
  activeShotId,
  onUpdateShot,
  sceneDefaultLoras = {},
  onUpdateSceneLoras,
  onShowToast
}) => {
  const [systemLoras, setSystemLoras] = useState<SystemLora[]>([]);
  const [remoteStatus, setRemoteStatus] = useState<RemoteLoraStatusReport | null>(null);
  const [loadingLoras, setLoadingLoras] = useState(false);
  const [copiedTrigger, setCopiedTrigger] = useState<string | null>(null);
  const [injectedTrigger, setInjectedTrigger] = useState<string | null>(null);
  const [customModeNodes, setCustomModeNodes] = useState<Record<string, boolean>>({});
  const [transferringMap, setTransferringMap] = useState<Record<string, boolean>>({});
  const [transferSuccessMap, setTransferSuccessMap] = useState<Record<string, string>>({});
  const [isBulkStaging, setIsBulkStaging] = useState(false);

  // Civitai Search Modal state
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchTargetNodeId, setSearchTargetNodeId] = useState<string>("");
  const [searchTargetNodeTitle, setSearchTargetNodeTitle] = useState<string>("");

  // Fetch System LoRAs & Remote GPU Inspection report
  const fetchLoras = async () => {
    try {
      setLoadingLoras(true);
      const res: any = await lorasApi.listLoras();
      if (res && Array.isArray(res.loras)) {
        setSystemLoras(res.loras);
      }
      const rep: any = await lorasApi.checkRemoteStatus();
      if (rep && rep.success) {
        setRemoteStatus(rep);
      }
    } catch (err) {
      console.error("Failed to load system loras:", err);
    } finally {
      setLoadingLoras(false);
    }
  };

  useEffect(() => {
    fetchLoras();
  }, []);

  const activeAssignments = useMemo(() => {
    return {
      ...sceneDefaultLoras,
      ...(activeShot?.lora_slots || {})
    };
  }, [sceneDefaultLoras, activeShot?.lora_slots]);

  const handleUpdateSlot = (nodeId: string, updates: Partial<ShotLoraAssignment>) => {
    const current = activeAssignments[nodeId] || {
      lora_name: "",
      strength_model: 1.0,
      strength_clip: 1.0,
      bypassed: false
    };

    const nextAssignment: ShotLoraAssignment = {
      ...current,
      ...updates
    };

    if (activeShotId && onUpdateShot) {
      onUpdateShot(prev => {
        const prevSlots = prev.lora_slots || {};
        return {
          ...prev,
          lora_slots: {
            ...prevSlots,
            [nodeId]: nextAssignment
          }
        };
      });
    } else if (onUpdateSceneLoras) {
      onUpdateSceneLoras({
        ...sceneDefaultLoras,
        [nodeId]: nextAssignment
      });
    }
  };

  const handleCopyTriggers = async (triggers: string[], slotId: string) => {
    if (!triggers || triggers.length === 0) return;
    const text = triggers.join(", ");
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedTrigger(slotId);
      setTimeout(() => setCopiedTrigger(null), 2000);
      onShowToast?.(`Copied triggers: [${text}]`, "info");
    }
  };

  /**
   * Inject LoRA trigger words directly into the active shot's prompt cleanly
   */
  const handleInjectTriggers = (triggers: string[], slotId: string) => {
    if (!triggers || triggers.length === 0 || !onUpdateShot || !activeShot) return;

    const triggerString = triggers.join(", ");
    
    onUpdateShot(prev => {
      let prompt = (prev.basic_stub || "").trim();
      
      // If already contains all triggers, skip duplicate
      const alreadyIn = triggers.every(t => prompt.toLowerCase().includes(t.toLowerCase()));
      if (!alreadyIn) {
        prompt = prompt ? `${triggerString}, ${prompt}` : triggerString;
      }

      let expPrompt = (prev.expanded_prompt || "").trim();
      if (expPrompt && !triggers.every(t => expPrompt.toLowerCase().includes(t.toLowerCase()))) {
        expPrompt = `${triggerString}, ${expPrompt}`;
      }

      return {
        ...prev,
        basic_stub: prompt,
        expanded_prompt: expPrompt || prev.expanded_prompt
      };
    });

    setInjectedTrigger(slotId);
    setTimeout(() => setInjectedTrigger(null), 2000);
    onShowToast?.(`Injected trigger words [${triggerString}] into Shot prompt!`, "success");
  };

  const handleTransferToRemote = async (lora: SystemLora) => {
    if (!lora || !lora.download_url) return;
    setTransferringMap(prev => ({ ...prev, [lora.id]: true }));
    try {
      const res: any = await lorasApi.transferRemote({
        lora_id: lora.id,
        filename: lora.filename,
        download_url: lora.download_url,
        destination_folder: lora.default_destination_folder || "loras"
      });
      if (res && res.success) {
        setTransferSuccessMap(prev => ({ ...prev, [lora.id]: "Transferred!" }));
        onShowToast?.(`Successfully staged "${lora.name}" to remote GPU!`, "success");
        // Refresh remote status
        const rep: any = await lorasApi.checkRemoteStatus();
        if (rep && rep.success) setRemoteStatus(rep);
      } else {
        setTransferSuccessMap(prev => ({ ...prev, [lora.id]: "Transfer failed" }));
        onShowToast?.(`Failed to transfer "${lora.name}"`, "error");
      }
    } catch (err: any) {
      setTransferSuccessMap(prev => ({ ...prev, [lora.id]: err.message || "Failed" }));
      onShowToast?.(`Transfer error: ${err.message}`, "error");
    } finally {
      setTransferringMap(prev => ({ ...prev, [lora.id]: false }));
      setTimeout(() => {
        setTransferSuccessMap(prev => {
          const next = { ...prev };
          delete next[lora.id];
          return next;
        });
      }, 4000);
    }
  };

  // Open Civitai search modal for specific slot
  const handleOpenSearchModal = (nodeId?: string, nodeTitle?: string) => {
    setSearchTargetNodeId(nodeId || "");
    setSearchTargetNodeTitle(nodeTitle || "");
    setSearchModalOpen(true);
  };

  // Callback when user chooses a model from the Civitai search modal
  const handleSelectFromCivitai = (lora: SystemLora, autoInject?: boolean) => {
    fetchLoras();
    if (searchTargetNodeId) {
      handleUpdateSlot(searchTargetNodeId, {
        lora_name: lora.filename,
        strength_model: lora.preferred_strength_model ?? 0.85,
        strength_clip: lora.preferred_strength_clip ?? 1.0,
        bypassed: false
      });

      if (autoInject && lora.trigger_words && lora.trigger_words.length > 0) {
        handleInjectTriggers(lora.trigger_words, searchTargetNodeId);
      }
    }
  };

  // Check for missing LoRAs among active (non-bypassed) assigned slots
  const missingAssignedLoras = useMemo(() => {
    const missing: SystemLora[] = [];
    if (!remoteStatus?.loras_status) return missing;

    for (const node of loraNodes) {
      const nodeId = String((node as any).id || (node as any).node_id || "");
      const assignment = activeAssignments[nodeId];
      if (assignment && !assignment.bypassed && assignment.lora_name) {
        const lora = systemLoras.find(l => l.filename === assignment.lora_name || l.name === assignment.lora_name);
        if (lora) {
          const stat = remoteStatus.loras_status[lora.filename];
          if (!stat?.exists_on_remote && lora.download_url) {
            if (!missing.some(m => m.id === lora.id)) {
              missing.push(lora);
            }
          }
        }
      }
    }
    return missing;
  }, [loraNodes, activeAssignments, systemLoras, remoteStatus]);

  // Bulk Stage all missing LoRAs
  const handleBulkStageMissing = async () => {
    if (missingAssignedLoras.length === 0) return;
    setIsBulkStaging(true);
    onShowToast?.(`Staging ${missingAssignedLoras.length} missing LoRA(s) to remote GPU...`, "info");

    try {
      for (const lora of missingAssignedLoras) {
        if (lora.download_url) {
          await lorasApi.transferRemote({
            lora_id: lora.id,
            filename: lora.filename,
            download_url: lora.download_url,
            destination_folder: lora.default_destination_folder || "models/loras/"
          }).catch(e => console.warn("LoRA stage failed", e));
        }
      }
      onShowToast?.("Completed pre-flight LoRA staging!", "success");
      const rep: any = await lorasApi.checkRemoteStatus();
      if (rep && rep.success) setRemoteStatus(rep);
    } catch (err: any) {
      onShowToast?.(`Pre-flight staging error: ${err.message}`, "error");
    } finally {
      setIsBulkStaging(false);
    }
  };

  if (!loraNodes || loraNodes.length === 0) {
    return (
      <div className="bg-zinc-50 dark:bg-zinc-950/40 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl p-4 text-center space-y-1.5">
        <div className="flex items-center justify-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>No LoRA Loader Nodes Detected</span>
        </div>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto">
          This ComfyUI workflow does not contain any <code className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-[10px]">LoraLoader</code> or <code className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-[10px]">WanVideoLoraLoader</code> nodes. Add a LoRA slot to your workflow JSON to enable dynamic per-shot character, style, and motion LoRA injection.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600 border border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                Workflow LoRA Slot Bindings
              </h3>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                {loraNodes.length} Slot{loraNodes.length > 1 ? "s" : ""} Available
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Attach favorited LoRAs or search Civitai directly to inject character, style, and motion weights into active workflow AST nodes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
          <button
            type="button"
            onClick={() => handleOpenSearchModal()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 text-white shadow-2xs transition-colors cursor-pointer"
            title="Search Civitai Model Hub for LoRAs"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search Civitai</span>
          </button>

          <button
            type="button"
            onClick={fetchLoras}
            disabled={loadingLoras}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-colors cursor-pointer"
            title="Refresh Favorites & Remote GPU Status"
          >
            <RefreshCw className={`w-3 h-3 ${loadingLoras ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Pre-Flight Missing LoRA Auto-Stage Banner */}
      {missingAssignedLoras.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <div>
              <span className="font-bold text-amber-900 dark:text-amber-200">
                Pre-Flight Notice: {missingAssignedLoras.length} assigned LoRA{missingAssignedLoras.length > 1 ? "s are" : " is"} not on the Remote GPU.
              </span>
              <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                Missing: {missingAssignedLoras.map(l => l.name).join(", ")}. Auto-stage now to prevent ComfyUI execution aborts.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleBulkStageMissing}
            disabled={isBulkStaging}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-800 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 shrink-0 shadow-2xs transition-colors cursor-pointer"
          >
            <Download className={`w-3.5 h-3.5 ${isBulkStaging ? "animate-bounce" : ""}`} />
            <span>{isBulkStaging ? "Staging to Remote GPU..." : "1-Click Stage All Missing"}</span>
          </button>
        </div>
      )}

      {/* LoRA Slots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {loraNodes.map((node) => {
          const nodeId = String((node as any).id || (node as any).node_id || "");
          const title = (node as any).title || `${(node as any).class_type} (#${nodeId})`;
          const classType = (node as any).class_type || "LoraLoader";
          
          const defaultDetails = (node as any).lora_details || {};
          const assignment: ShotLoraAssignment = activeAssignments[nodeId] || {
            lora_name: defaultDetails.lora_name || (node as any).lora_name || "",
            strength_model: defaultDetails.strength_model ?? (node as any).strength_model ?? 1.0,
            strength_clip: defaultDetails.strength_clip ?? (node as any).strength_clip ?? 1.0,
            bypassed: defaultDetails.bypassed ?? (node as any).is_bypassed ?? false
          };

          const isCustomMode = customModeNodes[nodeId];
          const matchedSystemLora = systemLoras.find(
            l => l.filename === assignment.lora_name || l.name === assignment.lora_name
          );

          const remoteCheck = matchedSystemLora && remoteStatus?.loras_status?.[matchedSystemLora.filename];
          const isRemoteReady = Boolean(remoteCheck?.exists_on_remote);
          const hasTriggers = Boolean(matchedSystemLora?.trigger_words && matchedSystemLora.trigger_words.length > 0);

          return (
            <div
              key={nodeId}
              className={`rounded-xl border transition-all p-3.5 space-y-3 ${
                assignment.bypassed
                  ? "bg-zinc-50/50 dark:bg-zinc-950/30 border-zinc-200 dark:border-zinc-800/80 opacity-75"
                  : "bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-700/80 shadow-2xs"
              }`}
            >
              {/* Slot Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex items-start gap-2">
                  <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 border ${
                    assignment.bypassed
                      ? "bg-zinc-100 text-zinc-400 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-500 dark:border-zinc-700"
                      : "bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20"
                  }`}>
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100">
                        Node #{nodeId}
                      </span>
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                        {title}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono truncate">
                      {classType}
                    </p>
                  </div>
                </div>

                {/* Bypass / Enable Toggle & Search Quick Button */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenSearchModal(nodeId, title)}
                    className="p-1 rounded-md text-[11px] text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 border border-purple-200 dark:border-purple-900/40 transition-colors cursor-pointer"
                    title="Search Civitai for this slot"
                  >
                    <Search className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdateSlot(nodeId, { bypassed: !assignment.bypassed })}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 border transition-colors cursor-pointer ${
                      assignment.bypassed
                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-300"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-500/30"
                    }`}
                    title={assignment.bypassed ? "Slot is Bypassed (Click to Enable)" : "Slot is Active (Click to Bypass)"}
                  >
                    <Power className="w-3 h-3" />
                    <span>{assignment.bypassed ? "Bypassed" : "Active"}</span>
                  </button>
                </div>
              </div>

              {/* LoRA Selection */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                    <span>Attached LoRA Weight</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenSearchModal(nodeId, title)}
                      className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold hover:underline cursor-pointer flex items-center gap-0.5"
                    >
                      <Search className="w-2.5 h-2.5" />
                      <span>Find on Civitai</span>
                    </button>
                    <span className="text-zinc-300 dark:text-zinc-700">|</span>
                    <button
                      type="button"
                      onClick={() => setCustomModeNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }))}
                      className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      {isCustomMode ? "Select from Library" : "Type Filename"}
                    </button>
                  </div>
                </div>

                {isCustomMode ? (
                  <input
                    type="text"
                    value={assignment.lora_name || ""}
                    onChange={(e) => handleUpdateSlot(nodeId, { lora_name: e.target.value })}
                    placeholder="e.g. wan2.1_cinematic_lighting.safetensors"
                    className="w-full px-3 py-1.5 text-xs font-mono bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                ) : (
                  <select
                    value={assignment.lora_name || ""}
                    onChange={(e) => {
                      const selFn = e.target.value;
                      const selectedObj = systemLoras.find(l => l.filename === selFn || l.name === selFn);
                      handleUpdateSlot(nodeId, {
                        lora_name: selFn,
                        strength_model: selectedObj?.preferred_strength_model ?? assignment.strength_model ?? 1.0,
                        strength_clip: selectedObj?.preferred_strength_clip ?? assignment.strength_clip ?? 1.0,
                        bypassed: !selFn
                      });
                    }}
                    className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-purple-500 focus:outline-hidden font-medium cursor-pointer truncate"
                  >
                    <option value="">— None (Bypass Slot) —</option>
                    {systemLoras.map((lora) => {
                      const onGpu = remoteStatus?.loras_status?.[lora.filename]?.exists_on_remote;
                      const gpuTag = onGpu ? "✓ [GPU Ready]" : "[Not on GPU]";
                      return (
                        <option key={lora.id} value={lora.filename}>
                          {lora.name} ({lora.base_model || "SDXL"}) {gpuTag}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              {/* Matched LoRA Info & Trigger Words Banner */}
              {matchedSystemLora && (
                <div className="bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 rounded-lg p-2.5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-purple-900 dark:text-purple-200 truncate">
                      {matchedSystemLora.name}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {matchedSystemLora.base_model && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300">
                          {matchedSystemLora.base_model}
                        </span>
                      )}
                      {isRemoteReady ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" /> GPU Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                          <AlertCircle className="w-3 h-3" /> Not on GPU
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Trigger Words Quick Copy & Direct Prompt Injection */}
                  {hasTriggers && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pt-1 border-t border-purple-200/60 dark:border-purple-800/40">
                      <div className="min-w-0 flex items-center gap-1 text-[11px] text-zinc-600 dark:text-zinc-300 truncate">
                        <Flame className="w-3 h-3 text-amber-500 shrink-0" />
                        <span className="truncate">
                          Triggers: <code className="font-mono text-purple-700 dark:text-purple-300">[{matchedSystemLora.trigger_words?.join(", ")}]</code>
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                        {/* Inject into prompt button */}
                        <button
                          type="button"
                          onClick={() => handleInjectTriggers(matchedSystemLora.trigger_words || [], nodeId)}
                          className="px-2 py-0.5 rounded bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer transition-colors shadow-2xs"
                          title="Inject trigger words directly into active Shot prompt"
                        >
                          {injectedTrigger === nodeId ? (
                            <>
                              <Check className="w-2.5 h-2.5" />
                              <span>Injected!</span>
                            </>
                          ) : (
                            <>
                              <Wand2 className="w-2.5 h-2.5" />
                              <span>✨ Inject Prompt</span>
                            </>
                          )}
                        </button>

                        {/* Copy triggers button */}
                        <button
                          type="button"
                          onClick={() => handleCopyTriggers(matchedSystemLora.trigger_words || [], nodeId)}
                          className="px-2 py-0.5 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[10px] font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                          title="Copy trigger words to clipboard"
                        >
                          {copiedTrigger === nodeId ? (
                            <>
                              <Check className="w-2.5 h-2.5 text-emerald-500" />
                              <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-2.5 h-2.5 text-zinc-400" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 1-Click Remote GPU Stage button if missing on remote server */}
                  {!isRemoteReady && matchedSystemLora.download_url && (
                    <div className="pt-1 flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-zinc-500 dark:text-zinc-400 text-[10px]">
                        LoRA file not found on remote GPU disk.
                      </span>
                      <button
                        type="button"
                        onClick={() => handleTransferToRemote(matchedSystemLora)}
                        disabled={transferringMap[matchedSystemLora.id]}
                        className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-semibold text-[10px] flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                      >
                        <Download className={`w-2.5 h-2.5 ${transferringMap[matchedSystemLora.id] ? "animate-bounce" : ""}`} />
                        <span>{transferSuccessMap[matchedSystemLora.id] || (transferringMap[matchedSystemLora.id] ? "Staging..." : "Stage to GPU")}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Weight & CLIP Strength Sliders */}
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-zinc-200 dark:border-zinc-800/80 text-xs">
                {/* Model Strength */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-600 dark:text-zinc-400 font-medium">Model Strength</span>
                    <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                      {(assignment.strength_model ?? 1.0).toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2.0"
                    step="0.05"
                    value={assignment.strength_model ?? 1.0}
                    onChange={(e) => handleUpdateSlot(nodeId, { strength_model: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                </div>

                {/* CLIP Strength */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-600 dark:text-zinc-400 font-medium">CLIP Strength</span>
                    <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                      {(assignment.strength_clip ?? 1.0).toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2.0"
                    step="0.05"
                    value={assignment.strength_clip ?? 1.0}
                    onChange={(e) => handleUpdateSlot(nodeId, { strength_clip: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Civitai LoRA Search & Ingest Modal */}
      <CivitaiLoraSearchModal
        isOpen={searchModalOpen}
        targetNodeId={searchTargetNodeId}
        targetNodeTitle={searchTargetNodeTitle}
        onClose={() => setSearchModalOpen(false)}
        onSelectLora={handleSelectFromCivitai}
        onShowToast={onShowToast}
      />
    </div>
  );
};
