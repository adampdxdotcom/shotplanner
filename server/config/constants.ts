import path from "path";
import fs from "fs";
import multer from "multer";

export const ROOT_DIR = process.cwd();
export const ASSETS_DIR = path.join(ROOT_DIR, "assets");
export const IMAGES_DIR = path.join(ASSETS_DIR, "images");
export const WORKFLOWS_DIR = path.join(ASSETS_DIR, "workflows");
export const VIDEOS_DIR = path.join(ASSETS_DIR, "videos");
export const AUDIOS_DIR = path.join(ASSETS_DIR, "audios");
export const UPLOADS_DIR = path.join(ASSETS_DIR, "uploads");
export const PROJECTS_DIR = path.join(ASSETS_DIR, "project_jsons");
export const GEMINI_CONFIG_FILE = path.join(ASSETS_DIR, "gemini_config.json");
export const ASSET_DB_FILE = path.join(ASSETS_DIR, "assets_db.json");
export const TMP_DIR = path.join(ROOT_DIR, "tmp");

/**
 * Standardize scene folder naming e.g., 'Scene 1' -> 'scene01'
 */
export function formatSceneFolderName(sceneName?: string): string {
  if (!sceneName) return "scene01";
  const numMatch = sceneName.match(/\d+/);
  if (numMatch) {
    const num = parseInt(numMatch[0], 10);
    return `scene${num < 10 ? "0" + num : num}`;
  }
  const clean = sceneName.toLowerCase().replace(/[^a-z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return clean || "scene01";
}

/**
 * Get scene-specific directories
 */
export function getSceneDirectories(sceneName: string = "scene01") {
  const sceneFolder = formatSceneFolderName(sceneName);
  return {
    images: path.join(IMAGES_DIR, sceneFolder),
    workflows: path.join(WORKFLOWS_DIR, sceneFolder),
    videos: path.join(VIDEOS_DIR, sceneFolder),
    audios: path.join(AUDIOS_DIR, sceneFolder),
    uploads: path.join(UPLOADS_DIR, sceneFolder)
  };
}

/**
 * Ensure all directories for a specific scene exist on disk
 */
export function ensureSceneDirectories(sceneName: string = "scene01"): {
  images: string;
  workflows: string;
  videos: string;
  audios: string;
  uploads: string;
} {
  const dirs = getSceneDirectories(sceneName);
  Object.values(dirs).forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  return dirs;
}

export const SCENE_REFERENCE_DIRECTIVE = "Do not embellish the setting. Use the exact likeness of location.";

// Standard 1x1 transparent pixel PNG buffer
export const EMPTY_1X1_PNG_BUFFER = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f1563340000000d49444154789c636000000002000148afa4710000000049454e44ae426082",
  "hex"
);

// Ensure all fundamental runtime directories exist
export function initDirectories(): void {
  const baseDirs = [
    ASSETS_DIR,
    IMAGES_DIR,
    WORKFLOWS_DIR,
    VIDEOS_DIR,
    AUDIOS_DIR,
    UPLOADS_DIR,
    PROJECTS_DIR,
    TMP_DIR
  ];
  
  baseDirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Ensure default scene01 folders exist
  const defaultSceneDirs = getSceneDirectories("scene01");
  Object.values(defaultSceneDirs).forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  const defaultEmptyPngPath = path.join(UPLOADS_DIR, "empty.png");
  if (!fs.existsSync(defaultEmptyPngPath)) {
    fs.writeFileSync(defaultEmptyPngPath, EMPTY_1X1_PNG_BUFFER);
  }
}

// Multer upload handler using the temporary directory
export const upload = multer({ dest: TMP_DIR });
