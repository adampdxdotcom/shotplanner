import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { upload, WORKFLOWS_DIR, formatSceneFolderName } from "../config/constants";
import { listWorkflows, parseWorkflowData } from "../services/workflowService";

const router = Router();

router.get("/", (req: Request, res: Response) => {
  const sceneName = (req.query.scene as string) || undefined;
  const result = listWorkflows(sceneName);
  res.json(result);
});

router.post("/upload", upload.single("file"), (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  const sceneName = (req.body.scene_name as string) || "scene01";
  const sceneFolder = formatSceneFolderName(sceneName);
  const targetDir = path.join(WORKFLOWS_DIR, sceneFolder);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  const target = path.join(targetDir, req.file.originalname);
  fs.copyFileSync(req.file.path, target);
  try {
    fs.unlinkSync(req.file.path);
  } catch (e) {}
  res.json({ success: true, filename: req.file.originalname, folder: sceneFolder });
});

router.post("/parse", (req: Request, res: Response) => {
  try {
    const { filename, scene_name } = req.body;
    if (!filename) return res.status(400).json({ error: "Filename is required" });

    // Look in scene-specific directory first, then fallback to root workflows
    const cleanFilename = path.basename(filename);
    const sceneFolder = formatSceneFolderName(scene_name);
    const candidatePaths = [
      path.join(WORKFLOWS_DIR, sceneFolder, cleanFilename),
      path.join(WORKFLOWS_DIR, "scene01", cleanFilename),
      path.join(WORKFLOWS_DIR, cleanFilename)
    ];

    let foundPath = candidatePaths.find(p => fs.existsSync(p));
    if (!foundPath) {
      // Deep scan all scene subdirectories in WORKFLOWS_DIR
      const allSubdirs = fs.readdirSync(WORKFLOWS_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => path.join(WORKFLOWS_DIR, d.name, cleanFilename));
      foundPath = allSubdirs.find(p => fs.existsSync(p));
    }

    if (!foundPath || !fs.existsSync(foundPath)) {
      return res.status(404).json({ error: `Workflow file '${cleanFilename}' not found.` });
    }

    const workflow = JSON.parse(fs.readFileSync(foundPath, "utf-8"));
    const parsed = parseWorkflowData(workflow);

    res.json({
      filename: cleanFilename,
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
