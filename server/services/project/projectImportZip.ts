import fs from "fs";
import path from "path";
import unzipper from "unzipper";
import { ensureSceneDirectories, formatSceneFolderName, ASSETS_DIR, ASSET_DB_FILE, UNIVERSE_MEDIA_DIR } from "../../config/constants";
import { universeService } from "../universeService";
import { sanitizeProjectName, IGNORED_JSON_FILENAMES } from "./projectCrud";
import { writeJsonAtomicSync } from "../../utils/atomicFs";

export async function importProjectZip(
  uploadedFilePath: string,
  universeResolutions?: Record<string, "keep_local" | "overwrite" | "ingest_as_new">
): Promise<string> {
  console.log(`[ZIP Import] Starting ZIP import from: ${uploadedFilePath}`);
  const zipBuffer = fs.readFileSync(uploadedFilePath);
  const directory = await unzipper.Open.buffer(zipBuffer);

  let importedProject = "";
  let projectJsonData: any = null;
  let assetsDbMeta: any[] = [];
  let incomingUniverseChars: Record<string, any> = {};

  // Detect if there is a common top-level directory prefix (e.g., macOS / Windows compressed folder wrapper)
  let commonPrefix = "";
  const nonHiddenFiles = directory.files.filter(f => f.type === "File" && !path.basename(f.path).startsWith("."));
  if (nonHiddenFiles.length > 0) {
    const firstPath = nonHiddenFiles[0].path;
    const parts = firstPath.split("/");
    if (parts.length > 1) {
      const candidatePrefix = parts[0] + "/";
      const allSharePrefix = nonHiddenFiles.every(f => f.path.startsWith(candidatePrefix));
      if (allSharePrefix) {
        commonPrefix = candidatePrefix;
        console.log(`[ZIP Import] Detected top-level folder wrapper prefix in ZIP: "${commonPrefix}"`);
      }
    }
  }

  // Normalization helper
  const getNormalizedPath = (filePath: string): string => {
    if (commonPrefix && filePath.startsWith(commonPrefix)) {
      return filePath.substring(commonPrefix.length);
    }
    return filePath;
  };

  // Pass 1: find master json & assets_db.json & universe metadata
  for (const file of directory.files) {
    if (file.type !== "File") continue;
    const normPath = getNormalizedPath(file.path);
    const fname = path.basename(normPath);
    if (!fname || fname.startsWith(".")) continue;

    if (normPath === "assets_db.json" || fname === "assets_db.json") {
      try {
        const buf = await file.buffer();
        const parsed = JSON.parse(buf.toString("utf-8"));
        if (Array.isArray(parsed)) {
          assetsDbMeta = parsed;
          console.log(`[ZIP Import] Found assets_db.json in ZIP with ${assetsDbMeta.length} assets`);
        }
      } catch (e) {
        console.error(`[ZIP Import] Failed to parse assets_db.json:`, e);
      }
    } else if (normPath === "universe/characters.json" || normPath.endsWith("/universe/characters.json")) {
      try {
        const buf = await file.buffer();
        const parsed = JSON.parse(buf.toString("utf-8"));
        if (parsed && typeof parsed === "object") {
          incomingUniverseChars = { ...incomingUniverseChars, ...parsed };
          console.log(`[ZIP Import] Found universe/characters.json in ZIP with ${Object.keys(parsed).length} characters`);
        }
      } catch (e) {
        console.error(`[ZIP Import] Failed to parse universe/characters.json:`, e);
      }
    } else if (normPath.endsWith(".json") && !normPath.includes("/")) {
      if (!IGNORED_JSON_FILENAMES.has(fname.toLowerCase())) {
        try {
          const buf = await file.buffer();
          const parsed = JSON.parse(buf.toString("utf-8"));
          
          // Heuristic structural check to verify this is indeed a project scene file
          if (parsed && typeof parsed === "object" && (parsed.scene_name || Array.isArray(parsed.shots) || parsed.scene_planning)) {
            importedProject = fname.replace(/\.json$/i, "");
            projectJsonData = parsed;
            console.log(`[ZIP Import] Found master project scene JSON file in ZIP: "${normPath}"`);
          } else {
            console.log(`[ZIP Import] Skipping non-project JSON at root: "${normPath}"`);
          }
        } catch (e) {
          console.error(`[ZIP Import] Error parsing candidate JSON file "${normPath}":`, e);
        }
      }
    }
  }

  // Fallback: If no project JSON was found via strict heuristic, accept any non-ignored root JSON file
  if (!projectJsonData) {
    for (const file of directory.files) {
      if (file.type !== "File") continue;
      const normPath = getNormalizedPath(file.path);
      if (normPath.endsWith(".json") && !normPath.includes("/")) {
        const fname = path.basename(normPath);
        if (!IGNORED_JSON_FILENAMES.has(fname.toLowerCase())) {
          try {
            const buf = await file.buffer();
            const parsed = JSON.parse(buf.toString("utf-8"));
            if (parsed && typeof parsed === "object") {
              importedProject = fname.replace(/\.json$/i, "");
              projectJsonData = parsed;
              console.log(`[ZIP Import] Fallback: Accepted master project JSON from: "${normPath}"`);
              break;
            }
          } catch (e) {}
        }
      }
    }
  }

  if (!projectJsonData) {
    console.warn("[ZIP Import] No valid project scene JSON found inside the ZIP archive!");
  }

  // If resolutions are provided, apply them
  if (universeResolutions && Object.keys(universeResolutions).length > 0) {
    console.log(`[ZIP Import] Applying character import resolutions...`);
    universeService.applyUniverseResolution(universeResolutions, incomingUniverseChars);
  } else if (Object.keys(incomingUniverseChars).length > 0) {
    console.log(`[ZIP Import] Auto-ingesting characters...`);
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

  console.log(`[ZIP Import] Resolving scene name: "${rawSceneName}" -> directory: "${sceneDirName}"`);

  if (projectJsonData && typeof projectJsonData === "object") {
    projectJsonData.scene_name = sceneDirName;
    if (projectJsonData.scene_planning && typeof projectJsonData.scene_planning === "object") {
      projectJsonData.scene_planning.scene_name = sceneDirName;
    }
  }

  const sceneDirs = ensureSceneDirectories(sceneDirName);

  // Build media type lookup from metadata and assets
  const mediaTypeMap: Record<string, string> = {};
  const metaLookup = new Map<string, any>();

  for (const a of assetsDbMeta) {
    if (a?.filename) {
      mediaTypeMap[a.filename] = a.media_type || "image";
      metaLookup.set(a.filename.toLowerCase(), a);
    }
  }
  if (Array.isArray(projectJsonData?.assets)) {
    for (const a of projectJsonData.assets) {
      if (a?.filename) {
        mediaTypeMap[a.filename] = a.media_type || "image";
        const key = a.filename.toLowerCase();
        if (!metaLookup.has(key)) metaLookup.set(key, a);
      }
    }
  }

  const registeredAssets: any[] = [];

  // Pass 2: extract files into scene hierarchy
  for (const file of directory.files) {
    if (file.type !== "File") continue;
    const normPath = getNormalizedPath(file.path);
    const fname = path.basename(normPath);
    if (!fname || fname.startsWith(".")) continue;
    
    const buffer = await file.buffer();

    if (normPath.startsWith("workflows/") || normPath.startsWith("staged_workflows/")) {
      const destPath = path.join(sceneDirs.workflows, fname);
      fs.writeFileSync(destPath, buffer);
      console.log(`[ZIP Import] Extracted workflow: "${normPath}" -> "${destPath}"`);
    } else if (normPath.startsWith("uploads/")) {
      const mType = mediaTypeMap[fname] || "image";
      const meta = metaLookup.get(fname.toLowerCase());
      const isUniverse = !!(meta?.is_universe || meta?.scene_name === "universe" || meta?.scene_name === "Universe");

      let destPath: string;
      if (isUniverse) {
        if (!fs.existsSync(UNIVERSE_MEDIA_DIR)) {
          fs.mkdirSync(UNIVERSE_MEDIA_DIR, { recursive: true });
        }
        destPath = path.join(UNIVERSE_MEDIA_DIR, fname);
        console.log(`[ZIP Import] Extracted global universe asset: "${normPath}" -> "${destPath}"`);
      } else {
        const targetDir = (sceneDirs as any)[`${mType}s`] || sceneDirs.images;
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        destPath = path.join(targetDir, fname);
        console.log(`[ZIP Import] Extracted upload: "${normPath}" -> "${destPath}"`);
      }

      fs.writeFileSync(destPath, buffer);

      // Track the asset to register in the central assets database later
      registeredAssets.push({
        filename: fname,
        path: destPath,
        mediaType: mType,
        isUniverse: isUniverse
      });
    } else if (normPath.startsWith("takes/") || normPath.startsWith("outputs/")) {
      const outputsDir = path.join(sceneDirs.base, "outputs");
      if (!fs.existsSync(outputsDir)) {
        fs.mkdirSync(outputsDir, { recursive: true });
      }
      const destPath = path.join(outputsDir, fname);
      fs.writeFileSync(destPath, buffer);
      console.log(`[ZIP Import] Extracted take/render video: "${normPath}" -> "${destPath}"`);

      // Track the extracted video take in the asset DB
      registeredAssets.push({
        filename: fname,
        path: destPath,
        mediaType: "video"
      });
    } else if (normPath.endsWith(".json") && !normPath.includes("/")) {
      if (!IGNORED_JSON_FILENAMES.has(fname.toLowerCase())) {
        const destBase = path.join(sceneDirs.base, `${sceneDirName}.json`);
        writeJsonAtomicSync(destBase, projectJsonData || {});
        console.log(`[ZIP Import] Extracted project scene file to base: "${destBase}"`);
      }
    }
  }

  // Ensure authoritative json exists
  const authoritativeJson = path.join(sceneDirs.base, `${sceneDirName}.json`);
  if (!fs.existsSync(authoritativeJson) && projectJsonData) {
    writeJsonAtomicSync(authoritativeJson, projectJsonData);
    console.log(`[ZIP Import] Assured authoritative scene JSON file is written to: "${authoritativeJson}"`);
  }

  // Merge any registered assets into the server's master ASSET_DB_FILE
  if (registeredAssets.length > 0) {
    try {
      let dbRecords: any[] = [];
      if (fs.existsSync(ASSET_DB_FILE)) {
        try {
          const raw = fs.readFileSync(ASSET_DB_FILE, "utf-8");
          const loaded = JSON.parse(raw);
          if (Array.isArray(loaded)) dbRecords = loaded;
        } catch (e) {
          console.error(`[ZIP Import] Error reading ASSET_DB_FILE:`, e);
        }
      }

      const existingMap = new Map<string, any>();
      for (const r of dbRecords) {
        if (r && r.filename) {
          existingMap.set(r.filename.toLowerCase(), r);
        }
      }

      for (const item of registeredAssets) {
        const meta = metaLookup.get(item.filename.toLowerCase());
        const size = fs.existsSync(item.path) ? fs.statSync(item.path).size : 0;

        existingMap.set(item.filename.toLowerCase(), {
          id: meta?.id || item.filename,
          filename: item.filename,
          original_name: meta?.original_name || item.filename,
          media_type: meta?.media_type || item.mediaType,
          type: meta?.type || (item.mediaType === "image" ? "headshot" : "unknown"),
          subject_name: meta?.subject_name || "subject",
          description: meta?.description || "",
          tags: Array.isArray(meta?.tags) ? meta.tags : [],
          size_bytes: size,
          scene_name: item.isUniverse ? "universe" : sceneDirName,
          is_universe: !!item.isUniverse,
          preview_url: `/api/uploads/${item.filename}`,
          path: item.path
        });
      }

      const mergedRecords = Array.from(existingMap.values());
      writeJsonAtomicSync(ASSET_DB_FILE, mergedRecords);
      console.log(`[ZIP Import] Merged and saved ${registeredAssets.length} asset metadata records into "${ASSET_DB_FILE}"`);
    } catch (e) {
      console.error(`[ZIP Import] Error merging asset records in ASSET_DB_FILE:`, e);
    }
  }

  try {
    fs.unlinkSync(uploadedFilePath);
    console.log(`[ZIP Import] Cleaned up temporary upload file at: ${uploadedFilePath}`);
  } catch (e) {}

  console.log(`[ZIP Import] Successfully completed ZIP import. Authoritative file: "${sceneDirName}.json"`);
  return `${sceneDirName}.json`;
}
