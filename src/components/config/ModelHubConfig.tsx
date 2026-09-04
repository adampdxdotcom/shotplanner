import React, { useState, useEffect } from "react";
import { AppConfig, ModelCategoryPreset } from "../../types";
import { 
  DownloadCloud, 
  Globe, 
  Sparkles, 
  Server 
} from "lucide-react";
import { COMFYUI_MODEL_CATEGORIES } from "./modelhub/modelHubConstants";
import { HuggingFaceIngestionTab } from "./modelhub/HuggingFaceIngestionTab";
import { CivitaiIngestionTab } from "./modelhub/CivitaiIngestionTab";
import { ModelDownloadStatusCard, DownloadResult } from "./modelhub/ModelDownloadStatusCard";

// Re-export constants for backwards compatibility
export { COMFYUI_MODEL_CATEGORIES };
export type { ModelCategoryPreset };

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

  // Credential status indicators
  const [civitaiConfigured, setCivitaiConfigured] = useState(false);
  const [civitaiMaskedKey, setCivitaiMaskedKey] = useState("");

  const [hfConfigured, setHfConfigured] = useState(false);
  const [hfMaskedToken, setHfMaskedToken] = useState("");

  // Download execution state
  const [downloading, setDownloading] = useState(false);
  const [downloadElapsed, setDownloadElapsed] = useState(0);
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(null);

  // Initial check for configured API keys
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

  // Remote download execution over SSH
  const handleExecuteRemoteDownload = async (target: {
    downloadUrl: string;
    destinationFolder: string;
    filename: string;
    authType: "civitai" | "huggingface";
  }) => {
    const { downloadUrl, destinationFolder, filename, authType } = target;

    if (!downloadUrl) {
      if (onShowToast) onShowToast("No model download URL selected.", "error");
      return;
    }
    if (!destinationFolder) {
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
        destination_folder: destinationFolder,
        filename: filename,
        auth_type: authType,
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

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
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
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
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
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
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

      {/* Tab 1: Hugging Face & Direct URL Ingestion */}
      {activeTab === "huggingface" && (
        <HuggingFaceIngestionTab
          config={config}
          onChange={onChange}
          onShowToast={onShowToast}
          hfConfigured={hfConfigured}
          setHfConfigured={setHfConfigured}
          hfMaskedToken={hfMaskedToken}
          setHfMaskedToken={setHfMaskedToken}
          downloading={downloading}
          downloadElapsed={downloadElapsed}
          onExecuteDownload={handleExecuteRemoteDownload}
          onResetDownloadResult={() => setDownloadResult(null)}
        />
      )}

      {/* Tab 2: Civitai Models & LoRAs Ingestion */}
      {activeTab === "civitai" && (
        <CivitaiIngestionTab
          config={config}
          onChange={onChange}
          onShowToast={onShowToast}
          civitaiConfigured={civitaiConfigured}
          setCivitaiConfigured={setCivitaiConfigured}
          civitaiMaskedKey={civitaiMaskedKey}
          setCivitaiMaskedKey={setCivitaiMaskedKey}
          downloading={downloading}
          downloadElapsed={downloadElapsed}
          onExecuteDownload={handleExecuteRemoteDownload}
          onResetDownloadResult={() => setDownloadResult(null)}
        />
      )}

      {/* Shared Download Status & Logs Feedback Card */}
      <ModelDownloadStatusCard downloadResult={downloadResult} />
    </div>
  );
};
