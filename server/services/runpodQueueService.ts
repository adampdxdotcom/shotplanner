import { createScopedLogger } from "../utils/logger";
import {
  fetchRunpodGpuTypes,
  deployRunpodPod,
  getStoredRunpodApiKey,
  RunpodDeployOptions,
  RunpodGpuType
} from "./runpodService";

const log = createScopedLogger("RunPodQueueService");

export interface RunpodWatcherItem {
  id: string;
  createdAt: number;
  apiKey?: string;
  gpuTypeId: string;
  gpuDisplayName?: string;
  cloudType: "COMMUNITY" | "SECURE" | "ALL";
  maxPricePerHour?: number;
  deployOptions: RunpodDeployOptions;
  status: "WATCHING" | "CLAIMED" | "FAILED" | "CANCELLED";
  lastCheckedAt?: number;
  checkCount: number;
  claimedPod?: any;
  error?: string;
}

export interface RunpodCreateWatcherOptions {
  gpuTypeId: string;
  gpuDisplayName?: string;
  cloudType?: "COMMUNITY" | "SECURE" | "ALL";
  maxPricePerHour?: number;
  deployOptions: RunpodDeployOptions;
}

// In-memory registry of active watchers
const watchers = new Map<string, RunpodWatcherItem>();

let pollIntervalTimer: NodeJS.Timeout | null = null;
const QUEUE_POLL_INTERVAL_MS = 20000; // 20 seconds polling interval

/**
 * Start the background queue polling loop if there are active watchers
 */
function ensurePollingLoop(): void {
  if (pollIntervalTimer) return;

  log.info("Starting RunPod Queue background polling loop...");
  pollIntervalTimer = setInterval(async () => {
    const activeWatchers = Array.from(watchers.values()).filter(
      (w) => w.status === "WATCHING"
    );

    if (activeWatchers.length === 0) {
      if (pollIntervalTimer) {
        clearInterval(pollIntervalTimer);
        pollIntervalTimer = null;
        log.info("No active RunPod watchers, paused background polling.");
      }
      return;
    }

    // Group watchers by API key to avoid redundant GraphQL calls
    const keyMap = new Map<string, RunpodWatcherItem[]>();
    for (const watcher of activeWatchers) {
      const key = (watcher.apiKey || getStoredRunpodApiKey() || "").trim();
      if (!key) continue;
      if (!keyMap.has(key)) keyMap.set(key, []);
      keyMap.get(key)!.push(watcher);
    }

    for (const [key, watcherList] of keyMap.entries()) {
      try {
        const gpuCatalog = await fetchRunpodGpuTypes(key);
        for (const watcher of watcherList) {
          watcher.lastCheckedAt = Date.now();
          watcher.checkCount += 1;

          const matchedGpu = gpuCatalog.find(
            (g) =>
              g.id.toLowerCase() === watcher.gpuTypeId.toLowerCase() ||
              g.displayName.toLowerCase() === watcher.gpuTypeId.toLowerCase()
          );

          if (!matchedGpu) continue;

          // Check availability & pricing criteria
          let isAvailable = false;
          let currentPrice = 0;

          if (watcher.cloudType === "COMMUNITY") {
            if (matchedGpu.communityPrice && matchedGpu.communityPrice > 0) {
              isAvailable = true;
              currentPrice = matchedGpu.communityPrice;
            }
          } else if (watcher.cloudType === "SECURE") {
            if (matchedGpu.securePrice && matchedGpu.securePrice > 0) {
              isAvailable = true;
              currentPrice = matchedGpu.securePrice;
            }
          } else {
            // ALL clouds: use lowest available
            const lowest = matchedGpu.lowestPrice?.uninterruptablePrice || matchedGpu.communityPrice || matchedGpu.securePrice;
            if (lowest && lowest > 0) {
              isAvailable = true;
              currentPrice = lowest;
            }
          }

          // Check if price ceiling is respected
          if (isAvailable && watcher.maxPricePerHour && watcher.maxPricePerHour > 0) {
            if (currentPrice > watcher.maxPricePerHour) {
              isAvailable = false; // Available but too expensive
            }
          }

          if (isAvailable) {
            log.info(`[RunPod Watcher] GPU '${watcher.gpuTypeId}' is IN STOCK at $${currentPrice.toFixed(2)}/hr! Attempting auto-deployment...`);
            try {
              const deployedPod = await deployRunpodPod(key, watcher.deployOptions);
              watcher.status = "CLAIMED";
              watcher.claimedPod = deployedPod;
              watcher.error = undefined;
              log.info(`[RunPod Watcher] Successfully claimed pod '${deployedPod.name || deployedPod.id}' for watcher ${watcher.id}`);
            } catch (deployErr: any) {
              log.warn(`[RunPod Watcher] Auto-deploy attempt failed (might have been claimed by another user): ${deployErr.message}`);
              watcher.error = `Claim attempt missed: ${deployErr.message}`;
            }
          }
        }
      } catch (err: any) {
        log.error("RunPod Queue Poll Error", { error: err.message });
      }
    }
  }, QUEUE_POLL_INTERVAL_MS);
}

/**
 * Register a new watcher to auto-deploy when GPU is in stock
 */
export function createRunpodWatcher(apiKey: string | undefined, options: RunpodCreateWatcherOptions): RunpodWatcherItem {
  const effectiveKey = (apiKey && apiKey.trim()) || getStoredRunpodApiKey() || "";
  if (!effectiveKey) {
    throw new Error("RunPod API Key is required to register a queue watcher.");
  }

  const id = `watcher_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const watcher: RunpodWatcherItem = {
    id,
    createdAt: Date.now(),
    apiKey: effectiveKey,
    gpuTypeId: options.gpuTypeId,
    gpuDisplayName: options.gpuDisplayName || options.gpuTypeId,
    cloudType: options.cloudType || "ALL",
    maxPricePerHour: options.maxPricePerHour,
    deployOptions: options.deployOptions,
    status: "WATCHING",
    checkCount: 0
  };

  watchers.set(id, watcher);
  ensurePollingLoop();
  return watcher;
}

/**
 * Get all watchers for an API key or current session
 */
export function getRunpodWatchers(apiKey?: string): RunpodWatcherItem[] {
  const effectiveKey = (apiKey && apiKey.trim()) || getStoredRunpodApiKey() || "";
  const all = Array.from(watchers.values());
  if (!effectiveKey) return all;
  return all.filter((w) => !w.apiKey || w.apiKey === effectiveKey);
}

/**
 * Cancel an active watcher
 */
export function cancelRunpodWatcher(watcherId: string): boolean {
  const existing = watchers.get(watcherId);
  if (existing) {
    existing.status = "CANCELLED";
    return true;
  }
  return false;
}

/**
 * Clear finished (claimed/cancelled/failed) watchers
 */
export function clearFinishedRunpodWatchers(): void {
  for (const [id, watcher] of watchers.entries()) {
    if (watcher.status !== "WATCHING") {
      watchers.delete(id);
    }
  }
}
