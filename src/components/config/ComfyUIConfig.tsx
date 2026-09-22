import React, { useState } from "react";
import { AppConfig } from "../../types";
import { settingsApi } from "../../api";
import { FolderOpen, Server, ShieldCheck, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

export interface ComfyUIConfigProps {
  config: AppConfig;
  handleInputChange: (field: keyof AppConfig, value: any) => void;
  onShowToast?: (msg: string, type: "success" | "error" | "info") => void;
}

export const ComfyUIConfig: React.FC<ComfyUIConfigProps> = ({ config, handleInputChange, onShowToast }) => {
  const [testingComfyUI, setTestingComfyUI] = useState(false);
  const [comfyTestResult, setComfyTestResult] = useState<{ success: boolean; message: string; systemInfo?: string } | null>(null);

  const inputDirValue = config.remote_comfyui_root
    ? `${config.remote_comfyui_root.replace(/\/$/, "")}/input/`
    : "/workspace/remote-slim/ComfyUI/input/";

  const handleTestComfyUI = async () => {
    setTestingComfyUI(true);
    setComfyTestResult(null);

    try {
      const data: any = await settingsApi.testComfyUI({ 
        comfyui_url: config.comfyui_api_url,
        url: config.comfyui_api_url, 
        comfyui_api_url: config.comfyui_api_url,
        token: config.remote_api_token,
        remote_api_token: config.remote_api_token
      });

      if (data && (data.success || data.status === "ok")) {
        setComfyTestResult({ success: true, message: data.message || "Connected successfully", systemInfo: data.systemInfo });
        if (onShowToast) {
          onShowToast("✓ ComfyUI connected successfully", "success");
        }
      } else {
        const errorMsg = data?.error || data?.message || "Connection failed";
        setComfyTestResult({ success: false, message: errorMsg });
        if (onShowToast) {
          onShowToast(`⚠ ComfyUI connection failed: ${errorMsg}`, "error");
        }
      }
    } catch (err: any) {
      const errorMsg = err.message || "Connection refused or endpoint unreachable";
      setComfyTestResult({ success: false, message: `Connection Failed: ${errorMsg}` });
      if (onShowToast) {
        onShowToast(`⚠ ComfyUI connection failed: ${errorMsg}`, "error");
      }
    } finally {
      setTestingComfyUI(false);
    }
  };

  return (
    <div className="space-y-4 pt-2 border-t border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
          Remote ComfyUI Paths &amp; Endpoints
        </h3>
        <button
          type="button"
          onClick={handleTestComfyUI}
          disabled={testingComfyUI}
          className="px-3 py-1.5 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 dark:hover:text-white border dark:border-zinc-700 dark:hover:border-zinc-600 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${testingComfyUI ? "animate-spin text-indigo-600 dark:text-indigo-400" : "text-zinc-500 dark:text-zinc-400"}`} />
          <span>{testingComfyUI ? "Testing..." : "Test ComfyUI"}</span>
        </button>
      </div>

      {comfyTestResult && (
        <div className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
          comfyTestResult.success 
            ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-300" 
            : "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800/40 text-red-900 dark:text-red-300"
        }`}>
          {comfyTestResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />}
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold">{comfyTestResult.success ? "Connected" : "Unreachable"}</span>
            <span className="opacity-90">{comfyTestResult.message}</span>
            {comfyTestResult.systemInfo && (
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400/80 mt-1">{comfyTestResult.systemInfo}</span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Remote ComfyUI Root Path */}
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            Remote ComfyUI Root Path
          </label>
          <input
            type="text"
            placeholder="/workspace/remote-slim/ComfyUI"
            value={config.remote_comfyui_root || "/workspace/remote-slim/ComfyUI"}
            onChange={(e) => handleInputChange("remote_comfyui_root", e.target.value)}
            className="w-full bg-white dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none transition-colors shadow-2xs"
          />
          <p className="text-[10px] text-zinc-500">The absolute directory path where ComfyUI is installed on the remote instance.</p>
        </div>

        {/* Remote ComfyUI Input Directory */}
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Remote ComfyUI Input Directory
          </label>
          <input
            type="text"
            placeholder="/workspace/remote-slim/ComfyUI/input/"
            value={inputDirValue}
            onChange={(e) => {
              const val = e.target.value;
              const rootPath = val.replace(/\/input\/?$/, "");
              handleInputChange("remote_comfyui_root", rootPath);
            }}
            className="w-full bg-white dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-700 focus:border-amber-500 rounded-lg px-3 py-2 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none transition-colors shadow-2xs"
          />
          <p className="text-[10px] text-zinc-500">Target input folder on remote server used for Paramiko SCP asset transfers.</p>
        </div>

        {/* Remote ComfyUI API URL */}
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Remote ComfyUI API URL
          </label>
          <input
            type="text"
            placeholder="http://127.0.0.1:8188 or https://pod-8188.proxy.remote.net"
            value={config.comfyui_api_url || ""}
            onChange={(e) => handleInputChange("comfyui_api_url", e.target.value)}
            className="w-full bg-white dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-700 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none transition-colors shadow-2xs"
          />
        </div>

        {/* Remote API Token (Optional Proxy Auth Header) */}
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
            Remote API Token (Optional Proxy Auth Header)
          </label>
          <input
            type="password"
            placeholder="Bearer token if using Remote GPU proxy endpoint"
            value={config.remote_api_token || ""}
            onChange={(e) => handleInputChange("remote_api_token", e.target.value)}
            className="w-full bg-white dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none transition-colors shadow-2xs"
          />
        </div>
      </div>
    </div>
  );
};

