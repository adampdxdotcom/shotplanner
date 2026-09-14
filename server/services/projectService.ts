import fs from "fs";
import path from "path";
import { Response } from "express";
import { ZipArchive } from "archiver";
import unzipper from "unzipper";
import { ASSETS_DIR, PROJECTS_DIR, UPLOADS_DIR, WORKFLOWS_DIR, UNIVERSE_DIR, UNIVERSE_MEDIA_DIR, ensureSceneDirectories, formatSceneFolderName, EMPTY_1X1_PNG_BUFFER } from "../config/constants";
import { AssetRecord } from "../types";
import { assetService } from "./assetService";
import { universeService } from "./universeService";
import { formatShotNumber, sanitizeFilenamePart, generateSaveVideoPrefix } from "../utils/formatters";
import { parseWorkflowData, injectAndPrepareWorkflowData } from "./workflowService";

const IGNORED_JSON_FILENAMES = new Set([
  "assets_db.json",
  "gemini_config.json",
  "civitai_config.json",
  "civitai_favorites.json",
  "huggingface_config.json",
  "characters.json",
  "package.json",
  "tsconfig.json",
  "metadata.json"
]);

const IGNORED_ASSET_DIRECTORIES = new Set([
  "tmp_uploads",
  "project_jsons",
  "universe"
]);

export function listProjects(): any[] {
  const projects: any[] = [];
  const seenScenes = new Set<string>();
  
  // 1. Scan scene directories in ASSETS_DIR
  if (fs.existsSync(ASSETS_DIR)) {
    const dirs = fs.readdirSync(ASSETS_DIR);
    for (const d of dirs) {
      if (IGNORED_ASSET_DIRECTORIES.has(d)) continue;
      const dirPath = path.join(ASSETS_DIR, d);
      try {
        if (fs.statSync(dirPath).isDirectory()) {
          if (seenScenes.has(d)) continue;
          
          // Check authoritative descriptor assets/{scene_name}/{scene_name}.json
          const authoritativePath = path.join(dirPath, `${d}.json`);
          let targetFile: string | null = null;
          
          if (fs.existsSync(authoritativePath)) {
            targetFile = authoritativePath;
          } else {
            // Fallback: check for primary non-auxiliary json
            const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".json"));
            for (const f of files) {
              if (!IGNORED_JSON_FILENAMES.has(f.toLowerCase()) && !f.startsWith(".")) {
                targetFile = path.join(dirPath, f);
                break;
              }
            }
          }
          
          if (targetFile && fs.existsSync(targetFile)) {
            seenScenes.add(d);
            const stats = fs.statSync(targetFile);
            projects.push({
              filename: path.basename(targetFile),
              display_name: d,
              scene_name: d,
              mtime: stats.mtime.toISOString(),
              size: stats.size
            });
          }
        }
      } catch (e) {}
    }
  }
  
  // 2. Scan legacy PROJECTS_DIR
  if (fs.existsSync(PROJECTS_DIR)) {
    const files = fs.readdirSync(PROJECTS_DIR).filter((f) => f.endsWith(".json"));
    for (const f of files) {
      if (IGNORED_JSON_FILENAMES.has(f.toLowerCase()) || f.startsWith(".")) continue;
      const stem = f.replace(/\.json$/i, "");
      if (seenScenes.has(stem)) continue;
      seenScenes.add(stem);
      try {
        const fullPath = path.join(PROJECTS_DIR, f);
        const stats = fs.statSync(fullPath);
        projects.push({
          filename: f,
          display_name: stem,
          scene_name: stem,
          mtime: stats.mtime.toISOString(),
          size: stats.size
        });
      } catch (e) {}
    }
  }
  
  return projects.sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime());
}

export function getProjectData(projectName: string): any | null {
  const filePath = findProjectFile(projectName);
  if (!filePath || !fs.existsSync(filePath)) return null;

  const projectData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  
  // Ensure scene folders exist on load
  const cleanName = sanitizeProjectName(projectName);
  const sceneName = projectData?.scene_name || projectData?.scene_planning?.scene_name || cleanName;
  ensureSceneDirectories(sceneName);

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
  
  // 1. Check direct authoritative 1-to-1 path
  let p = path.join(ASSETS_DIR, sceneDirName, `${sceneDirName}.json`);
  if (fs.existsSync(p)) return p;

  // 2. Check assets/{sceneDirName}/{sanitized}.json
  p = path.join(ASSETS_DIR, sceneDirName, `${sanitized}.json`);
  if (fs.existsSync(p)) return p;
  
  // 3. Check legacy flat path
  p = path.join(PROJECTS_DIR, `${sanitized}.json`);
  if (fs.existsSync(p)) return p;
  
  // 4. Search scene subdirectories
  if (fs.existsSync(ASSETS_DIR)) {
    const items = fs.readdirSync(ASSETS_DIR, { withFileTypes: true });
    for (const item of items) {
      if (item.isDirectory() && !IGNORED_ASSET_DIRECTORIES.has(item.name)) {
        const cand = path.join(ASSETS_DIR, item.name, `${item.name}.json`);
        if (fs.existsSync(cand) && normalize(item.name) === targetNorm) {
          return cand;
        }
        const dirPath = path.join(ASSETS_DIR, item.name);
        const subFiles = fs.readdirSync(dirPath);
        for (const sf of subFiles) {
          if (sf.endsWith(".json") && !IGNORED_JSON_FILENAMES.has(sf.toLowerCase()) && normalize(sf) === targetNorm) {
            return path.join(dirPath, sf);
          }
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
  const sceneDirName = formatSceneFolderName(cleanName);
  
  if (projectData && typeof projectData === "object") {
    projectData.scene_name = sceneDirName;
    if (projectData.scene_planning && typeof projectData.scene_planning === "object") {
      projectData.scene_planning.scene_name = sceneDirName;
    }
  }

  const dirs = ensureSceneDirectories(sceneDirName);
  const targetPath = path.join(dirs.base, `${sceneDirName}.json`);
  
  fs.writeFileSync(targetPath, JSON.stringify(projectData, null, 2));

  return `${sceneDirName}.json`;
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

export async function exportProjectZip(
  projectName: string, 
  res: Response, 
  options: { includeTakes?: boolean } = {}
): Promise<void> {
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

  const cleanup = () => {
    try { archive.abort(); } catch (e) {}
  };
  res.on("close", cleanup);

  archive.pipe(res);

  // 1. Add Master Project JSON at root
  archive.append(JSON.stringify(projectData, null, 2), { name: `${rawName}.json` });

  // Helper to locate asset across scene folders, uploads, and universe media
  const findAssetFile = (filename: string): string | null => {
    if (!filename) return null;
    const cleanFn = path.basename(filename.trim());
    if (!cleanFn || cleanFn === "thumbnails" || cleanFn === ".DS_Store") return null;
    const candidateDirs = [
      UPLOADS_DIR,
      UNIVERSE_MEDIA_DIR,
      path.join(process.cwd(), "assets", "images"),
      path.join(process.cwd(), "assets", "videos"),
      path.join(process.cwd(), "assets", "audios"),
      path.join(process.cwd(), "assets", "shared")
    ];
    for (const base of candidateDirs) {
      if (fs.existsSync(base)) {
        const direct = path.join(base, cleanFn);
        if (fs.existsSync(direct)) return direct;
        try {
          const subdirs = fs.readdirSync(base, { withFileTypes: true }).filter(d => d.isDirectory() && d.name !== "thumbnails");
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
    if (!cleanFn || addedFiles.has(cleanFn) || cleanFn === "thumbnails" || cleanFn === ".DS_Store") return;
    const foundPath = findAssetFile(cleanFn);
    if (foundPath && fs.existsSync(foundPath) && !foundPath.includes(`${path.sep}thumbnails${path.sep}`)) {
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

  // 4b. Package referenced Universe Characters in universe/characters.json
  try {
    const allUniverseChars = universeService.getUniverseCharacters();
    const referencedUniverseChars: Record<string, any> = {};
    
    // Check characters defined in projectData.characters or scene_planning
    const sceneChars = projectData.characters || projectData.scene_planning?.characters || {};
    for (const [name, charProfile] of Object.entries(sceneChars)) {
      const uChar = allUniverseChars[name] || (charProfile as any)?.in_universe ? charProfile : null;
      if (uChar) {
        referencedUniverseChars[name] = allUniverseChars[name] || uChar;
      }
    }
    
    // Check subjects in assets
    for (const a of (projectData.assets || [])) {
      if (a?.subject_name && allUniverseChars[a.subject_name]) {
        referencedUniverseChars[a.subject_name] = allUniverseChars[a.subject_name];
      }
    }

    if (Object.keys(referencedUniverseChars).length > 0) {
      archive.append(JSON.stringify(referencedUniverseChars, null, 2), { name: "universe/characters.json" });
    }
  } catch (e) {
    console.error("Error packaging universe metadata in ZIP export:", e);
  }

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

    // 5. Hero Take Selection & Parameter Resolution
    const takes = Array.isArray(shot.takes) ? shot.takes : [];
    const heroTake = takes.find((t: any) => t.id === shot.hero_take_id || t.is_hero) 
      || (takes.length > 0 ? takes[takes.length - 1] : null);

    // Expanded prompt
    const effectivePrompt = (heroTake && heroTake.expanded_prompt) 
      ? heroTake.expanded_prompt 
      : (shot.expanded_prompt || shot.basic_stub || "");

    // Sampling steps, megapixels, frame duration
    const effectiveParams =
      (heroTake && heroTake.generation_params) ? heroTake.generation_params :
      (shot.generation_params ||
      projectData.generation_params ||
      projectData.generationParams ||
      {});

    // Parameter node mappings
    const effectiveParamNodes =
      shot.parameter_node_mappings ||
      projectData.parameter_node_mappings ||
      projectData.parameterNodeMappings ||
      (parsedWf.detectedNodes ? {
        steps: parsedWf.detectedNodes.steps || "",
        megapixels: parsedWf.detectedNodes.megapixels || "",
        frames: parsedWf.detectedNodes.frames || ""
      } : {});

    // Prefixes
    const takeNum = heroTake ? heroTake.take_number : (takes.length + 1);
    const promptPrefix = `${shot.shot_name ? shot.shot_name + " - " : ""}Shot ${shotNumStr} - ${shot.shot_type || ""} - ${shot.camera_movement || ""}`;
    const saveVideoPrefix = generateSaveVideoPrefix(cleanSceneName, shotNumStr, takeNum);

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

    // Package output video for hero take only if explicitly requested (keeping standard archive lightweight)
    if (options.includeTakes && heroTake) {
      const vidFilename = heroTake.video_filename || `${cleanSceneName}_Shot_${shotNumStr}_Take_${heroTake.take_number}.mp4`;
      const sceneFolder = formatSceneFolderName(cleanSceneName);
      const possibleOutputs = [
        path.join(ASSETS_DIR, cleanSceneName, "outputs", vidFilename),
        path.join(ASSETS_DIR, sceneFolder, "outputs", vidFilename),
        path.join(ASSETS_DIR, "outputs", vidFilename)
      ];
      for (const outPath of possibleOutputs) {
        if (fs.existsSync(outPath)) {
          archive.file(outPath, { name: `outputs/${vidFilename}` });
          break;
        }
      }
    }
  }

  await archive.finalize();
}

export interface ProjectTakesSummary {
  projectName: string;
  sceneName: string;
  totalShots: number;
  totalTakes: number;
  foundVideoFiles: number;
  totalSizeBytes: number;
  heroTakesCount: number;
  goodTakesCount: number;
  badTakesCount: number;
  unreviewedTakesCount: number;
  takesByShot: Array<{
    shotNumber: number;
    shotName: string;
    takesCount: number;
    foundFilesCount: number;
  }>;
}

export function getProjectTakesSummary(projectName: string): ProjectTakesSummary | null {
  const filePath = findProjectFile(projectName);
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  let projectData: any = {};
  try {
    projectData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (e) {
    return null;
  }

  const rawName = path.parse(filePath).name;
  const cleanSceneName = sanitizeFilenamePart(projectData.scene_name || rawName || "Scene");
  const shotsList = Array.isArray(projectData.shots) ? projectData.shots : [];

  let totalTakes = 0;
  let foundVideoFiles = 0;
  let totalSizeBytes = 0;
  let heroTakesCount = 0;
  let goodTakesCount = 0;
  let badTakesCount = 0;
  let unreviewedTakesCount = 0;

  const candidateDirs = [
    path.join(ASSETS_DIR, formatSceneFolderName(cleanSceneName), "outputs"),
    path.join(ASSETS_DIR, sanitizeFilenamePart(cleanSceneName), "outputs"),
    path.join(ASSETS_DIR, cleanSceneName, "outputs"),
    path.join(ASSETS_DIR, "outputs"),
    UPLOADS_DIR
  ];

  const takesByShot: any[] = [];

  for (const shot of shotsList) {
    if (!shot || typeof shot !== "object") continue;
    const shotNumStr = formatShotNumber(shot.shot_number);
    const takes = Array.isArray(shot.takes) ? shot.takes : [];
    let shotFoundFiles = 0;

    for (const take of takes) {
      totalTakes++;
      if (take.is_hero || take.id === shot.hero_take_id) heroTakesCount++;
      if (take.rating === "good" || take.review_status === "approved") goodTakesCount++;
      else if (take.rating === "bad" || take.review_status === "needs_work") badTakesCount++;
      else unreviewedTakesCount++;

      const possibleFilenames = [
        take.video_filename,
        `${cleanSceneName}_Shot_${shotNumStr}_Take_${take.take_number}.mp4`,
        `${cleanSceneName}_Shot_${shotNumStr}_Take_${take.take_number}.webm`,
        `take_${take.take_number}.mp4`
      ].filter(Boolean);

      let foundPath: string | null = null;
      if (take.video_path && fs.existsSync(take.video_path)) {
        foundPath = take.video_path;
      } else {
        for (const fn of possibleFilenames) {
          for (const dir of candidateDirs) {
            const p = path.join(dir, fn);
            if (fs.existsSync(p)) {
              foundPath = p;
              break;
            }
          }
          if (foundPath) break;
        }
      }

      if (foundPath) {
        shotFoundFiles++;
        foundVideoFiles++;
        try {
          const stat = fs.statSync(foundPath);
          totalSizeBytes += stat.size;
        } catch (e) {}
      }
    }

    takesByShot.push({
      shotNumber: shot.shot_number,
      shotName: shot.shot_name || `Shot ${shotNumStr}`,
      takesCount: takes.length,
      foundFilesCount: shotFoundFiles
    });
  }

  return {
    projectName: rawName,
    sceneName: cleanSceneName,
    totalShots: shotsList.length,
    totalTakes,
    foundVideoFiles,
    totalSizeBytes,
    heroTakesCount,
    goodTakesCount,
    badTakesCount,
    unreviewedTakesCount,
    takesByShot
  };
}

export async function exportTakesZip(projectName: string, res: Response): Promise<void> {
  const filePath = findProjectFile(projectName);
  if (!filePath || !fs.existsSync(filePath)) {
    res.status(404).json({ error: `Project '${projectName}' not found on server. Please save it first.` });
    return;
  }

  let projectData: any = {};
  try {
    projectData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (err: any) {
    res.status(500).json({ error: `Failed to parse project file: ${err.message}` });
    return;
  }

  const rawName = path.parse(filePath).name;
  const cleanSceneName = sanitizeFilenamePart(projectData.scene_name || rawName || "Scene");
  const shotsList = Array.isArray(projectData.shots) ? projectData.shots : [];

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${cleanSceneName}_takes.zip"`);

  // Use compression level 1 for rapid packaging of already compressed video data
  const archive = new ZipArchive({ zlib: { level: 1 } });

  archive.on("error", (err: any) => {
    console.error("Takes archive error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Failed to create takes archive" });
    }
  });

  const cleanup = () => {
    try { archive.abort(); } catch (e) {}
  };
  res.on("close", cleanup);

  archive.pipe(res);

  const candidateDirs = [
    path.join(ASSETS_DIR, formatSceneFolderName(cleanSceneName), "outputs"),
    path.join(ASSETS_DIR, sanitizeFilenamePart(cleanSceneName), "outputs"),
    path.join(ASSETS_DIR, cleanSceneName, "outputs"),
    path.join(ASSETS_DIR, "outputs"),
    UPLOADS_DIR
  ];

  const addedFiles = new Set<string>();
  const manifestShots: any[] = [];
  const textLogLines: string[] = [
    "================================================================================",
    `DIRECTOR TAKES LOG - SCENE: ${cleanSceneName.toUpperCase()}`,
    `Exported At: ${new Date().toLocaleString()}`,
    `Project: ${rawName}.json`,
    "================================================================================",
    ""
  ];

  let totalFilesPackaged = 0;

  for (const shot of shotsList) {
    if (!shot || typeof shot !== "object") continue;
    const shotNumStr = formatShotNumber(shot.shot_number);
    const shotFolder = `Shot_${shotNumStr}${shot.shot_name ? `_${sanitizeFilenamePart(shot.shot_name)}` : ""}`;
    const takes = Array.isArray(shot.takes) ? shot.takes : [];

    textLogLines.push(`--------------------------------------------------------------------------------`);
    textLogLines.push(`SHOT ${shotNumStr}: ${shot.shot_name || "(Untitled)"} [${shot.shot_type || "Medium"} | ${shot.camera_movement || "Static"}]`);
    if (shot.prompt_node_id || shot.expanded_prompt) {
      textLogLines.push(`Prompt: ${shot.expanded_prompt || shot.basic_stub || ""}`);
    }
    textLogLines.push(`--------------------------------------------------------------------------------`);

    const manifestTakes: any[] = [];

    for (const take of takes) {
      const takeNumStr = String(take.take_number || 1).padStart(2, "0");
      const isHero = Boolean(take.is_hero || take.id === shot.hero_take_id);
      const rating = take.rating || (take.review_status === "approved" ? "good" : take.review_status === "needs_work" ? "bad" : "unreviewed");

      const possibleFilenames = [
        take.video_filename,
        `${cleanSceneName}_Shot_${shotNumStr}_Take_${take.take_number}.mp4`,
        `${cleanSceneName}_Shot_${shotNumStr}_Take_${take.take_number}.webm`,
        `take_${take.take_number}.mp4`
      ].filter(Boolean);

      let foundPath: string | null = null;
      let matchedFilename = take.video_filename || `${cleanSceneName}_Shot_${shotNumStr}_Take_${takeNumStr}.mp4`;

      if (take.video_path && fs.existsSync(take.video_path)) {
        foundPath = take.video_path;
        matchedFilename = path.basename(take.video_path);
      } else {
        for (const fn of possibleFilenames) {
          for (const dir of candidateDirs) {
            const candidatePath = path.join(dir, fn);
            if (fs.existsSync(candidatePath)) {
              foundPath = candidatePath;
              matchedFilename = fn;
              break;
            }
          }
          if (foundPath) break;
        }
      }

      let zipEntryPath = "";
      let fileSize = 0;

      if (foundPath && fs.existsSync(foundPath)) {
        zipEntryPath = `takes/${shotFolder}/${matchedFilename}`;
        if (!addedFiles.has(zipEntryPath)) {
          archive.file(foundPath, { name: zipEntryPath });
          addedFiles.add(zipEntryPath);
          totalFilesPackaged++;
          try {
            fileSize = fs.statSync(foundPath).size;
          } catch (e) {}
        }
      }

      manifestTakes.push({
        id: take.id,
        take_number: take.take_number,
        is_hero: isHero,
        rating,
        review_status: take.review_status || (rating === "good" ? "approved" : rating === "bad" ? "needs_work" : "unreviewed"),
        video_filename: matchedFilename,
        archive_path: zipEntryPath || null,
        file_size: fileSize,
        file_found_on_disk: Boolean(foundPath),
        notes: take.notes || "",
        expanded_prompt: take.expanded_prompt || "",
        generation_params: take.generation_params || null,
        created_at: take.created_at || null
      });

      const heroTag = isHero ? " [HERO TAKE]" : "";
      const ratingTag = rating === "good" ? " [GOOD]" : rating === "bad" ? " [NEEDS WORK]" : " [UNREVIEWED]";
      textLogLines.push(`  * Take ${takeNumStr}${heroTag}${ratingTag}: ${matchedFilename} (${fileSize ? (fileSize / (1024*1024)).toFixed(1) + " MB" : "not on disk"})`);
      if (take.notes) {
        textLogLines.push(`    Notes: ${take.notes}`);
      }
      if (take.expanded_prompt) {
        textLogLines.push(`    Take Prompt: ${take.expanded_prompt}`);
      }
    }

    if (takes.length === 0) {
      textLogLines.push(`  (No takes recorded for this shot)`);
    }

    textLogLines.push("");

    manifestShots.push({
      id: shot.id,
      shot_number: shot.shot_number,
      shot_name: shot.shot_name,
      shot_type: shot.shot_type,
      camera_movement: shot.camera_movement,
      hero_take_id: shot.hero_take_id,
      takes: manifestTakes
    });
  }

  // Also scan scene output folders for any unlinked take files matching scene
  for (const dir of candidateDirs) {
    if (fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if ((file.endsWith(".mp4") || file.endsWith(".webm")) && !file.startsWith(".")) {
            let alreadyAdded = false;
            for (const a of addedFiles) {
              if (a.endsWith(`/${file}`)) {
                alreadyAdded = true;
                break;
              }
            }
            if (!alreadyAdded) {
              const fullP = path.join(dir, file);
              const extraEntryPath = `takes/unassigned/${file}`;
              archive.file(fullP, { name: extraEntryPath });
              addedFiles.add(extraEntryPath);
              totalFilesPackaged++;
            }
          }
        }
      } catch (e) {}
    }
  }

  // Add director notes text log
  archive.append(textLogLines.join("\n"), { name: "DIRECTOR_NOTES.txt" });

  // Add JSON manifest
  const manifest = {
    scene_name: cleanSceneName,
    project_name: rawName,
    exported_at: new Date().toISOString(),
    total_shots: shotsList.length,
    total_takes_packaged: totalFilesPackaged,
    shots: manifestShots
  };
  archive.append(JSON.stringify(manifest, null, 2), { name: "takes_manifest.json" });

  await archive.finalize();
}

export async function importProjectZip(
  uploadedFilePath: string,
  universeResolutions?: Record<string, "keep_local" | "overwrite" | "ingest_as_new">
): Promise<string> {
  const zipBuffer = fs.readFileSync(uploadedFilePath);
  const directory = await unzipper.Open.buffer(zipBuffer);

  let importedProject = "";
  let projectJsonData: any = null;
  let assetsDbMeta: any[] = [];
  let incomingUniverseChars: Record<string, any> = {};

  // Pass 1: find master json & assets_db.json & universe metadata
  for (const file of directory.files) {
    if (file.type !== "File") continue;
    if (file.path === "assets_db.json" || path.basename(file.path) === "assets_db.json") {
      try {
        const buf = await file.buffer();
        const parsed = JSON.parse(buf.toString("utf-8"));
        if (Array.isArray(parsed)) assetsDbMeta = parsed;
      } catch (e) {}
    } else if (file.path === "universe/characters.json" || file.path.endsWith("/universe/characters.json")) {
      try {
        const buf = await file.buffer();
        const parsed = JSON.parse(buf.toString("utf-8"));
        if (parsed && typeof parsed === "object") {
          incomingUniverseChars = { ...incomingUniverseChars, ...parsed };
        }
      } catch (e) {}
    } else if (file.path.endsWith(".json") && !file.path.includes("/")) {
      if (!IGNORED_JSON_FILENAMES.has(file.path.toLowerCase())) {
        importedProject = path.basename(file.path).replace(/\.json$/i, "");
        try {
          const buf = await file.buffer();
          projectJsonData = JSON.parse(buf.toString("utf-8"));
        } catch (e) {}
      }
    }
  }

  // If resolutions are provided, apply them
  if (universeResolutions && Object.keys(universeResolutions).length > 0) {
    universeService.applyUniverseResolution(universeResolutions, incomingUniverseChars);
  } else if (Object.keys(incomingUniverseChars).length > 0) {
    // Default auto-ingest new characters that don't exist locally
    const currentMaster = universeService.getUniverseCharacters();
    for (const [name, char] of Object.entries(incomingUniverseChars)) {
      if (!currentMaster[name]) {
        universeService.upsertUniverseCharacter(char);
      }
    }
  }

  // Determine clean scene name
  const rawSceneName =
    projectJsonData?.scene_name ||
    projectJsonData?.scene_planning?.scene_name ||
    importedProject ||
    "imported_scene";
  const cleanSceneName = sanitizeProjectName(rawSceneName);
  const sceneDirName = formatSceneFolderName(cleanSceneName);

  if (projectJsonData && typeof projectJsonData === "object") {
    projectJsonData.scene_name = sceneDirName;
    if (projectJsonData.scene_planning && typeof projectJsonData.scene_planning === "object") {
      projectJsonData.scene_planning.scene_name = sceneDirName;
    }
  }

  const sceneDirs = ensureSceneDirectories(sceneDirName);

  // Build media type lookup
  const mediaTypeMap: Record<string, string> = {};
  for (const a of assetsDbMeta) {
    if (a?.filename) mediaTypeMap[a.filename] = a.media_type || "image";
  }
  if (Array.isArray(projectJsonData?.assets)) {
    for (const a of projectJsonData.assets) {
      if (a?.filename) mediaTypeMap[a.filename] = a.media_type || "image";
    }
  }

  // Pass 2: extract files into scene hierarchy
  for (const file of directory.files) {
    if (file.type !== "File") continue;
    const fname = path.basename(file.path);
    if (!fname) continue;
    const buffer = await file.buffer();

    if (file.path.startsWith("workflows/") || file.path.startsWith("staged_workflows/")) {
      fs.writeFileSync(path.join(sceneDirs.workflows, fname), buffer);
    } else if (file.path.startsWith("uploads/")) {
      const mType = mediaTypeMap[fname] || "image";
      const targetDir = (sceneDirs as any)[`${mType}s`] || sceneDirs.images;
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.writeFileSync(path.join(targetDir, fname), buffer);
    } else if (file.path.endsWith(".json") && !file.path.includes("/")) {
      if (!IGNORED_JSON_FILENAMES.has(fname.toLowerCase())) {
        const destBase = path.join(sceneDirs.base, `${sceneDirName}.json`);
        fs.writeFileSync(destBase, JSON.stringify(projectJsonData || {}, null, 2));
      }
    }
  }

  // Ensure authoritative json exists
  const authoritativeJson = path.join(sceneDirs.base, `${sceneDirName}.json`);
  if (!fs.existsSync(authoritativeJson) && projectJsonData) {
    fs.writeFileSync(authoritativeJson, JSON.stringify(projectJsonData, null, 2));
  }

  try {
    fs.unlinkSync(uploadedFilePath);
  } catch (e) {}

  return `${sceneDirName}.json`;
}
