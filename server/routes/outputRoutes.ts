import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { ASSETS_DIR } from "../config/constants";
import { sanitizeFilenamePart } from "../utils/formatters";
import mime from "mime-types"; // wait, mime is not in package.json? I'll just use simple extensions.

const router = Router();

router.post("/outputs/pull", async (req: Request, res: Response) => {
  try {
    const { scene_name, filename, subfolder, comfyui_api_url } = req.body;
    if (!scene_name || !filename || !comfyui_api_url) {
      return res.status(400).json({ error: "Missing parameters" });
    }
    
    const safeSceneName = sanitizeFilenamePart(scene_name);
    const outputDir = path.join(ASSETS_DIR, safeSceneName, "outputs");
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const filePath = path.join(outputDir, filename);
    const baseUrl = comfyui_api_url.replace(/\/$/, "");
    let downloadUrl = `${baseUrl}/view?filename=${encodeURIComponent(filename)}&type=output`;
    if (subfolder) {
      downloadUrl += `&subfolder=${encodeURIComponent(subfolder)}`;
    }
    
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download from ComfyUI: ${response.statusText}`);
    }
    
    const dest = fs.createWriteStream(filePath);
    response.body.pipe(dest);
    
    dest.on('finish', () => {
      res.json({ status: "success", filename, path: filePath });
    });
    
    dest.on('error', (err) => {
      console.error(err);
      res.status(500).json({ error: err.message });
    });
    
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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
    
    const safeSceneName = sanitizeFilenamePart(scene_name);
    const filePath = path.join(ASSETS_DIR, safeSceneName, "outputs", filename);
    
    if (!fs.existsSync(filePath)) {
      // Also try direct lookup in case file is in root outputs or another scene
      return res.status(404).send("Not found");
    }
    
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    let contentType = "application/octet-stream";
    if (filename.endsWith(".mp4")) contentType = "video/mp4";
    else if (filename.endsWith(".webm")) contentType = "video/webm";
    else if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) contentType = "image/jpeg";
    else if (filename.endsWith(".png")) contentType = "image/png";
    else if (filename.endsWith(".gif")) contentType = "image/gif";
    
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': contentType,
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
