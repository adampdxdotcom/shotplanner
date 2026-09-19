import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import nodeFetchModule from "node-fetch";

const getFetch = (): typeof fetch => {
  if (typeof globalThis.fetch === "function") {
    return globalThis.fetch as typeof fetch;
  }
  return ((nodeFetchModule as any).default || nodeFetchModule) as typeof fetch;
};
import { ASSETS_DIR, upload, formatSceneFolderName, ensureSceneDirectories } from "../config/constants";
import { sanitizeFilenamePart } from "../utils/formatters";
import { generateThumbnailFile } from "../services/thumbnailService";
import { 
  downloadAndIngestTake, 
  syncComfyOutputsFromHistory 
} from "../services/outputIngestionService";

const router = Router();

/**
 * Upload an ingested video take directly to scene outputs
 */
router.post("/outputs/upload", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No video file uploaded" });
    }

    const scene_name = (req.body.scene_name as string) || "scene01";
    const target_filename = req.body.target_filename as string;

    const safeSceneName = formatSceneFolderName(scene_name) || sanitizeFilenamePart(scene_name) || "scene01";
    const outputDir = path.join(ASSETS_DIR, safeSceneName, "outputs");

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    let finalFilename = req.file.originalname;
    if (target_filename && target_filename.trim()) {
      const ext = path.extname(target_filename) || path.extname(req.file.originalname) || ".mp4";
      const base = target_filename.replace(/\.[^/.]+$/, "");
      finalFilename = sanitizeFilenamePart(base) + ext;
    } else {
      const ext = path.extname(req.file.originalname) || ".mp4";
      const base = req.file.originalname.replace(/\.[^/.]+$/, "");
      finalFilename = sanitizeFilenamePart(base) + ext;
    }

    const destPath = path.join(outputDir, finalFilename);
    fs.copyFileSync(req.file.path, destPath);
    try {
      fs.unlinkSync(req.file.path);
    } catch (e) {}

    const streamUrl = `/api/outputs/stream/${encodeURIComponent(safeSceneName)}/${encodeURIComponent(finalFilename)}`;

    return res.json({
      success: true,
      filename: finalFilename,
      size: req.file.size,
      stream_url: streamUrl
    });
  } catch (err: any) {
    console.error("Take video upload error:", err);
    return res.status(500).json({ error: err.message || "Failed to upload video take" });
  }
});

/**
 * Delete an output / take video from disk
 */
router.delete(["/outputs/:scene_name/:filename", "/outputs/:filename"], (req: Request, res: Response) => {
  try {
    const scene_name = req.params.scene_name || (req.query.scene_name as string) || "scene01";
    const filename = req.params.filename;
    const safeScene1 = formatSceneFolderName(scene_name);
    const safeScene2 = sanitizeFilenamePart(scene_name);

    const candidates = [
      path.join(ASSETS_DIR, safeScene1, "outputs", filename),
      path.join(ASSETS_DIR, safeScene2, "outputs", filename),
      path.join(ASSETS_DIR, "outputs", filename)
    ];

    let deleted = false;
    for (const filePath of candidates) {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          deleted = true;
        } catch (e) {}
      }
    }

    res.json({ success: true, deleted });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/outputs/pull", async (req: Request, res: Response) => {
  try {
    const { scene_name, filename, subfolder, comfyui_api_url, remote_api_token, prompt_id, shot_number } = req.body;
    if (!scene_name || !filename) {
      return res.status(400).json({ error: "Missing required parameters: scene_name and filename are required" });
    }

    const result = await downloadAndIngestTake({
      scene_name,
      filename,
      subfolder,
      comfyui_api_url: comfyui_api_url || process.env.COMFYUI_API_URL,
      auth_token: remote_api_token,
      prompt_id,
      shot_number: typeof shot_number === "number" ? shot_number : undefined
    });

    return res.json({
      status: "success",
      filename: result.filename,
      size: result.size,
      stream_url: result.stream_url,
      media_type: result.media_type,
      shot_number: result.shot_number,
      take_number: result.take_number,
      take_id: result.take_id,
      saved_to_project: result.saved_to_project
    });
  } catch (error: any) {
    console.error("[Output Ingestion Error]:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/outputs/sync-history
 * Proactively checks ComfyUI /history on the backend and downloads newly completed takes
 */
router.post("/outputs/sync-history", async (req: Request, res: Response) => {
  try {
    const { scene_name, comfyui_api_url, remote_api_token, prompt_id, max_prompts } = req.body;
    if (!scene_name) {
      return res.status(400).json({ error: "Missing scene_name" });
    }

    const result = await syncComfyOutputsFromHistory({
      scene_name,
      comfyui_api_url: comfyui_api_url || process.env.COMFYUI_API_URL,
      auth_token: remote_api_token,
      prompt_id,
      max_prompts: typeof max_prompts === "number" ? max_prompts : 5
    });

    res.json(result);
  } catch (err: any) {
    console.error("[Output Sync Error]:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/outputs", (req: Request, res: Response) => {
  try {
    const scene_name = req.query.scene_name as string;
    if (!scene_name) return res.status(400).json({ error: "Missing scene_name" });
    
    const safeSceneName = sanitizeFilenamePart(scene_name);
    const outputDir = path.join(ASSETS_DIR, safeSceneName, "outputs");
    
    if (!fs.existsSync(outputDir)) {
      return res.json([]);
    }
    
    const files = fs.readdirSync(outputDir)
      .filter(f => !f.endsWith('.json') && fs.statSync(path.join(outputDir, f)).isFile())
      .sort((a, b) => {
        return fs.statSync(path.join(outputDir, b)).mtimeMs - fs.statSync(path.join(outputDir, a)).mtimeMs;
      });
      
    res.json(files);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/outputs/review", (req: Request, res: Response) => {
  try {
    const { scene_name, filename, status } = req.body;
    if (!scene_name || !filename || !status) return res.status(400).json({ error: "Missing parameters" });
    
    const safeSceneName = sanitizeFilenamePart(scene_name);
    const outputDir = path.join(ASSETS_DIR, safeSceneName, "outputs");
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const metadataFile = path.join(outputDir, "qa_status.json");
    let metadata: Record<string, string> = {};
    if (fs.existsSync(metadataFile)) {
      try {
        metadata = JSON.parse(fs.readFileSync(metadataFile, "utf-8"));
      } catch (e) {}
    }
    
    metadata[filename] = status;
    fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
    
    res.json({ status: "success" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/outputs/reviews", (req: Request, res: Response) => {
  try {
    const scene_name = req.query.scene_name as string;
    if (!scene_name) return res.status(400).json({ error: "Missing scene_name" });
    
    const safeSceneName = sanitizeFilenamePart(scene_name);
    const metadataFile = path.join(ASSETS_DIR, safeSceneName, "outputs", "qa_status.json");
    
    if (fs.existsSync(metadataFile)) {
      const metadata = JSON.parse(fs.readFileSync(metadataFile, "utf-8"));
      return res.json(metadata);
    }
    res.json({});
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get(["/outputs/stream/:scene_name/:filename", "/outputs/stream/:filename"], (req: Request, res: Response) => {
  try {
    const scene_name = req.params.scene_name || (req.query.scene_name as string) || "Scene";
    const filename = req.params.filename;
    
    const candidates = [
      path.join(ASSETS_DIR, formatSceneFolderName(scene_name), "outputs", filename),
      path.join(ASSETS_DIR, sanitizeFilenamePart(scene_name), "outputs", filename),
      path.join(ASSETS_DIR, scene_name, "outputs", filename),
      path.join(ASSETS_DIR, "outputs", filename)
    ];

    const filePath = candidates.find(p => fs.existsSync(p));
    if (!filePath) {
      return res.status(404).send("Not found");
    }
    
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const etag = `"${fileSize}-${Math.floor(stat.mtimeMs)}"`;
    const lastModified = stat.mtime.toUTCString();

    // Cache validation: return 304 Not Modified if browser already has cached version
    const ifNoneMatch = req.headers["if-none-match"];
    const ifModifiedSince = req.headers["if-modified-since"];
    if (ifNoneMatch === etag || (ifModifiedSince && new Date(ifModifiedSince) >= stat.mtime)) {
      res.status(304).end();
      return;
    }

    let contentType = "application/octet-stream";
    if (filename.endsWith(".mp4")) contentType = "video/mp4";
    else if (filename.endsWith(".webm")) contentType = "video/webm";
    else if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) contentType = "image/jpeg";
    else if (filename.endsWith(".png")) contentType = "image/png";
    else if (filename.endsWith(".gif")) contentType = "image/gif";

    const commonHeaders: Record<string, string | number> = {
      "Accept-Ranges": "bytes",
      "ETag": etag,
      "Last-Modified": lastModified,
      "Cache-Control": "public, max-age=86400, must-revalidate"
    };

    const range = req.headers.range;
    
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      let start = parseInt(parts[0], 10);
      let end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (isNaN(start)) start = 0;
      if (isNaN(end) || end >= fileSize) end = fileSize - 1;

      if (start >= fileSize || start > end) {
        res.writeHead(416, {
          "Content-Range": `bytes */${fileSize}`,
          "Accept-Ranges": "bytes"
        });
        res.end();
        return;
      }

      // Safe chunk window (2MB limit for initial stream chunk) prevents massive memory buffers
      const MAX_CHUNK_SIZE = 2 * 1024 * 1024;
      if (end - start + 1 > MAX_CHUNK_SIZE) {
        end = start + MAX_CHUNK_SIZE - 1;
      }

      const chunkSize = (end - start) + 1;
      res.writeHead(206, {
        ...commonHeaders,
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Content-Length": chunkSize,
        "Content-Type": contentType
      });

      const fileStream = fs.createReadStream(filePath, { start, end });
      fileStream.pipe(res);

      // Memory leak guard: ensure stream is destroyed on client abort/disconnect
      let isDestroyed = false;
      const destroyStream = () => {
        if (!isDestroyed) {
          isDestroyed = true;
          fileStream.destroy();
        }
      };

      req.on("close", destroyStream);
      res.on("close", destroyStream);
      fileStream.on("error", (err) => {
        destroyStream();
        if (!res.headersSent) {
          res.status(500).end();
        }
      });
    } else {
      res.writeHead(200, {
        ...commonHeaders,
        "Content-Length": fileSize,
        "Content-Type": contentType
      });

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);

      let isDestroyed = false;
      const destroyStream = () => {
        if (!isDestroyed) {
          isDestroyed = true;
          fileStream.destroy();
        }
      };

      req.on("close", destroyStream);
      res.on("close", destroyStream);
      fileStream.on("error", (err) => {
        destroyStream();
        if (!res.headersSent) {
          res.status(500).end();
        }
      });
    }
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

export default router;
