import { Router, Request, Response } from "express";
import { fetchCivitaiModelInfo } from "../services/civitaiService";
import { fetchHuggingFaceModelInfo } from "../services/huggingfaceService";
import { 
  executeUnifiedRemoteDownload, 
  COMFYUI_MODEL_CATEGORIES 
} from "../services/modelHubService";

const router = Router();

/**
 * GET /api/model-hub/categories
 * Returns standard ComfyUI model category presets
 */
router.get("/categories", (req: Request, res: Response) => {
  res.json({
    success: true,
    categories: COMFYUI_MODEL_CATEGORIES
  });
});

/**
 * GET /api/model-hub/hf-info
 * Look up Hugging Face repository/file or direct model URL
 */
router.get("/hf-info", async (req: Request, res: Response) => {
  const query = (
    req.query.url ||
    req.query.query ||
    req.query.model ||
    ""
  ).toString().trim();

  const token = (req.query.token as string) || undefined;

  if (!query) {
    return res.status(400).json({
      success: false,
      error: "Missing required parameter 'url' or 'query' (Hugging Face URL, repo ID, or direct model link)."
    });
  }

  try {
    const metadata = await fetchHuggingFaceModelInfo(query, token);
    return res.json({
      success: true,
      data: metadata,
      ...metadata
    });
  } catch (err: any) {
    console.error("[HF Model Info Error]:", err);
    return res.status(400).json({
      success: false,
      error: err.message || "Failed to inspect model on Hugging Face."
    });
  }
});

/**
 * GET /api/model-hub/civitai-info
 * Look up Civitai model metadata
 */
router.get("/civitai-info", async (req: Request, res: Response) => {
  const query = (
    req.query.query ||
    req.query.url ||
    req.query.modelId ||
    req.query.versionId ||
    ""
  ).toString().trim();

  const token = (req.query.token as string) || undefined;

  if (!query) {
    return res.status(400).json({
      success: false,
      error: "Missing required parameter 'query' or 'url' (Civitai Model ID, Version ID, or URL)."
    });
  }

  try {
    const metadata = await fetchCivitaiModelInfo(query, token);
    return res.json({
      success: true,
      data: metadata,
      ...metadata
    });
  } catch (err: any) {
    console.error("[Civitai Model Info Error]:", err);
    return res.status(400).json({
      success: false,
      error: err.message || "Failed to inspect model on Civitai."
    });
  }
});

/**
 * POST /api/model-hub/download-remote
 * Download any model directly to remote GPU ComfyUI instance via SSH
 */
router.post("/download-remote", async (req: Request, res: Response) => {
  const {
    download_url,
    destination_folder,
    filename,
    auth_type,
    api_token,
    civitai_token,
    hf_token,
    remote_host,
    ssh_port = 22,
    ssh_username = "root",
    ssh_password,
    ssh_private_key,
    ssh_key_path,
    remote_comfyui_root
  } = req.body || {};

  if (!download_url) {
    return res.status(400).json({ success: false, error: "Parameter 'download_url' is required." });
  }
  if (!destination_folder) {
    return res.status(400).json({ success: false, error: "Parameter 'destination_folder' is required." });
  }
  if (!filename) {
    return res.status(400).json({ success: false, error: "Parameter 'filename' is required." });
  }
  if (!remote_host) {
    return res.status(400).json({ success: false, error: "Remote Host IP / Address is required for SSH download." });
  }

  const token = api_token || civitai_token || hf_token;

  try {
    const result = await executeUnifiedRemoteDownload({
      download_url,
      destination_folder,
      filename,
      auth_type,
      api_token: token,
      remote_host,
      ssh_port: Number(ssh_port) || 22,
      ssh_username,
      ssh_password,
      ssh_private_key,
      ssh_key_path,
      remote_comfyui_root
    });

    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err: any) {
    console.error("[Remote Model Download Error]:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "An unexpected error occurred during remote download."
    });
  }
});

export default router;
