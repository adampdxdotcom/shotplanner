import React, { useState, useEffect, useRef } from "react";
import { AppConfig, LLMProvider } from "../types";
import { copyToClipboard } from "../utils/clipboard";
import { RemoteSSHPrimerCard } from "./RemoteSSHPrimerCard";
import { 
  Server, 
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileCode2,
  Info,
  Bot,
  Cpu,
  Sparkles,
  Star
} from "lucide-react";

import { RemoteGPUConfig } from "./config/RemoteGPUConfig";
import { ComfyUIConfig } from "./config/ComfyUIConfig";
import { GeminiConfig, probeGeminiConnection } from "./config/GeminiConfig";
import { CivitaiConfig } from "./config/CivitaiConfig";
import { ModelHubConfig } from "./config/ModelHubConfig";
import { SSHKeypairModal } from "./config/SSHKeypairModal";

export async function probeLMStudioConnection(url?: string): Promise<{ success: boolean; message: string }> {
  const targetUrl = (url || "http://localhost:1234/v1").trim();

  try {
    const res = await fetch("/api/settings/test-lm-studio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: targetUrl })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      const countMsg = data.modelsCount !== undefined ? ` (${data.modelsCount} model${data.modelsCount === 1 ? '' : 's'} available)` : '';
      return { success: true, message: `Connected: LM Studio server responsive at ${targetUrl}${countMsg}` };
    } else {
      let probeEndpoint = targetUrl.replace(/\/$/, "");
      if (!probeEndpoint.endsWith("/models")) {
        probeEndpoint = probeEndpoint.endsWith("/v1") ? `${probeEndpoint}/models` : `${probeEndpoint}/v1/models`;
      }
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const directRes = await fetch(probeEndpoint, { signal: controller.signal });
        clearTimeout(timeout);
        if (directRes.ok) {
          return { success: true, message: `Connected: Local LM Studio reachable from browser at ${targetUrl}` };
        }
      } catch (e) {}

      const errorMsg = data.error || "Connection refused or endpoint unreachable";
      return { success: false, message: errorMsg };
    }
  } catch (err: any) {
    let probeEndpoint = targetUrl.replace(/\/$/, "");
    if (!probeEndpoint.endsWith("/models")) {
      probeEndpoint = probeEndpoint.endsWith("/v1") ? `${probeEndpoint}/models` : `${probeEndpoint}/v1/models`;
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const directRes = await fetch(probeEndpoint, { signal: controller.signal });
      clearTimeout(timeout);
      if (directRes.ok) {
        return { success: true, message: `Connected: Local LM Studio reachable from browser at ${targetUrl}` };
      }
    } catch (e) {}

    return { success: false, message: err.message || "Connection refused or endpoint unreachable" };
  }
}

interface ConfigSectionProps {
  config: AppConfig;
  onChange: (newConfig: AppConfig) => void;
  llmProvider?: LLMProvider;
  defaultLlmProvider?: LLMProvider;
  onChangeProvider?: (provider: LLMProvider) => void;
  onSetDefaultProvider?: (provider: LLMProvider) => void;
  onShowToast?: (text: string, type: "success" | "error" | "info") => void;
  onOpenCodeViewer?: () => void;
}

export const ConfigSection: React.FC<ConfigSectionProps> = ({ 
  config, 
  onChange, 
  llmProvider,
  defaultLlmProvider,
  onChangeProvider,
  onSetDefaultProvider,
  onShowToast,
  onOpenCodeViewer 
}) => {
  // Remote SSH Testing state
  const [testingSSH, setTestingSSH] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  // In-App SSH Key Generator state
  const [isGeneratingKeyPair, setIsGeneratingKeyPair] = useState(false);
  const [generatedKeyPair, setGeneratedKeyPair] = useState<{ public_key: string; private_key: string } | null>(null);
  const [showPublicKeyModal, setShowPublicKeyModal] = useState(false);
  const [hasCopiedPublicKey, setHasCopiedPublicKey] = useState(false);

  // LM Studio connection testing state
  const [testingLM, setTestingLM] = useState(false);
  const [lmTestResult, setLmTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  // Gemini connection status state
  const [isGeminiConnected, setIsGeminiConnected] = useState(false);

  // Track previous connection state to avoid redundant connection lost toasts
  const wasConnectedRef = useRef<{ lm_studio: boolean | null; gemini: boolean | null }>({
    lm_studio: null,
    gemini: null,
  });

  const activeProvider: LLMProvider = llmProvider || config.llm_provider || "lm_studio";
  const effectiveDefault: LLMProvider = defaultLlmProvider || config.default_llm_provider || "lm_studio";

  const isLmStudioConnected = lmTestResult?.success === true;

  // Initial Gemini check on mount
  useEffect(() => {
    fetch("/api/settings/gemini")
      .then((res) => res.json())
      .then((data) => {
        if (data.configured) {
          setIsGeminiConnected(true);
        }
      })
      .catch(() => {});
  }, []);

  // Periodic health check polling for active default LLM
  useEffect(() => {
    let isMounted = true;

    const performPeriodicHealthCheck = async () => {
      if (effectiveDefault === "lm_studio") {
        const result = await probeLMStudioConnection(config.lm_studio_url);
        if (!isMounted) return;

        const previousStatus = wasConnectedRef.current.lm_studio;
        if (result.success) {
          setLmTestResult({ success: true, message: result.message });
          wasConnectedRef.current.lm_studio = true;
        } else {
          setLmTestResult({ success: false, message: `Connection Failed: ${result.message}` });
          if (previousStatus === true) {
            if (onShowToast) {
              onShowToast("Connection lost to LM Studio", "error");
            }
          }
          wasConnectedRef.current.lm_studio = false;
        }
      } else if (effectiveDefault === "gemini") {
        const keyToTest = config.gemini_api_key || "";
        const result = await probeGeminiConnection(keyToTest);
        if (!isMounted) return;

        const previousStatus = wasConnectedRef.current.gemini;
        if (result.success) {
          setIsGeminiConnected(true);
          wasConnectedRef.current.gemini = true;
        } else {
          setIsGeminiConnected(false);
          if (previousStatus === true) {
            if (onShowToast) {
              onShowToast("Connection lost to Gemini", "error");
            }
          }
          wasConnectedRef.current.gemini = false;
        }
      }
    };

    performPeriodicHealthCheck();

    const intervalId = setInterval(() => {
      performPeriodicHealthCheck();
    }, 25000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [effectiveDefault, config.lm_studio_url, config.gemini_api_key]);

  const handleInputChange = (field: keyof AppConfig, value: any) => {
    if (field === "lm_studio_url" && lmTestResult) {
      setLmTestResult(null);
    }
    onChange({ ...config, [field]: value });
  };

  const handleProviderSelect = (provider: LLMProvider) => {
    if (onChangeProvider) {
      onChangeProvider(provider);
    }
    onChange({ ...config, llm_provider: provider });

    const providerName = provider === "lm_studio" ? "LM Studio" : "Gemini";
    if (onShowToast) {
      onShowToast(`${providerName} selected`, "info");
    }
  };

  const handleTestLMStudio = async () => {
    setTestingLM(true);
    setLmTestResult(null);

    const result = await probeLMStudioConnection(config.lm_studio_url);
    setTestingLM(false);

    if (result.success) {
      setLmTestResult({ success: true, message: result.message });
      wasConnectedRef.current.lm_studio = true;
      if (onShowToast) {
        onShowToast("✓ LM Studio connected successfully", "success");
      }
    } else {
      setLmTestResult({ success: false, message: `Connection Failed: ${result.message}` });
      wasConnectedRef.current.lm_studio = false;
      if (onShowToast) {
        onShowToast(`⚠ LM Studio connection failed: ${result.message}`, "error");
      }
    }
  };

  const handleSetDefaultLMStudio = async () => {
    setTestingLM(true);
    setLmTestResult(null);

    const result = await probeLMStudioConnection(config.lm_studio_url);
    setTestingLM(false);

    if (result.success) {
      setLmTestResult({ success: true, message: result.message });
      wasConnectedRef.current.lm_studio = true;
      if (onSetDefaultProvider) {
        onSetDefaultProvider("lm_studio");
      }
    } else {
      setLmTestResult({ success: false, message: `Connection Failed: ${result.message}` });
      wasConnectedRef.current.lm_studio = false;
      if (onShowToast) {
        onShowToast(`Failed to set default: Could not connect to LM Studio`, "error");
      }
    }
  };

  const handleTestSSH = async () => {
    setTestingSSH(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/ssh/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: config.remote_host,
          port: config.ssh_port,
          username: config.ssh_username,
          password: config.ssh_password,
          key_path: config.ssh_key_path,
          ssh_private_key: config.ssh_private_key,
          remote_dir: config.remote_comfyui_root || "/workspace/remote-slim/ComfyUI/input/"
        })
      });
      const data = await res.json();
      setTestResult(data);
    } catch (e: any) {
      setTestResult({ success: false, message: e.message });
    } finally {
      setTestingSSH(false);
    }
  };

  const handleGenerateKeyPair = async () => {
    setIsGeneratingKeyPair(true);
    try {
      const res = await fetch("/api/ssh/generate_keypair", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.detail || `Failed to generate key pair (${res.status})`);
      }
      const data = await res.json();
      if (data.private_key && data.public_key) {
        // Auto-populate into state/config
        handleInputChange("ssh_private_key", data.private_key);
        setGeneratedKeyPair(data);
        setShowPublicKeyModal(true);
        setHasCopiedPublicKey(false);
      }
    } catch (err: any) {
      alert("Failed to generate SSH key pair: " + (err.message || "Unknown error"));
    } finally {
      setIsGeneratingKeyPair(false);
    }
  };

  const handleCopyPublicKey = async () => {
    if (!generatedKeyPair?.public_key) return;
    const success = await copyToClipboard(generatedKeyPair.public_key);
    if (success) {
      setHasCopiedPublicKey(true);
      setTimeout(() => setHasCopiedPublicKey(false), 2500);
    }
  };

  const handleDownloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div id="config-section" className="space-y-6">
      {/* 1. LLM Connection Panel */}
      <section className="bg-zinc-900/60 border-2 border-zinc-700 rounded-xl p-5 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">LLM Connection</h2>
              <p className="text-xs text-zinc-400">Select active LLM provider and configure prompt expansion settings.</p>
            </div>
          </div>

          {/* Provider Selector Pill-Bar */}
          <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800 gap-1.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => handleProviderSelect("lm_studio")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-2 cursor-pointer ${
                isLmStudioConnected
                  ? activeProvider === "lm_studio"
                    ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/60 shadow-xs"
                    : "bg-emerald-950/40 text-emerald-300 hover:text-emerald-100 hover:bg-emerald-900/50 border-emerald-700/60"
                  : activeProvider === "lm_studio"
                    ? "bg-amber-500/20 text-amber-200 border-amber-500/50 shadow-xs"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border-transparent"
              }`}
            >
              <Cpu className={`w-3.5 h-3.5 transition-colors ${
                isLmStudioConnected 
                  ? "text-emerald-400" 
                  : activeProvider === "lm_studio" 
                    ? "text-amber-400" 
                    : "text-zinc-400"
              }`} />
              <span>LM Studio</span>
            </button>

            <button
              type="button"
              onClick={() => handleProviderSelect("gemini")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-2 cursor-pointer ${
                isGeminiConnected
                  ? activeProvider === "gemini"
                    ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/60 shadow-xs"
                    : "bg-emerald-950/40 text-emerald-300 hover:text-emerald-100 hover:bg-emerald-900/50 border-emerald-700/60"
                  : activeProvider === "gemini"
                    ? "bg-purple-500/20 text-purple-200 border-purple-500/50 shadow-xs"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border-transparent"
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 transition-colors ${
                isGeminiConnected 
                  ? "text-emerald-400" 
                  : activeProvider === "gemini" 
                    ? "text-purple-400" 
                    : "text-zinc-400"
              }`} />
              <span>Gemini</span>
            </button>
          </div>
        </div>

        {/* Contextual Configuration Body */}
        {activeProvider === "lm_studio" ? (
          <div className="space-y-3 max-w-xl">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-amber-400" />
                  Local LM Studio API URL
                </label>

                {effectiveDefault === "lm_studio" ? (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/50 border border-emerald-700/50 px-2.5 py-1 rounded-lg shrink-0 shadow-xs">
                    <Star className="w-3.5 h-3.5 fill-emerald-400 text-emerald-400" />
                    ★ Default LLM
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSetDefaultLMStudio}
                    disabled={testingLM}
                    title="Set LM Studio as default LLM provider"
                    className="px-2.5 py-1 text-xs font-medium bg-zinc-800 hover:bg-emerald-950/40 text-zinc-300 hover:text-emerald-300 border border-zinc-700 hover:border-emerald-600/50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${testingLM ? "animate-spin text-emerald-400" : "hidden"}`} />
                    <Star className={`w-3.5 h-3.5 text-zinc-400 hover:text-emerald-400 ${testingLM ? "hidden" : ""}`} />
                    <span>{testingLM ? "Testing..." : "Set as Default LLM"}</span>
                  </button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  placeholder="http://localhost:1234/v1"
                  value={config.lm_studio_url || ""}
                  onChange={(e) => handleInputChange("lm_studio_url", e.target.value)}
                  className="flex-1 bg-zinc-950 border-2 border-zinc-700 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={handleTestLMStudio}
                  disabled={testingLM}
                  className="px-3.5 py-2 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 border border-zinc-700 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingLM ? "animate-spin text-amber-400" : ""}`} />
                  <span>{testingLM ? "Testing..." : "Test Connection"}</span>
                </button>
              </div>
              <p className="text-[10px] text-zinc-500">Local OpenAI-compatible endpoint hosted by LM Studio for offline LLM expansion.</p>
            </div>

            {lmTestResult && (
              <div className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                lmTestResult.success 
                  ? "bg-emerald-950/30 border-emerald-800/40 text-emerald-300" 
                  : "bg-red-950/30 border-red-800/40 text-red-300"
              }`}>
                {lmTestResult.success ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                <span className="font-medium">{lmTestResult.message}</span>
              </div>
            )}
          </div>
        ) : (
          <GeminiConfig 
            config={config}
            onChange={onChange}
            isDefault={effectiveDefault === "gemini"}
            onSetDefault={() => onSetDefaultProvider && onSetDefaultProvider("gemini")}
            onConnectionStatusChange={setIsGeminiConnected}
            onShowToast={onShowToast}
          />
        )}
      </section>

      {/* 2. Remote Server Connection Panel */}
      <section className="bg-zinc-900/60 border-2 border-zinc-700 rounded-xl p-5 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Remote Server Connection</h2>
              <p className="text-xs text-zinc-400">Configure Remote GPU SSH connection credentials, ComfyUI root and input paths, and API endpoints.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {onOpenCodeViewer && (
              <button
                onClick={onOpenCodeViewer}
                className="px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 hover:text-white rounded-lg border border-zinc-700 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="View Python FastAPI & Docker files"
              >
                <FileCode2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Backend &amp; Docker Code</span>
              </button>
            )}
            <button
              onClick={handleTestSSH}
              disabled={testingSSH || !config.remote_host}
              className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 border border-zinc-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingSSH ? "animate-spin text-indigo-400" : ""}`} />
              {testingSSH ? "Testing SSH..." : "Test Remote SSH"}
            </button>
          </div>
        </div>

        {testResult && (
          <div className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
            testResult.success 
              ? "bg-emerald-950/30 border-emerald-800/40 text-emerald-300" 
              : "bg-red-950/30 border-red-800/40 text-red-300"
          }`}>
            {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />}
            <div>
              <p className="font-medium">{testResult.success ? "SSH Connection Verified" : "SSH Connection Notice"}</p>
              <p className="opacity-90 mt-0.5">{testResult.message}</p>
            </div>
          </div>
        )}

        {/* SSH Connection Credentials */}
        <RemoteGPUConfig 
          config={config}
          handleInputChange={handleInputChange}
          handleGenerateKeyPair={handleGenerateKeyPair}
          isGeneratingKeyPair={isGeneratingKeyPair}
          generatedKeyPair={generatedKeyPair}
        />

        {/* Remote ComfyUI Paths & Endpoints */}
        <ComfyUIConfig 
          config={config}
          handleInputChange={handleInputChange}
          onShowToast={onShowToast}
        />

        {/* Informational Callout */}
        <div className="text-[11px] text-zinc-400 bg-zinc-950/40 p-3 rounded-lg border-2 border-zinc-700/60 flex items-center gap-2">
          <Info className="w-4 h-4 text-zinc-400 shrink-0" />
          <span>During execution, media assets are pushed via Paramiko SCP into <code className="text-zinc-200 bg-zinc-800 px-1 py-0.5 rounded">{config.remote_comfyui_root ? `${config.remote_comfyui_root.replace(/\/$/, '')}/input/` : "/workspace/remote-slim/ComfyUI/input/"}</code>, and modified JSON graphs are submitted to <code className="text-zinc-200 bg-zinc-800 px-1 py-0.5 rounded">/prompt</code>.</span>
        </div>

        {/* Expandable Guide Accordion nested at bottom (Disabled) */}
        {/* <div id="remote-ssh-guide" className="pt-2 border-t border-zinc-800">
          <RemoteSSHPrimerCard publicKey={generatedKeyPair?.public_key || config.ssh_public_key || undefined} />
        </div> */}
      </section>

      {/* 3. Remote Model Ingestion Hub (Civitai & Hugging Face / Direct URL) */}
      <ModelHubConfig 
        config={config} 
        onChange={onChange} 
        onShowToast={onShowToast} 
      />

      {/* SSH Keypair Modal */}
      <SSHKeypairModal 
        showPublicKeyModal={showPublicKeyModal}
        generatedKeyPair={generatedKeyPair}
        hasCopiedPublicKey={hasCopiedPublicKey}
        onCopyPublicKey={handleCopyPublicKey}
        onDownloadFile={handleDownloadFile}
        onClose={() => setShowPublicKeyModal(false)}
      />
    </div>
  );
};

