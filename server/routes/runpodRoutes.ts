import { Router, Request, Response } from "express";
import { fetchRunpodPods } from "../services/runpodService";
import { appendAuthorizedKeyToPod } from "../services/sshService";

const router = Router();

// In-memory cache for RunPod pods to prevent hammering RunPod GraphQL API across multiple tabs
interface RunpodPodsCacheEntry {
  pods: any[];
  timestamp: number;
}
const runpodPodsCache = new Map<string, RunpodPodsCacheEntry>();
const RUNPOD_CACHE_TTL_MS = 15000; // 15 seconds TTL

// Active SSE clients per RunPod API Key
const sseClients = new Map<string, Set<Response>>();
// Background polling timers per RunPod API Key
const sseIntervals = new Map<string, NodeJS.Timeout>();

/**
 * GET /api/runpod/events
 * Establishes a Server-Sent Events (SSE) stream for real-time pod push notifications
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
  if (cached && (now - cached.timestamp < RUNPOD_CACHE_TTL_MS)) {
    res.write(`data: ${JSON.stringify({ success: true, pods: cached.pods, cached: true })}\n\n`);
  } else {
    // Initial fetch
    fetchRunpodPods(apiKey)
      .then((pods) => {
        runpodPodsCache.set(apiKey, { pods, timestamp: Date.now() });
        res.write(`data: ${JSON.stringify({ success: true, pods })}\n\n`);
      })
      .catch((err) => {
        res.write(`data: ${JSON.stringify({ success: false, error: err.message || "Failed to fetch pods" })}\n\n`);
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

        const payload = JSON.stringify({ success: true, pods });
        for (const client of activeClients) {
          client.write(`data: ${payload}\n\n`);
        }
      } catch (err: any) {
        const payload = JSON.stringify({ success: false, error: err.message || "Background fetch failed" });
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
    console.error("[RunPod API Error]", err.message);
    res.status(400).json({
      success: false,
      error: err.message || "Failed to query RunPod active pods."
    });
  }
});

/**
 * POST /api/runpod/add-key
 * Authorize SSH public key directly on a running pod over SSH
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
    console.error("[RunPod Key Push Error]", err.message);
    res.status(400).json({
      success: false,
      error: err.message || "Failed to authorize SSH key on target Pod."
    });
  }
});

export default router;
