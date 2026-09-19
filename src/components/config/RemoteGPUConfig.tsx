import React, { useState } from "react";
import { AppConfig } from "../../types";
import { Terminal, Key, Sparkles, Copy, Check, ChevronDown, ChevronRight, Sliders } from "lucide-react";
import { copyToClipboard } from "../../utils/clipboard";
import { RunpodPodManagerCard } from "./RunpodPodManagerCard";
import { ComfyUIConfig } from "./ComfyUIConfig";

export interface RemoteGPUConfigProps {
  config: AppConfig;
  handleInputChange: (field: keyof AppConfig, value: any) => void;
  handleGenerateKeyPair: () => void;
  isGeneratingKeyPair: boolean;
  generatedKeyPair?: { public_key: string; private_key: string } | null;
  onShowToast?: (text: string, type: "success" | "error" | "info") => void;
  handleTestSSH?: () => void;
}

export const RemoteGPUConfig: React.FC<RemoteGPUConfigProps> = ({
  config,
  handleInputChange,
  handleGenerateKeyPair,
  isGeneratingKeyPair,
  generatedKeyPair,
  onShowToast,
  handleTestSSH
}) => {
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [copiedPublicKey, setCopiedPublicKey] = useState(false);
  const [isManualCollapsed, setIsManualCollapsed] = useState(true);

  const effectivePublicKey = generatedKeyPair?.public_key?.trim() || config.ssh_public_key?.trim() || "";
  const authCommandOneLiner = effectivePublicKey
    ? `mkdir -p ~/.ssh && echo "${effectivePublicKey}" >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys`
    : `mkdir -p ~/.ssh && echo "YOUR_PUBLIC_KEY" >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys`;

  const handleCopyCommand = async () => {
    const success = await copyToClipboard(authCommandOneLiner);
    if (success) {
      setCopiedCommand(true);
      if (onShowToast) onShowToast("Terminal authorization command copied to clipboard!", "success");
      setTimeout(() => setCopiedCommand(false), 2000);
    }
  };

  const handleCopyPublicKey = async () => {
    if (!effectivePublicKey) return;
    const success = await copyToClipboard(effectivePublicKey);
    if (success) {
      setCopiedPublicKey(true);
      if (onShowToast) onShowToast("SSH Public Key copied to clipboard!", "success");
      setTimeout(() => setCopiedPublicKey(false), 2000);
    }
  };

  return (
    <div className="space-y-4">
      {/* RunPod API & Auto-Connect Card */}
      <RunpodPodManagerCard
        config={config}
        handleInputChange={handleInputChange}
        onShowToast={onShowToast}
        effectivePublicKey={effectivePublicKey}
        handleTestSSH={handleTestSSH}
      />

      {/* SSH Private & Public Key Management Card */}
      <div className="bg-white dark:bg-zinc-950/70 border-2 border-zinc-200 dark:border-zinc-800 p-4 rounded-xl space-y-3.5 shadow-xs transition-colors">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              <span>SSH Keypair (Remote GPU Required)</span>
            </label>
            {config.ssh_private_key ? (
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800/60 font-mono font-medium">
                {config.ssh_private_key.includes("ED25519") ? "Ed25519 Key Loaded" : config.ssh_private_key.includes("RSA") ? "RSA Key Loaded" : config.ssh_private_key.includes("ECDSA") ? "ECDSA Key Loaded" : "Key Loaded"}
              </span>
            ) : null}
          </div>

          {/* Key Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGenerateKeyPair}
              disabled={isGeneratingKeyPair}
              className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
              title="Generate a fresh Ed25519 keypair and display the public key for Remote GPU"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isGeneratingKeyPair ? "animate-spin" : ""}`} />
              Generate
            </button>
            {config.ssh_private_key && (
              <button
                type="button"
                onClick={() => handleInputChange("ssh_private_key", "")}
                className="px-2.5 py-1.5 text-xs font-medium bg-zinc-100 hover:bg-red-50 text-zinc-600 hover:text-red-600 border border-zinc-200 dark:bg-zinc-800 dark:hover:bg-red-900/50 dark:text-zinc-400 dark:hover:text-red-400 dark:border-transparent rounded-lg transition-colors cursor-pointer"
              >
                Clear key
              </button>
            )}
          </div>
        </div>

        {/* Private Key Textarea Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-600 dark:text-zinc-400">
              Paste your OpenSSH or PEM private key below, or click Generate to create a fresh Ed25519 keypair:
            </span>
            {config.ssh_private_key && (
              <span className="text-[10px] text-zinc-500 font-mono">
                {config.ssh_private_key.trim().split("\n").length} lines
              </span>
            )}
          </div>
          <textarea
            rows={3}
            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
            value={config.ssh_private_key || ""}
            onChange={(e) => handleInputChange("ssh_private_key", e.target.value)}
            className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-750 focus:border-blue-500 rounded-lg p-2.5 text-xs font-mono text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none transition-colors resize-y leading-relaxed"
            spellCheck={false}
          />
        </div>

        {/* Public Key & Terminal Command Action Bar */}
        <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/80 space-y-1.5">
          <label className="text-[11px] font-medium text-zinc-700 dark:text-zinc-400 block">
            Public Key &amp; Pod Terminal Authorization Command
          </label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              readOnly
              placeholder="Public key will appear here after clicking Generate..."
              value={effectivePublicKey}
              className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-emerald-700 dark:text-emerald-400 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none select-all"
            />
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyPublicKey}
                disabled={!effectivePublicKey}
                className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
                  copiedPublicKey
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow"
                    : "bg-zinc-800 hover:bg-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white shadow-xs"
                }`}
                title="Copy SSH Public Key"
              >
                {copiedPublicKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPublicKey ? "Copied Key!" : "Copy Public Key"}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyCommand}
                disabled={!effectivePublicKey}
                className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
                  copiedCommand
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs"
                }`}
                title="Copy terminal command to insert key into Pod's authorized_keys"
              >
                {copiedCommand ? <Check className="w-3.5 h-3.5" /> : <Terminal className="w-3.5 h-3.5" />}
                <span>{copiedCommand ? "Copied Command!" : "Copy Terminal Command"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible Manual Settings Section */}
      <div className="bg-white dark:bg-zinc-900/60 border-2 border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs transition-colors">
        {/* Accordion Header */}
        <button
          type="button"
          onClick={() => setIsManualCollapsed(!isManualCollapsed)}
          className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900/90 hover:bg-zinc-100 dark:hover:bg-zinc-850 flex items-center justify-between text-left transition-colors cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 shrink-0">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>Manual SSH Host &amp; ComfyUI Paths</span>
                {isManualCollapsed && (
                  <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    Click to Expand
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Direct host IP overrides, custom SSH ports, ComfyUI installation paths, and API proxy tokens.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {config.remote_host && (
              <span className="hidden sm:inline-flex text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700">
                {config.remote_host}:{config.ssh_port || 22}
              </span>
            )}
            <div className="p-1 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200">
              {isManualCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
        </button>

        {/* Accordion Body */}
        {!isManualCollapsed && (
          <div className="p-4 space-y-4 border-t border-zinc-200 dark:border-zinc-800">
            {/* Remote Host, SSH Port, Username & Password settings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Remote GPU IP */}
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                  Remote GPU Host / IP
                </label>
                <input
                  type="text"
                  placeholder="194.26.196.xxx"
                  value={config.remote_host || ""}
                  onChange={(e) => handleInputChange("remote_host", e.target.value)}
                  className="w-full bg-white dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none transition-colors shadow-2xs"
                />
              </div>

              {/* SSH Port */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">SSH Port</label>
                <input
                  type="number"
                  placeholder="22"
                  value={config.ssh_port || ""}
                  onChange={(e) => handleInputChange("ssh_port", parseInt(e.target.value) || 22)}
                  className="w-full bg-white dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none transition-colors shadow-2xs"
                />
              </div>

              {/* Username */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Username</label>
                <input
                  type="text"
                  placeholder="root"
                  value={config.ssh_username || ""}
                  onChange={(e) => handleInputChange("ssh_username", e.target.value)}
                  className="w-full bg-white dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none transition-colors shadow-2xs"
                />
              </div>

              {/* Password / Passphrase */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Password / Passphrase</label>
                <input
                  type="password"
                  placeholder="Optional root / key pass"
                  value={config.ssh_password || ""}
                  onChange={(e) => handleInputChange("ssh_password", e.target.value)}
                  className="w-full bg-white dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none transition-colors shadow-2xs"
                />
              </div>
            </div>

            {/* Remote ComfyUI Paths & Endpoints */}
            <ComfyUIConfig 
              config={config}
              handleInputChange={handleInputChange}
              onShowToast={onShowToast}
            />
          </div>
        )}
      </div>
    </div>
  );
};
