import React, { useState } from "react";
import { AppConfig } from "../../types";
import { Terminal, Key, Sparkles, Copy, Check } from "lucide-react";
import { copyToClipboard } from "../../utils/clipboard";

export interface RemoteGPUConfigProps {
  config: AppConfig;
  handleInputChange: (field: keyof AppConfig, value: any) => void;
  handleGenerateKeyPair: () => void;
  isGeneratingKeyPair: boolean;
  generatedKeyPair?: { public_key: string; private_key: string } | null;
}

export const RemoteGPUConfig: React.FC<RemoteGPUConfigProps> = ({
  config,
  handleInputChange,
  handleGenerateKeyPair,
  isGeneratingKeyPair,
  generatedKeyPair
}) => {
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [copiedPublicKey, setCopiedPublicKey] = useState(false);

  const effectivePublicKey = generatedKeyPair?.public_key?.trim() || config.ssh_public_key?.trim() || "";
  const authCommandOneLiner = effectivePublicKey
    ? `mkdir -p ~/.ssh && echo "${effectivePublicKey}" >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys`
    : `mkdir -p ~/.ssh && echo "YOUR_PUBLIC_KEY" >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys`;

  const handleCopyCommand = async () => {
    const success = await copyToClipboard(authCommandOneLiner);
    if (success) {
      setCopiedCommand(true);
      setTimeout(() => setCopiedCommand(false), 2000);
    }
  };

  const handleCopyPublicKey = async () => {
    if (!effectivePublicKey) return;
    const success = await copyToClipboard(effectivePublicKey);
    if (success) {
      setCopiedPublicKey(true);
      setTimeout(() => setCopiedPublicKey(false), 2000);
    }
  };

  return (
    <div className="space-y-4">
      {/* Remote Host, SSH Port, Username & Password settings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Remote GPU IP */}
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-zinc-400" />
            Remote GPU Host / IP
          </label>
          <input
            type="text"
            placeholder="194.26.196.xxx"
            value={config.remote_host || ""}
            onChange={(e) => handleInputChange("remote_host", e.target.value)}
            className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
          />
        </div>

        {/* SSH Port */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">SSH Port</label>
          <input
            type="number"
            placeholder="22"
            value={config.ssh_port || ""}
            onChange={(e) => handleInputChange("ssh_port", parseInt(e.target.value) || 22)}
            className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
          />
        </div>

        {/* Username */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">Username</label>
          <input
            type="text"
            placeholder="root"
            value={config.ssh_username || ""}
            onChange={(e) => handleInputChange("ssh_username", e.target.value)}
            className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
          />
        </div>

        {/* Password / Passphrase */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">Password / Passphrase</label>
          <input
            type="password"
            placeholder="Optional root / key pass"
            value={config.ssh_password || ""}
            onChange={(e) => handleInputChange("ssh_password", e.target.value)}
            className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
          />
        </div>
      </div>

      {/* SSH Private Key Block on a new line below */}
      <div className="bg-zinc-950/70 border-2 border-zinc-750 p-3.5 rounded-xl space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>SSH Private Key (Remote GPU Required)</span>
            </label>
            {config.ssh_private_key ? (
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-mono">
                {config.ssh_private_key.includes("ED25519") ? "Ed25519 Key Loaded" : config.ssh_private_key.includes("RSA") ? "RSA Key Loaded" : config.ssh_private_key.includes("ECDSA") ? "ECDSA Key Loaded" : "Key Loaded"}
              </span>
            ) : null}
          </div>
          {/* In-App Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGenerateKeyPair}
              disabled={isGeneratingKeyPair}
              className="px-2.5 py-1 text-xs font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 rounded-lg shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
              title="Generate a fresh Ed25519 keypair and display the public key for Remote GPU"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isGeneratingKeyPair ? "animate-spin" : ""}`} />
              Generate
            </button>
            {config.ssh_private_key && (
              <button
                type="button"
                onClick={() => handleInputChange("ssh_private_key", "")}
                className="px-2.5 py-1 text-[10px] font-medium bg-zinc-800 hover:bg-red-900/50 hover:text-red-400 text-zinc-400 rounded transition-colors cursor-pointer"
              >
                Clear key
              </button>
            )}
          </div>
        </div>

        {/* Private Key Textarea Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">
              Paste your OpenSSH or PEM private key below, or click Generate to create a fresh Ed25519 keypair:
            </span>
            {config.ssh_private_key && (
              <span className="text-[10px] text-zinc-500 font-mono">
                {config.ssh_private_key.trim().split("\n").length} lines
              </span>
            )}
          </div>
          <textarea
            rows={4}
            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
            value={config.ssh_private_key || ""}
            onChange={(e) => handleInputChange("ssh_private_key", e.target.value)}
            className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-amber-500 rounded-lg p-2.5 text-xs font-mono text-zinc-200 placeholder-zinc-600 outline-none transition-colors resize-y leading-relaxed"
            spellCheck={false}
          />
        </div>

        {/* Public Key on a new line */}
        <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium text-zinc-400">Public Key</label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              placeholder="Public key will appear here after clicking Generate..."
              value={effectivePublicKey}
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs font-mono text-emerald-400 placeholder-zinc-600 outline-none select-all"
            />
            <button
              type="button"
              onClick={handleCopyPublicKey}
              disabled={!effectivePublicKey}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
                copiedPublicKey
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow"
                  : "bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
              }`}
              title="Copy SSH Public Key"
            >
              {copiedPublicKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedPublicKey ? "Copied!" : "Copy Public Key"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Pod Web Terminal command block (Duplicated directly under private key generator) */}
      <div className="bg-zinc-950/70 border-2 border-amber-900/40 rounded-xl p-3.5 space-y-2">
        {effectivePublicKey && (
          <div className="flex justify-end">
            <span className="text-[10px] text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 rounded-full font-mono">
              ✓ Public Key Filled In
            </span>
          </div>
        )}
        <p className="text-xs text-zinc-400">
          In your pod's <strong>Web Terminal</strong> (via the browser connect button on the Pod card), paste:
        </p>
        <div className="space-y-2">
          <div className="relative group bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden my-1.5">
            <div className="flex items-center justify-between px-3 py-1 bg-zinc-900/80 border-b border-zinc-800/80 text-[10px] font-mono text-zinc-400">
              <span>Pod Web Terminal (One-liner)</span>
              <button
                type="button"
                onClick={handleCopyCommand}
                className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer ${
                  copiedCommand 
                    ? "bg-emerald-950/80 text-emerald-300 border border-emerald-700/50" 
                    : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700"
                }`}
                title="Copy command to clipboard"
              >
                {copiedCommand ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCommand ? "Copied!" : "Copy"}</span>
              </button>
            </div>
            <pre className="p-3 text-xs font-mono text-emerald-400 overflow-x-auto whitespace-pre select-all">
              <code>{authCommandOneLiner}</code>
            </pre>
          </div>
          {!effectivePublicKey ? (
            <p className="text-[11px] text-zinc-400 italic">
              Replace <code className="text-amber-300 bg-zinc-800 px-1 py-0.5 rounded">YOUR_PUBLIC_KEY</code> with your single-line <code className="text-emerald-400">ssh-ed25519 AAAAC3...</code> string, or click <strong>Generate</strong> above.
            </p>
          ) : (
            <p className="text-[11px] text-emerald-400/90 font-medium">
              Your generated public key has been inserted into this command for easy one-click copying.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

