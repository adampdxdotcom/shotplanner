import fs from "fs";
import path from "path";
import { Response } from "express";
import { ZipArchive } from "archiver";
import unzipper from "unzipper";
import { ASSETS_DIR, PROJECTS_DIR, UPLOADS_DIR, WORKFLOWS_DIR, ensureSceneDirectories, formatSceneFolderName } from "../config/constants";
import { AssetRecord } from "../types";
import { assetService } from "./assetService";

export function listProjects(): any[] {
  const projects: any[] = [];
  const seen = new Set<string>();
  
  const processFile = (dir: string, f: string, sceneName: string | null) => {
    if (seen.has(f)) return;
    seen.add(f);
    const fullPath = path.join(dir, f);
    try {
      const stats = fs.statSync(fullPath);
      projects.push({
        filename: f,
        display_name: f.replace(/\.json$/i, ""),
        scene_name: sceneName,
        mtime: stats.mtime.toISOString(),
        size: stats.size
      });
    } catch(e) {}
  };
  
  
  if (fs.existsSync(ASSETS_DIR)) {
    const dirs = fs.readdirSync(ASSETS_DIR);
    for (const d of dirs) {
      const dirPath = path.join(ASSETS_DIR, d);
      if (fs.statSync(dirPath).isDirectory()) {
        const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".json"));
        for (const f of files) {
          processFile(dirPath, f, d);
        }
      }
    }
  }
  
  if (fs.existsSync(PROJECTS_DIR)) {
    const files = fs.readdirSync(PROJECTS_DIR).filter((f) => f.endsWith(".json"));
    for (const f of files) {
      processFile(PROJECTS_DIR, f, null);
    }
  }
  
  return projects.sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime());
}

export function getProjectData(projectName: string): any | null {
  const cleanName = sanitizeProjectName(projectName);
  const p = path.join(PROJECTS_DIR, `${cleanName}.json`);
  if (!fs.existsSync(p)) return null;

  const projectData = JSON.parse(fs.readFileSync(p, "utf-8"));
  
  // Ensure scene folders exist on load
  const sceneName = projectData?.scene_name || projectData?.scene_planning?.scene_name || cleanName;
  ensureSceneDirectories(sceneName);

  // Strict isolation: no global asset database sync
  return projectData;
}


export function findProjectFile(identifier: string): string | null {
  if (!identifier) return null;

  const normalize = (name: string) => {
    let clean = name.trim().toLowerCase();
    if (clean.endsWith(".json")) clean = clean.slice(0, -5);
    if (clean.startsWith("scene_")) clean = clean.slice(6);
    return clean;
  };

  const targetNorm = normalize(identifier);
  if (!targetNorm) return null;

  const sanitized = sanitizeProjectName(identifier);
  const sceneDirName = formatSceneFolderName(sanitized);
  
  // 1. Check direct structured path
  let p = path.join(ASSETS_DIR, sceneDirName, `${sanitized}.json`);
  if (fs.existsSync(p)) return p;
  
  // 2. Check legacy flat path
  p = path.join(PROJECTS_DIR, `${sanitized}.json`);
  if (fs.existsSync(p)) return p;
  
  // 3. Flexible search
  const dirsToScan = [PROJECTS_DIR, ASSETS_DIR];
  if (fs.existsSync(ASSETS_DIR)) {
    const items = fs.readdirSync(ASSETS_DIR, { withFileTypes: true });
    for (const item of items) {
      if (item.isDirectory()) {
        dirsToScan.push(path.join(ASSETS_DIR, item.name));
      }
    }
  }
  
  for (const dir of dirsToScan) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      if (file.isFile() && file.name.endsWith(".json")) {
        if (normalize(file.name) === targetNorm) {
          return path.join(dir, file.name);
        }
      }
    }
  }
  
  return null;
}

export function sanitizeProjectName(name: string): string {
  let clean = name.trim();
  if (clean.toLowerCase().endsWith(".json")) {
    clean = clean.slice(0, -5);
  }
  clean = clean.toLowerCase().replace(/[^a-z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return clean || "project";
}

export function saveProjectData(projectName: string, projectData: any): string {
  const cleanName = sanitizeProjectName(projectName);
  
  const sceneName = projectData?.scene_name || projectData?.scene_planning?.scene_name || cleanName;
  const sceneDirName = formatSceneFolderName(sceneName);
  
  ensureSceneDirectories(sceneName);
  
  const targetDir = path.join(ASSETS_DIR, sceneDirName);
  if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
  }
  const targetPath = path.join(targetDir, `${cleanName}.json`);
  
  fs.writeFileSync(targetPath, JSON.stringify(projectData, null, 2));

  // Strict isolation: no global asset database sync

  return cleanName;
}

export function deleteProject(projectName: string): boolean {
  const targetPath = findProjectFile(projectName);
  if (targetPath && fs.existsSync(targetPath)) {
    const parentDir = path.dirname(targetPath);
    fs.unlinkSync(targetPath);
    
    // Recursively remove the entire scene directory to clean up all assets
    if (parentDir !== ASSETS_DIR && parentDir !== PROJECTS_DIR) {
      try {
        fs.rmSync(parentDir, { recursive: true, force: true });
      } catch(e) {
        // Fallback for older Node versions if needed
        try { fs.rmdirSync(parentDir, { recursive: true }); } catch (err) {}
      }
    }
    return true;
  }
  return false;
}

export async function exportProjectZip(projectName: string, res: Response): Promise<void> {
  const filePath = findProjectFile(projectName);

  if (!filePath || !fs.existsSync(filePath)) {
    res.status(404).json({ error: `Project '${projectName}' not found on server. Please save it first.` });
    return;
  }

  const projectData = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  const rawName = path.parse(filePath).name;
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${rawName}.zip"`);

  const archive = new ZipArchive({ zlib: { level: 9 } });

  archive.on("error", (err: any) => {
    console.error("Archive error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Failed to create archive" });
    }
  });

  archive.pipe(res);

  // 1. Add project json
  archive.file(filePath, { name: jsonFileName });

  // Helper to locate asset across scene folders and uploads
  const findAssetFile = (filename: string): string | null => {
    const candidateDirs = [
      UPLOADS_DIR,
      path.join(process.cwd(), "assets", "images"),
      path.join(process.cwd(), "assets", "videos"),
      path.join(process.cwd(), "assets", "audios")
    ];
    // Check scene subdirectories
    for (const base of candidateDirs) {
      if (fs.existsSync(base)) {
        const direct = path.join(base, filename);
        if (fs.existsSync(direct)) return direct;
        try {
          const subdirs = fs.readdirSync(base, { withFileTypes: true }).filter(d => d.isDirectory());
          for (const s of subdirs) {
            const subFile = path.join(base, s.name, filename);
            if (fs.existsSync(subFile)) return subFile;
          }
        } catch {}
      }
    }
    return null;
  };

  // 2. Add workflow if selected
  if (projectData.selectedWorkflowFile) {
    const cleanWf = path.basename(projectData.selectedWorkflowFile);
    let wfFound = path.join(WORKFLOWS_DIR, cleanWf);
    if (!fs.existsSync(wfFound)) {
      try {
        const subdirs = fs.readdirSync(WORKFLOWS_DIR, { withFileTypes: true }).filter(d => d.isDirectory());
        for (const s of subdirs) {
          const cand = path.join(WORKFLOWS_DIR, s.name, cleanWf);
          if (fs.existsSync(cand)) {
            wfFound = cand;
            break;
          }
        }
      } catch {}
    }
    if (fs.existsSync(wfFound)) {
      archive.file(wfFound, { name: `workflows/${cleanWf}` });
    }
  }

  // 3. Add all project media assets
  const addedFiles = new Set<string>();
  const rawDb = assetService.getRawDatabase();

  const collectAsset = (filename?: string) => {
    if (!filename || typeof filename !== "string" || addedFiles.has(filename)) return;
    const foundPath = findAssetFile(filename);
    if (foundPath && fs.existsSync(foundPath)) {
      archive.file(foundPath, { name: `uploads/${filename}` });
      addedFiles.add(filename);
    }
  };

  if (Array.isArray(projectData.assets)) {
    for (const asset of projectData.assets) {
      if (asset?.filename) collectAsset(asset.filename);
    }
  }

  if (Array.isArray(projectData.shots)) {
    for (const shot of projectData.shots) {
      if (shot?.assigned_slots && typeof shot.assigned_slots === "object") {
        for (const slotFn of Object.values(shot.assigned_slots)) {
          if (typeof slotFn === "string") collectAsset(slotFn);
        }
      }
    }
  }

  if (Array.isArray(projectData.shared_assets)) {
    for (const sa of projectData.shared_assets) {
      if (sa?.filename) collectAsset(sa.filename);
    }
  }

  if (projectData.nodeMappings) {
    for (const assetFile of Object.values(projectData.nodeMappings)) {
      if (typeof assetFile === "string") collectAsset(assetFile);
    }
  }

  if (addedFiles.size === 0 && rawDb.length > 0) {
    for (const asset of rawDb) {
      if (asset && asset.filename && !addedFiles.has(asset.filename)) {
        const assetPath = path.join(UPLOADS_DIR, asset.filename);
        if (fs.existsSync(assetPath)) {
          archive.file(assetPath, { name: `uploads/${asset.filename}` });
          addedFiles.add(asset.filename);
        }
      }
    }
  }

  const relevantAssets = rawDb.filter((a) => addedFiles.has(a.filename));
  const finalAssetsDb = relevantAssets.length > 0 ? relevantAssets : projectData.assets || rawDb;
  archive.append(JSON.stringify(finalAssetsDb, null, 2), { name: "assets_db.json" });

  await archive.finalize();
}

export async function importProjectZip(uploadedFilePath: string): Promise<string> {
  const zipBuffer = fs.readFileSync(uploadedFilePath);
  const directory = await unzipper.Open.buffer(zipBuffer);

  let importedProject = "";

  for (const file of directory.files) {
    if (file.type !== "File") continue;
    const buffer = await file.buffer();

    if (file.path.startsWith("workflows/")) {
      const fname = path.basename(file.path);
      fs.writeFileSync(path.join(WORKFLOWS_DIR, fname), buffer);
    } else if (file.path.startsWith("uploads/")) {
      const fname = path.basename(file.path);
      fs.writeFileSync(path.join(UPLOADS_DIR, fname), buffer);
    } else if (file.path === "assets_db.json") {
      // Ignored: strictly using project JSON for metadata now
    } else if (file.path.endsWith(".json") && !file.path.includes("/")) {
      const fname = path.basename(file.path);
      fs.writeFileSync(path.join(PROJECTS_DIR, fname), buffer);
      importedProject = fname.replace(/\.json$/, "");
      try {
        const pData = JSON.parse(buffer.toString("utf-8"));
        
        // Ensure scene folders exist on load
        const sceneName = pData?.scene_name || pData?.scene_planning?.scene_name || importedProject;
        ensureSceneDirectories(sceneName);


      } catch (e) {}
    }
  }

  try {
    fs.unlinkSync(uploadedFilePath);
  } catch (e) {}

  return importedProject;
}
