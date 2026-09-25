import fs from "fs";
import path from "path";
import { Client } from "ssh2";
import { SYSTEM_LORAS_FILE, CIVITAI_FAVORITES_FILE } from "../config/constants";
import { writeJsonAtomicSync } from "../utils/atomicFs";
import { createScopedLogger } from "../utils/logger";
import { getStoredCivitaiFavorites, getStoredCivitaiKey } from "./civitaiService";
import { getStoredHuggingFaceToken } from "./huggingfaceService";
import { getStoredRemoteSettings } from "./remoteSettingsService";
import { resolveSSHConfig, SSHCredentials } from "./sshService";
import { executeUnifiedRemoteDownload } from "./modelHubService";

const log = createScopedLogger("LoraService");

export interface SystemLora {
  id: string;
  name: string;
  filename: string;
  version_name?: string;
  base_model?: string;
  category?: "lora" | "lycoris" | "dora" | "locon" | "style" | "character" | "concept" | string;
  trigger_words?: string[];
  default_destination_folder?: string;
  suggested_remote_path?: string;
  download_url?: string;
  source?: "civitai" | "huggingface" | "custom" | "local";
  model_id?: number;
  version_id?: number;
  preview_image_url?: string;
  file_size_formatted?: string;
  file_size_bytes?: number;
  description?: string;
  notes?: string;
  preferred_strength_model?: number;
  preferred_strength_clip?: number;
  is_favorite?: boolean;
  added_at?: string;
  updated_at?: string;
}

export interface RemoteLoraFileStatus {
  filename: string;
  exists_on_remote: boolean;
  remote_path?: string;
  size_bytes?: number;
  size_formatted?: string;
  last_modified?: string;
}

export interface RemoteLoraStatusReport {
  success: boolean;
  remote_host: string;
  scanned_directory: string;
  total_remote_files: number;
  loras_status: Record<string, RemoteLoraFileStatus>;
  error?: string;
}

/**
 * Format raw byte size into human readable string
 */
function formatBytes(bytes?: number): string {
  if (!bytes || isNaN(bytes) || bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
}

/**
 * Read system-level LoRAs directly from system_loras.json
 */
function readCustomSystemLoras(): SystemLora[] {
  if (fs.existsSync(SYSTEM_LORAS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(SYSTEM_LORAS_FILE, "utf-8"));
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.loras)) return data.loras;
    } catch (e: any) {
      log.warn("Failed to read system_loras.json", { error: e?.message });
    }
  }
  return [];
}

/**
 * Persist custom system LoRAs to system_loras.json
 */
function writeCustomSystemLoras(loras: SystemLora[]): void {
  writeJsonAtomicSync(SYSTEM_LORAS_FILE, {
    version: 1,
    updated_at: new Date().toISOString(),
    loras
  });
}

/**
 * Get unified list of all System LoRAs (merging custom system LoRAs + Civitai LoRA favorites)
 */
export function getAllSystemLoras(): SystemLora[] {
  const customLoras = readCustomSystemLoras();
  const civitaiFavorites = getStoredCivitaiFavorites();

  const loraMap = new Map<string, SystemLora>();

  // 1. Add custom system LoRAs
  for (const lora of customLoras) {
    const key = (lora.filename || lora.id).toLowerCase();
    loraMap.set(key, { ...lora });
  }

  // 2. Add Civitai favorites that are LoRAs or general models
  for (const fav of civitaiFavorites) {
    const category = (fav.category || "").toLowerCase();
    const isLoraLike = category.includes("lora") || category.includes("lycoris") || category.includes("dora") || category.includes("locon") || !category;
    
    const filename = fav.filename || (fav.name ? `${fav.name.toLowerCase().replace(/[^a-z0-9_.-]/g, "_")}.safetensors` : `civitai_${fav.version_id}.safetensors`);
    const key = filename.toLowerCase();

    const existing = loraMap.get(key);
    if (!existing) {
      const triggers = fav.trigger_words || fav.trained_words || fav.trainedWords || [];
      const systemLora: SystemLora = {
        id: `civitai_${fav.version_id}`,
        name: fav.name || fav.model_name || "Civitai LoRA",
        filename,
        version_name: fav.version_name || "Default",
        base_model: fav.base_model || "SDXL",
        category: (fav.category as any) || "lora",
        trigger_words: triggers,
        default_destination_folder: fav.default_destination_folder || "models/loras/",
        suggested_remote_path: fav.suggested_remote_path || `models/loras/${filename}`,
        download_url: fav.download_url,
        source: "civitai",
        model_id: fav.model_id,
        version_id: fav.version_id,
        preview_image_url: fav.preview_image_url || fav.image_url,
        file_size_formatted: fav.file_size_formatted || fav.file_size,
        file_size_bytes: fav.file_size_bytes,
        description: fav.clean_description || fav.description,
        preferred_strength_model: 0.85,
        preferred_strength_clip: 1.0,
        is_favorite: true,
        added_at: fav.added_at || new Date().toISOString()
      };
      loraMap.set(key, systemLora);
    } else {
      // Merge favorite status
      existing.is_favorite = true;
      if (!existing.download_url && fav.download_url) existing.download_url = fav.download_url;
      if (!existing.preview_image_url && (fav.preview_image_url || fav.image_url)) {
        existing.preview_image_url = fav.preview_image_url || fav.image_url;
      }
    }
  }

  return Array.from(loraMap.values());
}

/**
 * Register or update a system-level LoRA
 */
export function saveSystemLora(data: Partial<SystemLora> & { name: string; filename: string }): SystemLora {
  if (!data.name || !data.filename) {
    throw new Error("LoRA 'name' and 'filename' are required.");
  }

  const customLoras = readCustomSystemLoras();
  const cleanFilename = path.basename(data.filename.trim());
  const id = data.id || `lora_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const existingIndex = customLoras.findIndex(
    l => l.id === id || l.filename.toLowerCase() === cleanFilename.toLowerCase()
  );

  const updatedItem: SystemLora = {
    id,
    name: data.name.trim(),
    filename: cleanFilename,
    version_name: data.version_name || "v1.0",
    base_model: data.base_model || "SDXL",
    category: data.category || "lora",
    trigger_words: Array.isArray(data.trigger_words) ? data.trigger_words.filter(Boolean) : [],
    default_destination_folder: data.default_destination_folder || "models/loras/",
    suggested_remote_path: data.suggested_remote_path || `models/loras/${cleanFilename}`,
    download_url: data.download_url?.trim(),
    source: data.source || (data.version_id ? "civitai" : "custom"),
    model_id: data.model_id,
    version_id: data.version_id,
    preview_image_url: data.preview_image_url,
    file_size_formatted: data.file_size_formatted,
    file_size_bytes: data.file_size_bytes,
    description: data.description,
    notes: data.notes,
    preferred_strength_model: typeof data.preferred_strength_model === "number" ? data.preferred_strength_model : 0.85,
    preferred_strength_clip: typeof data.preferred_strength_clip === "number" ? data.preferred_strength_clip : 1.0,
    is_favorite: data.is_favorite ?? true,
    added_at: existingIndex >= 0 ? customLoras[existingIndex].added_at : new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    customLoras[existingIndex] = { ...customLoras[existingIndex], ...updatedItem };
  } else {
    customLoras.push(updatedItem);
  }

  writeCustomSystemLoras(customLoras);
  log.info(`Saved system LoRA '${updatedItem.name}' (${updatedItem.filename})`);
  return updatedItem;
}

/**
 * Remove a system-level LoRA by ID or filename
 */
export function deleteSystemLora(idOrFilename: string): boolean {
  const customLoras = readCustomSystemLoras();
  const cleanTarget = idOrFilename.trim().toLowerCase();

  const initialCount = customLoras.length;
  const filtered = customLoras.filter(
    l => l.id.toLowerCase() !== cleanTarget && l.filename.toLowerCase() !== cleanTarget
  );

  if (filtered.length !== initialCount) {
    writeCustomSystemLoras(filtered);
    log.info(`Deleted system LoRA '${idOrFilename}'`);
    return true;
  }
  return false;
}

/**
 * Inspect remote GPU host via SSH to check which LoRAs exist in ComfyUI models/loras/
 */
export async function checkRemoteLoraStatus(
  creds?: SSHCredentials,
  targetFilenames?: string[]
): Promise<RemoteLoraStatusReport> {
  const stored = getStoredRemoteSettings();
  const mergedCreds: SSHCredentials = {
    ...stored,
    ...creds
  };

  const resolved = resolveSSHConfig(mergedCreds);
  if (!resolved.host) {
    throw new Error("No remote host configured. Please configure your GPU SSH credentials in Settings.");
  }

  const remoteLorasDir = `${resolved.remoteComfyUIRoot}/models/loras`;

  return new Promise((resolve, reject) => {
    const conn = new Client();
    let isFinished = false;

    const timeoutTimer = setTimeout(() => {
      if (!isFinished) {
        isFinished = true;
        try { conn.end(); } catch (e) {}
        reject(new Error(`Remote SSH inspection timed out after 30 seconds on ${resolved.host}`));
      }
    }, 30000);

    conn.on("ready", () => {
      // Find all files in models/loras with their size in bytes and last modified timestamp
      // Command uses find with stat or ls fallback for broad Linux compatibility
      const command = `mkdir -p "${remoteLorasDir}" && find "${remoteLorasDir}" -type f -exec stat -c "%s %Y %n" {} + 2>/dev/null || find "${remoteLorasDir}" -type f -ls 2>/dev/null`;

      conn.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timeoutTimer);
          isFinished = true;
          try { conn.end(); } catch (e) {}
          return reject(err);
        }

        let stdout = "";
        let stderr = "";

        stream.on("data", (data: Buffer) => {
          stdout += data.toString();
        });

        stream.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });

        stream.on("close", () => {
          clearTimeout(timeoutTimer);
          if (!isFinished) {
            isFinished = true;
            try { conn.end(); } catch (e) {}

            // Parse remote files
            const remoteFileMap = new Map<string, { size: number; mtime: number; fullPath: string }>();
            const lines = stdout.split("\n");

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              // format: "%s %Y %n" -> e.g. "152345678 1712345678 /workspace/ComfyUI/models/loras/my_lora.safetensors"
              const parts = trimmed.split(/\s+/);
              if (parts.length >= 3 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
                const size = parseInt(parts[0], 10);
                const mtime = parseInt(parts[1], 10);
                const fullPath = parts.slice(2).join(" ");
                const baseName = path.basename(fullPath).toLowerCase();
                remoteFileMap.set(baseName, { size, mtime, fullPath });
              } else if (trimmed.includes(remoteLorasDir)) {
                // Fallback parsing for ls -ls
                const baseName = path.basename(trimmed).toLowerCase();
                remoteFileMap.set(baseName, { size: 0, mtime: 0, fullPath: trimmed });
              }
            }

            // Map requested or all system LoRAs
            const allLoras = getAllSystemLoras();
            const filenamesToCheck = (targetFilenames && targetFilenames.length > 0)
              ? targetFilenames
              : allLoras.map(l => l.filename);

            const lorasStatus: Record<string, RemoteLoraFileStatus> = {};

            for (const fn of filenamesToCheck) {
              const cleanFn = path.basename(fn);
              const key = cleanFn.toLowerCase();
              const match = remoteFileMap.get(key);

              if (match) {
                lorasStatus[cleanFn] = {
                  filename: cleanFn,
                  exists_on_remote: true,
                  remote_path: match.fullPath,
                  size_bytes: match.size,
                  size_formatted: formatBytes(match.size),
                  last_modified: match.mtime > 0 ? new Date(match.mtime * 1000).toISOString() : undefined
                };
              } else {
                lorasStatus[cleanFn] = {
                  filename: cleanFn,
                  exists_on_remote: false,
                  remote_path: `${remoteLorasDir}/${cleanFn}`
                };
              }
            }

            resolve({
              success: true,
              remote_host: resolved.host,
              scanned_directory: remoteLorasDir,
              total_remote_files: remoteFileMap.size,
              loras_status: lorasStatus
            });
          }
        });
      });
    });

    conn.on("error", (err) => {
      clearTimeout(timeoutTimer);
      if (!isFinished) {
        isFinished = true;
        try { conn.end(); } catch (e) {}
        reject(new Error(`Failed to connect to remote host ${resolved.host}: ${err.message}`));
      }
    });

    try {
      conn.connect(resolved.connectConfig);
    } catch (e: any) {
      clearTimeout(timeoutTimer);
      if (!isFinished) {
        isFinished = true;
        reject(new Error(`SSH connection error: ${e.message}`));
      }
    }
  });
}

/**
 * Trigger remote download / transfer of a LoRA directly onto the remote GPU instance
 */
export async function transferLoraToRemote(options: {
  lora_id?: string;
  filename?: string;
  download_url?: string;
  destination_folder?: string;
  creds?: SSHCredentials;
}): Promise<{
  success: boolean;
  message: string;
  filename: string;
  destination_path?: string;
  file_size?: string;
  duration_seconds?: number;
}> {
  const { lora_id, filename: rawFilename, download_url: rawUrl, destination_folder = "models/loras/", creds } = options;

  let downloadUrl = rawUrl || "";
  let filename = rawFilename || "";
  let authType: "civitai" | "huggingface" | "none" = "none";
  let apiToken = "";

  // If lora_id provided, look up in system registry
  if (lora_id) {
    const loras = getAllSystemLoras();
    const match = loras.find(l => l.id === lora_id || l.filename.toLowerCase() === lora_id.toLowerCase());
    if (match) {
      if (!filename) filename = match.filename;
      if (!downloadUrl) downloadUrl = match.download_url || "";
      if (match.source === "civitai" || match.version_id) {
        authType = "civitai";
        apiToken = getStoredCivitaiKey();
      } else if (match.source === "huggingface") {
        authType = "huggingface";
        apiToken = getStoredHuggingFaceToken();
      }
    }
  }

  if (!filename) {
    throw new Error("Filename is required for LoRA remote transfer.");
  }
  if (!downloadUrl) {
    throw new Error(`No download URL found for LoRA '${filename}'. Please ensure download_url is configured.`);
  }

  if (authType === "none") {
    if (downloadUrl.includes("civitai.com")) {
      authType = "civitai";
      apiToken = getStoredCivitaiKey();
    } else if (downloadUrl.includes("huggingface.co")) {
      authType = "huggingface";
      apiToken = getStoredHuggingFaceToken();
    }
  }

  const stored = getStoredRemoteSettings();
  const mergedCreds = { ...stored, ...creds };
  const resolved = resolveSSHConfig(mergedCreds);

  if (!resolved.host) {
    throw new Error("No remote host configured for GPU download.");
  }

  const result = await executeUnifiedRemoteDownload({
    download_url: downloadUrl,
    destination_folder,
    filename,
    auth_type: authType,
    api_token: apiToken,
    remote_host: resolved.host,
    ssh_port: resolved.port,
    ssh_username: resolved.username,
    ssh_password: resolved.password,
    ssh_private_key: resolved.privateKey,
    remote_comfyui_root: resolved.remoteComfyUIRoot
  });

  if (!result.success) {
    throw new Error(result.error || result.message || "Failed to download LoRA to remote GPU.");
  }

  return {
    success: true,
    message: result.message,
    filename,
    destination_path: result.destination_path,
    file_size: result.file_size,
    duration_seconds: result.duration_seconds
  };
}
