import { Router, Request, Response } from "express";
import {
  fetchCivitaiModelInfo,
  executeRemoteModelDownload,
  getStoredCivitaiKey,
  getStoredCivitaiFavorites,
  saveCivitaiFavorite,
  deleteCivitaiFavorite
} from "../services/civitaiService";

const router = Router();

/**
 * GET /api/civitai/favorites
 * List all saved favorite models
 */
router.get("/favorites", (req: Request, res: Response) => {
  try {
    const favorites = getStoredCivitaiFavorites();
    return res.json({
      success: true,
      favorites,
      count: favorites.length
    });
  } catch (err: any) {
    console.error("[Civitai Favorites List Error]:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to retrieve favorites."
    });
  }
});

/**
 * POST /api/civitai/favorites
 * Add or update model in favorites
 */
router.post("/favorites", (req: Request, res: Response) => {
  try {
    const payload = req.body || {};
    const favorite = saveCivitaiFavorite(payload);
    return res.json({
      success: true,
      favorite,
      message: `Successfully favorited '${favorite.name}'`
    });
  } catch (err: any) {
    console.error("[Civitai Favorites Save Error]:", err);
    return res.status(400).json({
      success: false,
      error: err.message || "Failed to save favorite."
    });
  }
});

/**
 * DELETE /api/civitai/favorites/:version_id
 * Remove model from favorites by version ID
 */
router.delete("/favorites/:version_id", (req: Request, res: Response) => {
  try {
    const versionId = req.params.version_id;
    const removed = deleteCivitaiFavorite(versionId);
    return res.json({
      success: true,
      removed,
      version_id: versionId,
      message: removed ? `Removed favorite ${versionId}` : `Favorite ${versionId} not found`
    });
  } catch (err: any) {
    console.error("[Civitai Favorites Delete Error]:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to delete favorite."
    });
  }
});

/**
 * GET /api/civitai/model-info
 * Look up model metadata and auto-route destination folder from Civitai API
 */
router.get("/model-info", async (req: Request, res: Response) => {
  const query = (
    req.query.query ||
    req.query.url ||
    req.query.modelId ||
    req.query.versionId ||
    req.query.model_id ||
    req.query.version_id ||
    ""
  ).toString().trim();

  const token = (req.query.token as string) || undefined;

  if (!query) {
    return res.status(400).json({
      success: false,
      error: "Missing required parameter 'query' or 'url' (Civitai Model ID, Version ID, or Web URL)."
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
 * POST /api/civitai/download-remote
 * Download model directly to remote GPU ComfyUI instance via SSH
 */
router.post("/download-remote", async (req: Request, res: Response) => {
  const {
    download_url,
    destination_folder,
    filename,
    civitai_token,
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

  try {
    const result = await executeRemoteModelDownload({
      download_url,
      destination_folder,
      filename,
      civitai_token,
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
    console.error("[Civitai Remote Download Error]:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "An unexpected error occurred during remote download."
    });
  }
});

export default router;
