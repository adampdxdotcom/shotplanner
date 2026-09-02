import fs from "fs";
import path from "path";
import { Client, ConnectConfig } from "ssh2";
import { getStoredCivitaiKey } from "./civitaiService";
import { getStoredHuggingFaceToken } from "./huggingfaceService";

export interface ModelCategoryPreset {
  id: string;
  label: string;
  subfolder: string;
  description?: string;
}

export const COMFYUI_MODEL_CATEGORIES: ModelCategoryPreset[] = [
  { 
    id: "checkpoints", 
    label: "Checkpoints", 
    subfolder: "models/checkpoints/",
    description: "Standard base models (SD 1.5, SDXL, Pony, Illustrious)"
  },
  { 
    id: "diffusion_models", 
    label: "Diffusion Models (Wan / Flux / Hunyuan)", 
    subfolder: "models/diffusion_models/",
    description: "Modern standalone DiT / UNet models (Wan2.1, FLUX, HunyuanVideo)"
  },
  { 
    id: "loras", 
    label: "LoRAs", 
    subfolder: "models/loras/",
    description: "Low-Rank Adaptation weights, DoRA, LoCon, LyCORIS"
  },
  { 
    id: "controlnet", 
    label: "ControlNet", 
    subfolder: "models/controlnet/",
    description: "ControlNet, T2I-Adapter, IP-Adapter models"
  },
  { 
    id: "clip", 
    label: "Text Encoders / CLIP", 
    subfolder: "models/clip/",
    description: "Text encoders (T5-XXL, CLIP-L, CLIP-G, ViT)"
  },
  { 
    id: "vae", 
    label: "VAE", 
    subfolder: "models/vae/",
    description: "Variational Autoencoders"
  },
  { 
    id: "upscalers", 
    label: "Upscalers", 
    subfolder: "models/upscale_models/",
    description: "ESRGAN, Real-ESRGAN, SwinIR upscaling models"
  },
  { 
    id: "embeddings", 
    label: "Embeddings", 
    subfolder: "models/embeddings/",
    description: "Textual inversions and prompt embeddings"
  },
  { 
    id: "custom", 
    label: "Custom Subfolder...", 
    subfolder: "",
    description: "Specify a custom relative path under ComfyUI root"
  }
];

export interface UnifiedRemoteDownloadOptions {
  download_url: string;
  destination_folder: string;
  filename: string;
  auth_type?: "civitai" | "huggingface" | "custom" | "none";
  api_token?: string;
  remote_host: string;
  ssh_port?: number;
  ssh_username?: string;
  ssh_password?: string;
  ssh_private_key?: string;
  ssh_key_path?: string;
  remote_comfyui_root?: string;
}

export interface UnifiedRemoteDownloadResult {
  success: boolean;
  message: string;
  destination_path?: string;
  file_size?: string;
  duration_seconds?: number;
  logs?: string;
  error?: string;
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

    const timeoutMs = options.timeoutMs || 900000; // 15 min default for large weights
    const timer = setTimeout(() => {
      if (!isFinished) {
        isFinished = true;
        try { conn.end(); } catch (e) {}
        reject(new Error(`Remote SSH download process timed out after ${Math.round(timeoutMs / 1000)}s`));
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
 * Execute unified remote direct download to ComfyUI models folder via SSH
 */
export async function executeUnifiedRemoteDownload(
  options: UnifiedRemoteDownloadOptions
): Promise<UnifiedRemoteDownloadResult> {
  const {
    download_url,
    destination_folder,
    filename,
    auth_type,
    api_token,
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

  // Resolve token based on URL or auth_type
  let resolvedToken = (api_token || "").trim();
  const lowerUrl = download_url.toLowerCase();

  if (!resolvedToken) {
    if (auth_type === "civitai" || lowerUrl.includes("civitai.com")) {
      resolvedToken = getStoredCivitaiKey();
    } else if (auth_type === "huggingface" || lowerUrl.includes("huggingface.co")) {
      resolvedToken = getStoredHuggingFaceToken();
    }
  }

  const cleanRoot = remote_comfyui_root.replace(/\/$/, "");
  
  // Resolve absolute destination path on remote machine
  let cleanDestFolder = (destination_folder || "models/checkpoints/").trim();
  if (!cleanDestFolder.startsWith("/")) {
    cleanDestFolder = path.posix.join(cleanRoot, cleanDestFolder);
  }
  const cleanTargetFilePath = path.posix.join(cleanDestFolder, filename);

  // If Civitai and token present, ensure query param or auth header
  let finalDownloadUrl = download_url;
  if (lowerUrl.includes("civitai.com") && resolvedToken && !finalDownloadUrl.includes("token=")) {
    const sep = finalDownloadUrl.includes("?") ? "&" : "?";
    finalDownloadUrl = `${finalDownloadUrl}${sep}token=${encodeURIComponent(resolvedToken)}`;
  }

  // Shell-escaped parameters
  const safeDestDir = cleanDestFolder.replace(/'/g, "'\\''");
  const safeFilename = filename.replace(/'/g, "'\\''");
  const safeUrl = finalDownloadUrl.replace(/'/g, "'\\''");
  const authHeaderAria = resolvedToken ? `--header="Authorization: Bearer ${resolvedToken}"` : "";
  const authHeaderCurl = resolvedToken ? `-H "Authorization: Bearer ${resolvedToken}"` : "";
  const authHeaderWget = resolvedToken ? `--header="Authorization: Bearer ${resolvedToken}"` : "";

  // Multi-connection accelerated download script with fallbacks
  const remoteScript = `
set -e
mkdir -p '${safeDestDir}'
cd '${safeDestDir}'

echo "[Model Hub] Target destination: ${safeDestDir}/${safeFilename}"
echo "[Model Hub] Downloading from: ${safeUrl}"

if command -v aria2c >/dev/null 2>&1; then
  echo "[Model Hub] Executing aria2c accelerated multi-stream download..."
  aria2c -c -x 8 -s 8 -k 1M --allow-overwrite=true ${authHeaderAria} -d '${safeDestDir}' -o '${safeFilename}' '${safeUrl}'
elif command -v curl >/dev/null 2>&1; then
  echo "[Model Hub] Executing curl stream download with resume..."
  curl -L -C - --fail --retry 3 ${authHeaderCurl} -o '${safeDestDir}/${safeFilename}' '${safeUrl}'
elif command -v wget >/dev/null 2>&1; then
  echo "[Model Hub] Executing wget download..."
  wget -c --tries=3 ${authHeaderWget} -O '${safeDestDir}/${safeFilename}' '${safeUrl}'
else
  echo "[Model Hub] Error: Neither aria2c, curl, nor wget is installed on remote instance." >&2
  exit 1
fi

if [ -f '${safeDestDir}/${safeFilename}' ]; then
  FILE_SIZE=$(ls -lh '${safeDestDir}/${safeFilename}' | awk '{print $5}')
  echo "[Model Hub] Ingestion complete! Stored at: ${safeDestDir}/${safeFilename} ($FILE_SIZE)"
else
  echo "[Model Hub] Error: Target model file not found on disk after download." >&2
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
      timeoutMs: 900000
    });

    const durationSeconds = Math.round((Date.now() - startTime) / 1000);

    if (res.code !== 0) {
      throw new Error(`Remote process exited with code ${res.code}: ${res.stderr || res.stdout}`);
    }

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
