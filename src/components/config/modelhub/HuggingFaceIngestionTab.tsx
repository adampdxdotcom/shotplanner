import React, { useState } from "react";
import { 
  AppConfig, 
  HuggingFaceModelMetadata, 
  HuggingFaceFileOption 
} from "../../../types";
import { copyToClipboard } from "../../../utils/clipboard";
import { COMFYUI_MODEL_CATEGORIES } from "./modelHubConstants";
import { HuggingFaceModelCard } from "./HuggingFaceModelCard";
import { 
  Key, 
  Save, 
  Trash2, 
  Search, 
  RefreshCw, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles 
} from "lucide-react";

export interface HuggingFaceIngestionTabProps {
  config: AppConfig;
  onChange: (newConfig: AppConfig) => void;
  onShowToast?: (text: string, type: "success" | "error" | "info") => void;
  hfConfigured: boolean;
  setHfConfigured: (configured: boolean) => void;
  hfMaskedToken: string;
  setHfMaskedToken: (masked: string) => void;
  downloading: boolean;
  downloadElapsed: number;
  onExecuteDownload: (target: {
    downloadUrl: string;
    destinationFolder: string;
    filename: string;
    authType: "huggingface";
  }) => void;
  onResetDownloadResult: () => void;
}

export const HuggingFaceIngestionTab: React.FC<HuggingFaceIngestionTabProps> = ({
  config,
  onChange,
  onShowToast,
  hfConfigured,
  setHfConfigured,
  hfMaskedToken,
  setHfMaskedToken,
  downloading,
  downloadElapsed,
  onExecuteDownload,
  onResetDownloadResult
}) => {
  // Hugging Face Token input state
  const [hfTokenInput, setHfTokenInput] = useState("");
  const [savingHfToken, setSavingHfToken] = useState(false);
  const [hfTokenFeedback, setHfTokenFeedback] = useState<{ success?: boolean; message?: string } | null>(null);

  // Model search and metadata
  const [hfQuery, setHfQuery] = useState("");
  const [lookingUpHf, setLookingUpHf] = useState(false);
  const [hfMetadata, setHfMetadata] = useState<HuggingFaceModelMetadata | null>(null);
  const [hfLookupError, setHfLookupError] = useState<string | null>(null);
  const [hfCategoryPreset, setHfCategoryPreset] = useState<string>("diffusion_models");
  const [hfTargetDest, setHfTargetDest] = useState<string>("models/diffusion_models/");
  const [hfTargetFilename, setHfTargetFilename] = useState<string>("");
  const [selectedHfFileUrl, setSelectedHfFileUrl] = useState<string>("");
  const [copiedHfCmd, setCopiedHfCmd] = useState(false);

  // Save Token
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

  // Clear Token
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

  // Lookup model metadata
  const handleLookupHfModel = async (overrideQuery?: string) => {
    const q = (overrideQuery !== undefined ? overrideQuery : hfQuery).trim();
    if (!q) {
      setHfLookupError("Please provide a Hugging Face model URL, repo name, or direct download link.");
      return;
    }

    setLookingUpHf(true);
    setHfLookupError(null);
    setHfMetadata(null);
    onResetDownloadResult();

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

  // Copy synthesized Hugging Face shell download command to clipboard
  const handleCopyHfCommand = async () => {
    if (!hfMetadata) return;

    const comfyRoot = (config.remote_comfyui_root || "/workspace/runpod-slim/ComfyUI").replace(/\/$/, "");
    let dest = (hfTargetDest || hfMetadata.default_destination_folder || "models/diffusion_models/").trim();
    if (!dest.startsWith("/")) {
      dest = `${comfyRoot}/${dest.replace(/^\//, "")}`;
    }
    const cleanDest = dest.replace(/\/$/, "");
    const filename = (hfTargetFilename || hfMetadata.filename || "model.safetensors").trim();
    const downloadUrl = (selectedHfFileUrl || hfMetadata.download_url || "").trim();
    const token = (config.huggingface_token || hfTokenInput || "").trim();

    const authPart = (hfMetadata.is_gated && token) ? `-H "Authorization: Bearer ${token}" ` : "";
    const cmd = `mkdir -p "${cleanDest}" && curl -L -C - --fail --retry 3 --user-agent "Mozilla/5.0" ${authPart}-o "${cleanDest}/${filename}" "${downloadUrl}"`;

    const success = await copyToClipboard(cmd);
    if (success) {
      setCopiedHfCmd(true);
      setTimeout(() => setCopiedHfCmd(false), 2000);
      if (onShowToast) {
        onShowToast("Download command copied to clipboard. Ready to paste in any remote terminal!", "success");
      }
    } else {
      if (onShowToast) {
        onShowToast("Failed to copy command to clipboard.", "error");
      }
    }
  };

  // Trigger remote ingestion
  const handleIngestTrigger = () => {
    const downloadUrl = (selectedHfFileUrl || hfMetadata?.download_url || "").trim();
    onExecuteDownload({
      downloadUrl,
      destinationFolder: hfTargetDest,
      filename: hfTargetFilename,
      authType: "huggingface"
    });
  };

  return (
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
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-neutral-950 font-semibold text-xs disabled:opacity-50 transition-colors shrink-0 cursor-pointer"
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
                className="p-2 rounded-lg bg-neutral-800 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 border border-neutral-700 transition-colors cursor-pointer"
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
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs disabled:opacity-50 transition-colors shadow-sm shrink-0 cursor-pointer"
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
              className="px-2.5 py-1 rounded bg-neutral-800/80 hover:bg-neutral-700/80 text-[11px] text-neutral-300 hover:text-amber-300 border border-neutral-700/60 transition-colors font-mono cursor-pointer"
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
        <HuggingFaceModelCard
          hfMetadata={hfMetadata}
          selectedFileUrl={selectedHfFileUrl}
          onSelectFile={handleHfFileChange}
          categoryPreset={hfCategoryPreset}
          onCategoryChange={handleHfCategoryChange}
          targetDest={hfTargetDest}
          onTargetDestChange={setHfTargetDest}
          targetFilename={hfTargetFilename}
          onTargetFilenameChange={setHfTargetFilename}
          remoteComfyRoot={config.remote_comfyui_root}
          copiedCmd={copiedHfCmd}
          onCopyCommand={handleCopyHfCommand}
          downloading={downloading}
          downloadElapsed={downloadElapsed}
          remoteHostConfigured={Boolean(config.remote_host)}
          onIngest={handleIngestTrigger}
        />
      )}
    </div>
  );
};
