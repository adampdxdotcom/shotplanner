import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { upload } from "../config/constants";
import { assetService } from "../services/assetService";

const router = Router();

// Retrieve all assets
router.get("/", (req: Request, res: Response) => {
  const sceneName = req.query.scene_name as string | undefined;
  res.json({ assets: assetService.getAllAssets(sceneName) });
});

// Dedicated media file serving route with MIME headers and fallback lookup across scene folders
export function serveAssetFile(req: Request, res: Response) {
  try {
    const rawFilename = req.params.filename;
    if (!rawFilename) return res.status(400).send("Filename is required");

    const foundPath = assetService.getAssetFilePath(rawFilename);

    if (foundPath && fs.existsSync(foundPath)) {
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

// Update asset metadata
router.put("/update", upload.single("file"), (req: Request, res: Response) => {
  const filename = req.body.original_filename || req.body.filename;
  const { type, subject_name, description } = req.body;
  const updated = assetService.updateAssetMetadata(filename, { type, subject_name, description });
  res.json({ success: true, asset: updated });
});

router.put("/:filename", upload.single("file"), (req: Request, res: Response) => {
  const targetFilename = req.params.filename === "update" ? (req.body.original_filename || "asset") : req.params.filename;
  const { type, subject_name, description } = req.body;
  const updated = assetService.updateAssetMetadata(targetFilename, { type, subject_name, description });
  res.json({ success: true, asset: updated });
});

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
router.post("/upload", upload.single("file"), (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No media file provided" });
    const assetRecord = assetService.handleSingleFileUpload(req.file, req.body);
    res.json({ success: true, asset: assetRecord });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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
    console.error("Chunk upload error:", err);
    res.status(500).json({ error: err ? err.message || String(err) : "Unknown chunk error" });
  }
});

export default router;
