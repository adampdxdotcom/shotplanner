import React, { useState } from "react";
import { AppConfig, RunpodPodItem, RunpodWatcherItem } from "../../types";
import { settingsApi } from "../../api";
import {
  Cpu,
  RefreshCw,
  Check,
  CheckCircle2,
  AlertCircle,
  Zap,
  Trash2,
  PlusCircle,
  Layers,
  Server,
  Radio,
  Play,
  Square,
  HardDrive,
  Globe,
  Terminal,
  ExternalLink
} from "lucide-react";
import { RunpodPodStatsCard } from "./RunpodPodStatsCard";
import { RunpodDeployPodPanel } from "./RunpodDeployPodPanel";
import { RunpodWatchersCard } from "./RunpodWatchersCard";

interface RunpodPodManagerCardProps {
  config: AppConfig;
  handleInputChange: (field: keyof AppConfig, value: any) => void;
  onBatchUpdateConfig?: (updates: Partial<AppConfig>) => void;
  onShowToast?: (text: string, type: "success" | "error" | "info") => void;
  effectivePublicKey?: string;
}

type ConnectionStatus = "untested" | "testing" | "connected" | "error";
type CardViewMode = "pods" | "deploy" | "watchers";

export const RunpodPodManagerCard: React.FC<RunpodPodManagerCardProps> = ({
  config,
  handleInputChange,
  onBatchUpdateConfig,
  onShowToast,
  effectivePublicKey
}) => {
  const [apiKey, setApiKey] = useState<string>(config.runpod_api_key || "");
  const [viewMode, setViewMode] = useState<CardViewMode>("pods");
  const [isLoadingPods, setIsLoadingPods] = useState(false);
  const [pods, setPods] = useState<RunpodPodItem[]>([]);
  const [watchers, setWatchers] = useState<RunpodWatcherItem[]>([]);
  const [selectedPodId, setSelectedPodId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("untested");
  const [actionInProgressPodId, setActionInProgressPodId] = useState<string | null>(null);
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
      const [podsData, watchersData] = await Promise.all([
        settingsApi.getRunpodPods(keyToUse),
        settingsApi.getRunpodWatchers(keyToUse).catch(() => ({ success: true, watchers: [] }))
      ]);

      if (podsData && podsData.success) {
        const discoveredPods: RunpodPodItem[] = podsData.pods || [];
        setPods(discoveredPods);
        if (watchersData && watchersData.success && Array.isArray(watchersData.watchers)) {
          setWatchers(watchersData.watchers);
        }
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
          setSuccessMsg(`RunPod API Connected! Discovered ${discoveredPods.length} pod(s).`);
          onShowToast?.(`API Connected! Found ${discoveredPods.length} pod(s)`, "success");
        } else {
          setSuccessMsg("RunPod API Connected! No active pods currently running.");
          onShowToast?.("API Connected (No active pods)", "info");
        }
      } else {
        throw new Error(podsData?.error || "Failed to connect to RunPod API");
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
      const data: any = await settingsApi.saveRunpodKey(cleanKey);
      if (data && (data.success || data.message)) {
        setSuccessMsg("RunPod API Key saved to program settings!");
        onShowToast?.("RunPod API Key saved to program settings", "success");
        handleFetchPods(false);
      } else {
        throw new Error(data?.error || "Failed to save key");
      }
    } catch (e: any) {
      setError(e.message || "Failed to save RunPod API Key.");
      setConnectionStatus("error");
      onShowToast?.("Failed to save RunPod API Key", "error");
    }
  };

  const handleRemoveApiKey = async () => {
    setError(null);
    setSuccessMsg(null);
    try {
      setApiKey("");
      handleInputChange("runpod_api_key", "");
      setPods([]);
      setWatchers([]);
      setConnectionStatus("untested");
      const data: any = await settingsApi.deleteRunpodKey().catch(() => ({ success: true }));
      if (data && (data.success || data.message)) {
        setSuccessMsg("RunPod API Key removed from settings.");
        onShowToast?.("RunPod API Key removed", "info");
      }
    } catch (e: any) {
      setError(e.message || "Failed to remove RunPod API Key.");
      onShowToast?.("Failed to remove RunPod API Key", "error");
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
      const [podsData, watchersData] = await Promise.all([
        settingsApi.getRunpodPods(keyToUse),
        settingsApi.getRunpodWatchers(keyToUse).catch(() => ({ success: true, watchers: [] }))
      ]);

      if (podsData && podsData.success) {
        const discoveredPods: RunpodPodItem[] = podsData.pods || [];
        setPods(discoveredPods);
        if (watchersData && watchersData.success && Array.isArray(watchersData.watchers)) {
          setWatchers(watchersData.watchers);
        }
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
            handleConnectPod(activePod, silent);
          } else if (!silent) {
            setSuccessMsg(`Discovered ${discoveredPods.length} RunPod pod(s).`);
            onShowToast?.(`Discovered ${discoveredPods.length} RunPod pod(s)`, "success");
          }
        } else if (!silent) {
          setSuccessMsg("No active pods found on your RunPod account.");
          onShowToast?.("No active pods found on RunPod", "info");
        }
      } else {
        throw new Error(podsData?.error || "Failed to fetch pods");
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

  const handleFetchWatchers = async () => {
    const keyToUse = apiKey.trim() || config.runpod_api_key?.trim() || "";
    if (!keyToUse) return;
    try {
      const res = await settingsApi.getRunpodWatchers(keyToUse);
      if (res && res.success && Array.isArray(res.watchers)) {
        setWatchers(res.watchers);
      }
    } catch (e) {
      console.warn("Failed to fetch watchers", e);
    }
  };

  // Quick action from multi-pod card list
  const handleQuickResumePod = async (pod: RunpodPodItem) => {
    setActionInProgressPodId(pod.id);
    try {
      const res = await settingsApi.startRunpodPod(pod.id, { runpod_api_key: apiKey });
      if (res && res.success) {
        onShowToast?.(`Resuming '${pod.name}'...`, "success");
        handleFetchPods(true);
      } else {
        throw new Error(res?.error || "Failed to resume pod");
      }
    } catch (err: any) {
      onShowToast?.(err.message || "Failed to resume pod", "error");
    } finally {
      setActionInProgressPodId(null);
    }
  };

  const handleQuickStopPod = async (pod: RunpodPodItem) => {
    setActionInProgressPodId(pod.id);
    try {
      const res = await settingsApi.stopRunpodPod(pod.id, { runpod_api_key: apiKey });
      if (res && res.success) {
        onShowToast?.(`Pod '${pod.name}' paused. Storage preserved.`, "info");
        handleFetchPods(true);
      } else {
        throw new Error(res?.error || "Failed to pause pod");
      }
    } catch (err: any) {
      onShowToast?.(err.message || "Failed to pause pod", "error");
    } finally {
      setActionInProgressPodId(null);
    }
  };

  // Auto-fetch on mount if key exists
  React.useEffect(() => {
    if (!hasInitialFetchedRef.current && (apiKey.trim() || config.runpod_api_key?.trim())) {
      hasInitialFetchedRef.current = true;
      handleFetchPods(true);
    }
  }, [apiKey, config.runpod_api_key]);

  // Periodic 15-second background auto-refresh via Server-Sent Events (SSE)
  React.useEffect(() => {
    const keyToUse = apiKey.trim() || config.runpod_api_key?.trim() || "";
    if (!autoSyncEnabled || !keyToUse) return;

    const eventSource = new EventSource(`/api/runpod/events?apiKey=${encodeURIComponent(keyToUse)}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.success) {
          if (Array.isArray(data.pods)) {
            const discoveredPods: RunpodPodItem[] = data.pods;
            setPods(discoveredPods);
            if (discoveredPods.length > 0) {
              setSelectedPodId((prev) => {
                if (!prev || !discoveredPods.some(p => p.id === prev)) {
                  return discoveredPods[0].id;
                }
                return prev;
              });

              const activePod = discoveredPods.find(p => p.id === selectedPodId) || discoveredPods[0];
              if (
                activePod &&
                activePod.ip &&
                (config.runpod_auto_connect || !config.remote_host || config.remote_host !== activePod.ip)
              ) {
                handleConnectPod(activePod, true);
              }
            }
          }

          if (Array.isArray(data.watchers)) {
            setWatchers(data.watchers);
          }

          setLastSyncedAt(new Date());
          setConnectionStatus("connected");
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
    setSelectedPodId(pod.id);

    const updates: Partial<AppConfig> = {};
    if (pod.ip) {
      updates.remote_host = pod.ip;
    }
    if (pod.sshPort) {
      updates.ssh_port = pod.sshPort;
    }
    if (pod.comfyUrl) {
      updates.comfyui_api_url = pod.comfyUrl;
    }

    if (onBatchUpdateConfig) {
      onBatchUpdateConfig(updates);
    } else {
      let merged = { ...config, ...updates };
      Object.entries(updates).forEach(([k, v]) => {
        handleInputChange(k as keyof AppConfig, v);
      });
      if (typeof handleInputChange === "function") {
        Object.keys(updates).forEach((k) => {
          (config as any)[k] = updates[k as keyof AppConfig];
        });
      }
    }

    const msg = `Connected Pod '${pod.name}': Host ${pod.ip}:${pod.sshPort}, ComfyUI ${pod.comfyUrl}`;
    if (!silent) {
      setSuccessMsg(msg);
      onShowToast?.(`Connected Pod '${pod.name}' (${pod.ip}:${pod.sshPort})`, "success");
    }
  };

  const handleDeploySuccess = (deployedPod: any) => {
    setViewMode("pods");
    setSuccessMsg(`Pod '${deployedPod.name || deployedPod.id}' is booting up! Syncing active status...`);
    if (deployedPod.id) {
      setSelectedPodId(deployedPod.id);
    }
    handleFetchPods(false);
  };

  const handleWatcherCreated = () => {
    setViewMode("watchers");
    handleFetchWatchers();
  };

  const activeSelectedPod = pods.find(p => p.id === selectedPodId) || (pods.length > 0 ? pods[0] : null);
  const activeWatchersCount = watchers.filter(w => w.status === "WATCHING").length;
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
              RunPod Cloud &amp; GPU Management
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Deploy GPU pods, manage active instance lifecycle (Resume/Pause/Terminate), or queue auto-deploy watchers.
            </p>
          </div>
        </div>

        {/* Dynamic Connection Status Button & Tabs Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Switcher */}
          <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode("pods")}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                viewMode === "pods"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
              }`}
            >
              <Server className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Pods ({pods.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("deploy")}
              disabled={!hasApiKey}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 ${
                viewMode === "deploy"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Deploy Pod</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("watchers")}
              disabled={!hasApiKey}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 ${
                viewMode === "watchers"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Queue ({activeWatchersCount})</span>
              {activeWatchersCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={handleTestApiConnection}
            disabled={connectionStatus === "testing"}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0 ${
              connectionStatus === "connected"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20"
                : connectionStatus === "error"
                ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30 hover:bg-red-500/20"
                : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
            }`}
          >
            {connectionStatus === "connected" ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            ) : connectionStatus === "testing" ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            <span>
              {connectionStatus === "connected"
                ? "API Active"
                : connectionStatus === "testing"
                ? "Testing..."
                : connectionStatus === "error"
                ? "Connection Error"
                : "Test API"}
            </span>
          </button>
        </div>
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

          {hasApiKey && (
            <button
              type="button"
              onClick={handleRemoveApiKey}
              className="p-2 rounded-lg bg-zinc-100 hover:bg-red-500/10 dark:bg-zinc-800 dark:hover:bg-red-500/20 text-zinc-500 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400 border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer shrink-0"
              title="Remove RunPod API Key"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

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

      {/* Status Notifications & Error Display */}
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
            <p className="font-bold">Status Update</p>
            <p className="text-[11px] opacity-90">{successMsg}</p>
          </div>
        </div>
      )}

      {/* TAB 1: Deploy New Pod Panel */}
      {viewMode === "deploy" && (
        <RunpodDeployPodPanel
          apiKey={apiKey}
          config={config}
          effectivePublicKey={effectivePublicKey}
          onDeploySuccess={handleDeploySuccess}
          onWatcherCreated={handleWatcherCreated}
          onShowToast={onShowToast}
          onCancel={() => setViewMode("pods")}
        />
      )}

      {/* TAB 2: Watchers & Auto-Deploy Queue */}
      {viewMode === "watchers" && (
        <RunpodWatchersCard
          watchers={watchers}
          apiKey={apiKey}
          config={config}
          onRefreshWatchers={handleFetchWatchers}
          onConnectPod={handleConnectPod}
          onShowToast={onShowToast}
        />
      )}

      {/* TAB 3: Active Pods List & Multi-Pod Grid */}
      {viewMode === "pods" && pods.length > 0 && (
        <div className="space-y-3.5">
          {/* Multi-Pod Overview Cards (if multiple pods exist) */}
          {pods.length > 1 && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
                All Running Pods ({pods.length})
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {pods.map((p) => {
                  const isConnected = config.remote_host === p.ip && Boolean(p.ip);
                  const isSelected = selectedPodId === p.id;
                  const isRunning = p.desiredStatus === "RUNNING";
                  const isExited = p.desiredStatus === "EXITED" || p.desiredStatus === "PAUSED" || p.desiredStatus === "STOPPED";
                  const isActing = actionInProgressPodId === p.id;

                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPodId(p.id)}
                      className={`p-3 rounded-lg border text-left cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? "bg-blue-50/90 dark:bg-blue-950/40 border-blue-500 ring-1 ring-blue-500/50 shadow-xs"
                          : "bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
                      }`}
                    >
                      <div>
                        {/* Header */}
                        <div className="flex items-start justify-between gap-1 mb-1.5">
                          <div>
                            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block truncate" title={p.name}>
                              {p.name}
                            </span>
                            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                              {p.gpuDisplayName || (p.gpuCount ? `${p.gpuCount}x GPU` : "GPU")}
                            </span>
                          </div>

                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${
                            isRunning
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/60"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800/60"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`}></span>
                            {p.desiredStatus}
                          </span>
                        </div>

                        {/* Network summary */}
                        <div className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 space-y-0.5 mb-2">
                          <p>IP: {p.ip ? `${p.ip}:${p.sshPort || 22}` : "Booting..."}</p>
                          {p.costPerHr ? <p className="text-emerald-600 dark:text-emerald-400 font-semibold">${p.costPerHr.toFixed(2)} / hr</p> : null}
                        </div>
                      </div>

                      {/* Card Action Controls */}
                      <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between gap-1">
                        {isConnected ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-800/60">
                            <CheckCircle2 className="w-3 h-3 text-blue-600" />
                            Connected
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConnectPod(p, false);
                            }}
                            className="px-2 py-1 text-[10px] font-bold bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                          >
                            <Zap className="w-3 h-3" />
                            <span>Connect</span>
                          </button>
                        )}

                        <div className="flex items-center gap-1">
                          {isExited && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickResumePod(p);
                              }}
                              disabled={isActing}
                              className="px-1.5 py-1 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer flex items-center gap-0.5"
                              title="Resume Pod"
                            >
                              {isActing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-2.5 h-2.5 fill-current" />}
                              <span>Resume</span>
                            </button>
                          )}

                          {isRunning && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickStopPod(p);
                              }}
                              disabled={isActing}
                              className="px-1.5 py-1 text-[10px] font-bold bg-amber-600 hover:bg-amber-500 text-white rounded cursor-pointer flex items-center gap-0.5"
                              title="Pause Pod"
                            >
                              {isActing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Square className="w-2.5 h-2.5 fill-current" />}
                              <span>Pause</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Selected Pod Details & Controls Card */}
          <div className="bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Selected Instance Details &amp; Endpoints</span>
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
                onChange={(e) => {
                  const nextId = e.target.value;
                  setSelectedPodId(nextId);
                  const chosenPod = pods.find(p => p.id === nextId);
                  if (chosenPod) {
                    handleConnectPod(chosenPod, false);
                  }
                }}
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

            {/* Detailed Hardware & Container Stats Card with Lifecycle actions */}
            {activeSelectedPod && (
              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <RunpodPodStatsCard
                  pod={activeSelectedPod}
                  isConnected={config.remote_host === activeSelectedPod.ip}
                  apiKey={apiKey}
                  effectivePublicKey={effectivePublicKey || config.ssh_public_key}
                  onActionComplete={() => handleFetchPods(true)}
                  onShowToast={onShowToast}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State when no pods exist */}
      {viewMode === "pods" && pods.length === 0 && hasApiKey && !isLoadingPods && (
        <div className="py-6 px-4 text-center rounded-lg border border-dashed border-zinc-300 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30 space-y-2">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            No active pods currently running on this RunPod account.
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode("deploy")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-2xs"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Deploy a ComfyUI Pod</span>
            </button>
            {watchers.length > 0 && (
              <button
                type="button"
                onClick={() => setViewMode("watchers")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60 cursor-pointer"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>View Auto-Deploy Queue ({activeWatchersCount})</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
