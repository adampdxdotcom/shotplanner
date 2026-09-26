import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { upload } from "../config/constants";
import { assetService } from "../services/assetService";
import { generateThumbnailFile } from "../services/thumbnailService";
import { safeUnlinkSync } from "../utils/fileCleanup";
import { createScopedLogger } from "../utils/logger";

const log = createScopedLogger("AssetRoute");
const router = Router();

// Retrieve all assets
router.get("/", (req: Request, res: Response) => {
  const sceneName = req.query.scene_name as string | undefined;
  const includeUniverse = req.query.include_universe === "true" || req.query.include_universe === "1";
  const universeOnly = req.query.universe_only === "true" || req.query.universe_only === "1";
  res.json({ assets: assetService.getAllAssets(sceneName, { includeUniverse, universeOnly }) });
});

// Dedicated media file serving route with MIME headers and fallback lookup across scene folders
export function serveAssetFile(req: Request, res: Response) {
  try {
    const rawFilename = req.params.filename;
    if (!rawFilename) return res.status(400).send("Filename is required");

    const foundPath = assetService.getAssetFilePath(rawFilename);

    if (foundPath && fs.existsSync(foundPath)) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.sendFile(foundPath);
    }

    res.status(404).json({ error: `Asset '${rawFilename}' not found` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// Dedicated thumbnail serving route with caching and fallback
export function serveThumbnailFile(req: Request, res: Response) {
  try {
    const rawFilename = req.params.filename;
    if (!rawFilename) return res.status(400).send("Filename is required");

    const foundPath = assetService.getAssetFilePath(rawFilename);

    if (foundPath && fs.existsSync(foundPath)) {
      const parentDir = path.dirname(foundPath);
      const thumbPath = path.join(parentDir, "thumbnails", path.basename(foundPath));
      
      const fileToServe = fs.existsSync(thumbPath) ? thumbPath : foundPath;
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Cache-Control", "public, max-age=31536000");
      return res.sendFile(fileToServe);
    }

    res.status(404).json({ error: `Asset '${rawFilename}' not found` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

router.get("/file/:filename", serveAssetFile);
router.get("/thumb/:filename", serveThumbnailFile);

// Delete an asset
router.delete("/:filename", (req: Request, res: Response) => {
  const { filename } = req.params;
  assetService.deleteAsset(filename);
  res.json({ success: true });
});

// Update asset metadata helper supporting both JSON updates and optional file replacements
async function handleAssetUpdate(req: Request, res: Response) {
  try {
    const targetFilename = req.params.filename && req.params.filename !== "update"
      ? req.params.filename
      : (req.body.original_filename || req.body.filename || "asset");

    if (req.file && targetFilename) {
      const existingPath = assetService.getAssetFilePath(targetFilename);
      if (existingPath && fs.existsSync(existingPath)) {
        try { 
          fs.copyFileSync(req.file.path, existingPath);
          await generateThumbnailFile(existingPath, undefined, 384);
        } catch (e) {}
      }
    }
    const updated = assetService.updateAssetMetadata(targetFilename, req.body);
    res.json({ success: true, asset: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  } finally {
    if (req.file?.path) safeUnlinkSync(req.file.path);
  }
}

// Update asset metadata - support PUT, POST, and PATCH on both /update and /:filename
router.put("/update", upload.single("file"), handleAssetUpdate);
router.post("/update", upload.single("file"), handleAssetUpdate);
router.put("/:filename", upload.single("file"), handleAssetUpdate);
router.post("/:filename", upload.single("file"), handleAssetUpdate);
router.patch("/:filename", upload.single("file"), handleAssetUpdate);

// Sync assets array from client
router.post("/sync", (req: Request, res: Response) => {
  try {
    const { assets } = req.body;
    res.json({ success: true, assets: assets });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Single asset upload
router.post("/upload", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No media file provided" });
    const assetRecord = await assetService.handleSingleFileUpload(req.file, req.body);
    res.json({ success: true, asset: assetRecord });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  } finally {
    if (req.file?.path) safeUnlinkSync(req.file.path);
  }
});

// Chunked asset upload
router.post("/upload_chunk", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const { upload_id } = req.body;
    if (!upload_id) return res.status(400).json({ error: "Missing upload_id" });
    if (!req.file) return res.status(400).json({ error: "No chunk file" });

    const result = await assetService.handleChunkUpload(req.file, req.body);

    if (result.complete) {
      return res.json({ success: true, asset: result.asset });
    }

    return res.json({ success: true, message: "chunk received" });
  } catch (err: any) {
    log.error("Chunk upload error", { error: err?.message || err });
    res.status(500).json({ error: err ? err.message || String(err) : "Unknown chunk error" });
  } finally {
    if (req.file?.path) safeUnlinkSync(req.file.path);
  }
});

// Explicit chunk upload cancellation / abort endpoint
router.delete("/upload_chunk/:upload_id", (req: Request, res: Response) => {
  try {
    const { upload_id } = req.params;
    if (!upload_id) return res.status(400).json({ error: "Missing upload_id" });

    assetService.abortChunkUpload(upload_id);
    log.info(`Aborted chunk upload session and purged temporary fragments for: ${upload_id}`);
    res.json({ success: true, message: `Upload session ${upload_id} aborted and chunks purged` });
  } catch (err: any) {
    log.error(`Error aborting chunk upload session: ${err?.message || err}`);
    res.status(500).json({ error: err.message || "Failed to abort chunk upload" });
  }
});

router.post("/upload_chunk/cancel", (req: Request, res: Response) => {
  try {
    const { upload_id } = req.body;
    if (!upload_id) return res.status(400).json({ error: "Missing upload_id" });

    assetService.abortChunkUpload(upload_id);
    log.info(`Cancelled chunk upload session and purged temporary fragments for: ${upload_id}`);
    res.json({ success: true, message: `Upload session ${upload_id} cancelled and chunks purged` });
  } catch (err: any) {
    log.error(`Error cancelling chunk upload session: ${err?.message || err}`);
    res.status(500).json({ error: err.message || "Failed to cancel chunk upload" });
  }
});

export default router;
