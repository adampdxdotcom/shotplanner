import React, { useState } from "react";
import { AppConfig, RunpodPodItem } from "../../types";
import { Cpu, RefreshCw, Check, AlertCircle, Zap, ShieldCheck } from "lucide-react";
import { RunpodPodStatsCard } from "./RunpodPodStatsCard";

interface RunpodPodManagerCardProps {
  config: AppConfig;
  handleInputChange: (field: keyof AppConfig, value: any) => void;
  onShowToast?: (text: string, type: "success" | "error" | "info") => void;
  effectivePublicKey?: string;
  handleTestSSH?: () => void;
}

export const RunpodPodManagerCard: React.FC<RunpodPodManagerCardProps> = ({
  config,
  handleInputChange,
  onShowToast,
  effectivePublicKey,
  handleTestSSH
}) => {
  const [apiKey, setApiKey] = useState<string>(config.runpod_api_key || "");
  const [isLoadingPods, setIsLoadingPods] = useState(false);
  const [pods, setPods] = useState<RunpodPodItem[]>([]);
  const [selectedPodId, setSelectedPodId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isRegisteringKey, setIsRegisteringKey] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const hasInitialFetchedRef = React.useRef(false);

  // Sync state if config.runpod_api_key changes externally
  React.useEffect(() => {
    if (config.runpod_api_key && config.runpod_api_key !== apiKey) {
      setApiKey(config.runpod_api_key);
    }
  }, [config.runpod_api_key]);

  const handleApiKeyChange = (val: string) => {
    setApiKey(val);
    handleInputChange("runpod_api_key", val);
  };

  const handleSaveApiKey = async () => {
    const cleanKey = apiKey.trim();
    if (!cleanKey) {
      setError("Please enter a valid RunPod API Key.");
      return;
    }
    setError(null);
    setSuccessMsg(null);
    try {
      handleInputChange("runpod_api_key", cleanKey);
      const res = await fetch("/api/settings/runpod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runpod_api_key: cleanKey })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("RunPod API Key saved to program settings!");
        onShowToast?.("RunPod API Key saved to program settings", "success");
        // Trigger immediate fetch upon saving key
        handleFetchPods(false);
      } else {
        throw new Error(data.error || "Failed to save key");
      }
    } catch (e: any) {
      setError(e.message || "Failed to save RunPod API Key.");
      onShowToast?.("Failed to save RunPod API Key", "error");
    }
  };

  const handleFetchPods = async (silent: boolean = false) => {
    const keyToUse = apiKey.trim() || config.runpod_api_key?.trim() || "";
    if (!keyToUse) {
      if (!silent) setError("Please enter a RunPod API Key first.");
      return;
    }
    if (!silent) setIsLoadingPods(true);
    if (!silent) {
      setError(null);
      setSuccessMsg(null);
    }

    try {
      const res = await fetch("/api/runpod/pods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runpod_api_key: keyToUse })
      });

      const data = await res.json();
      if (data.success) {
        const discoveredPods: RunpodPodItem[] = data.pods || [];
        setPods(discoveredPods);
        setLastSyncedAt(new Date());

        if (discoveredPods.length > 0) {
          if (!selectedPodId || !discoveredPods.some(p => p.id === selectedPodId)) {
            setSelectedPodId(discoveredPods[0].id);
          }

          // Auto-connect if enabled or if remote_host is missing
          const activePod = discoveredPods.find(p => p.id === selectedPodId) || discoveredPods[0];
          if (
            activePod &&
            activePod.ip &&
            (config.runpod_auto_connect || !config.remote_host || config.remote_host !== activePod.ip)
          ) {
            handleConnectPod(activePod, silent);
          } else if (!silent) {
            setSuccessMsg(`Found ${discoveredPods.length} active RunPod pod(s).`);
            onShowToast?.(`Discovered ${discoveredPods.length} RunPod pod(s)`, "success");
          }
        } else if (!silent) {
          setSuccessMsg("No active running pods found on your RunPod account.");
          onShowToast?.("No active pods found on RunPod", "info");
        }
      } else {
        throw new Error(data.error || "Failed to fetch pods");
      }
    } catch (err: any) {
      if (!silent) {
        setError(err.message || "Failed to connect to RunPod API");
        onShowToast?.(err.message || "RunPod query failed", "error");
      }
    } finally {
      if (!silent) setIsLoadingPods(false);
    }
  };

  // Phase 1: Auto-fetch on mount if key exists
  React.useEffect(() => {
    if (!hasInitialFetchedRef.current && (apiKey.trim() || config.runpod_api_key?.trim())) {
      hasInitialFetchedRef.current = true;
      handleFetchPods(true);
    }
  }, [apiKey, config.runpod_api_key]);

  // Phase 1: Periodic 15-second background auto-refresh
  React.useEffect(() => {
    if (!autoSyncEnabled || !(apiKey.trim() || config.runpod_api_key?.trim())) return;
    const interval = setInterval(() => {
      handleFetchPods(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [autoSyncEnabled, apiKey, config.runpod_api_key, selectedPodId, config.remote_host]);

  const handleConnectPod = (pod: RunpodPodItem, silent: boolean = false) => {
    if (!pod) return;

    if (pod.ip) {
      handleInputChange("remote_host", pod.ip);
    }
    if (pod.sshPort) {
      handleInputChange("ssh_port", pod.sshPort);
    }
    if (pod.comfyUrl) {
      handleInputChange("comfyui_api_url", pod.comfyUrl);
    }

    const msg = `Connected Pod '${pod.name}': Host ${pod.ip}:${pod.sshPort}, ComfyUI ${pod.comfyUrl}`;
    if (!silent) {
      setSuccessMsg(msg);
      onShowToast?.(`Connected Pod '${pod.name}' (${pod.ip}:${pod.sshPort})`, "success");
    }

    // Trigger live SSH test immediately when connected
    if (handleTestSSH && pod.ip) {
      setTimeout(() => handleTestSSH(), 300);
    }
  };

  const handleRegisterAccountKey = async () => {
    if (!effectivePublicKey) {
      setError("No SSH public key found. Click 'Generate' under SSH Private Key first.");
      return;
    }

    const targetHost = config.remote_host || activeSelectedPod?.ip || "";

    setIsRegisteringKey(true);
    setError(null);
    setSuccessMsg(null);

    try {
      // 1. Always copy key to clipboard for easy account-level pasting in RunPod Console
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(effectivePublicKey.trim());
      }

      if (targetHost) {
        // Push key directly to the active pod over SSH
        const res = await fetch("/api/runpod/add-key", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            public_key: effectivePublicKey.trim(),
            remote_host: targetHost,
            ssh_port: config.ssh_port || 22,
            ssh_password: config.ssh_password || ""
          })
        });

        const data = await res.json();
        if (data.success) {
          setSuccessMsg(`SSH Key authorized on Pod (${targetHost}) & copied to clipboard!`);
          onShowToast?.("SSH Key authorized on Pod & copied to clipboard!", "success");
        } else {
          throw new Error(data.error || "Failed to authorize SSH Key on Pod");
        }
      } else {
        setSuccessMsg("Public SSH Key copied to clipboard! Paste it into RunPod Console → Settings → SSH Public Keys.");
        onShowToast?.("SSH Key copied to clipboard for RunPod Console!", "info");
      }
    } catch (err: any) {
      setError(err.message || "Key push failed. Public key copied to clipboard for manual paste.");
      onShowToast?.(err.message || "Key push failed", "error");
    } finally {
      setIsRegisteringKey(false);
    }
  };

  const activeSelectedPod = pods.find(p => p.id === selectedPodId) || (pods.length > 0 ? pods[0] : null);

  return (
    <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-4 shadow-sm transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
              RunPod API &amp; Auto-Sync
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Auto-detect running pods, fetch host IP &amp; mapped SSH/HTTP ports, and register SSH account keys.
            </p>
          </div>
        </div>

        {effectivePublicKey && (
          <button
            type="button"
            onClick={handleRegisterAccountKey}
            disabled={isRegisteringKey}
            className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs self-start sm:self-auto shrink-0"
            title="Push SSH key directly to target running pod, and copy to clipboard for RunPod account settings"
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${isRegisteringKey ? "animate-spin" : ""}`} />
            <span>{isRegisteringKey ? "Pushing Key..." : "Authorize Key on Pod"}</span>
          </button>
        )}
      </div>

      {/* API Key Input & Action Buttons Row */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-7 space-y-1.5">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            RunPod API Key
          </label>
          <input
            type="password"
            placeholder="rpk_..."
            value={apiKey}
            onChange={(e) => handleApiKeyChange(e.target.value)}
            className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none transition-colors"
          />
        </div>

        <div className="sm:col-span-5 flex items-end gap-2">
          <button
            type="button"
            onClick={handleSaveApiKey}
            disabled={!apiKey.trim()}
            className="px-3 py-2 text-xs font-bold bg-zinc-800 hover:bg-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 disabled:opacity-50 text-white rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shrink-0"
            title="Save RunPod API Key to program settings"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save Key</span>
          </button>

          <button
            type="button"
            onClick={() => handleFetchPods(false)}
            disabled={isLoadingPods || !apiKey.trim()}
            className="flex-1 py-2 px-3 text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPods ? "animate-spin" : ""}`} />
            <span>{isLoadingPods ? "Fetching..." : "Fetch Pods"}</span>
          </button>
        </div>
      </div>

      {/* Auto-Connect & Auto-Sync Toggle Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
        <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!!config.runpod_auto_connect}
            onChange={(e) => handleInputChange("runpod_auto_connect", e.target.checked)}
            className="w-3.5 h-3.5 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <span className="font-medium">Auto-connect to active pod on discovery</span>
        </label>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoSyncEnabled}
              onChange={(e) => setAutoSyncEnabled(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-zinc-300 dark:border-zinc-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            <span>Auto-refresh (15s)</span>
          </label>

          {lastSyncedAt && (
            <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
              Synced {lastSyncedAt.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Status Notifications */}
      {error && (
        <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && !error && (
        <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Active Pods List & Connector */}
      {pods.length > 0 && (
        <div className="bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Discovered Active Pods ({pods.length})</span>
            </span>
            {autoSyncEnabled && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Live Sync Active
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2">
            <select
              value={selectedPodId}
              onChange={(e) => setSelectedPodId(e.target.value)}
              className="flex-1 w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-zinc-200 outline-none focus:border-blue-500 font-mono"
            >
              {pods.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.desiredStatus}] {p.name} - IP: {p.ip || "resolving..."}:{p.sshPort || 22} {p.comfyUrl ? `(ComfyUI: ${p.comfyUrl})` : ""}
                </option>
              ))}
            </select>

            {activeSelectedPod && (
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                <button
                  type="button"
                  onClick={() => handleConnectPod(activeSelectedPod, false)}
                  className="flex-1 sm:flex-none px-3.5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Connect Pod</span>
                </button>

                {handleTestSSH && (
                  <button
                    type="button"
                    onClick={handleTestSSH}
                    className="px-3 py-2 text-xs font-semibold bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                    title="Test SSH connection to current remote host"
                  >
                    <span>Test SSH</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Detailed Selected Pod Hardware & Container Stats Card */}
          {activeSelectedPod && (
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <RunpodPodStatsCard
                pod={activeSelectedPod}
                isConnected={config.remote_host === activeSelectedPod.ip}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
