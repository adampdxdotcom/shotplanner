/**
 * Utility functions to filter and strictly validate ComfyUI workflow files.
 */

// Patterns for folder names that should never be searched or accepted
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
  ".idea",
  "custom_nodes",
  "comfyui-manager",
  "node_db"
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
  ".swp",
  "settings",
  "model-list",
  "github-stats",
  "extras",
  "extension-node-map",
  "custom-node-list",
  "alter-list"
];

const KNOWN_NON_WORKFLOW_FILENAMES = new Set([
  "comfy.settings.json",
  "comfyui.json",
  "package.json",
  "tsconfig.json",
  "model-list.json",
  "github-stats.json",
  "extras.json",
  "extension-node-map.json",
  "custom-node-list.json",
  "alter-list.json"
]);

/**
 * Returns true if a workflow file path or filename represents a cache, autosave, temp, or non-workflow system file.
 */
export function isCacheOrTempWorkflow(filename: string, folder?: string, fullPath?: string): boolean {
  const cleanFilename = (filename || "").toLowerCase().trim();
  const cleanFolder = (folder || "").toLowerCase().trim();
  const cleanPath = (fullPath || "").toLowerCase().trim();

  // 1. Must be a .json file
  if (!cleanFilename.endsWith(".json")) {
    return true;
  }

  // 2. Explicit known non-workflow filenames
  if (KNOWN_NON_WORKFLOW_FILENAMES.has(cleanFilename)) {
    return true;
  }

  // 3. Check filename prefixes
  for (const prefix of EXCLUDED_FILENAME_PREFIXES) {
    if (cleanFilename.startsWith(prefix)) {
      return true;
    }
  }

  // 4. Check filename substrings
  for (const sub of EXCLUDED_FILENAME_SUBSTRINGS) {
    if (cleanFilename.includes(sub)) {
      return true;
    }
  }

  // 5. Check folder segments
  const pathParts = cleanPath.split("/").concat(cleanFolder.split("/"));
  for (const part of pathParts) {
    if (!part) continue;
    if (EXCLUDED_FOLDER_NAMES.includes(part) || part.startsWith(".")) {
      return true;
    }
  }

  return false;
}
