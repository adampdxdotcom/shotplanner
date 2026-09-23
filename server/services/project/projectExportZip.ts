import fs from "fs";
import path from "path";
import { Response } from "express";
import { ZipArchive } from "archiver";
import { 
  ASSETS_DIR, 
  UPLOADS_DIR, 
  WORKFLOWS_DIR, 
  UNIVERSE_MEDIA_DIR, 
  formatSceneFolderName, 
  getSceneDirectories,
  EMPTY_1X1_PNG_BUFFER 
} from "../../config/constants";
import { assetService } from "../assetService";
import { universeService } from "../universeService";
import { formatShotNumber, sanitizeFilenamePart, generateSaveVideoPrefix } from "../../utils/formatters";
import { parseWorkflowData, injectAndPrepareWorkflowData } from "../workflowService";
import { findProjectFile } from "./projectCrud";

/**
 * Locate asset file across scene folders, uploads, and universe media
 */
function findAssetFile(filename: string): string | null {
  if (!filename) return null;
  const cleanFn = path.basename(filename.trim());
  if (!cleanFn || cleanFn === "thumbnails" || cleanFn === ".DS_Store") return null;

  // 1. Primary check: Use the live database/disk path resolver from assetService
  try {
    const resolvedPath = assetService.getAssetFilePath(cleanFn);
    if (resolvedPath && fs.existsSync(resolvedPath)) {
      return resolvedPath;
    }
  } catch (e) {
    console.warn(`Error using assetService path resolver for ${cleanFn}:`, e);
  }

  // 2. Fallback: Search standard candidate folders
  const candidateDirs = [
    UPLOADS_DIR,
    UNIVERSE_MEDIA_DIR,
    path.join(process.cwd(), "assets", "images"),
    path.join(process.cwd(), "assets", "videos"),
    path.join(process.cwd(), "assets", "audios"),
    path.join(process.cwd(), "assets", "shared"),
    path.join(ASSETS_DIR, "shared")
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
}

/**
 * Locate workflow template file on disk
 */
function findWorkflowFile(wfFilename: string, sceneName?: string): string | null {
  if (!wfFilename) return null;
  const cleanWf = path.basename(wfFilename.trim());
  if (!cleanWf) return null;

  const candidatePaths: string[] = [];
  if (sceneName) {
    candidatePaths.push(path.join(getSceneDirectories(sceneName).workflows, cleanWf));
  }
  candidatePaths.push(
    path.join(WORKFLOWS_DIR, cleanWf),
    path.join(process.cwd(), "assets", "workflows", cleanWf)
  );

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) return p;
  }

  const bases = [
    WORKFLOWS_DIR,
    path.join(process.cwd(), "assets", "workflows")
  ];
  if (sceneName) {
    bases.unshift(getSceneDirectories(sceneName).workflows);
  }

  for (const base of bases) {
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
}

export async function exportProjectZip(
  projectName: string, 
  res: Response, 
  options: { includeAssets?: boolean; includeRenders?: boolean; includeTakes?: boolean } = {}
): Promise<void> {
  const filePath = findProjectFile(projectName);

  if (!filePath || !fs.existsSync(filePath)) {
    res.status(404).json({ error: `Project '${projectName}' not found on server. Please save it first.` });
    return;
  }

  const projectData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const rawName = path.parse(filePath).name;
  const cleanSceneName = sanitizeFilenamePart(projectData.scene_name || rawName || "Scene");

  const includeAssets = options.includeAssets !== false; // Default: true
  const includeRenders = options.includeRenders === true || options.includeTakes === true; // Default: false

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

  // Also collect all workflow .json files stored directly in the active scene's workflow directory
  const sceneWfDir = getSceneDirectories(projectData.scene_name || rawName).workflows;
  if (fs.existsSync(sceneWfDir)) {
    try {
      const sceneWfFiles = fs.readdirSync(sceneWfDir).filter(f => f.toLowerCase().endsWith(".json"));
      for (const f of sceneWfFiles) {
        referencedWfFiles.add(f);
      }
    } catch (e) {
      console.error("Error reading scene workflow directory for zip export:", e);
    }
  }

  for (const wfFile of referencedWfFiles) {
    const foundWfPath = findWorkflowFile(wfFile, projectData.scene_name || rawName);
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

  // 3. Add all project media assets into uploads/ (if assets are enabled)
  const addedFiles = new Set<string>();
  const rawDb = assetService.getAllAssets(projectData.scene_name, { includeUniverse: true });

  const collectAsset = (filename?: string) => {
    if (!includeAssets) return; // Skip if assets switch is disabled
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

  if (includeAssets && addedFiles.size <= 1 && rawDb.length > 0) {
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

    // Hero Take Selection & Parameter Resolution
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
    if (options.includeTakes && heroTake && !includeRenders) {
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

  // 6. Include full Renders package if explicitly requested (Unified single-download switch)
  if (includeRenders) {
    const addedRenders = new Set<string>();
    const manifestShots: any[] = [];
    const textLogLines: string[] = [
      "================================================================================",
      `DIRECTOR TAKES LOG - SCENE: ${cleanSceneName.toUpperCase()}`,
      `Exported At: ${new Date().toLocaleString()}`,
      `Project: ${rawName}.json`,
      "================================================================================",
      ""
    ];

    const candidateRendersDirs = [
      path.join(ASSETS_DIR, formatSceneFolderName(cleanSceneName), "outputs"),
      path.join(ASSETS_DIR, sanitizeFilenamePart(cleanSceneName), "outputs"),
      path.join(ASSETS_DIR, cleanSceneName, "outputs"),
      path.join(ASSETS_DIR, "outputs"),
      UPLOADS_DIR
    ];

    let totalRendersPackaged = 0;

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
            for (const dir of candidateRendersDirs) {
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
          if (!addedRenders.has(zipEntryPath)) {
            archive.file(foundPath, { name: zipEntryPath });
            addedRenders.add(zipEntryPath);
            totalRendersPackaged++;
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
    for (const dir of candidateRendersDirs) {
      if (fs.existsSync(dir)) {
        try {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            if ((file.endsWith(".mp4") || file.endsWith(".webm")) && !file.startsWith(".")) {
              let alreadyAdded = false;
              for (const a of addedRenders) {
                if (a.endsWith(`/${file}`)) {
                  alreadyAdded = true;
                  break;
                }
              }
              if (!alreadyAdded) {
                const fullP = path.join(dir, file);
                const extraEntryPath = `takes/unassigned/${file}`;
                archive.file(fullP, { name: extraEntryPath });
                addedRenders.add(extraEntryPath);
                totalRendersPackaged++;
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
      total_takes_packaged: totalRendersPackaged,
      shots: manifestShots
    };
    archive.append(JSON.stringify(manifest, null, 2), { name: "takes_manifest.json" });
  }

  await archive.finalize();
}
