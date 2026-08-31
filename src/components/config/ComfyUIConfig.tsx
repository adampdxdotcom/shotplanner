import React from "react";
import { AppConfig } from "../../types";
import { FolderOpen, Server, ShieldCheck, Bot } from "lucide-react";

export interface ComfyUIConfigProps {
  config: AppConfig;
  handleInputChange: (field: keyof AppConfig, value: any) => void;
}

export const ComfyUIConfig: React.FC<ComfyUIConfigProps> = ({ config, handleInputChange }) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* LM Studio Local URL */}
        <div className="space-y-1.5 md:col-span-4 lg:col-span-2 lg:col-start-3">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-amber-400" />
            Local LM Studio API URL
          </label>
          <input
            type="text"
            placeholder="http://localhost:1234/v1"
            value={config.lm_studio_url}
            onChange={(e) => handleInputChange("lm_studio_url", e.target.value)}
            className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
        {/* Remote ComfyUI Input Directory */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
            Remote ComfyUI Input Dir
          </label>
          <input
            type="text"
            placeholder="/workspace/remote-slim/ComfyUI/input/"
            value={config.remote_comfyui_root || ""}
            onChange={(e) => handleInputChange("remote_comfyui_root", e.target.value)}
            className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-amber-500 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
          />
        </div>

        {/* Remote ComfyUI Root Path */}
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-zinc-400" />
            Remote ComfyUI Root Path
          </label>
          <input
            type="text"
            placeholder="/workspace/remote-slim/ComfyUI"
            value={config.remote_comfyui_root || "/workspace/remote-slim/ComfyUI"}
            onChange={(e) => handleInputChange("remote_comfyui_root", e.target.value)}
            className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
          />
          <p className="text-[10px] text-zinc-500 mt-1">The absolute directory path where ComfyUI is installed on the remote instance.</p>
        </div>

        {/* ComfyUI API URL */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-emerald-400" />
            Remote ComfyUI API URL
          </label>
          <input
            type="text"
            placeholder="http://127.0.0.1:8188 or https://pod-8188.proxy.remote.net"
            value={config.comfyui_api_url}
            onChange={(e) => handleInputChange("comfyui_api_url", e.target.value)}
            className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
          />
        </div>

        {/* Remote API Token (for proxy auth) */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
            Remote API Token (Optional Proxy Auth Header)
          </label>
          <input
            type="password"
            placeholder="Bearer token if using Remote GPU proxy endpoint"
            value={config.remote_api_token}
            onChange={(e) => handleInputChange("remote_api_token", e.target.value)}
            className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
          />
        </div>
      </div>
    </div>
  );
};
