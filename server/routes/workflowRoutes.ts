import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { upload, WORKFLOWS_DIR } from "../config/constants";
import { listWorkflows, parseWorkflowData } from "../services/workflowService";

const router = Router();

router.get("/", (req: Request, res: Response) => {
  const result = listWorkflows();
  res.json(result);
});

router.post("/upload", upload.single("file"), (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  const target = path.join(WORKFLOWS_DIR, req.file.originalname);
  fs.copyFileSync(req.file.path, target);
  try {
    fs.unlinkSync(req.file.path);
  } catch (e) {}
  res.json({ success: true, filename: req.file.originalname });
});

router.post("/parse", (req: Request, res: Response) => {
  try {
    const { filename } = req.body;
    const filePath = path.join(WORKFLOWS_DIR, filename);
    const workflow = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const parsed = parseWorkflowData(workflow);

    res.json({
      filename,
      detected_nodes: parsed.detectedNodes,
      detected_values: parsed.detectedValues,
      nodes_info: {
        prompt_nodes: parsed.promptNodes,
        image_loader_nodes: parsed.imageLoaderNodes,
        video_loader_nodes: parsed.videoLoaderNodes,
        audio_loader_nodes: parsed.audioLoaderNodes,
        detected_nodes: parsed.detectedNodes,
        total_nodes: parsed.totalNodes
      },
      raw_json: workflow
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
