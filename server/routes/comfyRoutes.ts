import { Router, Request, Response } from "express";
import {
  fetchComfyQueue,
  interruptComfyExecution,
  deleteComfyQueueItem,
  clearComfyQueue,
  fetchComfySystemStats
} from "../services/comfyQueueService";

const router = Router();

/**
 * Helper to resolve API URL and Token from query or request body
 */
function resolveEndpointParams(req: Request): { apiUrl?: string; authToken?: string } {
  const apiUrl =
    (req.query.comfyui_api_url as string) ||
    (req.query.url as string) ||
    req.body?.comfyui_api_url ||
    req.body?.url ||
    req.body?.comfyui_url ||
    process.env.COMFYUI_API_URL ||
    "http://127.0.0.1:8188";

  const authToken =
    (req.query.token as string) ||
    (req.query.remote_api_token as string) ||
    req.body?.remote_api_token ||
    req.body?.token;

  return { apiUrl, authToken };
}

/**
 * GET /api/comfy/queue
 * Retrieve current running and pending jobs in ComfyUI queue
 */
router.get("/queue", async (req: Request, res: Response) => {
  const { apiUrl, authToken } = resolveEndpointParams(req);
  const result = await fetchComfyQueue(apiUrl, authToken);
  res.json(result);
});

router.post("/queue/status", async (req: Request, res: Response) => {
  const { apiUrl, authToken } = resolveEndpointParams(req);
  const result = await fetchComfyQueue(apiUrl, authToken);
  res.json(result);
});

/**
 * POST /api/comfy/interrupt
 * Immediately interrupts the currently active job
 */
router.post("/interrupt", async (req: Request, res: Response) => {
  const { apiUrl, authToken } = resolveEndpointParams(req);
  const result = await interruptComfyExecution(apiUrl, authToken);
  res.json(result);
});

/**
 * POST /api/comfy/delete-job
 * Removes a specific pending prompt ID from the queue
 */
router.post("/delete-job", async (req: Request, res: Response) => {
  const { apiUrl, authToken } = resolveEndpointParams(req);
  const promptId = req.body?.prompt_id || (req.query.prompt_id as string);

  if (!promptId || typeof promptId !== "string" || !promptId.trim()) {
    return res.status(400).json({ success: false, message: "Missing required parameter 'prompt_id'" });
  }

  const result = await deleteComfyQueueItem(promptId.trim(), apiUrl, authToken);
  res.json(result);
});

/**
 * POST /api/comfy/clear-queue
 * Clears all pending jobs waiting in line
 */
router.post("/clear-queue", async (req: Request, res: Response) => {
  const { apiUrl, authToken } = resolveEndpointParams(req);
  const result = await clearComfyQueue(apiUrl, authToken);
  res.json(result);
});

/**
 * GET /api/comfy/system-stats
 * Returns GPU VRAM and OS metrics from ComfyUI
 */
router.get("/system-stats", async (req: Request, res: Response) => {
  const { apiUrl, authToken } = resolveEndpointParams(req);
  const result = await fetchComfySystemStats(apiUrl, authToken);
  res.json(result);
});

router.post("/system-stats", async (req: Request, res: Response) => {
  const { apiUrl, authToken } = resolveEndpointParams(req);
  const result = await fetchComfySystemStats(apiUrl, authToken);
  res.json(result);
});

export default router;
