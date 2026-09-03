import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { upload, LEGACY_WORKFLOWS_DIR, formatSceneFolderName, getSceneDirectories, ASSETS_DIR } from "../config/constants";
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
  const targetDir = getSceneDirectories(sceneName).workflows;
  
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
    
    const candidatePaths: string[] = [];
    if (scene_name) {
      candidatePaths.push(path.join(getSceneDirectories(scene_name).workflows, cleanFilename));
    }
    
    // Add all scene folders
    if (fs.existsSync(ASSETS_DIR)) {
      const allSubdirs = fs.readdirSync(ASSETS_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name.startsWith("scene"));
      
      allSubdirs.forEach(d => {
        candidatePaths.push(path.join(ASSETS_DIR, d.name, "workflows", cleanFilename));
      });
    }

    // Add legacy
    candidatePaths.push(path.join(LEGACY_WORKFLOWS_DIR, cleanFilename));
    if (fs.existsSync(LEGACY_WORKFLOWS_DIR)) {
      const legacySubdirs = fs.readdirSync(LEGACY_WORKFLOWS_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory());
      legacySubdirs.forEach(d => {
        candidatePaths.push(path.join(LEGACY_WORKFLOWS_DIR, d.name, cleanFilename));
      });
    }

    let foundPath: string | undefined = candidatePaths.find(p => fs.existsSync(p));

    // Recursive search across ASSETS_DIR if not found in candidate paths
    if (!foundPath && fs.existsSync(ASSETS_DIR)) {
      const searchRecursively = (dir: string): string | null => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            const res = searchRecursively(fullPath);
            if (res) return res;
          } else if (entry.isFile() && (entry.name === cleanFilename || entry.name.toLowerCase() === cleanFilename.toLowerCase())) {
            return fullPath;
          }
        }
        return null;
      };
      foundPath = searchRecursively(ASSETS_DIR) || undefined;
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
      raw_json: workflow,
      workflow: workflow,
      raw_workflow: workflow
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
