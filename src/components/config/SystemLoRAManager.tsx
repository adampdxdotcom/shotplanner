import React, { useState, useEffect, useMemo } from "react";
import { 
  Layers, 
  Search, 
  RefreshCw, 
  Plus, 
  DownloadCloud, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Edit3, 
  Copy, 
  ExternalLink, 
  Server, 
  Sparkles,
  Sliders,
  Check,
  X
} from "lucide-react";
import { SystemLora, RemoteLoraFileStatus, AppConfig } from "../../types";
import { lorasApi } from "../../api";
import { copyToClipboard } from "../../utils/clipboard";

interface SystemLoRAManagerProps {
  config: AppConfig;
  onShowToast?: (text: string, type: "success" | "error" | "info") => void;
}

export const SystemLoRAManager: React.FC<SystemLoRAManagerProps> = ({
  config,
  onShowToast
}) => {
  const [loras, setLoras] = useState<SystemLora[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBaseModel, setSelectedBaseModel] = useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<"all" | "on_remote" | "not_on_remote">("all");

  // Remote inspection state
  const [probingRemote, setProbingRemote] = useState(false);
  const [remoteStatusMap, setRemoteStatusMap] = useState<Record<string, RemoteLoraFileStatus>>({});
  const [lastScannedHost, setLastScannedHost] = useState<string>("");

  // Transferring state per LoRA id
  const [transferringIds, setTransferringIds] = useState<Record<string, boolean>>({});

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLora, setEditingLora] = useState<SystemLora | null>(null);

  // Copied trigger word feedback state
  const [copiedTrigger, setCopiedTrigger] = useState<string | null>(null);

  // Fetch registered LoRAs
  const fetchLoras = async () => {
    setLoading(true);
    try {
      const res = await lorasApi.listLoras();
      if (res?.success && Array.isArray(res.loras)) {
        setLoras(res.loras);
      }
    } catch (err: any) {
      onShowToast?.(err.message || "Failed to load system LoRAs.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoras();
  }, []);

  // Probe Remote GPU host via SSH for all LoRAs
  const handleProbeRemote = async () => {
    setProbingRemote(true);
    try {
      const res = await lorasApi.checkRemoteStatus({ creds: config });
      if (res?.success && res.loras_status) {
        setRemoteStatusMap(res.loras_status);
        setLastScannedHost(res.remote_host || "");
        const onRemoteCount = Object.values(res.loras_status).filter(s => s.exists_on_remote).length;
        onShowToast?.(
          `Scanned remote GPU (${res.remote_host}): ${onRemoteCount} of ${Object.keys(res.loras_status).length} system LoRAs verified.`,
          "success"
        );
      }
    } catch (err: any) {
      onShowToast?.(err.message || "Failed to inspect remote GPU.", "error");
    } finally {
      setProbingRemote(false);
    }
  };

  // Transfer LoRA to remote GPU
  const handleTransferToRemote = async (lora: SystemLora) => {
    if (!lora.download_url && !lora.filename) {
      onShowToast?.(`Cannot transfer "${lora.name}": Missing download URL.`, "error");
      return;
    }

    setTransferringIds(prev => ({ ...prev, [lora.id]: true }));
    onShowToast?.(`Initiating remote GPU download for "${lora.name}"...`, "info");

    try {
      const res = await lorasApi.transferRemote({
        lora_id: lora.id,
        filename: lora.filename,
        download_url: lora.download_url,
        destination_folder: lora.default_destination_folder || "models/loras/",
        creds: config
      });

      if (res?.success) {
        onShowToast?.(`Successfully transferred "${lora.name}" to remote GPU!`, "success");
        // Update local remote status map
        setRemoteStatusMap(prev => ({
          ...prev,
          [lora.filename]: {
            filename: lora.filename,
            exists_on_remote: true,
            remote_path: res.destination_path,
            size_formatted: res.file_size
          }
        }));
      } else {
        throw new Error(res?.message || "Transfer failed.");
      }
    } catch (err: any) {
      onShowToast?.(`LoRA transfer failed: ${err.message}`, "error");
    } finally {
      setTransferringIds(prev => ({ ...prev, [lora.id]: false }));
    }
  };

  // Delete LoRA
  const handleDeleteLora = async (lora: SystemLora) => {
    if (!confirm(`Remove "${lora.name}" from system LoRA library?`)) return;

    try {
      const res = await lorasApi.deleteLora(lora.id);
      if (res?.success) {
        setLoras(prev => prev.filter(l => l.id !== lora.id));
        onShowToast?.(`Removed "${lora.name}" from system LoRAs.`, "info");
      }
    } catch (err: any) {
      onShowToast?.(err.message || "Failed to delete LoRA.", "error");
    }
  };

  // Copy trigger word to clipboard
  const handleCopyTrigger = (word: string) => {
    copyToClipboard(word);
    setCopiedTrigger(word);
    setTimeout(() => setCopiedTrigger(null), 2000);
    onShowToast?.(`Copied "${word}" to clipboard`, "info");
  };

  // Filtered LoRAs
  const filteredLoras = useMemo(() => {
    return loras.filter(lora => {
      // Search text
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = lora.name.toLowerCase().includes(q);
        const matchesFile = lora.filename.toLowerCase().includes(q);
        const matchesTriggers = lora.trigger_words?.some(t => t.toLowerCase().includes(q));
        const matchesDesc = (lora.description || "").toLowerCase().includes(q);
        if (!matchesName && !matchesFile && !matchesTriggers && !matchesDesc) return false;
      }

      // Base model
      if (selectedBaseModel !== "all") {
        const base = (lora.base_model || "").toLowerCase();
        if (selectedBaseModel === "flux" && !base.includes("flux")) return false;
        if (selectedBaseModel === "sdxl" && !base.includes("sdxl")) return false;
        if (selectedBaseModel === "wan" && !base.includes("wan")) return false;
        if (selectedBaseModel === "sd15" && !base.includes("1.5")) return false;
        if (selectedBaseModel === "pony" && !base.includes("pony")) return false;
      }

      // Remote status filter
      if (selectedStatusFilter !== "all") {
        const status = remoteStatusMap[lora.filename];
        const isOnRemote = status?.exists_on_remote;
        if (selectedStatusFilter === "on_remote" && !isOnRemote) return false;
        if (selectedStatusFilter === "not_on_remote" && isOnRemote) return false;
      }

      return true;
    });
  }, [loras, searchQuery, selectedBaseModel, selectedStatusFilter, remoteStatusMap]);

  return (
    <div id="system-lora-manager" className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-zinc-900/80 border border-zinc-700/80 rounded-xl shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-lg bg-purple-500/20 text-purple-400 shrink-0 border border-purple-500/30">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide">System LoRA Library</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-purple-950/80 border border-purple-800/80 text-purple-300">
                {loras.length} Registered
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              System-wide LoRAs persist across all scenes &amp; projects. Checked by Production Assistant for automated staging.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleProbeRemote}
            disabled={probingRemote}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-750 disabled:opacity-50 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-medium transition-all shadow-xs cursor-pointer"
            title="Scan remote GPU ComfyUI models/loras/ directory via SSH"
          >
            <Server className={`w-3.5 h-3.5 text-cyan-400 ${probingRemote ? "animate-pulse" : ""}`} />
            {probingRemote ? "Probing GPU..." : "Check Remote GPU"}
          </button>

          <button
            onClick={() => {
              setEditingLora(null);
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add System LoRA
          </button>
        </div>
      </div>

      {/* Filter and Search Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 bg-zinc-900/60 border border-zinc-800 rounded-xl">
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search LoRAs by name, filename, triggers, style..."
              className="w-full pl-8.5 pr-3 py-1.5 bg-zinc-800/90 border border-zinc-700/80 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Base Model Dropdown */}
          <select
            value={selectedBaseModel}
            onChange={e => setSelectedBaseModel(e.target.value)}
            className="px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Base Models</option>
            <option value="flux">Flux.1</option>
            <option value="sdxl">SDXL</option>
            <option value="wan">Wan2.1</option>
            <option value="sd15">SD 1.5</option>
            <option value="pony">Pony</option>
          </select>

          {/* Remote Status Filter */}
          <select
            value={selectedStatusFilter}
            onChange={e => setSelectedStatusFilter(e.target.value as any)}
            className="px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Remote Statuses</option>
            <option value="on_remote">Verified on Remote GPU</option>
            <option value="not_on_remote">Not on Remote GPU</option>
          </select>

          <button
            onClick={fetchLoras}
            disabled={loading}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 bg-zinc-800 rounded-lg border border-zinc-700 cursor-pointer"
            title="Refresh Library"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* LoRA Cards Grid */}
      {filteredLoras.length === 0 ? (
        <div className="p-8 text-center bg-zinc-900/40 border border-dashed border-zinc-800 rounded-xl space-y-3">
          <Layers className="w-8 h-8 text-zinc-600 mx-auto" />
          <p className="text-sm font-medium text-zinc-300">No LoRAs match the current filters.</p>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            Add a custom LoRA or favorite any LoRA in Civitai / HuggingFace tabs to populate your system-wide library.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredLoras.map(lora => {
            const isTransferring = !!transferringIds[lora.id];
            const remoteStatus = remoteStatusMap[lora.filename];
            const isOnRemote = remoteStatus?.exists_on_remote;
            const triggers = lora.trigger_words || [];

            return (
              <div
                key={lora.id}
                className="flex flex-col justify-between p-3.5 bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700/80 rounded-xl transition-all shadow-xs space-y-3"
              >
                {/* Card Top: Preview + Header */}
                <div className="flex items-start gap-3 min-w-0">
                  {lora.preview_image_url ? (
                    <img
                      src={lora.preview_image_url}
                      alt={lora.name}
                      className="w-16 h-16 rounded-lg object-cover bg-zinc-950 border border-zinc-750 shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-purple-400 shrink-0">
                      <Layers className="w-6 h-6" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-1.5">
                      <h4 className="text-xs font-bold text-white truncate" title={lora.name}>
                        {lora.name}
                      </h4>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            setEditingLora(lora);
                            setShowAddModal(true);
                          }}
                          className="p-1 text-zinc-400 hover:text-zinc-200 rounded hover:bg-zinc-800 cursor-pointer"
                          title="Edit LoRA Settings"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteLora(lora)}
                          className="p-1 text-zinc-400 hover:text-rose-400 rounded hover:bg-zinc-800 cursor-pointer"
                          title="Delete from Library"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 border border-zinc-700 text-zinc-300">
                        {lora.base_model || "SDXL"}
                      </span>
                      {lora.category && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-950/60 border border-purple-800/60 text-purple-300 uppercase font-mono">
                          {lora.category}
                        </span>
                      )}
                      {lora.file_size_formatted && (
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {lora.file_size_formatted}
                        </span>
                      )}
                    </div>

                    <p className="font-mono text-[10.5px] text-zinc-400 truncate" title={lora.filename}>
                      {lora.filename}
                    </p>
                  </div>
                </div>

                {/* Remote GPU Status Badge */}
                <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-zinc-950/60 border border-zinc-850">
                  <div className="flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="text-zinc-400">GPU Disk:</span>
                  </div>

                  {isOnRemote ? (
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      On Remote GPU
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-400 font-medium text-[11px]">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Not on Remote
                    </span>
                  )}
                </div>

                {/* Trigger Words Section */}
                {triggers.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                      Trigger Words:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {triggers.slice(0, 4).map((w, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleCopyTrigger(w)}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-950/40 hover:bg-purple-900/60 border border-purple-800/50 text-purple-200 transition-colors cursor-pointer"
                          title="Click to copy trigger word"
                        >
                          {copiedTrigger === w ? (
                            <Check className="w-2.5 h-2.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-2.5 h-2.5 text-purple-400" />
                          )}
                          <span className="truncate max-w-[120px]">{w}</span>
                        </button>
                      ))}
                      {triggers.length > 4 && (
                        <span className="text-[10px] text-zinc-500 self-center">
                          +{triggers.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Preferred Weights & Actions Footer */}
                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                  <div className="text-[10.5px] text-zinc-400 font-mono">
                    <span>W: {lora.preferred_strength_model ?? 0.85}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {lora.download_url && (
                      <button
                        onClick={() => handleTransferToRemote(lora)}
                        disabled={isTransferring}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all shadow-xs cursor-pointer ${
                          isOnRemote
                            ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700"
                            : "bg-purple-600 hover:bg-purple-500 text-white"
                        }`}
                        title="Download / Transfer directly onto remote GPU ComfyUI models/loras/"
                      >
                        <DownloadCloud className={`w-3 h-3 ${isTransferring ? "animate-spin" : ""}`} />
                        {isTransferring ? "Transferring..." : isOnRemote ? "Re-transfer" : "Transfer to GPU"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit LoRA Modal */}
      {showAddModal && (
        <AddEditLoraModal
          initialLora={editingLora}
          onClose={() => {
            setShowAddModal(false);
            setEditingLora(null);
          }}
          onSave={async (loraData) => {
            try {
              const res = await lorasApi.saveLora(loraData);
              if (res?.success) {
                onShowToast?.(`Saved system LoRA "${res.lora.name}"!`, "success");
                setShowAddModal(false);
                setEditingLora(null);
                fetchLoras();
              }
            } catch (err: any) {
              onShowToast?.(err.message || "Failed to save LoRA.", "error");
            }
          }}
        />
      )}
    </div>
  );
};

interface AddEditLoraModalProps {
  initialLora?: SystemLora | null;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}

const AddEditLoraModal: React.FC<AddEditLoraModalProps> = ({
  initialLora,
  onClose,
  onSave
}) => {
  const [name, setName] = useState(initialLora?.name || "");
  const [filename, setFilename] = useState(initialLora?.filename || "");
  const [baseModel, setBaseModel] = useState(initialLora?.base_model || "SDXL");
  const [category, setCategory] = useState(initialLora?.category || "lora");
  const [triggerWords, setTriggerWords] = useState((initialLora?.trigger_words || []).join(", "));
  const [downloadUrl, setDownloadUrl] = useState(initialLora?.download_url || "");
  const [previewImageUrl, setPreviewImageUrl] = useState(initialLora?.preview_image_url || "");
  const [modelWeight, setModelWeight] = useState(initialLora?.preferred_strength_model ?? 0.85);
  const [clipWeight, setClipWeight] = useState(initialLora?.preferred_strength_clip ?? 1.0);
  const [description, setDescription] = useState(initialLora?.description || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !filename.trim()) return;

    setSaving(true);
    const triggers = triggerWords
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);

    await onSave({
      id: initialLora?.id,
      name: name.trim(),
      filename: filename.trim(),
      base_model: baseModel,
      category,
      trigger_words: triggers,
      download_url: downloadUrl.trim() || undefined,
      preview_image_url: previewImageUrl.trim() || undefined,
      preferred_strength_model: Number(modelWeight) || 0.85,
      preferred_strength_clip: Number(clipWeight) || 1.0,
      description: description.trim() || undefined,
      is_favorite: true
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/90">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold text-white">
              {initialLora ? "Edit System LoRA" : "Add System LoRA"}
            </h3>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 overflow-y-auto flex-1 text-xs">
          <div>
            <label className="block text-zinc-300 font-semibold mb-1">LoRA Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Cyberpunk Neon Realism"
              className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-semibold mb-1">Filename on Remote GPU *</label>
            <input
              type="text"
              required
              value={filename}
              onChange={e => setFilename(e.target.value)}
              placeholder="e.g. cyberpunk_neon_v2.safetensors"
              className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white font-mono focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-semibold mb-1">Base Model</label>
              <select
                value={baseModel}
                onChange={e => setBaseModel(e.target.value)}
                className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                <option value="Flux.1 D">Flux.1 Dev / Schnell</option>
                <option value="SDXL">SDXL</option>
                <option value="Wan2.1">Wan2.1 Video</option>
                <option value="SD 1.5">SD 1.5</option>
                <option value="Pony">Pony XL</option>
                <option value="HunyuanVideo">HunyuanVideo</option>
              </select>
            </div>

            <div>
              <label className="block text-zinc-300 font-semibold mb-1">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                <option value="lora">LoRA</option>
                <option value="lycoris">LyCORIS / LoHa</option>
                <option value="dora">DoRA</option>
                <option value="style">Style Preset</option>
                <option value="character">Character LoRA</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-semibold mb-1">
              Trigger Words <span className="text-zinc-500 font-normal">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={triggerWords}
              onChange={e => setTriggerWords(e.target.value)}
              placeholder="e.g. neon cyberpunk, wet street reflection, glowing visor"
              className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-semibold mb-1">
              Direct Download URL <span className="text-zinc-500 font-normal">(Civitai / HuggingFace download link)</span>
            </label>
            <input
              type="url"
              value={downloadUrl}
              onChange={e => setDownloadUrl(e.target.value)}
              placeholder="https://civitai.com/api/download/models/..."
              className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white font-mono focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-semibold mb-1">Preview Image URL</label>
            <input
              type="url"
              value={previewImageUrl}
              onChange={e => setPreviewImageUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-semibold mb-1">Model Strength ({modelWeight})</label>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.05"
                value={modelWeight}
                onChange={e => setModelWeight(parseFloat(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-semibold mb-1">CLIP Strength ({clipWeight})</label>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.05"
                value={clipWeight}
                onChange={e => setClipWeight(parseFloat(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-semibold mb-1">Description / Notes</label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Recommended usage, base prompt tips..."
              className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-zinc-400 hover:text-zinc-200 cursor-pointer font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
            >
              {saving ? "Saving..." : initialLora ? "Update LoRA" : "Save to Library"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
