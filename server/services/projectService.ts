import fs from "fs";
import path from "path";
import { Response } from "express";
import { ZipArchive } from "archiver";
import unzipper from "unzipper";
import { ASSETS_DIR, PROJECTS_DIR, UPLOADS_DIR, WORKFLOWS_DIR, ensureSceneDirectories, formatSceneFolderName, EMPTY_1X1_PNG_BUFFER } from "../config/constants";
import { AssetRecord } from "../types";
import { assetService } from "./assetService";
import { formatShotNumber, sanitizeFilenamePart, generateSaveVideoPrefix } from "../utils/formatters";
import { parseWorkflowData, injectAndPrepareWorkflowData } from "./workflowService";

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
  const cleanSceneName = sanitizeFilenamePart(projectData.scene_name || rawName || "Scene");

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

  // 1. Add Master Project JSON at root
  archive.append(JSON.stringify(projectData, null, 2), { name: `${rawName}.json` });

  // Helper to locate asset across scene folders and uploads
  const findAssetFile = (filename: string): string | null => {
    if (!filename) return null;
    const cleanFn = path.basename(filename.trim());
    if (!cleanFn) return null;
    const candidateDirs = [
      UPLOADS_DIR,
      path.join(process.cwd(), "assets", "images"),
      path.join(process.cwd(), "assets", "videos"),
      path.join(process.cwd(), "assets", "audios")
    ];
    for (const base of candidateDirs) {
      if (fs.existsSync(base)) {
        const direct = path.join(base, cleanFn);
        if (fs.existsSync(direct)) return direct;
        try {
          const subdirs = fs.readdirSync(base, { withFileTypes: true }).filter(d => d.isDirectory());
          for (const s of subdirs) {
            const subFile = path.join(base, s.name, cleanFn);
            if (fs.existsSync(subFile)) return subFile;
          }
        } catch {}
      }
    }
    return null;
  };

  // Helper to locate workflow template on disk
  const findWorkflowFile = (wfFilename: string): string | null => {
    if (!wfFilename) return null;
    const cleanWf = path.basename(wfFilename.trim());
    if (!cleanWf) return null;
    const candidatePaths = [
      path.join(WORKFLOWS_DIR, cleanWf),
      path.join(process.cwd(), "assets", "workflows", cleanWf)
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) return p;
    }
    for (const base of [WORKFLOWS_DIR, path.join(process.cwd(), "assets", "workflows")]) {
      if (fs.existsSync(base)) {
        try {
          const subdirs = fs.readdirSync(base, { withFileTypes: true }).filter(d => d.isDirectory());
          for (const s of subdirs) {
            const subFile = path.join(base, s.name, cleanWf);
            if (fs.existsSync(subFile)) return subFile;
          }
        } catch {}
      }
    }
    return null;
  };

  // 2. Collect unique master workflow templates referenced by scene or individual shots
  const cachedTemplates = new Map<string, any>();
  const referencedWfFiles = new Set<string>();

  if (projectData.workflow_file && typeof projectData.workflow_file === "string") {
    referencedWfFiles.add(path.basename(projectData.workflow_file));
  }
  if (projectData.selectedWorkflowFile && typeof projectData.selectedWorkflowFile === "string") {
    referencedWfFiles.add(path.basename(projectData.selectedWorkflowFile));
  }
  if (Array.isArray(projectData.shots)) {
    for (const shot of projectData.shots) {
      if (shot?.workflow_file && typeof shot.workflow_file === "string") {
        referencedWfFiles.add(path.basename(shot.workflow_file));
      }
    }
  }

  for (const wfFile of referencedWfFiles) {
    const foundWfPath = findWorkflowFile(wfFile);
    if (foundWfPath && fs.existsSync(foundWfPath)) {
      archive.file(foundWfPath, { name: `workflows/${wfFile}` });
      try {
        const wfContent = JSON.parse(fs.readFileSync(foundWfPath, "utf-8"));
        cachedTemplates.set(wfFile, wfContent);
      } catch (e) {
        console.error(`Failed to parse workflow ${wfFile}:`, e);
      }
    }
  }

  // 3. Add all project media assets into uploads/
  const addedFiles = new Set<string>();
  const rawDb = assetService.getRawDatabase();

  const collectAsset = (filename?: string) => {
    if (!filename || typeof filename !== "string") return;
    const cleanFn = path.basename(filename.trim());
    if (!cleanFn || addedFiles.has(cleanFn)) return;
    const foundPath = findAssetFile(cleanFn);
    if (foundPath && fs.existsSync(foundPath)) {
      archive.file(foundPath, { name: `uploads/${cleanFn}` });
      addedFiles.add(cleanFn);
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
      if (shot?.node_mappings && typeof shot.node_mappings === "object") {
        for (const mapFn of Object.values(shot.node_mappings)) {
          if (typeof mapFn === "string") collectAsset(mapFn);
        }
      }
    }
  }

  if (Array.isArray(projectData.shared_assets)) {
    for (const sa of projectData.shared_assets) {
      if (sa?.filename) collectAsset(sa.filename);
    }
  }

  if (projectData.nodeMappings && typeof projectData.nodeMappings === "object") {
    for (const assetFile of Object.values(projectData.nodeMappings)) {
      if (typeof assetFile === "string") collectAsset(assetFile);
    }
  }

  if (projectData.node_mappings && typeof projectData.node_mappings === "object") {
    for (const assetFile of Object.values(projectData.node_mappings)) {
      if (typeof assetFile === "string") collectAsset(assetFile);
    }
  }

  // Always package empty.png into uploads/ for unmapped slot bypass
  const emptyPngPath = findAssetFile("empty.png");
  if (emptyPngPath && fs.existsSync(emptyPngPath)) {
    archive.file(emptyPngPath, { name: "uploads/empty.png" });
  } else {
    archive.append(EMPTY_1X1_PNG_BUFFER, { name: "uploads/empty.png" });
  }
  addedFiles.add("empty.png");

  if (addedFiles.size <= 1 && rawDb.length > 0) {
    for (const asset of rawDb) {
      if (asset && asset.filename && !addedFiles.has(asset.filename)) {
        const foundPath = findAssetFile(asset.filename);
        if (foundPath && fs.existsSync(foundPath)) {
          archive.file(foundPath, { name: `uploads/${asset.filename}` });
          addedFiles.add(asset.filename);
        }
      }
    }
  }

  // 4. Master assets_db.json at the root of the archive
  const relevantAssets = rawDb.filter((a) => addedFiles.has(a.filename));
  const finalAssetsDb = relevantAssets.length > 0 ? relevantAssets : projectData.assets || rawDb;
  archive.append(JSON.stringify(finalAssetsDb, null, 2), { name: "assets_db.json" });

  // 5. Dynamically synthesize and include fully injected ready-to-run workflow JSON for EVERY shot in staged_workflows/
  const shotsList = Array.isArray(projectData.shots) ? projectData.shots : [];

  for (const shot of shotsList) {
    if (!shot || typeof shot !== "object") continue;

    const shotNumStr = formatShotNumber(shot.shot_number);
    const cleanShotName = shot.shot_name ? sanitizeFilenamePart(shot.shot_name) : "";
    const stagedFilename = cleanShotName
      ? `Shot_${shotNumStr}_${cleanShotName}.json`
      : `${cleanSceneName}_Shot_${shotNumStr}.json`;

    // Determine workflow template for this shot
    const targetWfName = shot.workflow_file || projectData.workflow_file || projectData.selectedWorkflowFile || "";
    const cleanWfName = targetWfName ? path.basename(targetWfName) : "";
    let templateJson = cleanWfName ? cachedTemplates.get(cleanWfName) : null;

    if (!templateJson && cleanWfName) {
      const foundWfPath = findWorkflowFile(cleanWfName);
      if (foundWfPath && fs.existsSync(foundWfPath)) {
        try {
          templateJson = JSON.parse(fs.readFileSync(foundWfPath, "utf-8"));
          cachedTemplates.set(cleanWfName, templateJson);
        } catch {}
      }
    }

    if (!templateJson) {
      if (cachedTemplates.size > 0) {
        templateJson = cachedTemplates.values().next().value;
      } else {
        const defaultWfPath = findWorkflowFile("default.json") || findWorkflowFile("workflow.json");
        if (defaultWfPath && fs.existsSync(defaultWfPath)) {
          try {
            templateJson = JSON.parse(fs.readFileSync(defaultWfPath, "utf-8"));
          } catch {}
        }
      }
    }

    if (!templateJson) {
      templateJson = { nodes: [], links: [] };
    }

    // Inspect/parse workflow structure
    const parsedWf = parseWorkflowData(templateJson);
    const imgLoaders = parsedWf.imageLoaderNodes || [];
    const vidLoaders = parsedWf.videoLoaderNodes || [];
    const audLoaders = parsedWf.audioLoaderNodes || [];
    const allLoaders = [...imgLoaders, ...vidLoaders, ...audLoaders];

    // Build effective node mappings
    const effectiveMappings: Record<string, string> = {
      ...(projectData.nodeMappings || {}),
      ...(projectData.node_mappings || {}),
      ...(shot.node_mappings || {})
    };

    // Assign shot assigned_slots
    if (shot.assigned_slots && typeof shot.assigned_slots === "object") {
      for (const [slotIdxStr, fn] of Object.entries(shot.assigned_slots)) {
        const slotIdx = parseInt(slotIdxStr, 10);
        if (fn && typeof fn === "string" && !isNaN(slotIdx)) {
          if (imgLoaders[slotIdx]) {
            effectiveMappings[imgLoaders[slotIdx].id] = fn.trim();
          } else if (allLoaders[slotIdx]) {
            effectiveMappings[allLoaders[slotIdx].id] = fn.trim();
          }
        }
      }
    }

    // Shared assets fallback for slots not explicitly assigned in shot
    if (Array.isArray(projectData.shared_assets)) {
      for (const sa of projectData.shared_assets) {
        if (sa && typeof sa.slot_index === "number" && sa.filename) {
          const isSlotAssignedInShot = shot.assigned_slots && shot.assigned_slots[sa.slot_index];
          if (!isSlotAssignedInShot) {
            if (imgLoaders[sa.slot_index] && !effectiveMappings[imgLoaders[sa.slot_index].id]) {
              effectiveMappings[imgLoaders[sa.slot_index].id] = sa.filename;
            } else if (allLoaders[sa.slot_index] && !effectiveMappings[allLoaders[sa.slot_index].id]) {
              effectiveMappings[allLoaders[sa.slot_index].id] = sa.filename;
            }
          }
        }
      }
    }

    // Prompt node ID
    const effectivePromptNodeId =
      shot.prompt_node_id ||
      projectData.selectedPromptNodeId ||
      projectData.prompt_node_id ||
      (parsedWf.promptNodes.length > 0 ? parsedWf.promptNodes[0].id : undefined);

    // Expanded prompt
    const effectivePrompt = shot.expanded_prompt || shot.basic_stub || "";

    // Sampling steps, megapixels, frame duration
    const effectiveParams =
      shot.generation_params ||
      projectData.generation_params ||
      projectData.generationParams ||
      { steps: 30, megapixels: 0.5, frames: 81 };

    // Parameter node mappings
    const effectiveParamNodes =
      shot.parameter_node_mappings ||
      projectData.parameter_node_mappings ||
      projectData.parameterNodeMappings ||
      {
        steps: parsedWf.detectedNodes.steps || "",
        megapixels: parsedWf.detectedNodes.megapixels || "",
        frames: parsedWf.detectedNodes.frames || ""
      };

    // Prefixes
    const promptPrefix = `${shot.shot_name ? shot.shot_name + " - " : ""}Shot ${shotNumStr} - ${shot.shot_type || ""} - ${shot.camera_movement || ""}`;
    const saveVideoPrefix = generateSaveVideoPrefix(cleanSceneName, shotNumStr);

    const bypassMissing = projectData.bypassMissing !== undefined ? Boolean(projectData.bypassMissing) : true;

    // Synthesize fully injected workflow
    const injectedWorkflow = injectAndPrepareWorkflowData(
      templateJson,
      effectivePromptNodeId,
      effectivePrompt,
      effectiveMappings,
      bypassMissing,
      "empty.png",
      effectiveParams,
      effectiveParamNodes,
      promptPrefix,
      saveVideoPrefix
    );

    archive.append(JSON.stringify(injectedWorkflow, null, 2), {
      name: `staged_workflows/${stagedFilename}`
    });
  }

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
