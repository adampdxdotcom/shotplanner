import { Router, Request, Response } from "express";
import { fetchRunpodPods, addSSHKeyToRunpodAccount } from "../services/runpodService";

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
 * Register public SSH key to RunPod account
 */
router.post("/add-key", async (req: Request, res: Response) => {
  try {
    const { runpod_api_key, apiKey, public_key, publicKey } = req.body || {};
    const keyToUse = runpod_api_key || apiKey || process.env.RUNPOD_API_KEY;
    const pubKeyToUse = public_key || publicKey;

    if (!keyToUse || typeof keyToUse !== "string" || !keyToUse.trim()) {
      return res.status(400).json({
        success: false,
        error: "RunPod API Key is required."
      });
    }

    if (!pubKeyToUse || typeof pubKeyToUse !== "string" || !pubKeyToUse.trim()) {
      return res.status(400).json({
        success: false,
        error: "Public SSH Key is required."
      });
    }

    await addSSHKeyToRunpodAccount(keyToUse.trim(), pubKeyToUse.trim());

    res.json({
      success: true,
      message: "Public SSH Key successfully registered with your RunPod account! Future pods will automatically authorize this key."
    });
  } catch (err: any) {
    console.error("[RunPod Key Registration Error]", err.message);
    res.status(400).json({
      success: false,
      error: err.message || "Failed to register SSH key with RunPod."
    });
  }
});

export default router;
