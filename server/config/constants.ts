import path from "path";
import fs from "fs";
import multer from "multer";

export const ROOT_DIR = process.cwd();
export const ASSETS_DIR = path.join(ROOT_DIR, "assets");
export const WORKFLOWS_DIR = path.join(ASSETS_DIR, "workflows");
export const UPLOADS_DIR = path.join(ASSETS_DIR, "uploads");
export const PROJECTS_DIR = path.join(ASSETS_DIR, "project_jsons");
export const GEMINI_CONFIG_FILE = path.join(ASSETS_DIR, "gemini_config.json");
export const ASSET_DB_FILE = path.join(ASSETS_DIR, "assets_db.json");
export const TMP_DIR = path.join(ROOT_DIR, "tmp");

export const SCENE_REFERENCE_DIRECTIVE = "Do not embellish the setting. Use the exact likeness of location.";

// Standard 1x1 transparent pixel PNG buffer
export const EMPTY_1X1_PNG_BUFFER = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f1563340000000d49444154789c636000000002000148afa4710000000049454e44ae426082",
  "hex"
);

// Ensure all fundamental runtime directories exist
export function initDirectories(): void {
  [ASSETS_DIR, WORKFLOWS_DIR, UPLOADS_DIR, PROJECTS_DIR, TMP_DIR].forEach((dir) => {
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
