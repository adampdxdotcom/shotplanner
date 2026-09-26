import { Router, Request, Response } from "express";
import {
  fetchRunpodPods,
  fetchRunpodGpuTypes,
  fetchRunpodTemplates,
  fetchRunpodNetworkVolumes,
  deployRunpodPod,
  startRunpodPod,
  stopRunpodPod,
  terminateRunpodPod,
  RunpodDeployOptions
} from "../services/runpodService";
import {
  createRunpodWatcher,
  getRunpodWatchers,
  cancelRunpodWatcher,
  clearFinishedRunpodWatchers,
  RunpodCreateWatcherOptions
} from "../services/runpodQueueService";
import { appendAuthorizedKeyToPod } from "../services/sshService";
import { createScopedLogger } from "../utils/logger";

const log = createScopedLogger("RunPodRoute");

const router = Router();

// In-memory cache for RunPod pods to prevent hammering RunPod GraphQL API across multiple tabs
interface RunpodPodsCacheEntry {
  pods: any[];
  timestamp: number;
}

const runpodPodsCache = new Map<string, RunpodPodsCacheEntry>();
const RUNPOD_CACHE_TTL_MS = 15000; // 15 seconds TTL

// In-memory cache for GPU catalog to reduce rate-limits
interface RunpodGpuCacheEntry {
  gpus: any[];
  timestamp: number;
}
const runpodGpuCache = new Map<string, RunpodGpuCacheEntry>();
const GPU_CACHE_TTL_MS = 60000; // 60 seconds TTL

// Active SSE clients per RunPod API Key
const sseClients = new Map<string, Set<Response>>();
// Background polling timers per RunPod API Key
const sseIntervals = new Map<string, NodeJS.Timeout>();

/**
 * GET /api/runpod/events
 * Establishes a Server-Sent Events (SSE) stream for real-time pod & watcher push notifications
 */
router.get("/events", (req: Request, res: Response) => {
  const apiKey = (req.query.apiKey as string || "").trim();
  if (!apiKey) {
    return res.status(400).json({ success: false, error: "RunPod API Key is required." });
  }

  // Set standard SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  });

  // Keep connection open with regular heartbeats
  res.write(":\n\n");

  if (!sseClients.has(apiKey)) {
    sseClients.set(apiKey, new Set<Response>());
  }
  const clientSet = sseClients.get(apiKey)!;
  clientSet.add(res);

  // Send initial cache update immediately if fresh
  const now = Date.now();
  const cached = runpodPodsCache.get(apiKey);
  const currentWatchers = getRunpodWatchers(apiKey);

  if (cached && (now - cached.timestamp < RUNPOD_CACHE_TTL_MS)) {
    res.write(`data: ${JSON.stringify({ success: true, pods: cached.pods, watchers: currentWatchers, cached: true })}\n\n`);
  } else {
    // Initial fetch
    fetchRunpodPods(apiKey)
      .then((pods) => {
        runpodPodsCache.set(apiKey, { pods, timestamp: Date.now() });
        res.write(`data: ${JSON.stringify({ success: true, pods, watchers: getRunpodWatchers(apiKey) })}\n\n`);
      })
      .catch((err) => {
        res.write(`data: ${JSON.stringify({ success: false, error: err.message || "Failed to fetch pods", watchers: getRunpodWatchers(apiKey) })}\n\n`);
      });
  }

  // Start back-end polling interval if not already running for this API key
  if (!sseIntervals.has(apiKey)) {
    const interval = setInterval(async () => {
      try {
        const activeClients = sseClients.get(apiKey);
        if (!activeClients || activeClients.size === 0) {
          clearInterval(interval);
          sseIntervals.delete(apiKey);
          return;
        }

        const pods = await fetchRunpodPods(apiKey);
        runpodPodsCache.set(apiKey, { pods, timestamp: Date.now() });
        const watchers = getRunpodWatchers(apiKey);
        const payload = JSON.stringify({ success: true, pods, watchers });

        for (const client of activeClients) {
          client.write(`data: ${payload}\n\n`);
        }
      } catch (err: any) {
        const watchers = getRunpodWatchers(apiKey);
        const payload = JSON.stringify({ success: false, error: err.message || "Background fetch failed", watchers });
        const activeClients = sseClients.get(apiKey);
        if (activeClients) {
          for (const client of activeClients) {
            client.write(`data: ${payload}\n\n`);
          }
        }
      }
    }, RUNPOD_CACHE_TTL_MS);

    sseIntervals.set(apiKey, interval);
  }

  // Handle client disconnects safely
  req.on("close", () => {
    clientSet.delete(res);
    if (clientSet.size === 0) {
      sseClients.delete(apiKey);
      const interval = sseIntervals.get(apiKey);
      if (interval) {
        clearInterval(interval);
        sseIntervals.delete(apiKey);
      }
    }
  });
});

/**
 * POST /api/runpod/pods
 * Fetch active pods from RunPod API
 */
router.post("/pods", async (req: Request, res: Response) => {
  try {
    const { runpod_api_key, apiKey, force } = req.body || {};
    const keyToUse = (runpod_api_key || apiKey || process.env.RUNPOD_API_KEY || "").trim();

    if (!keyToUse) {
      return res.status(400).json({
        success: false,
        error: "RunPod API Key is required. Please enter your RunPod API key."
      });
    }

    // Check in-memory cache if not forced
    const now = Date.now();
    const cached = runpodPodsCache.get(keyToUse);
    if (!force && cached && (now - cached.timestamp < RUNPOD_CACHE_TTL_MS)) {
      return res.json({
        success: true,
        count: cached.pods.length,
        pods: cached.pods,
        cached: true,
        cachedAgeMs: now - cached.timestamp
      });
    }

    const pods = await fetchRunpodPods(keyToUse);

    // Save successful result to cache
    runpodPodsCache.set(keyToUse, {
      pods,
      timestamp: now
    });

    res.json({
      success: true,
      count: pods.length,
      pods
    });
  } catch (err: any) {
    log.error("RunPod API Error", { error: err.message });
    res.status(400).json({
      success: false,
      error: err.message || "Failed to query RunPod active pods."
    });
  }
});

/**
 * POST /api/runpod/gpus
 * Fetch available GPU types and live pricing
 */
router.post("/gpus", async (req: Request, res: Response) => {
  try {
    const { runpod_api_key, apiKey, force } = req.body || {};
    const keyToUse = (runpod_api_key || apiKey || process.env.RUNPOD_API_KEY || "").trim();

    if (!keyToUse) {
      return res.status(400).json({
        success: false,
        error: "RunPod API Key is required to view GPU catalog and pricing."
      });
    }

    const now = Date.now();
    const cached = runpodGpuCache.get(keyToUse);
    if (!force && cached && (now - cached.timestamp < GPU_CACHE_TTL_MS)) {
      return res.json({
        success: true,
        count: cached.gpus.length,
        gpus: cached.gpus,
        cached: true
      });
    }

    const gpus = await fetchRunpodGpuTypes(keyToUse);
    runpodGpuCache.set(keyToUse, { gpus, timestamp: now });

    res.json({
      success: true,
      count: gpus.length,
      gpus
    });
  } catch (err: any) {
    log.error("RunPod GPU Catalog Error", { error: err.message });
    res.status(400).json({
      success: false,
      error: err.message || "Failed to fetch GPU catalog."
    });
  }
});

/**
 * GET /api/runpod/gpus
 */
router.get("/gpus", async (req: Request, res: Response) => {
  try {
    const keyToUse = (req.query.apiKey as string || process.env.RUNPOD_API_KEY || "").trim();
    if (!keyToUse) {
      return res.status(400).json({
        success: false,
        error: "RunPod API Key is required to view GPU catalog and pricing."
      });
    }

    const gpus = await fetchRunpodGpuTypes(keyToUse);
    res.json({
      success: true,
      count: gpus.length,
      gpus
    });
  } catch (err: any) {
    log.error("RunPod GPU Catalog GET Error", { error: err.message });
    res.status(400).json({
      success: false,
      error: err.message || "Failed to fetch GPU catalog."
    });
  }
});

/**
 * POST /api/runpod/templates
 */
router.post("/templates", async (req: Request, res: Response) => {
  try {
    const { runpod_api_key, apiKey } = req.body || {};
    const keyToUse = (runpod_api_key || apiKey || process.env.RUNPOD_API_KEY || "").trim();

    const templates = await fetchRunpodTemplates(keyToUse || undefined);
    res.json({
      success: true,
      count: templates.length,
      templates
    });
  } catch (err: any) {
    log.error("RunPod Templates Error", { error: err.message });
    res.status(400).json({
      success: false,
      error: err.message || "Failed to fetch pod templates."
    });
  }
});

/**
 * GET /api/runpod/templates
 */
router.get("/templates", async (req: Request, res: Response) => {
  try {
    const keyToUse = (req.query.apiKey as string || process.env.RUNPOD_API_KEY || "").trim();
    const templates = await fetchRunpodTemplates(keyToUse || undefined);
    res.json({
      success: true,
      count: templates.length,
      templates
    });
  } catch (err: any) {
    log.error("RunPod Templates GET Error", { error: err.message });
    res.status(400).json({
      success: false,
      error: err.message || "Failed to fetch pod templates."
    });
  }
});

/**
 * POST /api/runpod/network-volumes
 */
router.post("/network-volumes", async (req: Request, res: Response) => {
  try {
    const { runpod_api_key, apiKey } = req.body || {};
    const keyToUse = (runpod_api_key || apiKey || process.env.RUNPOD_API_KEY || "").trim();

    if (!keyToUse) {
      return res.status(400).json({
        success: false,
        error: "RunPod API Key is required to fetch network volumes."
      });
    }

    const volumes = await fetchRunpodNetworkVolumes(keyToUse);
    res.json({
      success: true,
      count: volumes.length,
      volumes
    });
  } catch (err: any) {
    log.error("RunPod Network Volumes Error", { error: err.message });
    res.status(400).json({
      success: false,
      error: err.message || "Failed to fetch network volumes."
    });
  }
});

/**
 * POST /api/runpod/deploy
 */
router.post("/deploy", async (req: Request, res: Response) => {
  try {
    const { runpod_api_key, apiKey, ...deployOptions } = req.body || {};
    const keyToUse = (runpod_api_key || apiKey || process.env.RUNPOD_API_KEY || "").trim();

    if (!keyToUse) {
      return res.status(400).json({
        success: false,
        error: "RunPod API Key is required to deploy a pod."
      });
    }

    if (!deployOptions.gpuTypeId) {
      return res.status(400).json({
        success: false,
        error: "GPU Type ID (e.g., 'NVIDIA GeForce RTX 4090') is required."
      });
    }

    const deployedPod = await deployRunpodPod(keyToUse, deployOptions as RunpodDeployOptions);

    // Invalidate pods cache
    runpodPodsCache.delete(keyToUse);

    res.json({
      success: true,
      message: `Pod '${deployedPod.name || deployedPod.id}' successfully initiated!`,
      pod: deployedPod
    });
  } catch (err: any) {
    log.error("RunPod Deploy Error", { error: err.message });
    res.status(400).json({
      success: false,
      error: err.message || "Failed to deploy RunPod instance."
    });
  }
});

/**
 * GET & POST /api/runpod/watchers
 * Manage out-of-stock queue watchers
 */
router.get("/watchers", (req: Request, res: Response) => {
  const apiKey = (req.query.apiKey as string || process.env.RUNPOD_API_KEY || "").trim();
  const watchers = getRunpodWatchers(apiKey);
  res.json({
    success: true,
    count: watchers.length,
    watchers
  });
});

router.post("/watchers", (req: Request, res: Response) => {
  try {
    const { runpod_api_key, apiKey, ...options } = req.body || {};
    const keyToUse = (runpod_api_key || apiKey || process.env.RUNPOD_API_KEY || "").trim();

    if (!keyToUse) {
      return res.status(400).json({
        success: false,
        error: "RunPod API Key is required to register a queue watcher."
      });
    }

    if (!options.gpuTypeId) {
      return res.status(400).json({
        success: false,
        error: "GPU Type ID is required for queue watcher."
      });
    }

    const watcher = createRunpodWatcher(keyToUse, options as RunpodCreateWatcherOptions);
    res.json({
      success: true,
      message: `Auto-deploy watcher registered for ${watcher.gpuDisplayName || watcher.gpuTypeId}!`,
      watcher
    });
  } catch (err: any) {
    log.error("Register Watcher Error", { error: err.message });
    res.status(400).json({
      success: false,
      error: err.message || "Failed to register queue watcher."
    });
  }
});

router.delete("/watchers/:id", (req: Request, res: Response) => {
  const watcherId = req.params.id;
  const cancelled = cancelRunpodWatcher(watcherId);
  res.json({
    success: cancelled,
    message: cancelled ? `Watcher ${watcherId} cancelled.` : `Watcher ${watcherId} not found.`
  });
});

router.post("/watchers/clear", (req: Request, res: Response) => {
  clearFinishedRunpodWatchers();
  res.json({
    success: true,
    message: "Finished watchers cleared."
  });
});

/**
 * POST /api/runpod/pods/:id/start
 */
router.post("/pods/:id/start", async (req: Request, res: Response) => {
  try {
    const podId = req.params.id;
    const { runpod_api_key, apiKey, gpuCount } = req.body || {};
    const keyToUse = (runpod_api_key || apiKey || process.env.RUNPOD_API_KEY || "").trim();

    if (!keyToUse) {
      return res.status(400).json({ success: false, error: "RunPod API Key is required." });
    }

    const result = await startRunpodPod(keyToUse, podId, gpuCount || 1);
    runpodPodsCache.delete(keyToUse);

    res.json({
      success: true,
      message: `Pod ${podId} resumed successfully.`,
      result
    });
  } catch (err: any) {
    log.error("RunPod Start Error", { error: err.message });
    res.status(400).json({
      success: false,
      error: err.message || "Failed to resume pod."
    });
  }
});

/**
 * POST /api/runpod/pods/:id/stop
 */
router.post("/pods/:id/stop", async (req: Request, res: Response) => {
  try {
    const podId = req.params.id;
    const { runpod_api_key, apiKey } = req.body || {};
    const keyToUse = (runpod_api_key || apiKey || process.env.RUNPOD_API_KEY || "").trim();

    if (!keyToUse) {
      return res.status(400).json({ success: false, error: "RunPod API Key is required." });
    }

    const result = await stopRunpodPod(keyToUse, podId);
    runpodPodsCache.delete(keyToUse);

    res.json({
      success: true,
      message: `Pod ${podId} stopped successfully.`,
      result
    });
  } catch (err: any) {
    log.error("RunPod Stop Error", { error: err.message });
    res.status(400).json({
      success: false,
      error: err.message || "Failed to stop pod."
    });
  }
});

/**
 * POST /api/runpod/pods/:id/terminate
 */
router.post("/pods/:id/terminate", async (req: Request, res: Response) => {
  try {
    const podId = req.params.id;
    const { runpod_api_key, apiKey } = req.body || {};
    const keyToUse = (runpod_api_key || apiKey || process.env.RUNPOD_API_KEY || "").trim();

    if (!keyToUse) {
      return res.status(400).json({ success: false, error: "RunPod API Key is required." });
    }

    await terminateRunpodPod(keyToUse, podId);
    runpodPodsCache.delete(keyToUse);

    res.json({
      success: true,
      message: `Pod ${podId} terminated.`
    });
  } catch (err: any) {
    log.error("RunPod Terminate Error", { error: err.message });
    res.status(400).json({
      success: false,
      error: err.message || "Failed to terminate pod."
    });
  }
});

/**
 * POST /api/runpod/add-key
 */
router.post("/add-key", async (req: Request, res: Response) => {
  try {
    const { public_key, publicKey, remote_host, host, ip, ssh_port, port, ssh_password, password } = req.body || {};
    const pubKeyToUse = public_key || publicKey;
    const targetHost = remote_host || host || ip;

    if (!pubKeyToUse || typeof pubKeyToUse !== "string" || !pubKeyToUse.trim()) {
      return res.status(400).json({
        success: false,
        error: "Public SSH Key is required."
      });
    }

    if (!targetHost || typeof targetHost !== "string" || !targetHost.trim()) {
      return res.status(400).json({
        success: false,
        error: "Target Pod Host IP is required to push SSH key directly to pod."
      });
    }

    const result = await appendAuthorizedKeyToPod({
      remote_host: targetHost.trim(),
      ssh_port: ssh_port || port || 22,
      ssh_username: "root",
      ssh_password: ssh_password || password || ""
    }, pubKeyToUse.trim());

    res.json({
      success: true,
      message: result.message || "SSH Public Key successfully authorized on target Pod!"
    });
  } catch (err: any) {
    log.error("RunPod Key Push Error", { error: err.message });
    res.status(400).json({
      success: false,
      error: err.message || "Failed to authorize SSH key on target Pod."
    });
  }
});

export default router;
