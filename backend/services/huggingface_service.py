import os
import re
import json
import httpx
from urllib.parse import urlparse
from pathlib import Path
from typing import Dict, Any, List, Optional
from backend.utils.file_handlers import ASSETS_DIR

HUGGINGFACE_CONFIG_FILE = ASSETS_DIR / "huggingface_config.json"

def get_stored_huggingface_token() -> str:
    """Retrieve saved Hugging Face token from environment or config file."""
    env_token = os.environ.get("HUGGINGFACE_TOKEN") or os.environ.get("HF_TOKEN") or ""
    if env_token.strip():
        return env_token.strip()
    if HUGGINGFACE_CONFIG_FILE.exists():
        try:
            with open(HUGGINGFACE_CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return (data.get("api_token") or data.get("token") or "").strip()
        except Exception:
            pass
    return ""

def save_huggingface_token(token: str) -> None:
    """Persist Hugging Face token securely to assets/huggingface_config.json."""
    clean_token = (token or "").strip()
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    with open(HUGGINGFACE_CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump({"api_token": clean_token}, f, indent=2)

def format_bytes(bytes_val: int) -> str:
    """Format bytes to readable human size (GB / MB)."""
    if not bytes_val or bytes_val <= 0:
        return "Unknown size"
    gb = bytes_val / (1024 * 1024 * 1024)
    if gb >= 1:
        return f"{gb:.2f} GB"
    mb = bytes_val / (1024 * 1024)
    return f"{mb:.1f} MB"

def detect_hf_category(
    pipeline_tag: str = "",
    tags: Optional[List[str]] = None,
    filename: str = "",
    repo_id: str = ""
) -> Dict[str, str]:
    """Detect model category and preset key from tags, pipeline, and filename."""
    tags = tags or []
    combined = f"{pipeline_tag} {' '.join(tags)} {filename} {repo_id}".lower()

    # 1. Text Encoders / CLIP
    if any(k in combined for k in ["clip", "text_encoder", "text-encoder", "t5xxl", "t5_", "t5-", "clip_l", "clip_g"]):
        return {
            "category": "Text Encoders / CLIP",
            "preset_key": "clip",
            "destination": "models/clip/"
        }

    # 2. Diffusion Models
    if any(k in combined for k in ["diffusion_models", "diffusion_model", "diffusionmodel", "wan", "wanvideo", "flux", "hunyuan", "transformer", "dit", "mochi", "cogvideo", "ltx", "unet"]):
        return {
            "category": "Diffusion Models (Wan / Flux / Hunyuan)",
            "preset_key": "diffusion_models",
            "destination": "models/diffusion_models/"
        }

    # 3. LoRAs
    if any(k in combined for k in ["lora", "dora", "locon", "lycoris"]):
        return {
            "category": "LoRAs",
            "preset_key": "loras",
            "destination": "models/loras/"
        }

    # 4. ControlNet
    if any(k in combined for k in ["controlnet", "t2i", "adapter"]):
        return {
            "category": "ControlNet",
            "preset_key": "controlnet",
            "destination": "models/controlnet/"
        }

    # 5. VAE
    if any(k in combined for k in ["vae", "autoencoder"]):
        return {
            "category": "VAE",
            "preset_key": "vae",
            "destination": "models/vae/"
        }

    # 6. Upscalers
    if any(k in combined for k in ["upscaler", "upscale", "esrgan", "real-esrgan", "swinir", "hat"]):
        return {
            "category": "Upscalers",
            "preset_key": "upscalers",
            "destination": "models/upscale_models/"
        }

    # 7. Embeddings
    if any(k in combined for k in ["embedding", "textualinversion", "textual_inversion"]):
        return {
            "category": "Embeddings",
            "preset_key": "embeddings",
            "destination": "models/embeddings/"
        }

    # Fallback: Checkpoints
    return {
        "category": "Checkpoints",
        "preset_key": "checkpoints",
        "destination": "models/checkpoints/"
    }

def normalize_huggingface_url(raw_url: str) -> Dict[str, Any]:
    """Normalize any Hugging Face URL converting /blob/ to /resolve/ direct streaming endpoint."""
    trimmed = (raw_url or "").strip()
    if not trimmed:
        return {"normalized_url": "", "is_hf": False}

    try:
        url_obj = urlparse(trimmed)
        host = (url_obj.hostname or "").lower()

        if "huggingface.co" in host:
            segments = [s for s in url_obj.path.split("/") if s]
            if len(segments) >= 2:
                owner = segments[0]
                repo = segments[1]
                repo_id = f"{owner}/{repo}"

                # Direct file URL: /owner/repo/blob/main/file.safetensors
                if len(segments) >= 4 and segments[2] in ["blob", "resolve", "raw"]:
                    revision = segments[3]
                    file_path = "/".join(segments[4:])
                    filename = segments[-1]
                    normalized = f"https://huggingface.co/{repo_id}/resolve/{revision}/{file_path}"
                    return {
                        "normalized_url": normalized,
                        "is_hf": True,
                        "repo_id": repo_id,
                        "revision": revision,
                        "file_path": file_path,
                        "filename": filename
                    }

                # Repo root or tree
                revision = segments[3] if len(segments) >= 4 and segments[2] == "tree" else "main"
                return {
                    "normalized_url": f"https://huggingface.co/{repo_id}",
                    "is_hf": True,
                    "repo_id": repo_id,
                    "revision": revision
                }
    except Exception:
        pass

    # Direct URL fallback
    extracted_filename = "model.safetensors"
    try:
        parsed = urlparse(trimmed)
        parts = [p for p in parsed.path.split("/") if p]
        if parts:
            extracted_filename = parts[-1].split("?")[0]
    except Exception:
        pass

    return {
        "normalized_url": trimmed,
        "is_hf": False,
        "filename": extracted_filename
    }

async def fetch_huggingface_model_info(query_url: str, token_override: Optional[str] = None) -> Dict[str, Any]:
    """Query Hugging Face API or direct URL to extract model metadata and download details."""
    token = (token_override or get_stored_huggingface_token()).strip()
    parsed = normalize_huggingface_url(query_url)

    auth_headers = {
        "User-Agent": "ComfyUI-Bridge/1.0 (AI Studio)"
    }
    if token:
        auth_headers["Authorization"] = f"Bearer {token}"

    # Case A: Hugging Face repo or file URL
    if parsed.get("is_hf") and parsed.get("repo_id"):
        repo_id = parsed["repo_id"]
        api_url = f"https://huggingface.co/api/models/{repo_id}"
        hf_data = None

        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                res = await client.get(api_url, headers=auth_headers)
                if res.status_code == 200:
                    hf_data = res.json()
                elif res.status_code in [401, 403]:
                    if not token:
                        raise ValueError("This Hugging Face repository is gated or private. Please configure your Hugging Face Access Token in settings.")
                    raise ValueError(f"Access denied to Hugging Face repo ({repo_id}). Verify your token permissions.")
                elif res.status_code == 404:
                    raise ValueError(f"Hugging Face repository '{repo_id}' not found.")
            except Exception as err:
                if any(k in str(err) for k in ["gated", "Access denied", "not found"]):
                    raise

            siblings = (hf_data or {}).get("siblings", [])
            model_files = []
            valid_exts = (".safetensors", ".gguf", ".bin", ".pt", ".ckpt", ".onnx")
            
            for s in siblings:
                rfilename = s.get("rfilename", "")
                if rfilename.lower().endswith(valid_exts):
                    fname = os.path.basename(rfilename)
                    rev = parsed.get("revision") or "main"
                    dl_url = f"https://huggingface.co/{repo_id}/resolve/{rev}/{rfilename}"
                    model_files.append({
                        "filename": fname,
                        "downloadUrl": dl_url,
                        "isPrimary": rfilename == parsed.get("file_path")
                    })

            target_filename = parsed.get("filename")
            target_download_url = parsed.get("normalized_url")

            if not target_filename and model_files:
                primary = next((f for f in model_files if f["filename"].endswith(".safetensors")), model_files[0])
                target_filename = primary["filename"]
                target_download_url = primary["downloadUrl"]
                primary["isPrimary"] = True
            elif not target_filename:
                safe_repo_name = re.sub(r"[^a-zA-Z0-9_-]", "_", repo_id)
                target_filename = f"{safe_repo_name}.safetensors"
                target_download_url = f"https://huggingface.co/{repo_id}/resolve/main/{target_filename}"

            # Probe size
            file_size_bytes = 0
            try:
                head_res = await client.head(target_download_url, headers=auth_headers, follow_redirects=True)
                if head_res.status_code == 200:
                    cl = head_res.headers.get("content-length")
                    if cl:
                        file_size_bytes = int(cl)
            except Exception:
                pass

        cat_info = detect_hf_category(
            pipeline_tag=(hf_data or {}).get("pipeline_tag", ""),
            tags=(hf_data or {}).get("tags", []),
            filename=target_filename,
            repo_id=repo_id
        )

        model_name = (hf_data or {}).get("id") or repo_id
        author = repo_id.split("/")[0] if "/" in repo_id else "Hugging Face"

        return {
            "repo_id": repo_id,
            "model_name": model_name,
            "author": author,
            "pipeline_tag": (hf_data or {}).get("pipeline_tag"),
            "tags": (hf_data or {}).get("tags", []),
            "filename": target_filename,
            "file_size_bytes": file_size_bytes,
            "file_size_formatted": format_bytes(file_size_bytes) if file_size_bytes > 0 else "Direct Stream",
            "download_url": target_download_url,
            "raw_url": query_url,
            "detected_category": cat_info["category"],
            "category_preset_key": cat_info["preset_key"],
            "default_destination_folder": cat_info["destination"],
            "suggested_remote_path": f"{cat_info['destination'].rstrip('/')}/{target_filename}",
            "is_gated": (hf_data or {}).get("gated", False),
            "private": (hf_data or {}).get("private", False),
            "available_files": model_files,
            "description": (hf_data or {}).get("description") or f"Hugging Face model repository for {model_name}"
        }

    # Case B: Direct URL
    target_filename = parsed.get("filename") or "model.safetensors"
    file_size_bytes = 0
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            head_res = await client.head(parsed.get("normalized_url"), headers=auth_headers, follow_redirects=True)
            if head_res.status_code == 200:
                cl = head_res.headers.get("content-length")
                if cl:
                    file_size_bytes = int(cl)
        except Exception:
            pass

    cat_info = detect_hf_category(filename=target_filename)
    norm_url = parsed.get("normalized_url") or query_url

    return {
        "repo_id": "Direct URL",
        "model_name": target_filename,
        "author": "Direct Source",
        "tags": ["direct-download"],
        "filename": target_filename,
        "file_size_bytes": file_size_bytes,
        "file_size_formatted": format_bytes(file_size_bytes) if file_size_bytes > 0 else "Direct Stream",
        "download_url": norm_url,
        "raw_url": query_url,
        "detected_category": cat_info["category"],
        "category_preset_key": cat_info["preset_key"],
        "default_destination_folder": cat_info["destination"],
        "suggested_remote_path": f"{cat_info['destination'].rstrip('/')}/{target_filename}",
        "description": f"Direct model download link: {norm_url}"
    }
