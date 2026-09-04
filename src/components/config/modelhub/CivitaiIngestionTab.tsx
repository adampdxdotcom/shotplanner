import React, { useState, useEffect } from "react";
import { 
  AppConfig, 
  CivitaiModelMetadata, 
  CivitaiFavorite 
} from "../../../types";
import { copyToClipboard } from "../../../utils/clipboard";
import { 
  fetchCivitaiFavorites, 
  addCivitaiFavorite, 
  removeCivitaiFavorite 
} from "../../../services/civitaiFavoritesService";
import { CivitaiFavoritesTray } from "../CivitaiFavoritesTray";
import { COMFYUI_MODEL_CATEGORIES } from "./modelHubConstants";
import { CivitaiModelCard } from "./CivitaiModelCard";
import { CivitaiCredentialsCard } from "./CivitaiCredentialsCard";
import { 
  Search, 
  RefreshCw, 
  AlertCircle 
} from "lucide-react";

export interface CivitaiIngestionTabProps {
  config: AppConfig;
  onChange: (newConfig: AppConfig) => void;
  onShowToast?: (text: string, type: "success" | "error" | "info") => void;
  civitaiConfigured: boolean;
  setCivitaiConfigured: (configured: boolean) => void;
  civitaiMaskedKey: string;
  setCivitaiMaskedKey: (masked: string) => void;
  downloading: boolean;
  downloadElapsed: number;
  onExecuteDownload: (target: {
    downloadUrl: string;
    destinationFolder: string;
    filename: string;
    authType: "civitai";
  }) => void;
  onResetDownloadResult: () => void;
}

export const CivitaiIngestionTab: React.FC<CivitaiIngestionTabProps> = ({
  config,
  onChange,
  onShowToast,
  civitaiConfigured,
  setCivitaiConfigured,
  civitaiMaskedKey,
  setCivitaiMaskedKey,
  downloading,
  downloadElapsed,
  onExecuteDownload,
  onResetDownloadResult
}) => {
  // Civitai Key Input State
  const [civitaiKeyInput, setCivitaiKeyInput] = useState("");
  const [savingCivitaiKey, setSavingCivitaiKey] = useState(false);
  const [civitaiTokenFeedback, setCivitaiTokenFeedback] = useState<{ success?: boolean; message?: string } | null>(null);

  // Civitai Search & Model State
  const [civitaiQuery, setCivitaiQuery] = useState("");
  const [lookingUpCivitai, setLookingUpCivitai] = useState(false);
  const [civitaiMetadata, setCivitaiMetadata] = useState<CivitaiModelMetadata | null>(null);
  const [civitaiLookupError, setCivitaiLookupError] = useState<string | null>(null);
  const [civitaiCategoryPreset, setCivitaiCategoryPreset] = useState<string>("checkpoints");
  const [civitaiTargetDest, setCivitaiTargetDest] = useState<string>("models/checkpoints/");
  const [civitaiTargetFilename, setCivitaiTargetFilename] = useState<string>("");
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [copiedCivitaiCmd, setCopiedCivitaiCmd] = useState(false);
  const [copiedTriggerWord, setCopiedTriggerWord] = useState<string | null>(null);

  // Favorites
  const [favorites, setFavorites] = useState<CivitaiFavorite[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);

  // Load favorites on mount
  useEffect(() => {
    setLoadingFavorites(true);
    fetchCivitaiFavorites()
      .then((favs) => setFavorites(favs))
      .catch(() => {})
      .finally(() => setLoadingFavorites(false));
  }, []);

  // Handle saving Civitai API Key
  const handleSaveCivitaiKey = async () => {
    const clean = civitaiKeyInput.trim();
    if (!clean) {
      setCivitaiTokenFeedback({ success: false, message: "Please enter a valid Civitai API token." });
      return;
    }

    setSavingCivitaiKey(true);
    setCivitaiTokenFeedback(null);

    try {
      const res = await fetch("/api/settings/civitai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: clean })
      });
      if (!res.ok) throw new Error("Failed to save Civitai API token");

      setCivitaiConfigured(true);
      const masked = clean.length > 8 ? `${clean.slice(0, 4)}...${clean.slice(-4)}` : "***";
      setCivitaiMaskedKey(masked);
      setCivitaiKeyInput("");
      setCivitaiTokenFeedback({ success: true, message: "Civitai API token saved securely." });
      onChange({ ...config, civitai_api_key: clean });
      if (onShowToast) onShowToast("Civitai API token configured", "success");
    } catch (err: any) {
      setCivitaiTokenFeedback({ success: false, message: err.message || "Error saving token" });
    } finally {
      setSavingCivitaiKey(false);
    }
  };

  const handleClearCivitaiKey = async () => {
    setSavingCivitaiKey(true);
    try {
      await fetch("/api/settings/civitai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: "" })
      });
      setCivitaiConfigured(false);
      setCivitaiMaskedKey("");
      setCivitaiKeyInput("");
      setCivitaiTokenFeedback({ success: true, message: "Civitai token cleared." });
      onChange({ ...config, civitai_api_key: "" });
    } catch (e) {
    } finally {
      setSavingCivitaiKey(false);
    }
  };

  // Civitai model lookup
  const handleLookupCivitaiModel = async (overrideQuery?: string) => {
    const q = (overrideQuery !== undefined ? overrideQuery : civitaiQuery).trim();
    if (!q) {
      setCivitaiLookupError("Please provide a Civitai Model ID, Version ID, or Web URL.");
      return;
    }

    setLookingUpCivitai(true);
    setCivitaiLookupError(null);
    setCivitaiMetadata(null);
    onResetDownloadResult();

    try {
      const url = `/api/model-hub/civitai-info?query=${encodeURIComponent(q)}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to inspect model on Civitai.");
      }

      const meta: CivitaiModelMetadata = data.data || data;
      setCivitaiMetadata(meta);
      setCivitaiTargetFilename(meta.filename);
      setSelectedVersionId(meta.version_id);

      // Match category preset
      const catLower = (meta.category || "").toLowerCase();
      let matchedPreset = "checkpoints";
      if (catLower.includes("lora") || catLower.includes("dora") || catLower.includes("locon")) {
        matchedPreset = "loras";
      } else if (catLower.includes("controlnet") || catLower.includes("adapter")) {
        matchedPreset = "controlnet";
      } else if (catLower.includes("vae")) {
        matchedPreset = "vae";
      } else if (catLower.includes("upscaler") || catLower.includes("upscale")) {
        matchedPreset = "upscalers";
      } else if (catLower.includes("embedding")) {
        matchedPreset = "embeddings";
      } else if (catLower.includes("unet") || catLower.includes("diffusion")) {
        matchedPreset = "diffusion_models";
      }

      setCivitaiCategoryPreset(matchedPreset);
      const presetObj = COMFYUI_MODEL_CATEGORIES.find((p) => p.id === matchedPreset);
      setCivitaiTargetDest(presetObj ? presetObj.subfolder : meta.default_destination_folder || "models/checkpoints/");

      if (onShowToast) {
        onShowToast(`Found Civitai model: ${meta.model_name}`, "info");
      }
    } catch (err: any) {
      setCivitaiLookupError(err.message || "Failed to inspect model.");
      if (onShowToast) {
        onShowToast(`Civitai Lookup Error: ${err.message}`, "error");
      }
    } finally {
      setLookingUpCivitai(false);
    }
  };

  // Civitai category change handler
  const handleCivitaiCategoryChange = (presetId: string) => {
    setCivitaiCategoryPreset(presetId);
    const preset = COMFYUI_MODEL_CATEGORIES.find((p) => p.id === presetId);
    if (preset && preset.id !== "custom") {
      setCivitaiTargetDest(preset.subfolder);
    }
  };

  // Copy trigger word to clipboard
  const handleCopyTriggerWord = async (word: string) => {
    const success = await copyToClipboard(word);
    if (success) {
      setCopiedTriggerWord(word);
      setTimeout(() => setCopiedTriggerWord(null), 1500);
      if (onShowToast) {
        onShowToast(`Copied trigger word "${word}" to clipboard.`, "info");
      }
    }
  };

  // Copy all trigger words joined by commas
  const handleCopyAllTriggerWords = async () => {
    if (!civitaiMetadata) return;
    const words = civitaiMetadata.trained_words || civitaiMetadata.trainedWords || [];
    if (!words || words.length === 0) return;
    const joined = words.join(", ");
    const success = await copyToClipboard(joined);
    if (success) {
      setCopiedTriggerWord("__ALL__");
      setTimeout(() => setCopiedTriggerWord(null), 1500);
      if (onShowToast) {
        onShowToast(`Copied all ${words.length} trigger words to clipboard.`, "info");
      }
    }
  };

  // Copy synthesized shell download command to clipboard
  const handleCopyCivitaiCommand = async () => {
    if (!civitaiMetadata) return;

    const comfyRoot = (config.remote_comfyui_root || "/workspace/runpod-slim/ComfyUI").replace(/\/$/, "");
    let dest = (civitaiTargetDest || civitaiMetadata.default_destination_folder || "models/checkpoints/").trim();
    if (!dest.startsWith("/")) {
      dest = `${comfyRoot}/${dest.replace(/^\//, "")}`;
    }
    const cleanDest = dest.replace(/\/$/, "");
    const filename = (civitaiTargetFilename || civitaiMetadata.filename || "model.safetensors").trim();
    const token = (config.civitai_api_key || civitaiKeyInput || "").trim();
    let downloadUrl = (civitaiMetadata.download_url || "").trim();

    if (token && !downloadUrl.includes("token=")) {
      const sep = downloadUrl.includes("?") ? "&" : "?";
      downloadUrl = `${downloadUrl}${sep}token=${encodeURIComponent(token)}`;
    }

    const cmd = `mkdir -p "${cleanDest}" && curl -L -C - --fail --retry 3 --user-agent "Mozilla/5.0" -o "${cleanDest}/${filename}" "${downloadUrl}"`;

    const success = await copyToClipboard(cmd);
    if (success) {
      setCopiedCivitaiCmd(true);
      setTimeout(() => setCopiedCivitaiCmd(false), 2000);
      if (onShowToast) {
        onShowToast("Download command copied to clipboard. Ready to paste in any remote terminal!", "success");
      }
    } else {
      if (onShowToast) {
        onShowToast("Failed to copy command to clipboard.", "error");
      }
    }
  };

  // 1-Click loading of full model preview from favorites tray
  const handleSelectCivitaiFavorite = (fav: CivitaiFavorite) => {
    const versionIdStr = String(fav.version_id);
    setCivitaiQuery(versionIdStr);

    const meta: CivitaiModelMetadata = {
      model_id: Number(fav.model_id) || 0,
      model_name: fav.name || fav.model_name || "Civitai Model",
      version_id: Number(fav.version_id),
      version_name: fav.version_name || "Latest",
      category: fav.category || "Checkpoint",
      base_model: fav.base_model || "SDXL 1.0",
      file_size_bytes: fav.file_size_bytes || 0,
      file_size_formatted: fav.file_size_formatted || fav.file_size || "",
      filename: fav.filename || `${(fav.name || "model").toLowerCase().replace(/[^a-z0-9_-]/g, "_")}.safetensors`,
      preview_image_url: fav.preview_image_url || fav.image_url || "",
      download_url: fav.download_url || "",
      default_destination_folder: fav.default_destination_folder || "models/checkpoints/",
      suggested_remote_path: fav.suggested_remote_path || "",
      trained_words: fav.trained_words || fav.trigger_words || [],
      trainedWords: fav.trained_words || fav.trigger_words || [],
      description: fav.description || "",
      clean_description: fav.clean_description || fav.description || "",
      download_command: fav.download_command || "",
      tags: fav.tags || []
    };

    setCivitaiMetadata(meta);
    setCivitaiTargetFilename(meta.filename);
    setSelectedVersionId(meta.version_id);

    const catLower = (meta.category || "").toLowerCase();
    let matchedPreset = "checkpoints";
    if (catLower.includes("lora") || catLower.includes("dora") || catLower.includes("locon")) {
      matchedPreset = "loras";
    } else if (catLower.includes("controlnet") || catLower.includes("adapter")) {
      matchedPreset = "controlnet";
    } else if (catLower.includes("vae")) {
      matchedPreset = "vae";
    } else if (catLower.includes("upscaler") || catLower.includes("upscale")) {
      matchedPreset = "upscalers";
    } else if (catLower.includes("embedding")) {
      matchedPreset = "embeddings";
    } else if (catLower.includes("unet") || catLower.includes("diffusion")) {
      matchedPreset = "diffusion_models";
    }
    setCivitaiCategoryPreset(matchedPreset);
    const presetObj = COMFYUI_MODEL_CATEGORIES.find((p) => p.id === matchedPreset);
    setCivitaiTargetDest(presetObj ? presetObj.subfolder : meta.default_destination_folder || "models/checkpoints/");

    handleLookupCivitaiModel(versionIdStr);
  };

  // Remove a favorite
  const handleRemoveCivitaiFavorite = async (versionId: number | string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await removeCivitaiFavorite(versionId);
      setFavorites((prev) => prev.filter((f) => String(f.version_id) !== String(versionId)));
      if (onShowToast) {
        onShowToast("Model removed from favorites.", "info");
      }
    } catch (err) {
      console.error("Failed to delete favorite:", err);
    }
  };

  // Check if active model is favorited
  const isCivitaiFavorited = Boolean(
    civitaiMetadata && favorites.some((f) => String(f.version_id) === String(civitaiMetadata.version_id))
  );

  // Toggle favorite on active model
  const handleToggleCivitaiFavorite = async () => {
    if (!civitaiMetadata) return;
    const versionId = civitaiMetadata.version_id;

    if (isCivitaiFavorited) {
      await removeCivitaiFavorite(versionId);
      setFavorites((prev) => prev.filter((f) => String(f.version_id) !== String(versionId)));
      if (onShowToast) {
        onShowToast(`Removed "${civitaiMetadata.model_name}" from Favorites`, "info");
      }
    } else {
      const saved = await addCivitaiFavorite(civitaiMetadata);
      setFavorites((prev) => {
        const filtered = prev.filter((f) => String(f.version_id) !== String(versionId));
        return [saved, ...filtered];
      });
      if (onShowToast) {
        onShowToast(`Saved "${civitaiMetadata.model_name}" to Favorites! ⭐`, "success");
      }
    }
  };

  // Trigger remote ingestion
  const handleIngestTrigger = () => {
    const downloadUrl = (civitaiMetadata?.download_url || "").trim();
    onExecuteDownload({
      downloadUrl,
      destinationFolder: civitaiTargetDest,
      filename: civitaiTargetFilename,
      authType: "civitai"
    });
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Civitai Credentials Box */}
      <CivitaiCredentialsCard
        civitaiConfigured={civitaiConfigured}
        civitaiMaskedKey={civitaiMaskedKey}
        civitaiKeyInput={civitaiKeyInput}
        setCivitaiKeyInput={setCivitaiKeyInput}
        savingCivitaiKey={savingCivitaiKey}
        onSaveKey={handleSaveCivitaiKey}
        onClearKey={handleClearCivitaiKey}
        tokenFeedback={civitaiTokenFeedback}
      />

      {/* Model Lookup Query */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4">
        <label className="block text-xs font-semibold text-neutral-200 uppercase tracking-wider mb-2">
          Civitai Model ID, Version ID, or Model URL
        </label>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <input
              id="input-civitai-query"
              type="text"
              placeholder="e.g. 133005 or https://civitai.com/models/133005/juggernaut-xl"
              value={civitaiQuery}
              onChange={(e) => setCivitaiQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLookupCivitaiModel();
              }}
              className="w-full bg-neutral-950/80 border border-neutral-700/70 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-neutral-200 placeholder-neutral-500 outline-none"
            />
          </div>

          <button
            id="btn-inspect-civitai"
            type="button"
            onClick={() => handleLookupCivitaiModel()}
            disabled={lookingUpCivitai || !civitaiQuery.trim()}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs disabled:opacity-50 transition-colors shadow-sm shrink-0 cursor-pointer"
          >
            {lookingUpCivitai ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Inspecting...</span>
              </>
            ) : (
              <>
                <Search className="w-3.5 h-3.5" />
                <span>Inspect Model</span>
              </>
            )}
          </button>
        </div>

        {/* Collapsible Saved Favorites Tray */}
        <div className="mt-3">
          <CivitaiFavoritesTray
            favorites={favorites}
            activeVersionId={civitaiMetadata?.version_id}
            onSelectFavorite={handleSelectCivitaiFavorite}
            onRemoveFavorite={handleRemoveCivitaiFavorite}
            isLoading={loadingFavorites}
          />
        </div>

        {civitaiLookupError && (
          <div className="mt-3 p-3 bg-red-950/40 border border-red-800/60 rounded-lg flex items-start gap-2 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{civitaiLookupError}</span>
          </div>
        )}
      </div>

      {/* Model Card & Destination Settings */}
      {civitaiMetadata && (
        <CivitaiModelCard
          civitaiMetadata={civitaiMetadata}
          selectedVersionId={selectedVersionId}
          onSelectVersion={(vid) => {
            setSelectedVersionId(vid);
            handleLookupCivitaiModel(vid.toString());
          }}
          isFavorited={isCivitaiFavorited}
          onToggleFavorite={handleToggleCivitaiFavorite}
          copiedTriggerWord={copiedTriggerWord}
          onCopyTriggerWord={handleCopyTriggerWord}
          onCopyAllTriggerWords={handleCopyAllTriggerWords}
          categoryPreset={civitaiCategoryPreset}
          onCategoryChange={handleCivitaiCategoryChange}
          targetDest={civitaiTargetDest}
          onTargetDestChange={setCivitaiTargetDest}
          targetFilename={civitaiTargetFilename}
          onTargetFilenameChange={setCivitaiTargetFilename}
          remoteComfyRoot={config.remote_comfyui_root}
          copiedCmd={copiedCivitaiCmd}
          onCopyCommand={handleCopyCivitaiCommand}
          downloading={downloading}
          downloadElapsed={downloadElapsed}
          remoteHostConfigured={Boolean(config.remote_host)}
          onIngest={handleIngestTrigger}
        />
      )}
    </div>
  );
};
