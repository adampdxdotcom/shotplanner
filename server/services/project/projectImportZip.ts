import fs from "fs";
import path from "path";
import unzipper from "unzipper";
import { ensureSceneDirectories, formatSceneFolderName } from "../../config/constants";
import { universeService } from "../universeService";
import { sanitizeProjectName, IGNORED_JSON_FILENAMES } from "./projectCrud";

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
