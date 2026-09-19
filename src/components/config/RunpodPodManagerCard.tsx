import React, { useState } from "react";
import { AppConfig, RunpodPodItem } from "../../types";
import { Cpu, RefreshCw, Check, CheckCircle2, AlertCircle, Zap } from "lucide-react";
import { RunpodPodStatsCard } from "./RunpodPodStatsCard";

interface RunpodPodManagerCardProps {
  config: AppConfig;
  handleInputChange: (field: keyof AppConfig, value: any) => void;
  onShowToast?: (text: string, type: "success" | "error" | "info") => void;
  effectivePublicKey?: string;
}

type ConnectionStatus = "untested" | "testing" | "connected" | "error";

export const RunpodPodManagerCard: React.FC<RunpodPodManagerCardProps> = ({
  config,
  handleInputChange,
  onShowToast,
  effectivePublicKey
}) => {
  const [apiKey, setApiKey] = useState<string>(config.runpod_api_key || "");
  const [isLoadingPods, setIsLoadingPods] = useState(false);
  const [pods, setPods] = useState<RunpodPodItem[]>([]);
  const [selectedPodId, setSelectedPodId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("untested");
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
    setConnectionStatus("untested");
    setError(null);
  };

  const handleTestApiConnection = async () => {
    const keyToUse = apiKey.trim() || config.runpod_api_key?.trim() || "";
    if (!keyToUse) {
      setError("Please enter a valid RunPod API Key first.");
      setConnectionStatus("error");
      onShowToast?.("Missing RunPod API Key", "error");
      return;
    }

    setConnectionStatus("testing");
    setError(null);
    setSuccessMsg(null);

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
        setConnectionStatus("connected");

        if (discoveredPods.length > 0) {
          if (!selectedPodId || !discoveredPods.some(p => p.id === selectedPodId)) {
            setSelectedPodId(discoveredPods[0].id);
          }
          const activePod = discoveredPods.find(p => p.id === selectedPodId) || discoveredPods[0];
          if (
            activePod &&
            activePod.ip &&
            (config.runpod_auto_connect || !config.remote_host || config.remote_host !== activePod.ip)
          ) {
            handleConnectPod(activePod, true);
          }
          setSuccessMsg(`RunPod API Connected! Discovered ${discoveredPods.length} active pod(s).`);
          onShowToast?.(`API Connected! Found ${discoveredPods.length} active pod(s)`, "success");
        } else {
          setSuccessMsg("RunPod API Connected! No active running pods found on your account.");
          onShowToast?.("API Connected (No active pods found)", "info");
        }
      } else {
        throw new Error(data.error || "Failed to connect to RunPod API");
      }
    } catch (err: any) {
      setConnectionStatus("error");
      setError(err.message || "Connection Error: Failed to reach RunPod API");
      onShowToast?.(err.message || "RunPod Connection Error", "error");
    }
  };

  const handleSaveApiKey = async () => {
    const cleanKey = apiKey.trim();
    if (!cleanKey) {
      setError("Please enter a valid RunPod API Key.");
      setConnectionStatus("error");
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
        // Trigger immediate fetch & test upon saving key
        handleFetchPods(false);
      } else {
        throw new Error(data.error || "Failed to save key");
      }
    } catch (e: any) {
      setError(e.message || "Failed to save RunPod API Key.");
      setConnectionStatus("error");
      onShowToast?.("Failed to save RunPod API Key", "error");
    }
  };

  const handleFetchPods = async (silent: boolean = false) => {
    const keyToUse = apiKey.trim() || config.runpod_api_key?.trim() || "";
    if (!keyToUse) {
      if (!silent) {
        setError("Please enter a RunPod API Key first.");
        setConnectionStatus("error");
      }
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
        setConnectionStatus("connected");

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
        setConnectionStatus("error");
        setError(err.message || "Failed to connect to RunPod API");
        onShowToast?.(err.message || "RunPod query failed", "error");
      }
    } finally {
      if (!silent) setIsLoadingPods(false);
    }
  };

  // Auto-fetch on mount if key exists
  React.useEffect(() => {
    if (!hasInitialFetchedRef.current && (apiKey.trim() || config.runpod_api_key?.trim())) {
      hasInitialFetchedRef.current = true;
      handleFetchPods(true);
    }
  }, [apiKey, config.runpod_api_key]);

  // Periodic 15-second background auto-refresh via Server-Sent Events (SSE) background push
  React.useEffect(() => {
    const keyToUse = apiKey.trim() || config.runpod_api_key?.trim() || "";
    if (!autoSyncEnabled || !keyToUse) return;

    const eventSource = new EventSource(`/api/runpod/events?apiKey=${encodeURIComponent(keyToUse)}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.success && Array.isArray(data.pods)) {
          const discoveredPods: RunpodPodItem[] = data.pods;
          setPods(discoveredPods);
          setLastSyncedAt(new Date());
          setConnectionStatus("connected");

          if (discoveredPods.length > 0) {
            setSelectedPodId((prev) => {
              if (!prev || !discoveredPods.some(p => p.id === prev)) {
                return discoveredPods[0].id;
              }
              return prev;
            });

            // Auto-connect if enabled
            const activePod = discoveredPods.find(p => p.id === selectedPodId) || discoveredPods[0];
            if (
              activePod &&
              activePod.ip &&
              (config.runpod_auto_connect || !config.remote_host || config.remote_host !== activePod.ip)
            ) {
              handleConnectPod(activePod, true);
            }
          }
        } else if (data.error) {
          setError(data.error);
        }
      } catch (e) {
        console.error("Failed to parse SSE event data", e);
      }
    };

    eventSource.onerror = (err) => {
      console.warn("RunPod Live Sync connection lost, reconnecting...", err);
    };

    return () => {
      eventSource.close();
    };
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
  };

  const activeSelectedPod = pods.find(p => p.id === selectedPodId) || (pods.length > 0 ? pods[0] : null);
  const hasApiKey = Boolean(apiKey.trim() || config.runpod_api_key?.trim());

  return (
    <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-4 shadow-xs transition-colors">
      {/* Card Header & Dynamic Status Action Button */}
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
              Auto-detect running pods, fetch host IP &amp; mapped SSH/HTTP ports, and monitor instance health.
            </p>
          </div>
        </div>

        {/* Dynamic Connection Status Button */}
        <button
          type="button"
          onClick={handleTestApiConnection}
          disabled={!hasApiKey || connectionStatus === "testing"}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-xs self-start sm:self-auto shrink-0 ${
            !hasApiKey
              ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed opacity-60"
              : connectionStatus === "connected"
              ? "bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
              : connectionStatus === "error"
              ? "bg-red-600 hover:bg-red-500 text-white cursor-pointer"
              : connectionStatus === "testing"
              ? "bg-amber-600 text-white opacity-90 cursor-wait"
              : "bg-amber-600 hover:bg-amber-500 text-white cursor-pointer"
          }`}
          title={
            !hasApiKey
              ? "Enter a RunPod API key first to enable connection testing"
              : "Click to test RunPod API key & server connectivity"
          }
        >
          {connectionStatus === "testing" ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : connectionStatus === "connected" ? (
            <CheckCircle2 className="w-3.5 h-3.5" />
          ) : connectionStatus === "error" ? (
            <AlertCircle className="w-3.5 h-3.5" />
          ) : (
            <Zap className="w-3.5 h-3.5" />
          )}
          <span>
            {connectionStatus === "testing"
              ? "Testing Connection..."
              : connectionStatus === "connected"
              ? "API Connected"
              : connectionStatus === "error"
              ? "Connection Error"
              : "Test API Connection"}
          </span>
        </button>
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

      {/* Status Notifications & Error Display below API key entry */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border-2 border-red-200 dark:border-red-800/60 text-xs text-red-800 dark:text-red-300 flex items-start gap-2.5 font-medium shadow-2xs">
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">Connection Error</p>
            <p className="text-[11px] opacity-90">{error}</p>
          </div>
        </div>
      )}

      {successMsg && !error && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5 font-medium shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">Connection Verified</p>
            <p className="text-[11px] opacity-90">{successMsg}</p>
          </div>
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
