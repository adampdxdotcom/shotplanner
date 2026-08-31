import React, { useState } from "react";
import { AppConfig } from "../types";
import { copyToClipboard } from "../utils/clipboard";
import { RemoteSSHPrimerCard } from "./RemoteSSHPrimerCard";
import { 
  Server, 
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileCode2,
  Info
} from "lucide-react";

import { RemoteGPUConfig } from "./config/RemoteGPUConfig";
import { ComfyUIConfig } from "./config/ComfyUIConfig";
import { GeminiConfig } from "./config/GeminiConfig";
import { SSHKeypairModal } from "./config/SSHKeypairModal";

interface ConfigSectionProps {
  config: AppConfig;
  onChange: (newConfig: AppConfig) => void;
  onOpenCodeViewer?: () => void;
}

export const ConfigSection: React.FC<ConfigSectionProps> = ({ config, onChange, onOpenCodeViewer }) => {
  // Remote SSH Testing state
  const [testingSSH, setTestingSSH] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  // In-App SSH Key Generator state
  const [isGeneratingKeyPair, setIsGeneratingKeyPair] = useState(false);
  const [generatedKeyPair, setGeneratedKeyPair] = useState<{ public_key: string; private_key: string } | null>(null);
  const [showPublicKeyModal, setShowPublicKeyModal] = useState(false);
  const [hasCopiedPublicKey, setHasCopiedPublicKey] = useState(false);

  const handleInputChange = (field: keyof AppConfig, value: any) => {
    onChange({ ...config, [field]: value });
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
    <div id="config-section" className="bg-zinc-900/60 border-2 border-zinc-700 rounded-xl p-5 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">5. Infrastructure &amp; Remote Credentials</h2>
            <p className="text-xs text-zinc-400">Configure Remote GPU SSH instance, ComfyUI API endpoint, and local LM Studio server.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {onOpenCodeViewer && (
            <button
              onClick={onOpenCodeViewer}
              className="px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 hover:text-white rounded-lg border border-zinc-700 transition-all flex items-center gap-1.5 shadow-xs"
              title="View Python FastAPI & Docker files"
            >
              <FileCode2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Backend &amp; Docker Code</span>
            </button>
          )}
          <button
            onClick={handleTestSSH}
            disabled={testingSSH || !config.remote_host}
            className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 border border-zinc-700 rounded-lg transition-colors flex items-center gap-1.5"
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

      <RemoteGPUConfig 
        config={config}
        handleInputChange={handleInputChange}
        handleGenerateKeyPair={handleGenerateKeyPair}
        isGeneratingKeyPair={isGeneratingKeyPair}
      />

      <ComfyUIConfig 
        config={config}
        handleInputChange={handleInputChange}
      />

      <GeminiConfig 
        config={config}
        onChange={onChange}
      />

      <div className="text-[11px] text-zinc-400 bg-zinc-950/40 p-2.5 rounded-lg border-2 border-zinc-700/60 flex items-center gap-2">
        <Info className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
        <span>During execution, media assets are pushed via Paramiko SCP into <code className="text-zinc-200 bg-zinc-800 px-1 py-0.5 rounded">{config.remote_comfyui_root || "/workspace/remote-slim/ComfyUI/input/"}</code>, and modified JSON graphs are submitted to <code className="text-zinc-200 bg-zinc-800 px-1 py-0.5 rounded">/prompt</code>.</span>
      </div>

      <div id="remote-ssh-guide" className="pt-2">
        <RemoteSSHPrimerCard publicKey={generatedKeyPair?.public_key || config.ssh_public_key || undefined} />
      </div>

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
