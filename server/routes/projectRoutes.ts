import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { upload } from "../config/constants";
import { 
  exportProjectZip, 
  exportTakesZip,
  getProjectTakesSummary,
  getProjectData, 
  importProjectZip, 
  listProjects, 
  saveProjectData, 
  deleteProject 
} from "../services/projectService";
import { universeService } from "../services/universeService";

const router = Router();

// List all projects
router.get("/", (req: Request, res: Response) => {
  const projects = listProjects();
  res.json({ projects });
});

// Save a project
router.post("/", (req: Request, res: Response) => {
  try {
    const rawName = req.body.name || req.body.filename;
    if (!rawName) return res.status(400).json({ error: "Project name is required" });
    const savedName = saveProjectData(rawName, req.body.data);
    res.json({ success: true, filename: savedName });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Load a specific project
router.get("/:filename", (req: Request, res: Response) => {
  try {
    const rawName = req.params.filename;
    const projectData = getProjectData(rawName);
    if (!projectData) {
      return res.status(404).json({ error: `Project '${rawName}' not found` });
    }
    res.json(projectData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Export standard project as ZIP (lightweight JSON + assets)
router.get("/:filename/export", async (req: Request, res: Response) => {
  try {
    const includeTakes = req.query.include_takes === "true";
    await exportProjectZip(req.params.filename, res, { includeTakes });
  } catch (err: any) {
    console.error("Export error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Export error" });
    }
  }
});

// Export takes as separate ZIP (bundles all .mp4 video takes into organized folders)
router.get("/:filename/export-takes", async (req: Request, res: Response) => {
  try {
    await exportTakesZip(req.params.filename, res);
  } catch (err: any) {
    console.error("Export takes error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Export takes error" });
    }
  }
});

// Get summary of takes and media storage for project
router.get("/:filename/takes-summary", (req: Request, res: Response) => {
  try {
    const summary = getProjectTakesSummary(req.params.filename);
    if (!summary) {
      return res.status(404).json({ error: `Project '${req.params.filename}' not found` });
    }
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Inspect project ZIP for Universe characters and potential conflicts
router.post("/inspect-zip", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No zip file provided" });
    const zipBuffer = fs.readFileSync(req.file.path);
    const inspection = await universeService.inspectUniverseFromZip(zipBuffer);
    
    // Retain temp file or cleanup
    // We keep it in a temp identifier so it can be completed, or frontend can re-post or confirm
    res.json({
      success: true,
      temp_file_path: req.file.path,
      temp_filename: path.basename(req.file.path),
      ...inspection
    });
  } catch (err: any) {
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    console.error("Inspect ZIP error:", err);
    res.status(500).json({ error: err.message || "Failed to inspect ZIP archive" });
  }
});

// Import project from ZIP (supports direct file or pre-inspected temp file + resolutions)
router.post("/import", upload.single("file"), async (req: Request, res: Response) => {
  try {
    let filePath = req.file?.path;
    let resolutions: any = undefined;

    if (req.body?.universe_resolutions) {
      try {
        resolutions = typeof req.body.universe_resolutions === "string" 
          ? JSON.parse(req.body.universe_resolutions) 
          : req.body.universe_resolutions;
      } catch (e) {}
    }

    // If a temp_file_path was provided from inspect step
    if (!filePath && req.body?.temp_file_path && fs.existsSync(req.body.temp_file_path)) {
      filePath = req.body.temp_file_path;
    }

    if (!filePath) return res.status(400).json({ error: "No zip file provided" });
    const importedProject = await importProjectZip(filePath, resolutions);

    if (importedProject) {
      res.json({ success: true, filename: importedProject });
    } else {
      res.status(400).json({ error: "No project JSON found in zip" });
    }
  } catch (err: any) {
    console.error("Import error:", err);
    res.status(500).json({ error: err.message || "Failed to import zip" });
  }
});

// Delete a project
router.delete("/:filename", (req: Request, res: Response) => {
  try {
    const rawName = req.params.filename;
    const success = deleteProject(rawName);
    if (!success) {
      return res.status(404).json({ error: `Project '${rawName}' not found` });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
