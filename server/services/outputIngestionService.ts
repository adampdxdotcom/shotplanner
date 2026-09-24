import fs from "fs";
import path from "path";
import nodeFetchModule from "node-fetch";

const getFetch = (): typeof fetch => {
  if (typeof globalThis.fetch === "function") {
    return globalThis.fetch as typeof fetch;
  }
  return ((nodeFetchModule as any).default || nodeFetchModule) as typeof fetch;
};
import { ASSETS_DIR, formatSceneFolderName, ensureSceneDirectories } from "../config/constants";
import { sanitizeFilenamePart, formatShotNumber } from "../utils/formatters";
import { normalizeComfyUrl } from "./comfyQueueService";
import { generateThumbnailFile } from "./thumbnailService";
import { findProjectFile, getProjectData, saveProjectData } from "./project/projectCrud";
import { createScopedLogger } from "../utils/logger";

const log = createScopedLogger("TakeIngestion");

export interface IngestedTakeResult {
  filename: string;
  subfolder?: string;
  media_type: "image" | "video" | "other";
  size: number;
  stream_url: string;
  shot_number?: number;
  take_number?: number;
  take_id?: string;
  saved_to_project: boolean;
}

export interface SyncHistoryResult {
  success: boolean;
  ingested_count: number;
  ingested: IngestedTakeResult[];
  error?: string;
}

// Track already ingested filenames and prompt IDs in memory to avoid duplicate writes
const ingestedFilenames = new Set<string>();
const syncedPromptIds = new Set<string>();

/**
 * Robustly extract output media files from any ComfyUI node output object.
 * Supports: SaveImage, SaveVideo, VHS_VideoCombine, SaveAnimatedWEBP, etc.
 */
export function extractFilesFromOutputs(outputs: Record<string, any>): Array<{ filename: string; subfolder?: string; type?: string }> {
  const files: Array<{ filename: string; subfolder?: string; type?: string }> = [];
  if (!outputs || typeof outputs !== "object") return files;

  for (const nodeKey of Object.keys(outputs)) {
    const nodeOut = outputs[nodeKey];
    if (!nodeOut || typeof nodeOut !== "object") continue;

    // 1. Standard images array
    if (Array.isArray(nodeOut.images)) {
      for (const item of nodeOut.images) {
        if (typeof item === "string") files.push({ filename: item });
        else if (item?.filename) files.push({ filename: item.filename, subfolder: item.subfolder, type: item.type });
      }
    }

    // 2. Video / GIF arrays (VHS_VideoCombine, AnimateDiff, Wan)
    if (Array.isArray(nodeOut.gifs)) {
      for (const item of nodeOut.gifs) {
        if (typeof item === "string") files.push({ filename: item });
        else if (item?.filename) files.push({ filename: item.filename, subfolder: item.subfolder, type: item.type });
      }
    }

    if (Array.isArray(nodeOut.videos)) {
      for (const item of nodeOut.videos) {
        if (typeof item === "string") files.push({ filename: item });
        else if (item?.filename) files.push({ filename: item.filename, subfolder: item.subfolder, type: item.type });
      }
    }

    // 3. VHS_VideoCombine filenames format: ["filename.mp4"] or [{ filename: "..." }]
    if (Array.isArray(nodeOut.filenames)) {
      for (const item of nodeOut.filenames) {
        if (typeof item === "string") files.push({ filename: item });
        else if (item?.filename) files.push({ filename: item.filename, subfolder: item.subfolder, type: item.type });
      }
    }

    // 4. Nested ui outputs: e.g. nodeOut.ui.images, nodeOut.ui.videos
    if (nodeOut.ui && typeof nodeOut.ui === "object") {
      if (Array.isArray(nodeOut.ui.images)) {
        for (const item of nodeOut.ui.images) {
          if (typeof item === "string") files.push({ filename: item });
          else if (item?.filename) files.push({ filename: item.filename, subfolder: item.subfolder, type: item.type });
        }
      }
      if (Array.isArray(nodeOut.ui.videos)) {
        for (const item of nodeOut.ui.videos) {
          if (typeof item === "string") files.push({ filename: item });
          else if (item?.filename) files.push({ filename: item.filename, subfolder: item.subfolder, type: item.type });
        }
      }
      if (Array.isArray(nodeOut.ui.gifs)) {
        for (const item of nodeOut.ui.gifs) {
          if (typeof item === "string") files.push({ filename: item });
          else if (item?.filename) files.push({ filename: item.filename, subfolder: item.subfolder, type: item.type });
        }
      }
    }
  }

  // Deduplicate by filename
  const uniqueMap = new Map<string, { filename: string; subfolder?: string; type?: string }>();
  for (const f of files) {
    if (f.filename && !uniqueMap.has(f.filename)) {
      uniqueMap.set(f.filename, f);
    }
  }

  return Array.from(uniqueMap.values());
}

/**
 * Downloads a single output file from ComfyUI and persists it as a shot take
 */
export async function downloadAndIngestTake(options: {
  scene_name: string;
  filename: string;
  subfolder?: string;
  comfyui_api_url?: string;
  auth_token?: string;
  prompt_id?: string;
  shot_number?: number;
}): Promise<IngestedTakeResult> {
  const { scene_name, filename, subfolder, comfyui_api_url, auth_token, prompt_id } = options;
  const safeSceneName = formatSceneFolderName(scene_name) || sanitizeFilenamePart(scene_name) || "scene01";
  const outputDir = path.join(ASSETS_DIR, safeSceneName, "outputs");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filePath = path.join(outputDir, filename);
  const baseUrl = normalizeComfyUrl(comfyui_api_url);

  let downloadUrl = `${baseUrl}/view?filename=${encodeURIComponent(filename)}&type=output`;
  if (subfolder) {
    downloadUrl += `&subfolder=${encodeURIComponent(subfolder)}`;
  }

  const headers: Record<string, string> = {};
  if (auth_token && auth_token.trim()) {
    headers["Authorization"] = `Bearer ${auth_token.trim()}`;
  }

  log.info(`Downloading from ComfyUI: ${downloadUrl}`);
  const response = await fetch(downloadUrl, { headers });
  if (!response.ok) {
    throw new Error(`Failed to download ${filename} from ComfyUI (${response.status} ${response.statusText})`);
  }

  const arrayBuf = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);
  fs.writeFileSync(filePath, buffer);
  const fileSize = buffer.length;

  const isVideo = /\.(mp4|mov|webm|mkv|avi)$/i.test(filename);
  const isImage = /\.(png|jpg|jpeg|webp|avif)$/i.test(filename);
  const mediaType = isVideo ? "video" : isImage ? "image" : "other";

  // Also persist in scene asset directories
  const sceneDirs = ensureSceneDirectories(safeSceneName);
  const targetAssetDir = isVideo ? sceneDirs.videos : sceneDirs.images;
  if (!fs.existsSync(targetAssetDir)) {
    fs.mkdirSync(targetAssetDir, { recursive: true });
  }
  const assetPath = path.join(targetAssetDir, filename);
  try {
    fs.writeFileSync(assetPath, buffer);
    if (isImage) {
      generateThumbnailFile(assetPath).catch(() => {});
    }
  } catch (copyErr) {
    log.warn("Failed to copy to asset storage", { error: copyErr });
  }

  const streamUrl = `/api/outputs/stream/${encodeURIComponent(safeSceneName)}/${encodeURIComponent(filename)}`;

  // Automatically attach to the scene project file on the backend
  let savedToProject = false;
  let targetShotNumber = options.shot_number;
  let assignedTakeNumber: number | undefined;
  let newTakeId: string | undefined;

  try {
    const projectData = getProjectData(safeSceneName);
    if (projectData && Array.isArray(projectData.shots) && projectData.shots.length > 0) {
      // Find matching shot:
      // 1. By explicit shot_number option
      // 2. By prompt_id match
      // 3. By filename match (e.g. shot_01, Shot02)
      // 4. By active monitored_workflow
      // 5. Fallback to shot 0
      let shotIdx = -1;

      if (targetShotNumber !== undefined) {
        shotIdx = projectData.shots.findIndex((s: any) => s.shot_number === targetShotNumber);
      }

      if (shotIdx === -1 && prompt_id) {
        shotIdx = projectData.shots.findIndex((s: any) => s.latest_prompt_id === prompt_id);
      }

      if (shotIdx === -1) {
        const shotMatch = filename.match(/shot[_\-\s]*0*(\d+)/i);
        if (shotMatch) {
          const num = parseInt(shotMatch[1], 10);
          shotIdx = projectData.shots.findIndex((s: any) => s.shot_number === num);
        }
      }

      if (shotIdx === -1) {
        shotIdx = projectData.shots.findIndex((s: any) => Boolean(s.monitored_workflow));
      }

      if (shotIdx === -1) {
        shotIdx = 0; // Default to first shot
      }

      const targetShot = projectData.shots[shotIdx];
      targetShotNumber = targetShot.shot_number;
      const existingTakes = Array.isArray(targetShot.takes) ? targetShot.takes : [];

      // Check if take already exists for this filename
      const alreadyHasTake = existingTakes.some((t: any) => t.video_filename === filename || t.video_url?.includes(filename));

      if (!alreadyHasTake) {
        let takeNum = existingTakes.reduce((max: number, t: any) => Math.max(max, t.take_number || 0), 0) + 1;
        const takeMatch = filename.match(/(?:_|^)(?:Take|T)_?(\d+)/i);
        if (takeMatch) {
          const parsed = parseInt(takeMatch[1], 10);
          if (!isNaN(parsed) && parsed > 0) takeNum = parsed;
        }

        assignedTakeNumber = takeNum;
        newTakeId = `take_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        const newTake = {
          id: newTakeId,
          take_number: takeNum,
          created_at: new Date().toISOString(),
          video_filename: filename,
          video_url: streamUrl,
          expanded_prompt: targetShot.expanded_prompt || "",
          basic_stub: targetShot.basic_stub || "",
          variation_id: targetShot.active_variation_id,
          generation_params: targetShot.generation_params,
          sampling_steps: targetShot.generation_params?.steps,
          assigned_slots: targetShot.assigned_slots ? { ...targetShot.assigned_slots } : undefined,
          review_status: "unreviewed",
          rating: null,
          file_size: fileSize,
          aspect_ratio: targetShot.aspect_ratio || "16:9",
          is_hero: existingTakes.length === 0 || !targetShot.hero_take_id
        };

        targetShot.takes = [...existingTakes, newTake];
        targetShot.active_take_id = newTakeId;
        if (!targetShot.hero_take_id && newTake.is_hero) {
          targetShot.hero_take_id = newTakeId;
        }
        targetShot.status = "rendered";

        projectData.shots[shotIdx] = targetShot;
        saveProjectData(safeSceneName, projectData);
        savedToProject = true;
        log.info(`Successfully registered Take ${takeNum} under Shot ${formatShotNumber(targetShot.shot_number)} in ${safeSceneName}.json`);
      }
    }
  } catch (projErr) {
    log.warn("Could not register take into project JSON", { error: projErr });
  }

  ingestedFilenames.add(filename);

  return {
    filename,
    subfolder,
    media_type: mediaType,
    size: fileSize,
    stream_url: streamUrl,
    shot_number: targetShotNumber,
    take_number: assignedTakeNumber,
    take_id: newTakeId,
    saved_to_project: savedToProject
  };
}

/**
 * Queries ComfyUI /history endpoint directly on the backend to sync completed outputs
 */
export async function syncComfyOutputsFromHistory(options: {
  scene_name: string;
  comfyui_api_url?: string;
  auth_token?: string;
  prompt_id?: string;
  max_prompts?: number;
}): Promise<SyncHistoryResult> {
  const { scene_name, comfyui_api_url, auth_token, prompt_id, max_prompts = 5 } = options;
  const baseUrl = normalizeComfyUrl(comfyui_api_url);

  const historyUrl = prompt_id
    ? `${baseUrl}/history/${encodeURIComponent(prompt_id)}`
    : `${baseUrl}/history?max_items=${max_prompts}`;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (auth_token && auth_token.trim()) {
    headers["Authorization"] = `Bearer ${auth_token.trim()}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(historyUrl, { headers, signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`ComfyUI /history returned HTTP ${res.status}: ${res.statusText}`);
    }

    const historyData: any = await res.json();
    const promptKeys = Object.keys(historyData || {});
    const ingestedList: IngestedTakeResult[] = [];

    for (const pId of promptKeys) {
      const entry = historyData[pId];
      if (!entry || !entry.outputs) continue;

      const files = extractFilesFromOutputs(entry.outputs);
      for (const f of files) {
        if (!f.filename) continue;
        
        // Skip if already ingested
        if (ingestedFilenames.has(f.filename)) continue;

        try {
          const takeResult = await downloadAndIngestTake({
            scene_name,
            filename: f.filename,
            subfolder: f.subfolder,
            comfyui_api_url,
            auth_token,
            prompt_id: pId
          });
          ingestedList.push(takeResult);
        } catch (downloadErr: any) {
          log.warn(`Failed to ingest ${f.filename}`, { error: downloadErr.message || downloadErr });
        }
      }

      syncedPromptIds.add(pId);
    }

    return {
      success: true,
      ingested_count: ingestedList.length,
      ingested: ingestedList
    };
  } catch (err: any) {
    return {
      success: false,
      ingested_count: 0,
      ingested: [],
      error: err.message || "Failed to query ComfyUI history"
    };
  }
}
