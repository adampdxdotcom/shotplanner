import React, { useState, useEffect } from "react";
import { AppConfig, CivitaiModelMetadata, CivitaiModelVersionOption, CivitaiFavorite } from "../../types";
import { copyToClipboard } from "../../utils/clipboard";
import { 
  fetchCivitaiFavorites, 
  addCivitaiFavorite, 
  removeCivitaiFavorite 
} from "../../services/civitaiFavoritesService";
import { CivitaiFavoritesTray } from "./CivitaiFavoritesTray";
import { 
  DownloadCloud, 
  Key, 
  Save, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ExternalLink, 
  FolderDown, 
  FileCode, 
  Zap, 
  Layers, 
  HardDrive,
  Trash2,
  Info,
  Sparkles,
  Copy,
  Check,
  FileText,
  Terminal,
  Star
} from "lucide-react";

export interface CivitaiConfigProps {
  config: AppConfig;
  onChange: (newConfig: AppConfig) => void;
  onShowToast?: (text: string, type: "success" | "error" | "info") => void;
}

export const CivitaiConfig: React.FC<CivitaiConfigProps> = ({
  config,
  onChange,
  onShowToast
}) => {
  // 1. Credentials Sub-Panel State
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isConfigured, setIsConfigured] = useState(false);
  const [maskedKey, setMaskedKey] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [tokenFeedback, setTokenFeedback] = useState<{ success?: boolean; message?: string } | null>(null);

  // 2. Model Lookup State
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [modelMetadata, setModelMetadata] = useState<CivitaiModelMetadata | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // 3. Download Customization State
  const [targetDestination, setTargetDestination] = useState<string>("");
  const [targetFilename, setTargetFilename] = useState<string>("");
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [copiedTriggerWord, setCopiedTriggerWord] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<CivitaiFavorite[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);

  // 4. Download Execution State
  const [downloading, setDownloading] = useState(false);
  const [downloadElapsed, setDownloadElapsed] = useState(0);
  const [downloadResult, setDownloadResult] = useState<{
    success: boolean;
    message: string;
    destination_path?: string;
    file_size?: string;
    duration_seconds?: number;
    logs?: string;
    error?: string;
  } | null>(null);

  // Initial fetch of Civitai token configuration status and favorites
  useEffect(() => {
    fetch("/api/settings/civitai")
      .then((res) => res.json())
      .then((data) => {
        if (data.configured) {
          setIsConfigured(true);
          setMaskedKey(data.masked_key || (data.api_key ? `${data.api_key}...` : "Configured"));
        }
      })
      .catch(() => {});

    fetchCivitaiFavorites()
      .then((favs) => setFavorites(favs))
      .catch(() => {});
  }, []);

  // Timer effect for download feedback
  useEffect(() => {
    let interval: any = null;
    if (downloading) {
      setDownloadElapsed(0);
      interval = setInterval(() => {
        setDownloadElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [downloading]);

  // Handle saving Civitai API Key
  const handleSaveApiKey = async () => {
    const clean = apiKeyInput.trim();
    if (!clean) {
      setTokenFeedback({ success: false, message: "Please enter a valid Civitai API token." });
      return;
    }

    setSavingKey(true);
    setTokenFeedback(null);

    try {
      const res = await fetch("/api/settings/civitai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: clean })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsConfigured(true);
        setMaskedKey(clean.length > 8 ? `${clean.slice(0, 4)}...${clean.slice(-4)}` : "***");
        setApiKeyInput("");
        setTokenFeedback({ success: true, message: "Civitai API token saved securely to persistent storage!" });
        onChange({ ...config, civitai_api_key: clean });
        if (onShowToast) {
          onShowToast("Civitai API key saved successfully", "success");
        }
      } else {
        setTokenFeedback({ success: false, message: data.error || "Failed to save Civitai API key." });
      }
    } catch (e: any) {
      setTokenFeedback({ success: false, message: e.message || "Network error" });
    } finally {
      setSavingKey(false);
    }
  };

  // Handle clearing Civitai API Key
  const handleClearApiKey = async () => {
    try {
      await fetch("/api/settings/civitai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: "" })
      });
      setIsConfigured(false);
      setMaskedKey("");
      setApiKeyInput("");
      setTokenFeedback({ success: true, message: "Civitai API key removed." });
      onChange({ ...config, civitai_api_key: "" });
      if (onShowToast) {
        onShowToast("Civitai API token removed", "info");
      }
    } catch (e) {}
  };

  // Handle Model Lookup
  const handleLookupModel = async (overrideQuery?: string) => {
    const q = (overrideQuery || lookupQuery).trim();
    if (!q) {
      setLookupError("Please enter a Civitai Model ID, Version ID, or Civitai URL.");
      return;
    }

    setLookingUp(true);
    setLookupError(null);
    setDownloadResult(null);

    try {
      const url = `/api/civitai/model-info?query=${encodeURIComponent(q)}`;
      const res = await fetch(url);
      const data = await res.json();

      if (res.ok && data.success && data.data) {
        const meta: CivitaiModelMetadata = data.data;
        setModelMetadata(meta);
        setTargetDestination(meta.default_destination_folder || "models/checkpoints/");
        setTargetFilename(meta.filename || "model.safetensors");
        setSelectedVersionId(meta.version_id);
      } else {
        setModelMetadata(null);
        setLookupError(data.error || "Could not find or inspect this Civitai model.");
      }
    } catch (err: any) {
      setModelMetadata(null);
      setLookupError(err.message || "Failed to connect to Civitai lookup service.");
    } finally {
      setLookingUp(false);
    }
  };

  // Handle version change within looked-up model
  const handleSelectVersion = (version: CivitaiModelVersionOption) => {
    setSelectedVersionId(version.id);
    handleLookupModel(String(version.id));
  };

  // Handle Download to Remote ComfyUI
  const handleDownloadToRemote = async () => {
    if (!modelMetadata) return;

    if (!config.remote_host || !config.remote_host.trim()) {
      const msg = "Remote GPU Host IP is not configured. Please enter your SSH credentials in the Remote Server Connection panel.";
      setDownloadResult({ success: false, message: msg, error: msg });
      if (onShowToast) onShowToast(msg, "error");
      return;
    }

    setDownloading(true);
    setDownloadResult(null);

    try {
      const payload = {
        download_url: modelMetadata.download_url,
        destination_folder: targetDestination || modelMetadata.default_destination_folder,
        filename: targetFilename || modelMetadata.filename,
        civitai_token: config.civitai_api_key || "",
        remote_host: config.remote_host,
        ssh_port: config.ssh_port || 22,
        ssh_username: config.ssh_username || "root",
        ssh_password: config.ssh_password,
        ssh_private_key: config.ssh_private_key,
        ssh_key_path: config.ssh_key_path,
        remote_comfyui_root: config.remote_comfyui_root || "/workspace/runpod-slim/ComfyUI"
      };

      const res = await fetch("/api/civitai/download-remote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      setDownloadResult(data);

      if (res.ok && data.success) {
        if (onShowToast) {
          onShowToast(`Downloaded '${targetFilename || modelMetadata.filename}' to Remote ComfyUI successfully!`, "success");
        }
      } else {
        if (onShowToast) {
          onShowToast(data.error || "Remote model download failed", "error");
        }
      }
    } catch (err: any) {
      const errMsg = err.message || "Network request failed during remote download dispatch.";
      setDownloadResult({ success: false, message: errMsg, error: errMsg });
      if (onShowToast) onShowToast(errMsg, "error");
    } finally {
      setDownloading(false);
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

  // Copy all trigger words
  const handleCopyAllTriggerWords = async () => {
    if (!modelMetadata) return;
    const words = modelMetadata.trained_words || modelMetadata.trainedWords || [];
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

  // Copy synthesized shell download command
  const handleCopyCommand = async () => {
    if (!modelMetadata) return;

    const dest = (targetDestination || modelMetadata.default_destination_folder || "models/checkpoints/").trim().replace(/\/$/, "");
    const filename = (targetFilename || modelMetadata.filename || "model.safetensors").trim();
    const downloadUrl = (modelMetadata.download_url || "").trim();
    const token = (config.civitai_api_key || apiKeyInput || "").trim();

    const authAria = (token || isConfigured) ? `--header="Authorization: Bearer ${token || '$CIVITAI_API_KEY'}" ` : "";
    const authCurl = (token || isConfigured) ? `-H "Authorization: Bearer ${token || '$CIVITAI_API_KEY'}" ` : "";

    const cmd = `mkdir -p "${dest}" && (aria2c -c -x 8 -s 8 -k 1M ${authAria}-d "${dest}" -o "${filename}" "${downloadUrl}" || curl -L -C - --fail --retry 3 ${authCurl}-o "${dest}/${filename}" "${downloadUrl}")`;

    const success = await copyToClipboard(cmd);
    if (success) {
      setCopiedCommand(true);
      setTimeout(() => setCopiedCommand(false), 2000);
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
  const handleSelectFavorite = (fav: CivitaiFavorite) => {
    const versionIdStr = String(fav.version_id);
    setLookupQuery(versionIdStr);

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

    setModelMetadata(meta);
    setTargetDestination(meta.default_destination_folder || "models/checkpoints/");
    setTargetFilename(meta.filename);
    setSelectedVersionId(meta.version_id);

    // Background fetch to load all versions and full metadata
    handleLookupModel(versionIdStr);
  };

  // Remove a favorite
  const handleRemoveFavorite = async (versionId: number | string, e: React.MouseEvent) => {
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
  const isFavorited = Boolean(
    modelMetadata && favorites.some((f) => String(f.version_id) === String(modelMetadata.version_id))
  );

  // Toggle favorite on active model
  const handleToggleFavorite = async () => {
    if (!modelMetadata) return;
    const versionId = modelMetadata.version_id;

    if (isFavorited) {
      await removeCivitaiFavorite(versionId);
      setFavorites((prev) => prev.filter((f) => String(f.version_id) !== String(versionId)));
      if (onShowToast) {
        onShowToast(`Removed "${modelMetadata.model_name}" from Favorites`, "info");
      }
    } else {
      const saved = await addCivitaiFavorite(modelMetadata);
      setFavorites((prev) => {
        const filtered = prev.filter((f) => String(f.version_id) !== String(versionId));
        return [saved, ...filtered];
      });
      if (onShowToast) {
        onShowToast(`Saved "${modelMetadata.model_name}" to Favorites! ⭐`, "success");
      }
    }
  };

  const cleanComfyUIRoot = (config.remote_comfyui_root || "/workspace/runpod-slim/ComfyUI").replace(/\/$/, "");
  const fullDestinationPath = targetDestination.startsWith("/")
    ? `${targetDestination.replace(/\/$/, "")}/${targetFilename}`
    : `${cleanComfyUIRoot}/${targetDestination.replace(/\/$/, "")}/${targetFilename}`;

  return (
    <section id="civitai-model-downloader-section" className="bg-zinc-900/60 border-2 border-zinc-700 rounded-xl p-5 shadow-sm space-y-6">
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <DownloadCloud className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <span>Civitai &amp; Model Downloader</span>
              <span className="text-[10px] font-semibold text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded-full">
                Remote GPU Accelerated
              </span>
            </h2>
            <p className="text-xs text-zinc-400">
              Inspect model metadata from Civitai and stream weights (Checkpoints, LoRAs, ControlNets, VAEs) directly onto your remote GPU ComfyUI instance.
            </p>
          </div>
        </div>
      </div>

      {/* 1. Credentials Sub-Panel */}
      <div className="bg-zinc-950/50 border border-zinc-800/80 rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-cyan-400" />
            <span>Civitai API Token</span>
            <span className="text-[10px] text-zinc-500 font-normal">(Optional for public models, required for gated/early-access models)</span>
          </label>

          <div className="flex items-center gap-2">
            {isConfigured && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-300 bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 rounded-md">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Token Active: <code className="text-emerald-200">{maskedKey}</code></span>
              </span>
            )}
            <a
              href="https://civitai.com/user/account"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1"
            >
              <span>Get Civitai API Key</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            type="password"
            placeholder={isConfigured ? "Enter new API token to update..." : "Paste your Civitai API Token..."}
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSaveApiKey();
              }
            }}
            className="flex-1 bg-zinc-900 border border-zinc-700 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
          />
          <button
            type="button"
            onClick={handleSaveApiKey}
            disabled={savingKey || !apiKeyInput.trim()}
            className="px-3.5 py-2 text-xs font-medium bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
          >
            <Save className={`w-3.5 h-3.5 ${savingKey ? "animate-spin" : ""}`} />
            <span>{savingKey ? "Saving..." : "Save Token"}</span>
          </button>
          {isConfigured && (
            <button
              type="button"
              onClick={handleClearApiKey}
              title="Remove Civitai token"
              className="px-2.5 py-2 text-xs font-medium bg-zinc-800 hover:bg-red-950/40 text-zinc-400 hover:text-red-300 border border-zinc-700 hover:border-red-800/50 rounded-lg transition-colors flex items-center justify-center cursor-pointer shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {tokenFeedback && (
          <div className={`p-2 rounded-lg border text-xs flex items-center gap-2 ${
            tokenFeedback.success 
              ? "bg-emerald-950/30 border-emerald-800/40 text-emerald-300" 
              : "bg-red-950/30 border-red-800/40 text-red-300"
          }`}>
            {tokenFeedback.success ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
            <span>{tokenFeedback.message}</span>
          </div>
        )}
      </div>

      {/* 2. Model Lookup & Downloader Tool */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-cyan-400" />
            <span>Civitai Model URL or Model ID</span>
          </label>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              placeholder="e.g. https://civitai.com/models/133005 or model ID 133005..."
              value={lookupQuery}
              onChange={(e) => setLookupQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleLookupModel();
                }
              }}
              className="flex-1 bg-zinc-950 border-2 border-zinc-700 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
            />
            <button
              type="button"
              onClick={() => handleLookupModel()}
              disabled={lookingUp || !lookupQuery.trim()}
              className="px-4 py-2 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-100 border border-zinc-700 hover:border-cyan-500/50 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${lookingUp ? "animate-spin text-cyan-400" : "text-zinc-400"}`} />
              <span>{lookingUp ? "Inspecting..." : "Lookup Model"}</span>
            </button>
          </div>

          {/* Collapsible Saved Favorites Tray */}
          <div className="pt-1">
            <CivitaiFavoritesTray
              favorites={favorites}
              activeVersionId={modelMetadata?.version_id}
              onSelectFavorite={handleSelectFavorite}
              onRemoveFavorite={handleRemoveFavorite}
              isLoading={loadingFavorites}
            />
          </div>
        </div>

        {/* Lookup Error Banner */}
        {lookupError && (
          <div className="p-3 rounded-lg border bg-red-950/30 border-red-800/40 text-red-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Lookup Failed</p>
              <p className="opacity-90 mt-0.5">{lookupError}</p>
            </div>
          </div>
        )}

        {/* Interactive Model Preview Card */}
        {modelMetadata && (
          <div className="bg-zinc-950 border-2 border-cyan-900/60 rounded-xl p-4 shadow-md space-y-4">
            <div className="flex flex-col md:flex-row items-start gap-4">
              {/* Cover Preview Image */}
              <div className="w-full md:w-36 h-36 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 shrink-0 flex items-center justify-center relative">
                {modelMetadata.preview_image_url ? (
                  <img
                    src={modelMetadata.preview_image_url}
                    alt={modelMetadata.model_name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="text-zinc-600 flex flex-col items-center gap-1 text-[10px]">
                    <Layers className="w-8 h-8 opacity-40" />
                    <span>No Preview</span>
                  </div>
                )}
                <span className="absolute bottom-1.5 left-1.5 bg-black/80 backdrop-blur-xs text-[10px] font-bold text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/30">
                  {modelMetadata.category}
                </span>
              </div>

              {/* Metadata Details */}
              <div className="flex-1 space-y-2.5 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-zinc-100 truncate" title={modelMetadata.model_name}>
                    {modelMetadata.model_name}
                  </h3>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {/* Prominent Favorite Toggle Button */}
                    <button
                      id="btn-toggle-favorite-standalone"
                      type="button"
                      onClick={handleToggleFavorite}
                      title={isFavorited ? "Remove model from saved favorites" : "Save model to favorites"}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-md border text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                        isFavorited
                          ? "bg-amber-950/70 hover:bg-amber-900/80 border-amber-500/80 text-amber-300 ring-1 ring-amber-500/30"
                          : "bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300 hover:text-amber-300"
                      }`}
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${
                          isFavorited ? "text-amber-400 fill-amber-400" : "text-zinc-400"
                        }`}
                      />
                      <span>{isFavorited ? "★ Favorited" : "⭐ Favorite"}</span>
                    </button>

                    <span className="text-[11px] font-semibold text-purple-300 bg-purple-950/60 border border-purple-800/50 px-2 py-0.5 rounded-md">
                      {modelMetadata.base_model}
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <HardDrive className="w-3 h-3" />
                      {modelMetadata.file_size_formatted}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                  <span>Version: <strong className="text-zinc-200">{modelMetadata.version_name}</strong></span>
                  <span>•</span>
                  <span>File: <code className="text-zinc-300 bg-zinc-900 px-1.5 py-0.5 rounded text-[11px]">{modelMetadata.filename}</code></span>
                </div>

                {/* Available Versions Picker if multiple */}
                {modelMetadata.versions && modelMetadata.versions.length > 1 && (
                  <div className="pt-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-zinc-400">Available Versions:</span>
                    {modelMetadata.versions.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => handleSelectVersion(v)}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors cursor-pointer ${
                          v.id === selectedVersionId
                            ? "bg-cyan-500/20 text-cyan-200 border-cyan-500/60"
                            : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 border-zinc-800 hover:border-zinc-700"
                        }`}
                      >
                        {v.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Trained Trigger Words Section */}
            {((modelMetadata.trained_words && modelMetadata.trained_words.length > 0) ||
              (modelMetadata.trainedWords && modelMetadata.trainedWords.length > 0)) && (
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Trained Trigger Words</span>
                    <span className="text-[10px] font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full">
                      {(modelMetadata.trained_words || modelMetadata.trainedWords || []).length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyAllTriggerWords}
                    className="text-[11px] font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1 bg-cyan-950/40 hover:bg-cyan-900/50 px-2.5 py-1 rounded border border-cyan-800/50 transition-colors cursor-pointer"
                  >
                    {copiedTriggerWord === "__ALL__" ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-300 font-semibold">Copied All</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy All</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                  {(modelMetadata.trained_words || modelMetadata.trainedWords || []).map((word, idx) => {
                    const isCopied = copiedTriggerWord === word;
                    return (
                      <button
                        key={`${word}-${idx}`}
                        type="button"
                        onClick={() => handleCopyTriggerWord(word)}
                        title="Click to copy trigger word"
                        className={`text-xs px-2.5 py-1 rounded-md border font-mono flex items-center gap-1.5 transition-all text-left group active:scale-95 cursor-pointer ${
                          isCopied
                            ? "bg-emerald-950/60 border-emerald-700 text-emerald-300"
                            : "bg-cyan-950/30 hover:bg-cyan-900/40 border-cyan-800/40 hover:border-cyan-700 text-cyan-200"
                        }`}
                      >
                        {isCopied ? (
                          <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                        ) : (
                          <Copy className="w-3 h-3 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        )}
                        <span className="truncate max-w-[280px]">{word}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Description & Release Notes Section */}
            {(modelMetadata.clean_description || modelMetadata.description) && (
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                    <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>Model Description & Release Notes</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">Civitai API</span>
                </div>
                <div className="text-xs text-zinc-300/90 leading-relaxed font-sans whitespace-pre-wrap max-h-36 overflow-y-auto bg-zinc-950/80 p-2.5 rounded border border-zinc-800/60 select-text">
                  {modelMetadata.clean_description || modelMetadata.description}
                </div>
              </div>
            )}

            {/* Destination Configuration Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-zinc-800/80">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  <FolderDown className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Remote ComfyUI Subfolder</span>
                  <span className="text-[10px] text-emerald-400 font-normal">(Auto-routed)</span>
                </label>
                <input
                  type="text"
                  value={targetDestination}
                  onChange={(e) => setTargetDestination(e.target.value)}
                  placeholder="e.g. models/checkpoints/"
                  className="w-full bg-zinc-900 border border-zinc-700 focus:border-cyan-500 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Target Filename</span>
                </label>
                <input
                  type="text"
                  value={targetFilename}
                  onChange={(e) => setTargetFilename(e.target.value)}
                  placeholder="e.g. model.safetensors"
                  className="w-full bg-zinc-900 border border-zinc-700 focus:border-cyan-500 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 font-mono"
                />
              </div>
            </div>

            {/* Full Remote Path Preview */}
            <div className="p-2.5 bg-zinc-900/80 rounded-lg border border-zinc-800 text-[11px] text-zinc-400 flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <div className="truncate">
                <span>Direct Remote GPU Path: </span>
                <code className="text-cyan-300 font-mono font-medium">{fullDestinationPath}</code>
              </div>
            </div>

            {/* Download Execution Button & Copy Download Command */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              <div className="text-xs text-zinc-400">
                <span>Target Host: </span>
                <code className="text-zinc-200 font-mono font-semibold">
                  {config.ssh_username || "root"}@{config.remote_host || "NO_HOST_SET"}:{config.ssh_port || 22}
                </code>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleCopyCommand}
                  className="px-4 py-2.5 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 hover:text-white rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  {copiedCommand ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-300 font-bold">Command Copied!</span>
                    </>
                  ) : (
                    <>
                      <Terminal className="w-4 h-4 text-cyan-400" />
                      <span>Copy Download Command</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadToRemote}
                  disabled={downloading || !config.remote_host}
                  className="px-5 py-2.5 text-xs font-bold bg-linear-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 active:scale-95"
                >
                  <Zap className={`w-4 h-4 ${downloading ? "animate-bounce text-amber-300" : "fill-amber-300 text-amber-300"}`} />
                  <span>
                    {downloading 
                      ? `⚡ Downloading to Remote GPU (${downloadElapsed}s)...` 
                      : "⚡ Download to Remote ComfyUI"}
                  </span>
                </button>
              </div>
            </div>

            {/* Real-time downloading progress banner */}
            {downloading && (
              <div className="p-3 bg-cyan-950/40 border border-cyan-800/60 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs text-cyan-300 font-semibold">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                    <span>Streaming directly to remote GPU disk at datacenter speed...</span>
                  </span>
                  <span className="font-mono">{downloadElapsed}s</span>
                </div>
                <div className="w-full bg-cyan-950 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-cyan-400 h-full w-full animate-pulse"></div>
                </div>
                <p className="text-[10px] text-cyan-400/80">
                  Using high-speed multi-connection stream (aria2c / curl resume). The model will be placed directly into your ComfyUI models folder.
                </p>
              </div>
            )}

            {/* Download Result Card */}
            {downloadResult && !downloading && (
              <div className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                downloadResult.success
                  ? "bg-emerald-950/30 border-emerald-800/50 text-emerald-200"
                  : "bg-red-950/30 border-red-800/50 text-red-200"
              }`}>
                <div className="flex items-center gap-2 font-bold">
                  {downloadResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  )}
                  <span>{downloadResult.success ? "Remote Model Stored Successfully" : "Download Failed"}</span>
                  {downloadResult.duration_seconds !== undefined && (
                    <span className="text-[10px] font-normal opacity-80">({downloadResult.duration_seconds}s)</span>
                  )}
                </div>

                <p className="text-xs opacity-90">{downloadResult.message}</p>

                {downloadResult.destination_path && (
                  <div className="pt-1 text-[11px] font-mono text-zinc-300">
                    Location: <span className="text-emerald-300">{downloadResult.destination_path}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
