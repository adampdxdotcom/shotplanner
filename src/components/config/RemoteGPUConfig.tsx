import React from "react";
import { AppConfig } from "../../types";
import { Terminal, Key, Sparkles } from "lucide-react";

export interface RemoteGPUConfigProps {
  config: AppConfig;
  handleInputChange: (field: keyof AppConfig, value: any) => void;
  handleGenerateKeyPair: () => void;
  isGeneratingKeyPair: boolean;
}

export const RemoteGPUConfig: React.FC<RemoteGPUConfigProps> = ({
  config,
  handleInputChange,
  handleGenerateKeyPair,
  isGeneratingKeyPair
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Remote GPU IP */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-zinc-400" />
          Remote GPU Host / IP
        </label>
        <input
          type="text"
          placeholder="194.26.196.xxx"
          value={config.remote_host}
          onChange={(e) => handleInputChange("remote_host", e.target.value)}
          className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
        />
      </div>

      {/* SSH Port & Username */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">SSH Port</label>
          <input
            type="number"
            placeholder="22"
            value={config.ssh_port}
            onChange={(e) => handleInputChange("ssh_port", parseInt(e.target.value) || 22)}
            className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">Username</label>
          <input
            type="text"
            placeholder="root"
            value={config.ssh_username}
            onChange={(e) => handleInputChange("ssh_username", e.target.value)}
            className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
          />
        </div>
      </div>

      {/* SSH Private Key or Password */}
      <div className="space-y-1.5 md:col-span-2 bg-zinc-950/70 border-2 border-zinc-750 p-3.5 rounded-xl">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>SSH Private Key (Remote GPU Required)</span>
            </label>
            {config.ssh_private_key ? (
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-mono">
                {config.ssh_private_key.includes("ED25519") ? "Ed25519 Key Loaded" : config.ssh_private_key.includes("RSA") ? "RSA Key Loaded" : "Key Loaded"}
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
      </div>
    </div>
  );
};
