import React, { useState, useEffect } from "react";
import { 
  AppConfig, 
  CivitaiModelMetadata, 
  CivitaiModelVersionOption, 
  CivitaiFavorite 
} from "../../../types";
import { copyToClipboard } from "../../../utils/clipboard";
import { 
  fetchCivitaiFavorites, 
  addCivitaiFavorite, 
  removeCivitaiFavorite 
} from "../../../services/civitaiFavoritesService";

export interface UseCivitaiConfigProps {
  config: AppConfig;
  onChange: (newConfig: AppConfig) => void;
  onShowToast?: (text: string, type: "success" | "error" | "info") => void;
}

export interface DownloadResult {
  success: boolean;
  message: string;
  destination_path?: string;
  file_size?: string;
  duration_seconds?: number;
  logs?: string;
  error?: string;
}

export function useCivitaiConfig({
  config,
  onChange,
  onShowToast
}: UseCivitaiConfigProps) {
  // 1. Credentials State
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
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(null);

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

    setLoadingFavorites(true);
    fetchCivitaiFavorites()
      .then((favs) => setFavorites(favs))
      .catch(() => {})
      .finally(() => setLoadingFavorites(false));
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

    const comfyRoot = (config.remote_comfyui_root || "/workspace/runpod-slim/ComfyUI").replace(/\/$/, "");
    let dest = (targetDestination || modelMetadata.default_destination_folder || "models/checkpoints/").trim();
    if (!dest.startsWith("/")) {
      dest = `${comfyRoot}/${dest.replace(/^\//, "")}`;
    }
    const cleanDest = dest.replace(/\/$/, "");
    const filename = (targetFilename || modelMetadata.filename || "model.safetensors").trim();
    const token = (config.civitai_api_key || apiKeyInput || "").trim();
    let finalUrl = (modelMetadata.download_url || "").trim();

    if (token && !finalUrl.includes("token=")) {
      const sep = finalUrl.includes("?") ? "&" : "?";
      finalUrl = `${finalUrl}${sep}token=${encodeURIComponent(token)}`;
    }

    const cmd = `mkdir -p "${cleanDest}" && curl -L -C - --fail --retry 3 --user-agent "Mozilla/5.0" -o "${cleanDest}/${filename}" "${finalUrl}"`;

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

  return {
    // Credentials
    apiKeyInput,
    setApiKeyInput,
    isConfigured,
    maskedKey,
    savingKey,
    tokenFeedback,
    handleSaveApiKey,
    handleClearApiKey,

    // Model Lookup
    lookupQuery,
    setLookupQuery,
    lookingUp,
    modelMetadata,
    lookupError,
    handleLookupModel,
    selectedVersionId,
    handleSelectVersion,

    // Customization & Destination
    targetDestination,
    setTargetDestination,
    targetFilename,
    setTargetFilename,
    fullDestinationPath,

    // Clipboard
    copiedCommand,
    copiedTriggerWord,
    handleCopyTriggerWord,
    handleCopyAllTriggerWords,
    handleCopyCommand,

    // Favorites
    favorites,
    loadingFavorites,
    isFavorited,
    handleSelectFavorite,
    handleRemoveFavorite,
    handleToggleFavorite,

    // Remote Download
    downloading,
    downloadElapsed,
    downloadResult,
    handleDownloadToRemote
  };
}
