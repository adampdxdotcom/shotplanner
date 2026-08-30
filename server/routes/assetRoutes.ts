import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { ASSETS_DIR, IMAGES_DIR, VIDEOS_DIR, AUDIOS_DIR, UPLOADS_DIR, WORKFLOWS_DIR, upload } from "../config/constants";
import { assetService } from "../services/assetService";

const router = Router();

// Retrieve all assets
router.get("/", (req: Request, res: Response) => {
  res.json({ assets: assetService.getAllAssets() });
});

// Dedicated media file serving route with MIME headers and fallback lookup across scene folders
export function serveAssetFile(req: Request, res: Response) {
  try {
    const rawFilename = req.params.filename;
    if (!rawFilename) return res.status(400).send("Filename is required");
    const filename = path.basename(rawFilename);

    const candidateDirs: string[] = [
      UPLOADS_DIR,
      ASSETS_DIR,
      IMAGES_DIR,
      VIDEOS_DIR,
      AUDIOS_DIR,
      WORKFLOWS_DIR
    ];

    [IMAGES_DIR, VIDEOS_DIR, AUDIOS_DIR, UPLOADS_DIR, WORKFLOWS_DIR].forEach((base) => {
      if (fs.existsSync(base)) {
        try {
          const subdirs = fs.readdirSync(base, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => path.join(base, d.name));
          candidateDirs.push(...subdirs);
        } catch {}
      }
    });

    for (const dir of candidateDirs) {
      const targetPath = path.join(dir, filename);
      if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
        res.setHeader("Cache-Control", "public, max-age=3600");
        return res.sendFile(targetPath);
      }
    }

    res.status(404).json({ error: `Asset '${filename}' not found` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

router.get("/file/:filename", serveAssetFile);

// Delete an asset
router.delete("/:filename", (req: Request, res: Response) => {
  const { filename } = req.params;
  assetService.deleteAsset(filename);
  res.json({ success: true });
});

// Update asset metadata
router.put("/:filename", (req: Request, res: Response) => {
  const { filename } = req.params;
  const { type, subject_name, description } = req.body;
  const updated = assetService.updateAssetMetadata(filename, { type, subject_name, description });
  if (!updated) return res.status(404).json({ error: "Asset not found" });
  res.json({ success: true, asset: updated });
});

// Sync assets array from client
router.post("/sync", (req: Request, res: Response) => {
  try {
    const { assets } = req.body;
    const synced = assetService.syncAssets(assets);
    res.json({ success: true, assets: synced });
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
