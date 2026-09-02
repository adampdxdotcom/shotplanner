import React, { useState, useEffect } from "react";
import { 
  AppConfig, 
  CivitaiModelMetadata, 
  CivitaiModelVersionOption,
  HuggingFaceModelMetadata,
  HuggingFaceFileOption,
  ModelCategoryPreset
} from "../../types";
import { copyToClipboard } from "../../utils/clipboard";
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
  Globe,
  Sparkles,
  Server,
  Lock,
  ArrowRight,
  Copy,
  Check,
  FileText,
  Terminal
} from "lucide-react";

export const COMFYUI_MODEL_CATEGORIES: ModelCategoryPreset[] = [
  { 
    id: "checkpoints", 
    label: "Checkpoints", 
    subfolder: "models/checkpoints/",
    description: "Base models (SD 1.5, SDXL, Pony, Illustrious)"
  },
  { 
    id: "diffusion_models", 
    label: "Diffusion Models (Wan / Flux / Hunyuan)", 
    subfolder: "models/diffusion_models/",
    description: "Modern standalone DiT / UNet models (Wan2.1, FLUX, HunyuanVideo)"
  },
  { 
    id: "loras", 
    label: "LoRAs", 
    subfolder: "models/loras/",
    description: "Low-Rank Adaptation weights, DoRA, LoCon, LyCORIS"
  },
  { 
    id: "controlnet", 
    label: "ControlNet", 
    subfolder: "models/controlnet/",
    description: "ControlNet, T2I-Adapter, IP-Adapter models"
  },
  { 
    id: "clip", 
    label: "Text Encoders / CLIP", 
    subfolder: "models/clip/",
    description: "Text encoders (T5-XXL, CLIP-L, CLIP-G, ViT)"
  },
  { 
    id: "vae", 
    label: "VAE", 
    subfolder: "models/vae/",
    description: "Variational Autoencoders"
  },
  { 
    id: "upscalers", 
    label: "Upscalers", 
    subfolder: "models/upscale_models/",
    description: "ESRGAN, Real-ESRGAN, SwinIR upscaling models"
  },
  { 
    id: "embeddings", 
    label: "Embeddings", 
    subfolder: "models/embeddings/",
    description: "Textual inversions and prompt embeddings"
  },
  { 
    id: "custom", 
    label: "Custom Subfolder...", 
    subfolder: "",
    description: "Specify a custom relative path under ComfyUI root"
  }
];

export interface ModelHubConfigProps {
  config: AppConfig;
  onChange: (newConfig: AppConfig) => void;
  onShowToast?: (text: string, type: "success" | "error" | "info") => void;
}

export const ModelHubConfig: React.FC<ModelHubConfigProps> = ({
  config,
  onChange,
  onShowToast
}) => {
  // Active Source Tab: 'huggingface' | 'civitai'
  const [activeTab, setActiveTab] = useState<"huggingface" | "civitai">("huggingface");

  // ==========================================
  // 1. CREDENTIALS STATE
  // ==========================================
  // Civitai Key
  const [civitaiKeyInput, setCivitaiKeyInput] = useState("");
  const [civitaiConfigured, setCivitaiConfigured] = useState(false);
  const [civitaiMaskedKey, setCivitaiMaskedKey] = useState("");
  const [savingCivitaiKey, setSavingCivitaiKey] = useState(false);
  const [civitaiTokenFeedback, setCivitaiTokenFeedback] = useState<{ success?: boolean; message?: string } | null>(null);

  // Hugging Face Token
  const [hfTokenInput, setHfTokenInput] = useState("");
  const [hfConfigured, setHfConfigured] = useState(false);
  const [hfMaskedToken, setHfMaskedToken] = useState("");
  const [savingHfToken, setSavingHfToken] = useState(false);
  const [hfTokenFeedback, setHfTokenFeedback] = useState<{ success?: boolean; message?: string } | null>(null);

  // ==========================================
  // 2. CIVITAI STATE
  // ==========================================
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

  // ==========================================
  // 3. HUGGING FACE / DIRECT URL STATE
  // ==========================================
  const [hfQuery, setHfQuery] = useState("");
  const [lookingUpHf, setLookingUpHf] = useState(false);
  const [hfMetadata, setHfMetadata] = useState<HuggingFaceModelMetadata | null>(null);
  const [hfLookupError, setHfLookupError] = useState<string | null>(null);
  const [hfCategoryPreset, setHfCategoryPreset] = useState<string>("diffusion_models");
  const [hfTargetDest, setHfTargetDest] = useState<string>("models/diffusion_models/");
  const [hfTargetFilename, setHfTargetFilename] = useState<string>("");
  const [selectedHfFileUrl, setSelectedHfFileUrl] = useState<string>("");

  // ==========================================
  // 4. DOWNLOAD EXECUTION STATE
  // ==========================================
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

  // Initial load of token status
  useEffect(() => {
    // Civitai
    fetch("/api/settings/civitai")
      .then((res) => res.json())
      .then((data) => {
        if (data.configured) {
          setCivitaiConfigured(true);
          setCivitaiMaskedKey(data.masked_key || (data.api_key ? `${data.api_key}...` : "Configured"));
        }
      })
      .catch(() => {});

    // Hugging Face
    fetch("/api/settings/huggingface")
      .then((res) => res.json())
      .then((data) => {
        if (data.configured) {
          setHfConfigured(true);
          setHfMaskedToken(data.masked_token || (data.token ? `${data.token}...` : "Configured"));
        }
      })
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

  // Handle saving Hugging Face Token
  const handleSaveHfToken = async () => {
    const clean = hfTokenInput.trim();
    if (!clean) {
      setHfTokenFeedback({ success: false, message: "Please enter a valid Hugging Face Access Token." });
      return;
    }

    setSavingHfToken(true);
    setHfTokenFeedback(null);

    try {
      const res = await fetch("/api/settings/huggingface", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: clean })
      });
      if (!res.ok) throw new Error("Failed to save Hugging Face token");

      setHfConfigured(true);
      const masked = clean.length > 8 ? `${clean.slice(0, 4)}...${clean.slice(-4)}` : "***";
      setHfMaskedToken(masked);
      setHfTokenInput("");
      setHfTokenFeedback({ success: true, message: "Hugging Face Access Token saved securely." });
      onChange({ ...config, huggingface_token: clean });
      if (onShowToast) onShowToast("Hugging Face token configured", "success");
    } catch (err: any) {
      setHfTokenFeedback({ success: false, message: err.message || "Error saving token" });
    } finally {
      setSavingHfToken(false);
    }
  };

  const handleClearHfToken = async () => {
    setSavingHfToken(true);
    try {
      await fetch("/api/settings/huggingface", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "" })
      });
      setHfConfigured(false);
      setHfMaskedToken("");
      setHfTokenInput("");
      setHfTokenFeedback({ success: true, message: "Hugging Face token cleared." });
      onChange({ ...config, huggingface_token: "" });
    } catch (e) {
    } finally {
      setSavingHfToken(false);
    }
  };

  // ==========================================
  // CIVITAI MODEL LOOKUP
  // ==========================================
  const handleLookupCivitaiModel = async (overrideQuery?: string) => {
    const q = (overrideQuery !== undefined ? overrideQuery : civitaiQuery).trim();
    if (!q) {
      setCivitaiLookupError("Please provide a Civitai Model ID, Version ID, or Web URL.");
      return;
    }

    setLookingUpCivitai(true);
    setCivitaiLookupError(null);
    setCivitaiMetadata(null);
    setDownloadResult(null);

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

    const dest = (civitaiTargetDest || civitaiMetadata.default_destination_folder || "models/checkpoints/").trim().replace(/\/$/, "");
    const filename = (civitaiTargetFilename || civitaiMetadata.filename || "model.safetensors").trim();
    const downloadUrl = (civitaiMetadata.download_url || "").trim();
    const token = civitaiKeyInput.trim();

    const authAria = (token || civitaiConfigured) ? `--header="Authorization: Bearer ${token || '$CIVITAI_API_KEY'}" ` : "";
    const authCurl = (token || civitaiConfigured) ? `-H "Authorization: Bearer ${token || '$CIVITAI_API_KEY'}" ` : "";

    const cmd = `mkdir -p "${dest}" && (aria2c -c -x 8 -s 8 -k 1M ${authAria}-d "${dest}" -o "${filename}" "${downloadUrl}" || curl -L -C - --fail --retry 3 ${authCurl}-o "${dest}/${filename}" "${downloadUrl}")`;

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

  // ==========================================
  // HUGGING FACE / DIRECT URL LOOKUP
  // ==========================================
  const handleLookupHfModel = async (overrideQuery?: string) => {
    const q = (overrideQuery !== undefined ? overrideQuery : hfQuery).trim();
    if (!q) {
      setHfLookupError("Please provide a Hugging Face model URL, repo name, or direct download link.");
      return;
    }

    setLookingUpHf(true);
    setHfLookupError(null);
    setHfMetadata(null);
    setDownloadResult(null);

    try {
      const url = `/api/model-hub/hf-info?url=${encodeURIComponent(q)}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to inspect Hugging Face model repository.");
      }

      const meta: HuggingFaceModelMetadata = data.data || data;
      setHfMetadata(meta);
      setHfTargetFilename(meta.filename);
      setSelectedHfFileUrl(meta.download_url);

      // Match preset
      const presetKey = meta.category_preset_key || "diffusion_models";
      setHfCategoryPreset(presetKey);
      const presetObj = COMFYUI_MODEL_CATEGORIES.find((p) => p.id === presetKey);
      setHfTargetDest(presetObj ? presetObj.subfolder : meta.default_destination_folder || "models/diffusion_models/");

      if (onShowToast) {
        onShowToast(`Found model: ${meta.model_name}`, "info");
      }
    } catch (err: any) {
      setHfLookupError(err.message || "Failed to inspect model.");
      if (onShowToast) {
        onShowToast(`Hugging Face Error: ${err.message}`, "error");
      }
    } finally {
      setLookingUpHf(false);
    }
  };

  // HF category change handler
  const handleHfCategoryChange = (presetId: string) => {
    setHfCategoryPreset(presetId);
    const preset = COMFYUI_MODEL_CATEGORIES.find((p) => p.id === presetId);
    if (preset && preset.id !== "custom") {
      setHfTargetDest(preset.subfolder);
    }
  };

  // HF file selection change
  const handleHfFileChange = (fileOption: HuggingFaceFileOption) => {
    setSelectedHfFileUrl(fileOption.downloadUrl);
    setHfTargetFilename(fileOption.filename);

    // Auto-detect category for new filename
    const fname = fileOption.filename.toLowerCase();
    let newPreset = hfCategoryPreset;
    if (fname.includes("t5") || fname.includes("clip")) {
      newPreset = "clip";
    } else if (fname.includes("vae")) {
      newPreset = "vae";
    } else if (fname.includes("lora")) {
      newPreset = "loras";
    } else if (fname.includes("controlnet")) {
      newPreset = "controlnet";
    } else if (fname.includes("wan") || fname.includes("flux") || fname.includes("hunyuan")) {
      newPreset = "diffusion_models";
    }

    if (newPreset !== hfCategoryPreset) {
      handleHfCategoryChange(newPreset);
    }
  };

  // ==========================================
  // EXECUTE REMOTE DOWNLOAD (SSH)
  // ==========================================
  const handleExecuteRemoteDownload = async (source: "civitai" | "huggingface") => {
    const isCivitai = source === "civitai";
    const downloadUrl = isCivitai ? civitaiMetadata?.download_url : selectedHfFileUrl || hfMetadata?.download_url;
    const destFolder = isCivitai ? civitaiTargetDest : hfTargetDest;
    const filename = isCivitai ? civitaiTargetFilename : hfTargetFilename;

    if (!downloadUrl) {
      if (onShowToast) onShowToast("No model download URL selected.", "error");
      return;
    }
    if (!destFolder) {
      if (onShowToast) onShowToast("Target destination folder cannot be empty.", "error");
      return;
    }
    if (!filename) {
      if (onShowToast) onShowToast("Filename cannot be empty.", "error");
      return;
    }
    if (!config.remote_host) {
      if (onShowToast) onShowToast("Remote Host IP is not configured in SSH settings.", "error");
      return;
    }

    setDownloading(true);
    setDownloadResult(null);

    try {
      const payload = {
        download_url: downloadUrl,
        destination_folder: destFolder,
        filename: filename,
        auth_type: isCivitai ? "civitai" : "huggingface",
        civitai_token: config.civitai_api_key || undefined,
        hf_token: config.huggingface_token || undefined,
        remote_host: config.remote_host,
        ssh_port: config.ssh_port || 22,
        ssh_username: config.ssh_username || "root",
        ssh_password: config.ssh_password || undefined,
        ssh_private_key: config.ssh_private_key || undefined,
        ssh_key_path: config.ssh_key_path || undefined,
        remote_comfyui_root: config.remote_comfyui_root || "/workspace/runpod-slim/ComfyUI"
      };

      const res = await fetch("/api/model-hub/download-remote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      setDownloadResult(result);

      if (result.success) {
        if (onShowToast) {
          onShowToast(`Model '${filename}' downloaded successfully to remote ComfyUI!`, "success");
        }
      } else {
        if (onShowToast) {
          onShowToast(`Remote Download Failed: ${result.error || result.message}`, "error");
        }
      }
    } catch (err: any) {
      const failResult = {
        success: false,
        message: err.message || "Failed to execute remote download command.",
        error: err.message
      };
      setDownloadResult(failResult);
      if (onShowToast) {
        onShowToast(`Download Error: ${err.message}`, "error");
      }
    } finally {
      setDownloading(false);
    }
  };

  // Helper to compute full remote target path
  const computeFullRemotePath = (destFolder: string, filename: string) => {
    const root = (config.remote_comfyui_root || "/workspace/runpod-slim/ComfyUI").replace(/\/$/, "");
    let sub = (destFolder || "").trim();
    if (sub.startsWith("/")) {
      return `${sub.replace(/\/$/, "")}/${filename || ""}`;
    }
    return `${root}/${sub.replace(/^\//, "").replace(/\/$/, "")}/${filename || ""}`;
  };

  return (
    <div id="remote-model-ingestion-hub" className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 border border-neutral-700/60 rounded-xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
                <DownloadCloud className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white tracking-wide">
                Remote Model Ingestion Hub
              </h3>
            </div>
            <p className="text-xs text-neutral-400 mt-1.5 max-w-2xl leading-relaxed">
              Ingest Checkpoints, DiT Diffusion Models (Wan 2.1, FLUX), LoRAs, Text Encoders, ControlNets, and VAEs directly into your remote GPU ComfyUI instance with multi-stream accelerated downloading.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-neutral-950/80 px-3.5 py-2 rounded-lg border border-neutral-800 text-xs text-neutral-300">
            <Server className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] text-neutral-400 uppercase font-medium">Remote ComfyUI Root</span>
              <span className="font-mono text-emerald-300 font-semibold text-xs truncate max-w-[220px]">
                {config.remote_comfyui_root || "/workspace/runpod-slim/ComfyUI"}
              </span>
            </div>
          </div>
        </div>

        {/* Source Navigation Tabs */}
        <div className="flex items-center gap-2 mt-5 border-t border-neutral-800/80 pt-4">
          <button
            id="tab-huggingface"
            type="button"
            onClick={() => setActiveTab("huggingface")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "huggingface"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                : "bg-neutral-800/60 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 border border-transparent"
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-amber-400" />
            Hugging Face / Direct URL
            {hfConfigured && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="Token Configured" />
            )}
          </button>

          <button
            id="tab-civitai"
            type="button"
            onClick={() => setActiveTab("civitai")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "civitai"
                ? "bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm"
                : "bg-neutral-800/60 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 border border-transparent"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            Civitai Models & LoRAs
            {civitaiConfigured && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="API Key Configured" />
            )}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: HUGGING FACE & DIRECT URL INGESTION */}
      {/* ========================================================================= */}
      {activeTab === "huggingface" && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Hugging Face Credentials Box */}
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold text-neutral-200 uppercase tracking-wider">
                  Hugging Face Access Token (Optional)
                </span>
              </div>
              <a
                href="https://huggingface.co/settings/tokens"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-amber-400/90 hover:text-amber-300 flex items-center gap-1 transition-colors"
              >
                <span>Get Hugging Face Token</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <input
                  id="input-hf-token"
                  type="password"
                  placeholder={hfConfigured ? `Configured (${hfMaskedToken})` : "Enter Hugging Face Token (hf_...)"}
                  value={hfTokenInput}
                  onChange={(e) => setHfTokenInput(e.target.value)}
                  className="w-full bg-neutral-950/80 border border-neutral-700/70 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-neutral-200 placeholder-neutral-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="btn-save-hf-token"
                  type="button"
                  onClick={handleSaveHfToken}
                  disabled={savingHfToken || !hfTokenInput.trim()}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-neutral-950 font-semibold text-xs disabled:opacity-50 transition-colors shrink-0"
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingHfToken ? "Saving..." : "Save Token"}
                </button>

                {hfConfigured && (
                  <button
                    id="btn-clear-hf-token"
                    type="button"
                    onClick={handleClearHfToken}
                    disabled={savingHfToken}
                    className="p-2 rounded-lg bg-neutral-800 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 border border-neutral-700 transition-colors"
                    title="Clear Token"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {hfTokenFeedback && (
              <div className={`mt-2 flex items-center gap-1.5 text-xs ${hfTokenFeedback.success ? "text-emerald-400" : "text-red-400"}`}>
                {hfTokenFeedback.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                <span>{hfTokenFeedback.message}</span>
              </div>
            )}
            <p className="text-[11px] text-neutral-400 mt-2 leading-relaxed">
              Public repos download without a token. Gated models (like FLUX.1-dev or Llama) pass this token automatically via <code className="text-amber-300 font-mono">Authorization: Bearer</code> headers.
            </p>
          </div>

          {/* Model URL Search Bar */}
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4">
            <label className="block text-xs font-semibold text-neutral-200 uppercase tracking-wider mb-2">
              Hugging Face URL, Repository, or Direct Model Link
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <input
                  id="input-hf-query"
                  type="text"
                  placeholder="e.g. https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/Wan2_1_T2V_14B_bf16.safetensors or comfyanonymous/flux_text_encoders"
                  value={hfQuery}
                  onChange={(e) => setHfQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleLookupHfModel();
                  }}
                  className="w-full bg-neutral-950/80 border border-neutral-700/70 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-neutral-200 placeholder-neutral-500 outline-none"
                />
              </div>

              <button
                id="btn-inspect-hf"
                type="button"
                onClick={() => handleLookupHfModel()}
                disabled={lookingUpHf || !hfQuery.trim()}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs disabled:opacity-50 transition-colors shadow-sm shrink-0"
              >
                {lookingUpHf ? (
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

            {/* Quick Presets */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-neutral-400 font-medium mr-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                Popular:
              </span>
              {[
                { label: "Wan 2.1 14B T2V", url: "https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/Wan2_1_T2V_14B_bf16.safetensors" },
                { label: "FLUX T5-XXL FP8", url: "https://huggingface.co/comfyanonymous/flux_text_encoders/blob/main/t5xxl_fp8_e4m3fn.safetensors" },
                { label: "FLUX CLIP-L", url: "https://huggingface.co/comfyanonymous/flux_text_encoders/blob/main/clip_l.safetensors" },
                { label: "SDXL VAE", url: "https://huggingface.co/stabilityai/sdxl-vae/blob/main/sdxl_vae.safetensors" },
                { label: "RealESRGAN x4plus", url: "https://huggingface.co/ai-forever/Real-ESRGAN/blob/main/RealESRGAN_x4.pth" }
              ].map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setHfQuery(preset.url);
                    handleLookupHfModel(preset.url);
                  }}
                  className="px-2.5 py-1 rounded bg-neutral-800/80 hover:bg-neutral-700/80 text-[11px] text-neutral-300 hover:text-amber-300 border border-neutral-700/60 transition-colors font-mono"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {hfLookupError && (
              <div className="mt-3 p-3 bg-red-950/40 border border-red-800/60 rounded-lg flex items-start gap-2 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{hfLookupError}</span>
              </div>
            )}
          </div>

          {/* Model Inspection & Destination Routing Card */}
          {hfMetadata && (
            <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-5 shadow-lg space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-neutral-800 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-base font-bold text-white">
                      {hfMetadata.model_name}
                    </h4>
                    {hfMetadata.is_gated && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" />
                        Gated Model
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-800 text-neutral-300 border border-neutral-700">
                      {hfMetadata.detected_category}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400">
                    Repository: <span className="font-mono text-neutral-300">{hfMetadata.repo_id}</span>
                    {hfMetadata.author && <span> • by {hfMetadata.author}</span>}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="bg-neutral-950 px-3 py-1.5 rounded-lg border border-neutral-800 text-right">
                    <span className="text-[10px] text-neutral-400 block font-medium">Estimated Size</span>
                    <span className="text-xs font-mono font-bold text-amber-300">
                      {hfMetadata.file_size_formatted || "Stream"}
                    </span>
                  </div>
                </div>
              </div>

              {/* If repo has multiple available model weights files */}
              {hfMetadata.available_files && hfMetadata.available_files.length > 1 && (
                <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-lg p-3.5 space-y-2">
                  <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-amber-400" />
                    Select Specific Model File from Repository
                  </label>
                  <select
                    value={selectedHfFileUrl}
                    onChange={(e) => {
                      const sel = hfMetadata.available_files?.find((f) => f.downloadUrl === e.target.value);
                      if (sel) handleHfFileChange(sel);
                    }}
                    className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 text-xs rounded-lg px-3 py-2 outline-none focus:border-amber-500 font-mono"
                  >
                    {hfMetadata.available_files.map((file, idx) => (
                      <option key={idx} value={file.downloadUrl}>
                        {file.filename} {file.isPrimary ? "(Recommended)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Destination Configuration Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category Preset Selector */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                    Target Model Category
                  </label>
                  <select
                    id="select-hf-category"
                    value={hfCategoryPreset}
                    onChange={(e) => handleHfCategoryChange(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:border-amber-500 outline-none"
                  >
                    {COMFYUI_MODEL_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label} {cat.subfolder ? `(${cat.subfolder})` : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    {COMFYUI_MODEL_CATEGORIES.find((c) => c.id === hfCategoryPreset)?.description}
                  </p>
                </div>

                {/* Subfolder override input */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                    Destination Subfolder (Relative to ComfyUI Root)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={hfTargetDest}
                      onChange={(e) => {
                        setHfTargetDest(e.target.value);
                        setHfCategoryPreset("custom");
                      }}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-200 font-mono focus:border-amber-500 outline-none"
                    />
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    Folder is automatically created if it does not exist on remote host.
                  </p>
                </div>

                {/* Target Filename input */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                    Target Filename on Remote Host
                  </label>
                  <input
                    type="text"
                    value={hfTargetFilename}
                    onChange={(e) => setHfTargetFilename(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-200 font-mono focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              {/* Path confirmation callout */}
              <div className="bg-neutral-950/80 border border-neutral-800 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 font-semibold uppercase tracking-wider">
                  <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                  Full Remote Destination Path:
                </div>
                <div className="font-mono text-xs text-emerald-300 bg-neutral-900/90 px-2.5 py-1.5 rounded border border-neutral-800 break-all select-all">
                  {computeFullRemotePath(hfTargetDest, hfTargetFilename)}
                </div>
              </div>

              {/* Download CTA */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="text-xs text-neutral-400">
                  <span>Method: </span>
                  <span className="font-mono text-neutral-300">aria2c (multi-stream 8x) / curl fallback</span>
                </div>

                <button
                  id="btn-download-hf-model"
                  type="button"
                  onClick={() => handleExecuteRemoteDownload("huggingface")}
                  disabled={downloading || !config.remote_host}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs disabled:opacity-50 transition-all shadow-md shrink-0"
                >
                  {downloading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Ingesting Model ({downloadElapsed}s)...</span>
                    </>
                  ) : (
                    <>
                      <DownloadCloud className="w-4 h-4" />
                      <span>Ingest to Remote ComfyUI</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CIVITAI INGESTION */}
      {/* ========================================================================= */}
      {activeTab === "civitai" && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Civitai Credentials Box */}
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-semibold text-neutral-200 uppercase tracking-wider">
                  Civitai API Key (Required for authenticated/NSFW/creator weights)
                </span>
              </div>
              <a
                href="https://civitai.com/user/account"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-blue-400/90 hover:text-blue-300 flex items-center gap-1 transition-colors"
              >
                <span>Get Civitai API Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <input
                  id="input-civitai-key"
                  type="password"
                  placeholder={civitaiConfigured ? `Configured (${civitaiMaskedKey})` : "Enter Civitai API Key"}
                  value={civitaiKeyInput}
                  onChange={(e) => setCivitaiKeyInput(e.target.value)}
                  className="w-full bg-neutral-950/80 border border-neutral-700/70 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-neutral-200 placeholder-neutral-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="btn-save-civitai-key"
                  type="button"
                  onClick={handleSaveCivitaiKey}
                  disabled={savingCivitaiKey || !civitaiKeyInput.trim()}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs disabled:opacity-50 transition-colors shrink-0"
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingCivitaiKey ? "Saving..." : "Save Key"}
                </button>

                {civitaiConfigured && (
                  <button
                    id="btn-clear-civitai-key"
                    type="button"
                    onClick={handleClearCivitaiKey}
                    disabled={savingCivitaiKey}
                    className="p-2 rounded-lg bg-neutral-800 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 border border-neutral-700 transition-colors"
                    title="Clear Key"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {civitaiTokenFeedback && (
              <div className={`mt-2 flex items-center gap-1.5 text-xs ${civitaiTokenFeedback.success ? "text-emerald-400" : "text-red-400"}`}>
                {civitaiTokenFeedback.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                <span>{civitaiTokenFeedback.message}</span>
              </div>
            )}
          </div>

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
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs disabled:opacity-50 transition-colors shadow-sm shrink-0"
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

            {/* Quick Presets */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-neutral-400 font-medium mr-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-blue-400" />
                Popular:
              </span>
              {[
                { label: "Juggernaut XL", query: "133005" },
                { label: "Realistic Vision V6.0", query: "4201" },
                { label: "CyberRealistic", query: "15003" },
                { label: "Pony Diffusion V6 XL", query: "257749" }
              ].map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setCivitaiQuery(preset.query);
                    handleLookupCivitaiModel(preset.query);
                  }}
                  className="px-2.5 py-1 rounded bg-neutral-800/80 hover:bg-neutral-700/80 text-[11px] text-neutral-300 hover:text-blue-300 border border-neutral-700/60 transition-colors font-mono"
                >
                  {preset.label}
                </button>
              ))}
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
            <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-5 shadow-lg space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-neutral-800 pb-4">
                <div className="flex items-start gap-4">
                  {civitaiMetadata.preview_image_url ? (
                    <img
                      src={civitaiMetadata.preview_image_url}
                      alt={civitaiMetadata.model_name}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-lg object-cover border border-neutral-700 shrink-0 bg-neutral-950"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-center text-neutral-500 shrink-0">
                      <Layers className="w-6 h-6" />
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-base font-bold text-white">
                        {civitaiMetadata.model_name}
                      </h4>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {civitaiMetadata.category}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-800 text-neutral-300 border border-neutral-700">
                        {civitaiMetadata.base_model}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400">
                      Version: <span className="font-semibold text-neutral-300">{civitaiMetadata.version_name}</span> (ID: {civitaiMetadata.version_id})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="bg-neutral-950 px-3 py-1.5 rounded-lg border border-neutral-800 text-right">
                    <span className="text-[10px] text-neutral-400 block font-medium">Model Size</span>
                    <span className="text-xs font-mono font-bold text-blue-300">
                      {civitaiMetadata.file_size_formatted}
                    </span>
                  </div>
                </div>
              </div>

              {/* Version Selector if multiple versions exist */}
              {civitaiMetadata.versions && civitaiMetadata.versions.length > 1 && (
                <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-lg p-3.5 space-y-2">
                  <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-blue-400" />
                    Select Model Version
                  </label>
                  <select
                    value={selectedVersionId || civitaiMetadata.version_id}
                    onChange={(e) => {
                      const vid = parseInt(e.target.value, 10);
                      setSelectedVersionId(vid);
                      handleLookupCivitaiModel(vid.toString());
                    }}
                    className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 text-xs rounded-lg px-3 py-2 outline-none focus:border-blue-500 font-mono"
                  >
                    {civitaiMetadata.versions.map((ver) => (
                      <option key={ver.id} value={ver.id}>
                        {ver.name} {ver.baseModel ? `(${ver.baseModel})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Trained Trigger Words Section */}
              {((civitaiMetadata.trained_words && civitaiMetadata.trained_words.length > 0) ||
                (civitaiMetadata.trainedWords && civitaiMetadata.trainedWords.length > 0)) && (
                <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-lg p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Trained Trigger Words</span>
                      <span className="text-[10px] font-mono bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded-full">
                        {(civitaiMetadata.trained_words || civitaiMetadata.trainedWords || []).length}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyAllTriggerWords}
                      className="text-[11px] font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-blue-950/40 hover:bg-blue-900/50 px-2.5 py-1 rounded border border-blue-800/50 transition-colors cursor-pointer"
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
                    {(civitaiMetadata.trained_words || civitaiMetadata.trainedWords || []).map((word, idx) => {
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
                              : "bg-blue-950/30 hover:bg-blue-900/40 border-blue-800/40 hover:border-blue-700 text-blue-200"
                          }`}
                        >
                          {isCopied ? (
                            <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                          ) : (
                            <Copy className="w-3 h-3 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          )}
                          <span className="truncate max-w-[280px]">{word}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Description & Release Notes Section */}
              {(civitaiMetadata.clean_description || civitaiMetadata.description) && (
                <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-lg p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
                      <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>Model Description & Release Notes</span>
                    </div>
                    <span className="text-[10px] text-neutral-500 font-mono">Civitai API</span>
                  </div>
                  <div className="text-xs text-neutral-300/90 leading-relaxed font-sans whitespace-pre-wrap max-h-36 overflow-y-auto bg-neutral-900/60 p-2.5 rounded border border-neutral-800/60 select-text">
                    {civitaiMetadata.clean_description || civitaiMetadata.description}
                  </div>
                </div>
              )}

              {/* Destination Configuration Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category Preset Selector */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                    Target Model Category
                  </label>
                  <select
                    id="select-civitai-category"
                    value={civitaiCategoryPreset}
                    onChange={(e) => handleCivitaiCategoryChange(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:border-blue-500 outline-none"
                  >
                    {COMFYUI_MODEL_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label} {cat.subfolder ? `(${cat.subfolder})` : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    {COMFYUI_MODEL_CATEGORIES.find((c) => c.id === civitaiCategoryPreset)?.description}
                  </p>
                </div>

                {/* Subfolder override input */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                    Destination Subfolder (Relative to ComfyUI Root)
                  </label>
                  <input
                    type="text"
                    value={civitaiTargetDest}
                    onChange={(e) => {
                      setCivitaiTargetDest(e.target.value);
                      setCivitaiCategoryPreset("custom");
                    }}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-200 font-mono focus:border-blue-500 outline-none"
                  />
                  <p className="text-[11px] text-neutral-400 mt-1">
                    Folder is automatically created if it does not exist on remote host.
                  </p>
                </div>

                {/* Target Filename input */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                    Target Filename on Remote Host
                  </label>
                  <input
                    type="text"
                    value={civitaiTargetFilename}
                    onChange={(e) => setCivitaiTargetFilename(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-200 font-mono focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Path confirmation callout */}
              <div className="bg-neutral-950/80 border border-neutral-800 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 font-semibold uppercase tracking-wider">
                  <HardDrive className="w-3.5 h-3.5 text-blue-400" />
                  Full Remote Destination Path:
                </div>
                <div className="font-mono text-xs text-emerald-300 bg-neutral-900/90 px-2.5 py-1.5 rounded border border-neutral-800 break-all select-all">
                  {computeFullRemotePath(civitaiTargetDest, civitaiTargetFilename)}
                </div>
              </div>

              {/* Download CTA & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="text-xs text-neutral-400">
                  <span>Method: </span>
                  <span className="font-mono text-neutral-300">aria2c (multi-stream 8x) / curl fallback</span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    id="btn-copy-civitai-command"
                    type="button"
                    onClick={handleCopyCivitaiCommand}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 hover:text-white font-semibold text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
                  >
                    {copiedCivitaiCmd ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-300 font-bold">Command Copied!</span>
                      </>
                    ) : (
                      <>
                        <Terminal className="w-4 h-4 text-blue-400" />
                        <span>Copy Download Command</span>
                      </>
                    )}
                  </button>

                  <button
                    id="btn-download-civitai-model"
                    type="button"
                    onClick={() => handleExecuteRemoteDownload("civitai")}
                    disabled={downloading || !config.remote_host}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs disabled:opacity-50 transition-all shadow-md shrink-0 active:scale-95 cursor-pointer"
                  >
                    {downloading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Ingesting Model ({downloadElapsed}s)...</span>
                      </>
                    ) : (
                      <>
                        <DownloadCloud className="w-4 h-4" />
                        <span>Ingest to Remote ComfyUI</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. DOWNLOAD STATUS & LOGS FEEDBACK CARD */}
      {/* ========================================================================= */}
      {downloadResult && (
        <div
          className={`p-4 rounded-xl border animate-in fade-in duration-300 ${
            downloadResult.success
              ? "bg-emerald-950/30 border-emerald-800/60 text-emerald-200"
              : "bg-red-950/30 border-red-800/60 text-red-200"
          }`}
        >
          <div className="flex items-start gap-3">
            {downloadResult.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-2 flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <h5 className="text-sm font-bold">
                  {downloadResult.success ? "Model Ingested Successfully!" : "Remote Download Failed"}
                </h5>
                {downloadResult.duration_seconds !== undefined && (
                  <span className="text-xs font-mono opacity-80">
                    Duration: {downloadResult.duration_seconds}s
                  </span>
                )}
              </div>
              <p className="text-xs opacity-90 leading-relaxed">
                {downloadResult.message}
              </p>

              {downloadResult.destination_path && (
                <div className="text-xs font-mono bg-neutral-950/80 px-2.5 py-1.5 rounded border border-neutral-800/80 text-neutral-300 select-all">
                  Location: {downloadResult.destination_path}
                </div>
              )}

              {downloadResult.logs && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer text-neutral-400 hover:text-neutral-200 font-medium">
                    View Remote SSH Execution Logs
                  </summary>
                  <pre className="mt-1.5 p-3 bg-neutral-950 rounded border border-neutral-800 font-mono text-[11px] text-neutral-300 max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {downloadResult.logs}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
