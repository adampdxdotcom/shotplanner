import fs from "fs";
import path from "path";
import { ASSETS_DIR, PROJECTS_DIR, ensureSceneDirectories, formatSceneFolderName } from "../../config/constants";

export const IGNORED_JSON_FILENAMES = new Set([
  "assets_db.json",
  "gemini_config.json",
  "civitai_config.json",
  "civitai_favorites.json",
  "huggingface_config.json",
  "runpod_config.json",
  "characters.json",
  "package.json",
  "tsconfig.json",
  "metadata.json",
  "takes_manifest.json"
]);

export const IGNORED_ASSET_DIRECTORIES = new Set([
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
