import { Router, Request, Response } from "express";
import { upload } from "../config/constants";
import { exportProjectZip, getProjectData, importProjectZip, listProjects, saveProjectData, deleteProject } from "../services/projectService";

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
    const rawName = req.params.filename.replace(/\.json$/, "");
    const projectData = getProjectData(rawName);
    if (!projectData) {
      return res.status(404).json({ error: `Project '${rawName}' not found` });
    }
    res.json(projectData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Export project as ZIP
router.get("/:filename/export", async (req: Request, res: Response) => {
  try {
    await exportProjectZip(req.params.filename, res);
  } catch (err: any) {
    console.error("Export error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Export error" });
    }
  }
});

// Import project from ZIP
router.post("/import", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No zip file provided" });
    const importedProject = await importProjectZip(req.file.path);

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
    const rawName = req.params.filename.replace(/\.json$/, "");
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
