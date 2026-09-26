import React, { useState } from "react";
import { RunpodWatcherItem, RunpodPodItem, AppConfig } from "../../types";
import { settingsApi } from "../../api";
import {
  Radio,
  Clock,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Trash2,
  XCircle,
  Zap,
  RefreshCw,
  Cpu,
  Layers,
  Sparkles
} from "lucide-react";

interface RunpodWatchersCardProps {
  watchers: RunpodWatcherItem[];
  apiKey: string;
  config: AppConfig;
  onRefreshWatchers: () => void;
  onConnectPod: (pod: RunpodPodItem) => void;
  onShowToast?: (text: string, type: "success" | "error" | "info") => void;
}

function formatTimeAgo(timestamp?: number): string {
  if (!timestamp) return "Never";
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export const RunpodWatchersCard: React.FC<RunpodWatchersCardProps> = ({
  watchers,
  apiKey,
  config,
  onRefreshWatchers,
  onConnectPod,
  onShowToast
}) => {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  const activeWatchers = watchers.filter((w) => w.status === "WATCHING");
  const claimedWatchers = watchers.filter((w) => w.status === "CLAIMED");
  const inactiveWatchers = watchers.filter((w) => w.status !== "WATCHING" && w.status !== "CLAIMED");

  const handleCancelWatcher = async (id: string) => {
    setCancellingId(id);
    try {
      const res = await settingsApi.cancelRunpodWatcher(id);
      if (res && res.success) {
        onShowToast?.("Watcher cancelled.", "info");
        onRefreshWatchers();
      } else {
        throw new Error(res?.error || "Failed to cancel watcher");
      }
    } catch (err: any) {
      onShowToast?.(err.message || "Failed to cancel watcher", "error");
    } finally {
      setCancellingId(null);
    }
  };

  const handleClearFinished = async () => {
    setIsClearing(true);
    try {
      await settingsApi.clearRunpodWatchers();
      onShowToast?.("Cleared inactive watchers.", "info");
      onRefreshWatchers();
    } catch (err: any) {
      onShowToast?.(err.message || "Failed to clear watchers", "error");
    } finally {
      setIsClearing(false);
    }
  };

  if (watchers.length === 0) {
    return (
      <div className="bg-zinc-50 dark:bg-zinc-950/60 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl p-4 text-center space-y-1.5 transition-colors">
        <Radio className="w-5 h-5 text-zinc-400 dark:text-zinc-500 mx-auto" />
        <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
          No Active Stock Watchers
        </h4>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
          When a GPU is out of stock or above your target price, queue an auto-deploy watcher from the <span className="font-semibold text-blue-600 dark:text-blue-400">Deploy New Pod</span> tab. The app will claim the instance automatically the second it appears.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-50/80 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-3.5 shadow-xs transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 shrink-0">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                GPU Availability Watchers &amp; Auto-Deploy Queue
              </h4>
              {activeWatchers.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  {activeWatchers.length} Watching
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Background queue monitors RunPod inventory every 20s and automatically claims GPUs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onRefreshWatchers}
            className="p-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer shadow-2xs"
            title="Refresh Watchers"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          {watchers.some(w => w.status !== "WATCHING") && (
            <button
              type="button"
              onClick={handleClearFinished}
              disabled={isClearing}
              className="px-2 py-1 text-[11px] font-medium bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg transition-colors cursor-pointer"
            >
              Clear Finished
            </button>
          )}
        </div>
      </div>

      {/* Watchers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {watchers.map((watcher) => {
          const isWatching = watcher.status === "WATCHING";
          const isClaimed = watcher.status === "CLAIMED";
          const isCancelled = watcher.status === "CANCELLED";
          const isFailed = watcher.status === "FAILED";

          return (
            <div
              key={watcher.id}
              className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all ${
                isClaimed
                  ? "bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/80 shadow-xs"
                  : isWatching
                  ? "bg-white dark:bg-zinc-900 border-blue-300 dark:border-blue-800/80 shadow-xs"
                  : "bg-zinc-100/60 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 opacity-75"
              }`}
            >
              <div>
                {/* Status & GPU */}
                <div className="flex items-start justify-between gap-1 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-[180px]">
                      {watcher.gpuDisplayName || watcher.gpuTypeId}
                    </span>
                  </div>

                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${
                    isClaimed
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/60"
                      : isWatching
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300 dark:border-blue-800/60"
                      : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700"
                  }`}>
                    {isWatching && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>}
                    {isClaimed && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />}
                    {watcher.status}
                  </span>
                </div>

                {/* Specs / Criteria */}
                <div className="grid grid-cols-2 gap-1 text-[10px] font-mono text-zinc-600 dark:text-zinc-400 mb-2">
                  <div>
                    <span className="text-zinc-400">Cloud: </span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">{watcher.cloudType}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400">Max $: </span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {watcher.maxPricePerHour ? `$${watcher.maxPricePerHour.toFixed(2)}/hr` : "Any"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400">Checks: </span>
                    <span className="font-semibold">{watcher.checkCount} times</span>
                  </div>
                  <div>
                    <span className="text-zinc-400">Last: </span>
                    <span className="font-semibold">{formatTimeAgo(watcher.lastCheckedAt)}</span>
                  </div>
                </div>

                {watcher.error && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-1 rounded border border-amber-200 dark:border-amber-800/50 mb-2">
                    {watcher.error}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between gap-2">
                {isWatching && (
                  <button
                    type="button"
                    onClick={() => handleCancelWatcher(watcher.id)}
                    disabled={cancellingId === watcher.id}
                    className="px-2 py-1 text-[11px] font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Cancel Watcher</span>
                  </button>
                )}

                {isClaimed && watcher.claimedPod && (
                  <button
                    type="button"
                    onClick={() => onConnectPod(watcher.claimedPod)}
                    className="w-full px-2.5 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Connect Claimed Pod ({watcher.claimedPod.name || watcher.claimedPod.id})</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
