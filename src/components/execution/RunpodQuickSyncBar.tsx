import React, { useState } from "react";
import { AppConfig, RunpodPodItem } from "../../types";
import { Zap, RefreshCw, ShieldCheck, Check, AlertCircle, Server } from "lucide-react";

interface RunpodQuickSyncBarProps {
  config: AppConfig;
  onUpdateConfig?: (newConfig: AppConfig) => void;
  onShowToast?: (text: string, type: "success" | "error" | "info") => void;
}

export const RunpodQuickSyncBar: React.FC<RunpodQuickSyncBarProps> = ({
  config,
  onUpdateConfig,
  onShowToast
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [pods, setPods] = useState<RunpodPodItem[]>([]);
  const [showPodPicker, setShowPodPicker] = useState(false);
  const [selectedPodId, setSelectedPodId] = useState<string>("");
  const [isRegisteringKey, setIsRegisteringKey] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<"success" | "error" | null>(null);

  const apiKey = config.runpod_api_key?.trim() || "";

  const handleSyncRunpod = async () => {
    if (!apiKey) {
      onShowToast?.("Please add your RunPod API Key in Settings first.", "info");
      return;
    }

    setIsSyncing(true);
    setStatusMsg(null);
    setStatusType(null);

    try {
      const res = await fetch("/api/runpod/pods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runpod_api_key: apiKey })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch active pods");
      }

      const activePods: RunpodPodItem[] = data.pods || [];
      setPods(activePods);

      if (activePods.length === 0) {
        setStatusMsg("No active running pods found on RunPod.");
        setStatusType("error");
        onShowToast?.("No active pods found on your RunPod account.", "info");
        return;
      }

      if (activePods.length === 1) {
        applyPodConnection(activePods[0]);
      } else {
        setSelectedPodId(activePods[0].id);
        setShowPodPicker(true);
        setStatusMsg(`Discovered ${activePods.length} active pods. Select one below.`);
        setStatusType("success");
      }
    } catch (err: any) {
      setStatusMsg(err.message || "Failed to query RunPod");
      setStatusType("error");
      onShowToast?.(err.message || "RunPod sync failed", "error");
    } finally {
      setIsSyncing(false);
    }
  };

  const applyPodConnection = (pod: RunpodPodItem) => {
    if (!pod) return;

    const newConfig: AppConfig = {
      ...config,
      remote_host: pod.ip || config.remote_host,
      ssh_port: pod.sshPort || config.ssh_port,
      comfyui_api_url: pod.comfyUrl || config.comfyui_api_url
    };

    onUpdateConfig?.(newConfig);

    const label = `Connected to RunPod '${pod.name}' (${pod.ip}:${pod.sshPort})`;
    setStatusMsg(label);
    setStatusType("success");
    setShowPodPicker(false);
    onShowToast?.(label, "success");
  };

  const handleRegisterKey = async () => {
    if (!apiKey) {
      onShowToast?.("RunPod API Key is required.", "error");
      return;
    }
    const pubKey = config.ssh_public_key || config.ssh_private_key;
    if (!pubKey) {
      onShowToast?.("No public SSH key found. Generate one in Settings first.", "error");
      return;
    }

    setIsRegisteringKey(true);
    try {
      const res = await fetch("/api/runpod/add-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runpod_api_key: apiKey,
          public_key: pubKey.trim()
        })
      });

      const data = await res.json();
      if (data.success) {
        onShowToast?.("SSH Key registered to RunPod account!", "success");
      } else {
        throw new Error(data.error || "Failed to register key");
      }
    } catch (err: any) {
      onShowToast?.(err.message || "Key registration failed", "error");
    } finally {
      setIsRegisteringKey(false);
    }
  };

  if (!apiKey) {
    return null;
  }

  const selectedPod = pods.find((p) => p.id === selectedPodId) || pods[0];

  return (
    <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-xs space-y-2 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Active Pod Info */}
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs">
            <span className="font-bold text-zinc-900 dark:text-zinc-200 flex items-center gap-1.5">
              <span>RunPod Connection</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </span>
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded text-blue-700 dark:text-blue-300 border border-zinc-200 dark:border-zinc-700/60 flex items-center gap-1">
                <Server className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                {config.remote_host || "No Host"}:{config.ssh_port || 22}
              </span>
              <span className="bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded text-teal-700 dark:text-cyan-300 border border-zinc-200 dark:border-zinc-700/60 truncate max-w-[200px]">
                {config.comfyui_api_url || "No ComfyUI URL"}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRegisterKey}
            disabled={isRegisteringKey}
            className="px-2.5 py-1.5 text-[11px] font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 dark:border-zinc-700 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
            title="Register app SSH key with RunPod account"
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${isRegisteringKey ? "animate-spin" : ""}`} />
            <span className="hidden md:inline">{isRegisteringKey ? "Registering..." : "Account Key"}</span>
          </button>

          <button
            type="button"
            onClick={handleSyncRunpod}
            disabled={isSyncing}
            className="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            title="Query RunPod API for live running pod and auto-update IP & ports"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Syncing..." : "Sync RunPod"}</span>
          </button>
        </div>
      </div>

      {/* Status Feedback */}
      {statusMsg && (
        <div className={`text-[11px] px-2.5 py-1 rounded-md flex items-center gap-1.5 ${
          statusType === "error"
            ? "bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/50"
            : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50"
        }`}>
          {statusType === "error" ? (
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" />
          ) : (
            <Check className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
          )}
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Multiple Pods Picker Dropdown */}
      {showPodPicker && pods.length > 1 && (
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-1 border-t border-zinc-200 dark:border-zinc-800">
          <select
            value={selectedPodId}
            onChange={(e) => setSelectedPodId(e.target.value)}
            className="flex-1 w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-200 outline-none font-mono focus:border-blue-500"
          >
            {pods.map((p) => (
              <option key={p.id} value={p.id}>
                [{p.desiredStatus}] {p.name} - {p.ip}:{p.sshPort} ({p.comfyUrl})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => selectedPod && applyPodConnection(selectedPod)}
            className="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg cursor-pointer shrink-0"
          >
            Connect Selected Pod
          </button>
        </div>
      )}
    </div>
  );
};
