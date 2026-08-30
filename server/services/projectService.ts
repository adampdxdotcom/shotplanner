import fs from "fs";
import path from "path";
import { Response } from "express";
import { ZipArchive } from "archiver";
import unzipper from "unzipper";
import { PROJECTS_DIR, UPLOADS_DIR, WORKFLOWS_DIR } from "../config/constants";
import { AssetRecord } from "../types";
import { assetService } from "./assetService";

export function listProjects(): string[] {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  return fs
    .readdirSync(PROJECTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

export function getProjectData(projectName: string): any | null {
  const cleanName = projectName.replace(/\.json$/, "");
  const p = path.join(PROJECTS_DIR, `${cleanName}.json`);
  if (!fs.existsSync(p)) return null;

  const projectData = JSON.parse(fs.readFileSync(p, "utf-8"));
  // Sync any saved assets into assetDatabase
  if (Array.isArray(projectData.assets)) {
    for (const item of projectData.assets) {
      if (!item || !item.filename) continue;
      assetService.upsertAsset(item);
    }
  }
  return projectData;
}

export function saveProjectData(projectName: string, projectData: any): string {
  const cleanName = projectName.replace(/\.json$/, "");
  const targetPath = path.join(PROJECTS_DIR, `${cleanName}.json`);
  fs.writeFileSync(targetPath, JSON.stringify(projectData, null, 2));

  // If project payload includes assets, sync them into assetDatabase
  if (projectData && Array.isArray(projectData.assets)) {
    for (const item of projectData.assets) {
      if (!item || !item.filename) continue;
      assetService.upsertAsset(item);
    }
  }

  return cleanName;
}

export function deleteProject(projectName: string): boolean {
  const cleanName = projectName.replace(/\.json$/, "");
  const targetPath = path.join(PROJECTS_DIR, `${cleanName}.json`);
  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
    return true;
  }
  return false;
}

export async function exportProjectZip(projectName: string, res: Response): Promise<void> {
  const rawName = projectName.replace(/\.json$/, "");
  const jsonFileName = `${rawName}.json`;
  const filePath = path.join(PROJECTS_DIR, jsonFileName);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: `Project '${rawName}' not found on server. Please save it first.` });
    return;
  }

  const projectData = JSON.parse(fs.readFileSync(filePath, "utf-8"));

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

  // 2. Add workflow if selected
  if (projectData.selectedWorkflowFile) {
    const wfPath = path.join(WORKFLOWS_DIR, projectData.selectedWorkflowFile);
    if (fs.existsSync(wfPath)) {
      archive.file(wfPath, { name: `workflows/${projectData.selectedWorkflowFile}` });
    }
  }

  // 3. Add all project media assets
  const addedFiles = new Set<string>();
  const rawDb = assetService.getRawDatabase();

  if (Array.isArray(projectData.assets)) {
    for (const asset of projectData.assets) {
      if (asset && asset.filename && !addedFiles.has(asset.filename)) {
        const assetPath = path.join(UPLOADS_DIR, asset.filename);
        if (fs.existsSync(assetPath)) {
          archive.file(assetPath, { name: `uploads/${asset.filename}` });
          addedFiles.add(asset.filename);
        }
      }
    }
  }

  if (Array.isArray(projectData.shots)) {
    for (const shot of projectData.shots) {
      if (shot && shot.assigned_slots && typeof shot.assigned_slots === "object") {
        for (const slotFn of Object.values(shot.assigned_slots)) {
          if (slotFn && typeof slotFn === "string" && !addedFiles.has(slotFn)) {
            const assetPath = path.join(UPLOADS_DIR, slotFn);
            if (fs.existsSync(assetPath)) {
              archive.file(assetPath, { name: `uploads/${slotFn}` });
              addedFiles.add(slotFn);
            }
          }
        }
      }
    }
  }

  if (Array.isArray(projectData.shared_assets)) {
    for (const sa of projectData.shared_assets) {
      if (sa && sa.filename && !addedFiles.has(sa.filename)) {
        const assetPath = path.join(UPLOADS_DIR, sa.filename);
        if (fs.existsSync(assetPath)) {
          archive.file(assetPath, { name: `uploads/${sa.filename}` });
          addedFiles.add(sa.filename);
        }
      }
    }
  }

  if (projectData.nodeMappings) {
    for (const assetFile of Object.values(projectData.nodeMappings)) {
      if (assetFile && typeof assetFile === "string" && !addedFiles.has(assetFile)) {
        const assetPath = path.join(UPLOADS_DIR, assetFile);
        if (fs.existsSync(assetPath)) {
          archive.file(assetPath, { name: `uploads/${assetFile}` });
          addedFiles.add(assetFile);
        }
      }
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
      try {
        const importedDb: AssetRecord[] = JSON.parse(buffer.toString("utf-8"));
        for (const item of importedDb) {
          assetService.upsertAsset(item);
        }
      } catch (e) {}
    } else if (file.path.endsWith(".json") && !file.path.includes("/")) {
      const fname = path.basename(file.path);
      fs.writeFileSync(path.join(PROJECTS_DIR, fname), buffer);
      importedProject = fname.replace(/\.json$/, "");
      try {
        const pData = JSON.parse(buffer.toString("utf-8"));
        if (Array.isArray(pData.assets)) {
          for (const item of pData.assets) {
            if (!item || !item.filename) continue;
            assetService.upsertAsset(item);
          }
        }
      } catch (e) {}
    }
  }

  try {
    fs.unlinkSync(uploadedFilePath);
  } catch (e) {}

  return importedProject;
}
