import { Router, Request, Response } from "express";
import { fetchRunpodPods } from "../services/runpodService";
import { appendAuthorizedKeyToPod } from "../services/sshService";

const router = Router();

/**
 * POST /api/runpod/pods
 * Fetch active pods from RunPod API
 */
router.post("/pods", async (req: Request, res: Response) => {
  try {
    const { runpod_api_key, apiKey } = req.body || {};
    const keyToUse = runpod_api_key || apiKey || process.env.RUNPOD_API_KEY;

    if (!keyToUse || typeof keyToUse !== "string" || !keyToUse.trim()) {
      return res.status(400).json({
        success: false,
        error: "RunPod API Key is required. Please enter your RunPod API key."
      });
    }

    const pods = await fetchRunpodPods(keyToUse.trim());

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
