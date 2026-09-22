import path from "path";
import fs from "fs";
import multer from "multer";
import { writeJsonAtomicSync } from "../utils/atomicFs";

export const ROOT_DIR = process.cwd();
export const ASSETS_DIR = path.join(ROOT_DIR, "assets");
export const PROJECTS_DIR = path.join(ASSETS_DIR, "project_jsons");
export const SERVER_CONFIG_DIR = path.join(ROOT_DIR, "data", "config");
export const GEMINI_CONFIG_FILE = path.join(SERVER_CONFIG_DIR, "gemini_config.json");
export const CIVITAI_CONFIG_FILE = path.join(SERVER_CONFIG_DIR, "civitai_config.json");
export const CIVITAI_FAVORITES_FILE = path.join(SERVER_CONFIG_DIR, "civitai_favorites.json");
export const HUGGINGFACE_CONFIG_FILE = path.join(SERVER_CONFIG_DIR, "huggingface_config.json");
export const RUNPOD_CONFIG_FILE = path.join(SERVER_CONFIG_DIR, "runpod_config.json");
export const ASSET_DB_FILE = path.join(ASSETS_DIR, "assets_db.json");
export const UNIVERSE_DIR = path.join(ASSETS_DIR, "universe");
export const UNIVERSE_CHARACTERS_FILE = path.join(UNIVERSE_DIR, "characters.json");
export const UNIVERSE_MEDIA_DIR = path.join(UNIVERSE_DIR, "media");
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
 * Ensure all directories for a specific scene exist on disk Just-In-Time
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

  const emptyPngPath = path.join(dirs.shared, "empty.png");
  if (!fs.existsSync(emptyPngPath)) {
    fs.writeFileSync(emptyPngPath, EMPTY_1X1_PNG_BUFFER);
  }

  return dirs;
}

export const SCENE_REFERENCE_DIRECTIVE = "Do not embellish the setting. Use the exact likeness of location.";

// Standard 1x1 transparent pixel PNG buffer
export const EMPTY_1X1_PNG_BUFFER = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f1563340000000d49444154789c636000000002000148afa4710000000049454e44ae426082",
  "hex"
);

// Ensure only fundamental runtime root base directories exist on server boot
export function initDirectories(): void {
  const baseDirs = [
    ASSETS_DIR,
    SERVER_CONFIG_DIR,
    UNIVERSE_DIR,
    UNIVERSE_MEDIA_DIR,
    TMP_DIR
  ];
  
  baseDirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Migrate any legacy config files from public ASSETS_DIR to protected SERVER_CONFIG_DIR
  const legacyConfigNames = [
    "gemini_config.json",
    "civitai_config.json",
    "civitai_favorites.json",
    "huggingface_config.json",
    "runpod_config.json"
  ];
  legacyConfigNames.forEach((fileName) => {
    const legacyPath = path.join(ASSETS_DIR, fileName);
    const targetPath = path.join(SERVER_CONFIG_DIR, fileName);
    if (fs.existsSync(legacyPath)) {
      try {
        if (!fs.existsSync(targetPath)) {
          fs.copyFileSync(legacyPath, targetPath);
        }
        fs.unlinkSync(legacyPath);
      } catch (err) {
        console.warn(`[Config] Migration note for ${fileName}:`, err);
      }
    }
  });

  if (!fs.existsSync(UNIVERSE_CHARACTERS_FILE)) {
    try {
      writeJsonAtomicSync(UNIVERSE_CHARACTERS_FILE, {});
    } catch (e) {}
  }
}

// Multer upload handler using the temporary directory with 500MB limit for large archives and 4K media
export const upload = multer({
  dest: TMP_DIR,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB
  }
});
