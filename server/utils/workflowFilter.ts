/**
 * Utility functions to filter out cache, temporary, autosave, and backup files
 * from discovered remote ComfyUI workflows.
 */

// Patterns indicating cache or temporary folders/files
const EXCLUDED_FOLDER_NAMES = [
  ".git",
  ".cache",
  "cache",
  "node_modules",
  "models",
  "venv",
  ".venv",
  "env",
  "__pycache__",
  "input",
  "output",
  "dist",
  "temp",
  "tmp",
  ".temp",
  ".tmp",
  "logs",
  ".vscode",
  ".idea"
];

// Patterns for filenames that should be ignored
const EXCLUDED_FILENAME_PREFIXES = [
  "autosave",
  "auto_save",
  "temp_",
  "tmp_",
  "cache_",
  "backup_",
  ".",
  "~",
  "_",
  "preview_"
];

const EXCLUDED_FILENAME_SUBSTRINGS = [
  ".cache.",
  ".bak",
  ".backup",
  "-checkpoint",
  ".tmp.",
  ".swp"
];

/**
 * Returns true if a workflow file path or filename represents a cache, autosave, or temp file.
 */
export function isCacheOrTempWorkflow(filename: string, folder?: string, fullPath?: string): boolean {
  const cleanFilename = (filename || "").toLowerCase().trim();
  const cleanFolder = (folder || "").toLowerCase().trim();
  const cleanPath = (fullPath || "").toLowerCase().trim();

  // 1. Must be a .json file
  if (!cleanFilename.endsWith(".json")) {
    return true;
  }

  // 2. Check filename prefixes
  for (const prefix of EXCLUDED_FILENAME_PREFIXES) {
    if (cleanFilename.startsWith(prefix)) {
      return true;
    }
  }

  // 3. Check filename substrings
  for (const sub of EXCLUDED_FILENAME_SUBSTRINGS) {
    if (cleanFilename.includes(sub)) {
      return true;
    }
  }

  // 4. Check folder segments
  const pathParts = cleanPath.split("/").concat(cleanFolder.split("/"));
  for (const part of pathParts) {
    if (!part) continue;
    if (EXCLUDED_FOLDER_NAMES.includes(part) || part.startsWith(".")) {
      return true;
    }
  }

  // 5. Exclude ComfyUI internal system files
  if (
    cleanFilename === "extra_model_paths.yaml.example" ||
    cleanFilename === "comfyui.json" ||
    cleanFilename === "package.json" ||
    cleanFilename === "tsconfig.json"
  ) {
    return true;
  }

  return false;
}
