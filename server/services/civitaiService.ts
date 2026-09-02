import fs from "fs";
import path from "path";
import { Client, ConnectConfig } from "ssh2";
import { CIVITAI_CONFIG_FILE } from "../config/constants";

export interface CivitaiModelVersionOption {
  id: number;
  name: string;
  baseModel?: string;
  downloadUrl?: string;
  createdAt?: string;
}

export interface CivitaiModelMetadata {
  model_id: number;
  model_name: string;
  version_id: number;
  version_name: string;
  category: string;
  base_model: string;
  file_size_bytes: number;
  file_size_formatted: string;
  filename: string;
  preview_image_url: string;
  download_url: string;
  default_destination_folder: string;
  suggested_remote_path: string;
  files?: any[];
  trained_words?: string[];
  trainedWords?: string[];
  description?: string;
  clean_description?: string;
  download_command?: string;
  tags?: string[];
  allow_commercial_use?: boolean | string;
  nsfw?: boolean;
  versions?: CivitaiModelVersionOption[];
}

export interface RemoteDownloadOptions {
  download_url: string;
  destination_folder: string;
  filename: string;
  civitai_token?: string;
  remote_host: string;
  ssh_port?: number;
  ssh_username?: string;
  ssh_password?: string;
  ssh_private_key?: string;
  ssh_key_path?: string;
  remote_comfyui_root?: string;
}

export interface RemoteDownloadResult {
  success: boolean;
  message: string;
  destination_path?: string;
  file_size?: string;
  duration_seconds?: number;
  logs?: string;
  error?: string;
}

/**
 * Retrieve saved Civitai API key from filesystem or environment
 */
export function getStoredCivitaiKey(): string {
  if (process.env.CIVITAI_API_KEY && process.env.CIVITAI_API_KEY.trim()) {
    return process.env.CIVITAI_API_KEY.trim();
  }
  if (fs.existsSync(CIVITAI_CONFIG_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CIVITAI_CONFIG_FILE, "utf-8"));
      return (data.api_key || "").trim();
    } catch (e) {}
  }
  return "";
}

/**
 * Persist Civitai API key securely
 */
export function saveCivitaiKey(apiKey: string): void {
  const cleanKey = (apiKey || "").trim();
  fs.writeFileSync(CIVITAI_CONFIG_FILE, JSON.stringify({ api_key: cleanKey, updated_at: new Date().toISOString() }, null, 2));
}

/**
 * Automatically determine the appropriate remote ComfyUI destination subfolder
 * based on model category
 */
export function determineComfyUIDestination(category: string): string {
  const cat = (category || "").trim().toLowerCase();

  if (cat.includes("lora") || cat.includes("dora") || cat.includes("locon") || cat.includes("lycoris")) {
    return "models/loras/";
  }
  if (cat.includes("controlnet") || cat.includes("t2i") || cat.includes("adapter")) {
    return "models/controlnet/";
  }
  if (cat.includes("vae")) {
    return "models/vae/";
  }
  if (cat.includes("upscaler") || cat.includes("upscale")) {
    return "models/upscale_models/";
  }
  if (cat.includes("embedding") || cat.includes("textualinversion") || cat.includes("textual inversion")) {
    return "models/embeddings/";
  }
  if (cat.includes("animatediff") || cat.includes("motionmodule") || cat.includes("motion")) {
    return "models/animatediff_models/";
  }
  if (cat.includes("clipvision") || cat.includes("clip_vision") || cat.includes("clip vision")) {
    return "models/clip_vision/";
  }
  if (cat.includes("unet") || cat.includes("diffusion_models") || cat.includes("diffusionmodel")) {
    return "models/unet/";
  }
  if (cat.includes("checkpoint") || cat.includes("model") || cat.includes("base")) {
    return "models/checkpoints/";
  }

  // Default fallback for general weights
  return "models/checkpoints/";
}

/**
 * Format bytes to readable human size (GB / MB)
 */
export function formatBytes(bytes: number): string {
  if (!bytes || isNaN(bytes) || bytes <= 0) return "Unknown size";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(2)} GB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

/**
 * Clean raw HTML markup from Civitai descriptions to produce clean plain text
 */
export function cleanHtmlDescription(rawHtml?: string): string {
  if (!rawHtml) return "";
  let text = rawHtml;
  // Convert line breaks and paragraph closings to appropriate newlines
  text = text.replace(/<br\s*[\/]?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<\/li>/gi, "\n");
  text = text.replace(/<\/h[1-6]>/gi, "\n\n");
  text = text.replace(/<\/div>/gi, "\n");
  // Strip all other HTML tags
  text = text.replace(/<[^>]+>/g, "");
  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—");
  // Collapse excess blank lines
  text = text.replace(/\n{3,}/g, "\n\n").trim();
  return text;
}

/**
 * Synthesize pre-formatted remote CLI download command using aria2c with curl fallback
 */
export function generateCivitaiDownloadCommand(
  downloadUrl: string,
  destinationFolder: string,
  filename: string,
  token?: string
): string {
  const cleanDest = (destinationFolder || "models/checkpoints/").trim().replace(/\/$/, "");
  const cleanFilename = (filename || "model.safetensors").trim();
  const cleanUrl = (downloadUrl || "").trim();
  const cleanToken = (token || "").trim();

  const authAria = cleanToken ? `--header="Authorization: Bearer ${cleanToken}" ` : "";
  const authCurl = cleanToken ? `-H "Authorization: Bearer ${cleanToken}" ` : "";

  return `mkdir -p "${cleanDest}" && (aria2c -c -x 8 -s 8 -k 1M ${authAria}-d "${cleanDest}" -o "${cleanFilename}" "${cleanUrl}" || curl -L -C - --fail --retry 3 ${authCurl}-o "${cleanDest}/${cleanFilename}" "${cleanUrl}")`;
}

export interface ParsedCivitaiQuery {
  modelId?: number;
  versionId?: number;
  isRawNumeric?: boolean;
  isAir?: boolean;
}

/**
 * Parse input string or URL to extract version ID and/or model ID.
 * Strictly prioritizes Model Version ID across all input formats.
 */
export function parseCivitaiQuery(rawQuery: string): ParsedCivitaiQuery {
  const query = (rawQuery || "").trim();
  if (!query) return {};

  // 1. Raw numeric ID (e.g., "3193337")
  if (/^\d+$/.test(query)) {
    const num = parseInt(query, 10);
    return { versionId: num, modelId: num, isRawNumeric: true };
  }

  // 2. Civitai AIR parser:
  // Extract strictly the numeric digits located between '@' and '+' (or end of string/whitespace).
  // Example: urn:air:minimaxh3:diffusionmodel:civitai:2830065@3193337+3074134 -> versionId: 3193337
  if (query.includes("@")) {
    const airVersionMatch = query.match(/@(\d+)(?:\+|[\s\b]|$)/);
    const airModelMatch = query.match(/(?:civitai:|\/models\/|:|^)(\d+)@/i);
    const versionId = airVersionMatch ? parseInt(airVersionMatch[1], 10) : undefined;
    const modelId = airModelMatch ? parseInt(airModelMatch[1], 10) : undefined;
    if (versionId) {
      return { versionId, modelId, isAir: true };
    }
  }

  // 3. Civitai URL & standard query parser:
  // Prioritize modelVersionId query parameter over parent model path
  const versionParamMatch = query.match(/[?&]modelVersionId=(\d+)/i);
  const versionParamId = versionParamMatch ? parseInt(versionParamMatch[1], 10) : undefined;

  // Check /model-versions/{id} in URL path
  const versionPathMatch = query.match(/\/model-versions\/(\d+)/i);
  const versionPathId = versionPathMatch ? parseInt(versionPathMatch[1], 10) : undefined;

  // Check /models/{id} in URL path
  const modelPathMatch = query.match(/\/models\/(\d+)/i);
  const modelPathId = modelPathMatch ? parseInt(modelPathMatch[1], 10) : undefined;

  // Check /api/v1/models/{id}
  const apiModelMatch = query.match(/\/api\/v1\/models\/(\d+)/i);
  const apiModelId = apiModelMatch ? parseInt(apiModelMatch[1], 10) : undefined;

  const resolvedVersionId = versionParamId || versionPathId;
  const resolvedModelId = modelPathId || apiModelId;

  if (resolvedVersionId) {
    return {
      versionId: resolvedVersionId,
      modelId: resolvedModelId
    };
  }

  if (resolvedModelId) {
    return {
      modelId: resolvedModelId
    };
  }

  return {};
}

/**
 * Query Civitai API to fetch detailed model metadata, strictly prioritizing Model Version ID.
 */
export async function fetchCivitaiModelInfo(
  query: string,
  tokenOverride?: string
): Promise<CivitaiModelMetadata> {
  const token = (tokenOverride || getStoredCivitaiKey()).trim();
  const { modelId, versionId } = parseCivitaiQuery(query);

  if (!modelId && !versionId) {
    throw new Error("Invalid Civitai query. Please enter a valid Civitai Model Version ID, AIR URN, Model ID, or Civitai URL.");
  }

  const headers: Record<string, string> = {
    "Accept": "application/json",
    "User-Agent": "ComfyUI-Bridge/1.0 (AI Studio)"
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let versionData: any = null;
  let modelData: any = null;

  // Priority 1: Query Civitai Model Version endpoint for versionId / raw numeric / AIR / modelVersionId param
  if (versionId) {
    const versionUrl = `https://civitai.com/api/v1/model-versions/${versionId}`;
    try {
      const res = await fetch(versionUrl, { headers });
      if (res.ok) {
        versionData = await res.json();
      }
    } catch (e) {}
  }

  // Priority 2: If version endpoint failed (e.g. raw ID was a Model ID instead of Version ID, or model-only URL)
  if (!versionData && modelId) {
    const modelUrl = `https://civitai.com/api/v1/models/${modelId}`;
    const res = await fetch(modelUrl, { headers });
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(`Civitai model / version not found (ID ${versionId || modelId}). Check the ID or ensure your Civitai API Token is configured for private/early-access models.`);
      }
      throw new Error(`Civitai API error (HTTP ${res.status}): ${res.statusText}`);
    }
    modelData = await res.json();
  }

  // If we fetched version data, query parent model data to enrich metadata
  if (versionData && !modelData && versionData.modelId) {
    try {
      const modelRes = await fetch(`https://civitai.com/api/v1/models/${versionData.modelId}`, { headers });
      if (modelRes.ok) {
        modelData = await modelRes.json();
      }
    } catch (e) {}
  }

  // If we only have modelData, extract the primary version
  if (!versionData && modelData) {
    const versions = modelData.modelVersions || [];
    if (versions.length === 0) {
      throw new Error(`Civitai model '${modelData.name}' has no available model versions.`);
    }
    versionData = versions[0];
  }

  if (!versionData) {
    throw new Error("Could not retrieve model version metadata from Civitai API.");
  }

  // Ensure response contains exact version title, files list, base model architecture, and authenticated download URL for that specific release
  const resolvedModelId = modelData?.id || versionData.modelId || modelId || 0;
  const resolvedModelName = modelData?.name || versionData.model?.name || versionData.name || "Untitled Model";
  const resolvedVersionId = versionData.id;
  const resolvedVersionName = versionData.name || "Default Version";
  const category = modelData?.type || versionData.model?.type || "Checkpoint";
  const baseModel = versionData.baseModel || "SDXL 1.0";

  // Identify primary file or first safetensors file
  const files = versionData.files || [];
  let primaryFile = files.find((f: any) => f.primary === true);
  if (!primaryFile && files.length > 0) {
    primaryFile = files.find((f: any) => f.name?.endsWith(".safetensors")) || files[0];
  }

  let filename = primaryFile?.name || `${resolvedModelName.toLowerCase().replace(/[^a-z0-9]/g, "_")}.safetensors`;
  const sizeKB = primaryFile?.sizeKB || 0;
  const fileSizeBytes = Math.round(sizeKB * 1024);

  // Extract preview image from the exact version
  const images = versionData.images || modelData?.images || [];
  let previewImageUrl = "";
  if (images.length > 0) {
    previewImageUrl = images[0].url || "";
  }

  // Formulate direct authenticated download URL for that specific release
  let downloadUrl = versionData.downloadUrl || `https://civitai.com/api/download/models/${resolvedVersionId}`;
  if (token && !downloadUrl.includes("token=")) {
    const sep = downloadUrl.includes("?") ? "&" : "?";
    downloadUrl = `${downloadUrl}${sep}token=${encodeURIComponent(token)}`;
  }

  const defaultDestination = determineComfyUIDestination(category);
  const suggestedRemotePath = path.posix.join(defaultDestination, filename);

  // Extract and normalize trained trigger words
  const rawTrainedWords = versionData.trainedWords || modelData?.trainedWords || [];
  const trainedWordsList: string[] = Array.isArray(rawTrainedWords)
    ? rawTrainedWords
        .flatMap((w: any) => (typeof w === "string" ? w.split(",").map((s) => s.trim()).filter(Boolean) : []))
        .filter((w, idx, arr) => arr.indexOf(w) === idx)
    : [];

  // Extract and clean HTML description / release notes
  const rawDescription = versionData.description || modelData?.description || "";
  const cleanedDescription = cleanHtmlDescription(rawDescription);

  // Synthesize pre-formatted remote CLI download command
  const downloadCommand = generateCivitaiDownloadCommand(
    downloadUrl,
    defaultDestination,
    filename,
    token
  );

  const availableVersions: CivitaiModelVersionOption[] = (modelData?.modelVersions || []).map((v: any) => ({
    id: v.id,
    name: v.name,
    baseModel: v.baseModel,
    downloadUrl: v.downloadUrl,
    createdAt: v.createdAt
  }));

  return {
    model_id: resolvedModelId,
    model_name: resolvedModelName,
    version_id: resolvedVersionId,
    version_name: resolvedVersionName,
    category,
    base_model: baseModel,
    file_size_bytes: fileSizeBytes,
    file_size_formatted: formatBytes(fileSizeBytes),
    filename,
    preview_image_url: previewImageUrl,
    download_url: downloadUrl,
    default_destination_folder: defaultDestination,
    suggested_remote_path: suggestedRemotePath,
    files,
    trained_words: trainedWordsList,
    trainedWords: trainedWordsList,
    description: cleanedDescription || rawDescription,
    clean_description: cleanedDescription,
    download_command: downloadCommand,
    tags: modelData?.tags || [],
    allow_commercial_use: modelData?.allowCommercialUse,
    nsfw: modelData?.nsfw || versionData.images?.[0]?.nsfwLevel > 1,
    versions: availableVersions
  };
}

/**
 * Execute SSH command on remote host
 */
function runSSHCommand(options: {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  keyPath?: string;
  command: string;
  timeoutMs?: number;
}): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let stdout = "";
    let stderr = "";
    let isFinished = false;

    const timeoutMs = options.timeoutMs || 300000; // 5 minutes default
    const timer = setTimeout(() => {
      if (!isFinished) {
        isFinished = true;
        try { conn.end(); } catch (e) {}
        reject(new Error(`Remote SSH command timed out after ${Math.round(timeoutMs / 1000)}s`));
      }
    }, timeoutMs);

    conn.on("ready", () => {
      conn.exec(options.command, (err, stream) => {
        if (err) {
          clearTimeout(timer);
          isFinished = true;
          try { conn.end(); } catch (e) {}
          return reject(err);
        }

        stream.on("close", (code: number) => {
          clearTimeout(timer);
          if (!isFinished) {
            isFinished = true;
            try { conn.end(); } catch (e) {}
            resolve({ stdout, stderr, code: code || 0 });
          }
        });

        stream.on("data", (data: Buffer) => {
          stdout += data.toString();
        });

        stream.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });
      });
    });

    conn.on("error", (err) => {
      clearTimeout(timer);
      if (!isFinished) {
        isFinished = true;
        reject(err);
      }
    });

    const config: ConnectConfig = {
      host: options.host,
      port: options.port || 22,
      username: options.username || "root",
      readyTimeout: 30000
    };

    let rawKey = (options.privateKey || "").trim();
    if (!rawKey && options.password && (options.password.includes("BEGIN") || options.password.includes("-----"))) {
      rawKey = options.password.trim();
    }
    if (!rawKey && options.keyPath && (options.keyPath.includes("BEGIN") || options.keyPath.includes("-----"))) {
      rawKey = options.keyPath.trim();
    }
    if (!rawKey && options.keyPath && fs.existsSync(options.keyPath)) {
      try {
        rawKey = fs.readFileSync(options.keyPath, "utf-8").trim();
      } catch (e) {}
    }

    if (rawKey) {
      config.privateKey = rawKey;
    } else if (options.password) {
      config.password = options.password;
    }

    try {
      conn.connect(config);
    } catch (err) {
      clearTimeout(timer);
      reject(err);
    }
  });
}

/**
 * Execute remote high-speed direct download to ComfyUI models folder via SSH
 */
export async function executeRemoteModelDownload(
  options: RemoteDownloadOptions
): Promise<RemoteDownloadResult> {
  const {
    download_url,
    destination_folder,
    filename,
    civitai_token,
    remote_host,
    ssh_port = 22,
    ssh_username = "root",
    ssh_password,
    ssh_private_key,
    ssh_key_path,
    remote_comfyui_root = "/workspace/runpod-slim/ComfyUI"
  } = options;

  if (!remote_host) {
    throw new Error("Remote Host IP / Address is required for SSH download.");
  }
  if (!download_url) {
    throw new Error("Download URL is required.");
  }
  if (!filename) {
    throw new Error("Filename is required.");
  }

  const token = (civitai_token || getStoredCivitaiKey()).trim();
  const cleanRoot = remote_comfyui_root.replace(/\/$/, "");
  
  // Resolve absolute destination path on remote machine
  let cleanDestFolder = destination_folder.trim();
  if (!cleanDestFolder.startsWith("/")) {
    cleanDestFolder = path.posix.join(cleanRoot, cleanDestFolder);
  }
  const cleanTargetFilePath = path.posix.join(cleanDestFolder, filename);

  // Ensure download URL has token or headers configured
  let finalDownloadUrl = download_url;
  if (token && !finalDownloadUrl.includes("token=")) {
    const sep = finalDownloadUrl.includes("?") ? "&" : "?";
    finalDownloadUrl = `${finalDownloadUrl}${sep}token=${encodeURIComponent(token)}`;
  }

  // Shell-escaped variables
  const safeDestDir = cleanDestFolder.replace(/'/g, "'\\''");
  const safeFilename = filename.replace(/'/g, "'\\''");
  const safeUrl = finalDownloadUrl.replace(/'/g, "'\\''");
  const authHeaderParam = token ? `--header="Authorization: Bearer ${token}"` : "";
  const authHeaderCurl = token ? `-H "Authorization: Bearer ${token}"` : "";
  const authHeaderWget = token ? `--header="Authorization: Bearer ${token}"` : "";

  // Script with fallback from aria2c -> curl -> wget
  const remoteScript = `
set -e
mkdir -p '${safeDestDir}'
cd '${safeDestDir}'

echo "[Civitai Remote] Target destination: ${safeDestDir}/${safeFilename}"

if command -v aria2c >/dev/null 2>&1; then
  echo "[Civitai Remote] Executing aria2c accelerated multi-stream download..."
  aria2c -c -x 8 -s 8 -k 1M --allow-overwrite=true ${authHeaderParam} -d '${safeDestDir}' -o '${safeFilename}' '${safeUrl}'
elif command -v curl >/dev/null 2>&1; then
  echo "[Civitai Remote] Executing curl stream download with resume..."
  curl -L -C - --fail --retry 3 ${authHeaderCurl} -o '${safeDestDir}/${safeFilename}' '${safeUrl}'
elif command -v wget >/dev/null 2>&1; then
  echo "[Civitai Remote] Executing wget download..."
  wget -c --tries=3 ${authHeaderWget} -O '${safeDestDir}/${safeFilename}' '${safeUrl}'
else
  echo "[Civitai Remote] Error: Neither aria2c, curl, nor wget is installed on the remote machine." >&2
  exit 1
fi

if [ -f '${safeDestDir}/${safeFilename}' ]; then
  FILE_SIZE=$(ls -lh '${safeDestDir}/${safeFilename}' | awk '{print $5}')
  echo "[Civitai Remote] Download complete! Stored at: ${safeDestDir}/${safeFilename} ($FILE_SIZE)"
else
  echo "[Civitai Remote] Error: Target file was not found on disk after download." >&2
  exit 1
fi
`.trim();

  const startTime = Date.now();

  try {
    const res = await runSSHCommand({
      host: remote_host,
      port: ssh_port,
      username: ssh_username,
      password: ssh_password,
      privateKey: ssh_private_key,
      keyPath: ssh_key_path,
      command: remoteScript,
      timeoutMs: 600000 // 10 min for large weights
    });

    const durationSeconds = Math.round((Date.now() - startTime) / 1000);

    if (res.code !== 0) {
      throw new Error(`Remote process exited with code ${res.code}: ${res.stderr || res.stdout}`);
    }

    // Extract file size from log if present
    const sizeMatch = res.stdout.match(/\(([\d\.]+\s*[GMK]B?)\)/i);
    const resolvedSize = sizeMatch ? sizeMatch[1] : undefined;

    return {
      success: true,
      message: `Model '${filename}' downloaded successfully to ${cleanTargetFilePath} in ${durationSeconds}s.`,
      destination_path: cleanTargetFilePath,
      file_size: resolvedSize,
      duration_seconds: durationSeconds,
      logs: res.stdout
    };
  } catch (err: any) {
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);
    return {
      success: false,
      message: `Failed to download model to remote machine: ${err.message}`,
      error: err.message,
      destination_path: cleanTargetFilePath,
      duration_seconds: durationSeconds
    };
  }
}
