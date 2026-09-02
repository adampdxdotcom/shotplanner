import fs from "fs";
import path from "path";
import { HUGGINGFACE_CONFIG_FILE } from "../config/constants";

export interface HuggingFaceFileOption {
  filename: string;
  downloadUrl: string;
  sizeBytes?: number;
  sizeFormatted?: string;
  isPrimary?: boolean;
}

export interface HuggingFaceModelMetadata {
  repo_id: string;
  model_name: string;
  author: string;
  pipeline_tag?: string;
  tags: string[];
  filename: string;
  file_size_bytes?: number;
  file_size_formatted?: string;
  download_url: string;
  raw_url: string;
  detected_category: string;
  category_preset_key: string;
  default_destination_folder: string;
  suggested_remote_path: string;
  is_gated?: boolean;
  private?: boolean;
  available_files?: HuggingFaceFileOption[];
  description?: string;
}

/**
 * Retrieve saved Hugging Face token from environment or config file
 */
export function getStoredHuggingFaceToken(): string {
  if (process.env.HUGGINGFACE_TOKEN && process.env.HUGGINGFACE_TOKEN.trim()) {
    return process.env.HUGGINGFACE_TOKEN.trim();
  }
  if (process.env.HF_TOKEN && process.env.HF_TOKEN.trim()) {
    return process.env.HF_TOKEN.trim();
  }
  if (fs.existsSync(HUGGINGFACE_CONFIG_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(HUGGINGFACE_CONFIG_FILE, "utf-8"));
      return (data.api_token || data.token || "").trim();
    } catch (e) {}
  }
  return "";
}

/**
 * Persist Hugging Face token securely
 */
export function saveHuggingFaceToken(token: string): void {
  const cleanToken = (token || "").trim();
  fs.writeFileSync(
    HUGGINGFACE_CONFIG_FILE,
    JSON.stringify({ api_token: cleanToken, updated_at: new Date().toISOString() }, null, 2)
  );
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
 * Detect model category and preset key from tags, pipeline, and filename
 */
export function detectHFCategory(options: {
  pipeline_tag?: string;
  tags?: string[];
  filename?: string;
  repo_id?: string;
}): { category: string; presetKey: string; destination: string } {
  const { pipeline_tag = "", tags = [], filename = "", repo_id = "" } = options;
  const combined = `${pipeline_tag} ${tags.join(" ")} ${filename} ${repo_id}`.toLowerCase();

  // 1. Text Encoders / CLIP / T5
  if (
    combined.includes("clip") ||
    combined.includes("text_encoder") ||
    combined.includes("text-encoder") ||
    combined.includes("t5xxl") ||
    combined.includes("t5_") ||
    combined.includes("t5-") ||
    combined.includes("clip_l") ||
    combined.includes("clip_g") ||
    combined.includes("tokenizer")
  ) {
    return {
      category: "Text Encoders / CLIP",
      presetKey: "clip",
      destination: "models/clip/"
    };
  }

  // 2. Diffusion Models / UNets / DiTs / Wan / Flux / Hunyuan
  if (
    combined.includes("diffusion_models") ||
    combined.includes("diffusion_model") ||
    combined.includes("diffusionmodel") ||
    combined.includes("wan") ||
    combined.includes("wanvideo") ||
    combined.includes("flux") ||
    combined.includes("hunyuan") ||
    combined.includes("transformer") ||
    combined.includes("dit") ||
    combined.includes("mochi") ||
    combined.includes("cogvideo") ||
    combined.includes("ltx") ||
    combined.includes("unet")
  ) {
    return {
      category: "Diffusion Models (Wan / Flux / Hunyuan)",
      presetKey: "diffusion_models",
      destination: "models/diffusion_models/"
    };
  }

  // 3. LoRAs
  if (
    combined.includes("lora") ||
    combined.includes("dora") ||
    combined.includes("locon") ||
    combined.includes("lycoris")
  ) {
    return {
      category: "LoRAs",
      presetKey: "loras",
      destination: "models/loras/"
    };
  }

  // 4. ControlNet
  if (
    combined.includes("controlnet") ||
    combined.includes("t2i") ||
    combined.includes("adapter")
  ) {
    return {
      category: "ControlNet",
      presetKey: "controlnet",
      destination: "models/controlnet/"
    };
  }

  // 5. VAE
  if (
    combined.includes("vae") ||
    combined.includes("autoencoder")
  ) {
    return {
      category: "VAE",
      presetKey: "vae",
      destination: "models/vae/"
    };
  }

  // 6. Upscalers
  if (
    combined.includes("upscaler") ||
    combined.includes("upscale") ||
    combined.includes("esrgan") ||
    combined.includes("real-esrgan") ||
    combined.includes("swinir") ||
    combined.includes("hat")
  ) {
    return {
      category: "Upscalers",
      presetKey: "upscalers",
      destination: "models/upscale_models/"
    };
  }

  // 7. Embeddings
  if (
    combined.includes("embedding") ||
    combined.includes("textualinversion") ||
    combined.includes("textual_inversion")
  ) {
    return {
      category: "Embeddings",
      presetKey: "embeddings",
      destination: "models/embeddings/"
    };
  }

  // Default fallback: Checkpoints
  return {
    category: "Checkpoints",
    presetKey: "checkpoints",
    destination: "models/checkpoints/"
  };
}

/**
 * Normalize any Hugging Face URL converting /blob/ to /resolve/ direct streaming endpoint
 */
export function normalizeHuggingFaceUrl(rawUrl: string): {
  normalizedUrl: string;
  isHf: boolean;
  repoId?: string;
  revision?: string;
  filePath?: string;
  filename?: string;
} {
  const trimmed = (rawUrl || "").trim();
  if (!trimmed) {
    return { normalizedUrl: "", isHf: false };
  }

  try {
    const urlObj = new URL(trimmed);
    const host = urlObj.hostname.toLowerCase();

    if (host.includes("huggingface.co")) {
      // Path format 1: /owner/repo/blob/revision/path/to/file.safetensors
      // Path format 2: /owner/repo/resolve/revision/path/to/file.safetensors
      // Path format 3: /owner/repo/raw/revision/path/to/file.safetensors
      // Path format 4: /owner/repo (repository root)
      const segments = urlObj.pathname.split("/").filter(Boolean);

      if (segments.length >= 2) {
        const owner = segments[0];
        const repo = segments[1];
        const repoId = `${owner}/${repo}`;

        // File download format
        if (segments.length >= 4 && (segments[2] === "blob" || segments[2] === "resolve" || segments[2] === "raw")) {
          const revision = segments[3];
          const filePath = segments.slice(4).join("/");
          const filename = segments[segments.length - 1];
          const normalizedUrl = `https://huggingface.co/${repoId}/resolve/${revision}/${filePath}`;
          return {
            normalizedUrl,
            isHf: true,
            repoId,
            revision,
            filePath,
            filename
          };
        }

        // Repo root or tree
        return {
          normalizedUrl: `https://huggingface.co/${repoId}`,
          isHf: true,
          repoId,
          revision: segments[2] === "tree" && segments[3] ? segments[3] : "main"
        };
      }
    }
  } catch (e) {}

  // Direct URL fallback (non-HF or raw direct link)
  let extractedFilename = "model.safetensors";
  try {
    const parsed = new URL(trimmed);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length > 0) {
      extractedFilename = parts[parts.length - 1];
    }
  } catch (e) {
    const parts = trimmed.split("/").filter(Boolean);
    if (parts.length > 0) {
      extractedFilename = parts[parts.length - 1].split("?")[0];
    }
  }

  return {
    normalizedUrl: trimmed,
    isHf: false,
    filename: extractedFilename
  };
}

/**
 * Query Hugging Face API or direct URL to extract model metadata and download details
 */
export async function fetchHuggingFaceModelInfo(
  queryUrl: string,
  tokenOverride?: string
): Promise<HuggingFaceModelMetadata> {
  const token = (tokenOverride || getStoredHuggingFaceToken()).trim();
  const parsed = normalizeHuggingFaceUrl(queryUrl);

  const authHeaders: Record<string, string> = {
    "User-Agent": "ComfyUI-Bridge/1.0 (AI Studio)"
  };
  if (token) {
    authHeaders["Authorization"] = `Bearer ${token}`;
  }

  // Case A: Hugging Face repository or file URL
  if (parsed.isHf && parsed.repoId) {
    const apiUrl = `https://huggingface.co/api/models/${parsed.repoId}`;
    let hfData: any = null;

    try {
      const res = await fetch(apiUrl, { headers: authHeaders });
      if (res.ok) {
        hfData = await res.json();
      } else if (res.status === 401 || res.status === 403) {
        if (!token) {
          throw new Error(`This Hugging Face repository is gated or private. Please configure your Hugging Face Access Token in the settings below.`);
        }
        throw new Error(`Access denied to Hugging Face repo (${parsed.repoId}). Verify your token permissions.`);
      } else if (res.status === 404) {
        throw new Error(`Hugging Face repository '${parsed.repoId}' not found.`);
      }
    } catch (err: any) {
      if (err.message.includes("gated") || err.message.includes("Access denied") || err.message.includes("not found")) {
        throw err;
      }
    }

    const siblings = (hfData?.siblings || []) as Array<{ rfilename: string }>;
    const modelFiles: HuggingFaceFileOption[] = siblings
      .filter((s) => {
        const f = s.rfilename.toLowerCase();
        return (
          f.endsWith(".safetensors") ||
          f.endsWith(".gguf") ||
          f.endsWith(".bin") ||
          f.endsWith(".pt") ||
          f.endsWith(".ckpt") ||
          f.endsWith(".onnx")
        );
      })
      .map((s) => {
        const fname = path.basename(s.rfilename);
        return {
          filename: fname,
          downloadUrl: `https://huggingface.co/${parsed.repoId}/resolve/${parsed.revision || "main"}/${s.rfilename}`,
          isPrimary: s.rfilename === parsed.filePath
        };
      });

    // Determine target file
    let targetFilename = parsed.filename;
    let targetDownloadUrl = parsed.normalizedUrl;

    if (!targetFilename && modelFiles.length > 0) {
      // Pick first or primary safetensors file
      const primary = modelFiles.find((f) => f.filename.endsWith(".safetensors")) || modelFiles[0];
      targetFilename = primary.filename;
      targetDownloadUrl = primary.downloadUrl;
      primary.isPrimary = true;
    } else if (!targetFilename) {
      targetFilename = `${parsed.repoId.replace(/[^a-zA-Z0-9_-]/g, "_")}.safetensors`;
      targetDownloadUrl = `https://huggingface.co/${parsed.repoId}/resolve/main/${targetFilename}`;
    }

    // Try probing content-length if possible
    let fileSizeBytes = 0;
    try {
      const headRes = await fetch(targetDownloadUrl, {
        method: "HEAD",
        headers: authHeaders,
        redirect: "follow"
      });
      if (headRes.ok) {
        const cl = headRes.headers.get("content-length");
        if (cl) fileSizeBytes = parseInt(cl, 10);
      }
    } catch (e) {}

    const categoryInfo = detectHFCategory({
      pipeline_tag: hfData?.pipeline_tag,
      tags: hfData?.tags || [],
      filename: targetFilename,
      repo_id: parsed.repoId
    });

    const modelName = hfData?.id || parsed.repoId;
    const author = parsed.repoId.split("/")[0] || "Hugging Face";

    return {
      repo_id: parsed.repoId,
      model_name: modelName,
      author,
      pipeline_tag: hfData?.pipeline_tag,
      tags: hfData?.tags || [],
      filename: targetFilename,
      file_size_bytes: fileSizeBytes,
      file_size_formatted: fileSizeBytes > 0 ? formatBytes(fileSizeBytes) : "Direct Stream",
      download_url: targetDownloadUrl,
      raw_url: queryUrl,
      detected_category: categoryInfo.category,
      category_preset_key: categoryInfo.presetKey,
      default_destination_folder: categoryInfo.destination,
      suggested_remote_path: path.posix.join(categoryInfo.destination, targetFilename),
      is_gated: hfData?.gated || false,
      private: hfData?.private || false,
      available_files: modelFiles,
      description: hfData?.description || `Hugging Face model repository for ${modelName}`
    };
  }

  // Case B: Direct download link / non-HF URL
  const targetFilename = parsed.filename || "model.safetensors";
  let fileSizeBytes = 0;
  try {
    const headRes = await fetch(parsed.normalizedUrl, {
      method: "HEAD",
      headers: authHeaders,
      redirect: "follow"
    });
    if (headRes.ok) {
      const cl = headRes.headers.get("content-length");
      if (cl) fileSizeBytes = parseInt(cl, 10);
    }
  } catch (e) {}

  const categoryInfo = detectHFCategory({
    filename: targetFilename
  });

  return {
    repo_id: "Direct URL",
    model_name: targetFilename,
    author: "Direct Source",
    tags: ["direct-download"],
    filename: targetFilename,
    file_size_bytes: fileSizeBytes,
    file_size_formatted: fileSizeBytes > 0 ? formatBytes(fileSizeBytes) : "Direct Stream",
    download_url: parsed.normalizedUrl,
    raw_url: queryUrl,
    detected_category: categoryInfo.category,
    category_preset_key: categoryInfo.presetKey,
    default_destination_folder: categoryInfo.destination,
    suggested_remote_path: path.posix.join(categoryInfo.destination, targetFilename),
    description: `Direct model download link: ${parsed.normalizedUrl}`
  };
}
