import React, { useState } from "react";
import { AppConfig } from "../types";
import { 
  Server, 
  Terminal, 
  Key, 
  Bot, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Info,
  ShieldCheck
} from "lucide-react";

interface ConfigSectionProps {
  config: AppConfig;
  onChange: (newConfig: AppConfig) => void;
}

export const ConfigSection: React.FC<ConfigSectionProps> = ({ config, onChange }) => {
  const [testingSSH, setTestingSSH] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

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
          host: config.runpod_ip,
          port: config.ssh_port,
          username: config.ssh_username,
          password: config.ssh_password,
          key_path: config.ssh_key_path
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

  return (
    <div id="config-section" className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 shadow-sm space-y-5">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">1. Infrastructure &amp; Remote Credentials</h2>
            <p className="text-xs text-zinc-400">Configure RunPod SSH instance, ComfyUI API endpoint, and local LM Studio server.</p>
          </div>
        </div>

        <button
          onClick={handleTestSSH}
          disabled={testingSSH || !config.runpod_ip}
          className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 border border-zinc-700 rounded-lg transition-colors flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${testingSSH ? "animate-spin text-indigo-400" : ""}`} />
          {testingSSH ? "Testing SSH..." : "Test RunPod SSH"}
        </button>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* RunPod IP */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-zinc-400" />
            RunPod IP / Host
          </label>
          <input
            type="text"
            placeholder="194.26.196.xxx"
            value={config.runpod_ip}
            onChange={(e) => handleInputChange("runpod_ip", e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
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
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">Username</label>
            <input
              type="text"
              placeholder="root"
              value={config.ssh_username}
              onChange={(e) => handleInputChange("ssh_username", e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
            />
          </div>
        </div>

        {/* SSH Password or Key */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-zinc-400" />
            SSH Password / Key Path
          </label>
          <input
            type="password"
            placeholder="Pod password or /root/.ssh/id_ed25519"
            value={config.ssh_password}
            onChange={(e) => handleInputChange("ssh_password", e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
          />
        </div>

        {/* LM Studio Local URL */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-amber-400" />
            Local LM Studio API URL
          </label>
          <input
            type="text"
            placeholder="http://localhost:1234/v1"
            value={config.lm_studio_url}
            onChange={(e) => handleInputChange("lm_studio_url", e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
        {/* ComfyUI API URL */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-emerald-400" />
            RunPod ComfyUI API URL
          </label>
          <input
            type="text"
            placeholder="http://127.0.0.1:8188 or https://pod-8188.proxy.runpod.net"
            value={config.comfyui_api_url}
            onChange={(e) => handleInputChange("comfyui_api_url", e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
          />
        </div>

        {/* RunPod API Token (for proxy auth) */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
            RunPod API Token (Optional Proxy Auth Header)
          </label>
          <input
            type="password"
            placeholder="Bearer token if using RunPod proxy endpoint"
            value={config.runpod_api_token}
            onChange={(e) => handleInputChange("runpod_api_token", e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
          />
        </div>
      </div>

      <div className="text-[11px] text-zinc-400 bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-800/60 flex items-center gap-2">
        <Info className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
        <span>During execution, media assets are pushed via Paramiko SCP into <code className="text-zinc-200 bg-zinc-800 px-1 py-0.5 rounded">/workspace/ComfyUI/input/</code>, and modified JSON graphs are submitted to <code className="text-zinc-200 bg-zinc-800 px-1 py-0.5 rounded">/prompt</code>.</span>
      </div>
    </div>
  );
};
