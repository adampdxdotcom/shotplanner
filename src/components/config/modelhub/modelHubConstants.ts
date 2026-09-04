import { ModelCategoryPreset } from "../../../types";

export const COMFYUI_MODEL_CATEGORIES: ModelCategoryPreset[] = [
  { 
    id: "checkpoints", 
    label: "Checkpoints", 
    subfolder: "models/checkpoints/",
    description: "Base models (SD 1.5, SDXL, Pony, Illustrious)"
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

export const computeFullRemotePath = (
  destFolder: string,
  filename: string,
  remoteComfyRoot: string = "/workspace/runpod-slim/ComfyUI"
): string => {
  const root = (remoteComfyRoot || "/workspace/runpod-slim/ComfyUI").replace(/\/$/, "");
  const sub = (destFolder || "").trim();
  if (sub.startsWith("/")) {
    return `${sub.replace(/\/$/, "")}/${filename || ""}`;
  }
  return `${root}/${sub.replace(/^\//, "").replace(/\/$/, "")}/${filename || ""}`;
};
