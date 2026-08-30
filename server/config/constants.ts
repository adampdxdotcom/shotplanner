import path from "path";
import fs from "fs";
import multer from "multer";

export const ROOT_DIR = process.cwd();
export const ASSETS_DIR = path.join(ROOT_DIR, "assets");
export const PROJECTS_DIR = path.join(ASSETS_DIR, "project_jsons");
export const GEMINI_CONFIG_FILE = path.join(ASSETS_DIR, "gemini_config.json");
export const ASSET_DB_FILE = path.join(ASSETS_DIR, "assets_db.json");
export const TMP_DIR = path.join(ROOT_DIR, "tmp");

// Legacy directories for backward compatibility
export const LEGACY_IMAGES_DIR = path.join(ASSETS_DIR, "images");
export const LEGACY_WORKFLOWS_DIR = path.join(ASSETS_DIR, "workflows");
export const LEGACY_VIDEOS_DIR = path.join(ASSETS_DIR, "videos");
export const LEGACY_AUDIOS_DIR = path.join(ASSETS_DIR, "audios");
export const LEGACY_UPLOADS_DIR = path.join(ASSETS_DIR, "uploads");

// Aliases for backward compatibility in imports
export const WORKFLOWS_DIR = LEGACY_WORKFLOWS_DIR;
export const UPLOADS_DIR = LEGACY_UPLOADS_DIR;

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
  const scenePath = path.join(ASSETS_DIR, sceneFolder);
  return {
    base: scenePath,
    images: path.join(scenePath, "images"),
    workflows: path.join(scenePath, "workflows"),
    videos: path.join(scenePath, "videos"),
    audios: path.join(scenePath, "audios"),
    shared: path.join(scenePath, "shared")
  };
}

/**
 * Ensure all directories for a specific scene exist on disk
 */
export function ensureSceneDirectories(sceneName: string = "scene01"): {
  base: string;
  images: string;
  workflows: string;
  videos: string;
  audios: string;
  shared: string;
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
    PROJECTS_DIR,
    TMP_DIR,
    LEGACY_IMAGES_DIR,
    LEGACY_WORKFLOWS_DIR,
    LEGACY_VIDEOS_DIR,
    LEGACY_AUDIOS_DIR,
    LEGACY_UPLOADS_DIR
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

  const defaultEmptyPngPath = path.join(defaultSceneDirs.shared, "empty.png");
  if (!fs.existsSync(defaultEmptyPngPath)) {
    fs.writeFileSync(defaultEmptyPngPath, EMPTY_1X1_PNG_BUFFER);
  }
}

// Multer upload handler using the temporary directory
export const upload = multer({ dest: TMP_DIR });
