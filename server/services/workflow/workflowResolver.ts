import fs from "fs";
import path from "path";
import { WORKFLOWS_DIR, ASSETS_DIR, formatSceneFolderName, getSceneDirectories } from "../../config/constants";
import { parseWorkflowData } from "./workflowParser";
import { createScopedLogger } from "../../utils/logger";

const log = createScopedLogger("WorkflowResolver");

export interface ResolvedWorkflowTemplate {
  resolvedPath: string;
  resolvedFilename: string;
  rawWorkflow: any;
}

export function listWorkflows(sceneName?: string) {
  const workflowMap = new Map<string, { filename: string; path: string; node_count: number; title: string }>();

  const scanDir = (dirPath: string, folderLabel?: string, publicPathPrefix?: string) => {
    if (!fs.existsSync(dirPath)) return;
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && /\.json$/i.test(entry.name)) {
          const f = entry.name;
          if (workflowMap.has(f.toLowerCase())) continue;
          const fullPath = path.join(dirPath, f);
          try {
            const content = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
            const parsed = parseWorkflowData(content);
            const cleanTitle = f.replace(/\.json$/i, "").replace(/[_-]/g, " ");
            workflowMap.set(f.toLowerCase(), {
              filename: f,
              path: publicPathPrefix ? `${publicPathPrefix}/${f}` : `/assets/workflows/${f}`,
              node_count: parsed.totalNodes,
              title: cleanTitle
            });
          } catch {
            const cleanTitle = f.replace(/\.json$/i, "").replace(/[_-]/g, " ");
            workflowMap.set(f.toLowerCase(), {
              filename: f,
              path: publicPathPrefix ? `${publicPathPrefix}/${f}` : `/assets/workflows/${f}`,
              node_count: 0,
              title: cleanTitle
            });
          }
        }
      }
    } catch (e) {
      log.warn(`Failed reading ${dirPath}:`, { error: e });
    }
  };

  // 1. If scene specified, scan scene workflows first (highest priority)
  if (sceneName) {
    const sceneFolder = formatSceneFolderName(sceneName);
    scanDir(getSceneDirectories(sceneName).workflows, sceneFolder, `/assets/${sceneFolder}/workflows`);
    scanDir(path.join(WORKFLOWS_DIR, sceneFolder), sceneFolder, `/assets/workflows/${sceneFolder}`);
    scanDir(path.join(ASSETS_DIR, sceneFolder, "workflows"), sceneFolder, `/assets/${sceneFolder}/workflows`);
  }

  // 2. Scan top-level WORKFLOWS_DIR and process.cwd() workflows for global base templates
  scanDir(WORKFLOWS_DIR, undefined, "/assets/workflows");
  const topLevelWfDir = path.join(process.cwd(), "workflows");
  if (fs.existsSync(topLevelWfDir) && topLevelWfDir !== WORKFLOWS_DIR) {
    scanDir(topLevelWfDir, undefined, "/workflows");
  }

  // 3. ONLY if NO sceneName was specified (global explorer mode), scan all project directories.
  // When a sceneName IS specified, we do NOT scan sibling project directories so each project only sees its own workflows.
  if (!sceneName) {
    if (fs.existsSync(ASSETS_DIR)) {
      try {
        const dirs = fs.readdirSync(ASSETS_DIR, { withFileTypes: true });
        for (const d of dirs) {
          if (d.isDirectory() && d.name !== "workflows" && d.name !== "uploads" && d.name !== "tmp_uploads" && d.name !== ".aistudio") {
            const sceneWfDir = path.join(ASSETS_DIR, d.name, "workflows");
            scanDir(sceneWfDir, d.name, `/assets/${d.name}/workflows`);
          }
        }
      } catch {}
    }

    if (fs.existsSync(WORKFLOWS_DIR)) {
      try {
        const dirs = fs.readdirSync(WORKFLOWS_DIR, { withFileTypes: true });
        for (const d of dirs) {
          if (d.isDirectory() && d.name !== "workflows") {
            scanDir(path.join(WORKFLOWS_DIR, d.name), d.name, `/assets/workflows/${d.name}`);
          }
        }
      } catch {}
    }
  }

  const workflowItems = Array.from(workflowMap.values());
  const files = workflowItems.map((item) => item.filename);
  return { workflows: files, workflow_items: workflowItems };
}

/**
 * Resiliently resolve and parse a ComfyUI workflow JSON template from disk.
 * Searches scene-specific directories and global workflows dir.
 */
export function resolveWorkflowTemplate(
  requestedFilename?: string,
  sceneName?: string
): ResolvedWorkflowTemplate {
  const cleanScene = sceneName ? formatSceneFolderName(sceneName) : "";
  const candidates: string[] = [];

  let cleanRequested = (requestedFilename || "").trim();
  if (cleanRequested.includes("/") || cleanRequested.includes("\\")) {
    cleanRequested = path.basename(cleanRequested);
  }

  const isGeneric =
    !cleanRequested ||
    cleanRequested === "default.json" ||
    cleanRequested === "default" ||
    cleanRequested === "undefined" ||
    cleanRequested === "null";

  if (!isGeneric) {
    if (cleanScene) {
      candidates.push(path.join(getSceneDirectories(cleanScene).workflows, cleanRequested));
      candidates.push(path.join(ASSETS_DIR, cleanScene, "workflows", cleanRequested));
      candidates.push(path.join(WORKFLOWS_DIR, cleanScene, cleanRequested));
    }
    candidates.push(path.join(WORKFLOWS_DIR, cleanRequested));
    candidates.push(path.join(ASSETS_DIR, "workflows", cleanRequested));
    candidates.push(path.join(process.cwd(), "workflows", cleanRequested));
  }

  // Fallback candidate templates
  if (cleanScene) {
    candidates.push(path.join(getSceneDirectories(cleanScene).workflows, "minimax_video_workflow.json"));
    candidates.push(path.join(ASSETS_DIR, cleanScene, "workflows", "minimax_video_workflow.json"));
    candidates.push(path.join(WORKFLOWS_DIR, cleanScene, "minimax_video_workflow.json"));
  }
  candidates.push(path.join(WORKFLOWS_DIR, "minimax_video_workflow.json"));
  candidates.push(path.join(process.cwd(), "workflows", "minimax_video_workflow.json"));

  // Check candidates in order
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      try {
        const raw = JSON.parse(fs.readFileSync(candidate, "utf-8"));
        return {
          resolvedPath: candidate,
          resolvedFilename: path.basename(candidate),
          rawWorkflow: raw
        };
      } catch (e: any) {
        log.warn(`Candidate ${candidate} exists but failed to parse: ${e.message}`);
      }
    }
  }

  // Search directory tree for any valid workflow json file strictly within the project or global workflows
  const searchDirs = [
    cleanScene ? getSceneDirectories(cleanScene).workflows : null,
    cleanScene ? path.join(ASSETS_DIR, cleanScene, "workflows") : null,
    cleanScene ? path.join(WORKFLOWS_DIR, cleanScene) : null,
    WORKFLOWS_DIR,
    path.join(ASSETS_DIR, "workflows"),
    !cleanScene ? ASSETS_DIR : null
  ].filter(Boolean) as string[];

  for (const searchDir of searchDirs) {
    if (fs.existsSync(searchDir)) {
      try {
        const files = fs.readdirSync(searchDir);
        for (const file of files) {
          if (
            file.endsWith(".json") &&
            !file.includes(".scene.") &&
            !file.includes("config") &&
            !file.includes("universe") &&
            !file.includes("characters") &&
            !file.includes("assets_db")
          ) {
            const fullPath = path.join(searchDir, file);
            if (fs.statSync(fullPath).isFile()) {
              try {
                const raw = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
                if (raw && (raw.nodes || Object.keys(raw).some(k => raw[k]?.class_type))) {
                  return {
                    resolvedPath: fullPath,
                    resolvedFilename: file,
                    rawWorkflow: raw
                  };
                }
              } catch (e) {}
            }
          }
        }
      } catch (e) {}
    }
  }

  throw new Error(
    `Workflow template "${cleanRequested || "default"}" could not be found or loaded for scene "${cleanScene || "global"}". Please upload or select a valid ComfyUI workflow JSON for this project.`
  );
}


/**
 * Safely delete a workflow JSON template from disk.
 * Removes matching copies within the specified scene workflows or global workflows dir.
 */
export function deleteWorkflow(
  filename: string,
  sceneName?: string
): { success: boolean; deletedCount: number; filename: string } {
  if (!filename || typeof filename !== "string") {
    throw new Error("Filename is required for workflow deletion.");
  }

  // Prevent directory traversal attacks
  const cleanFilename = path.basename(filename.trim());
  if (!cleanFilename.toLowerCase().endsWith(".json")) {
    throw new Error("Only .json workflow files may be deleted.");
  }

  const cleanScene = sceneName ? formatSceneFolderName(sceneName) : "";
  const targetsToDelete = new Set<string>();

  if (cleanScene) {
    targetsToDelete.add(path.join(getSceneDirectories(cleanScene).workflows, cleanFilename));
    targetsToDelete.add(path.join(ASSETS_DIR, cleanScene, "workflows", cleanFilename));
    targetsToDelete.add(path.join(WORKFLOWS_DIR, cleanScene, cleanFilename));
  } else {
    // If no scene specified, check global and legacy
    targetsToDelete.add(path.join(WORKFLOWS_DIR, cleanFilename));
    targetsToDelete.add(path.join(ASSETS_DIR, "workflows", cleanFilename));
    const topLevelWfDir = path.join(process.cwd(), "workflows");
    if (fs.existsSync(topLevelWfDir)) {
      targetsToDelete.add(path.join(topLevelWfDir, cleanFilename));
    }
  }

  let deletedCount = 0;
  for (const filePath of targetsToDelete) {
    try {
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
        deletedCount++;
        log.info(`Deleted workflow file: ${filePath}`);
      }
    } catch (err: any) {
      log.warn(`Could not delete workflow at ${filePath}:`, { error: err.message });
    }
  }

  if (deletedCount === 0) {
    log.warn(`No existing workflow files found to delete for "${cleanFilename}" in scene "${cleanScene || "global"}"`);
  }

  return {
    success: true,
    deletedCount,
    filename: cleanFilename
  };
}
