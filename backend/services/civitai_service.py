import os
import re
import json
import httpx
from pathlib import Path
from typing import Dict, Any, List, Optional
from backend.utils.file_handlers import ASSETS_DIR

CIVITAI_CONFIG_FILE = ASSETS_DIR / "civitai_config.json"

def get_stored_civitai_key() -> str:
    """Retrieve saved Civitai API key from filesystem or environment."""
    env_key = os.environ.get("CIVITAI_API_KEY", "").strip()
    if env_key:
        return env_key
    if CIVITAI_CONFIG_FILE.exists():
        try:
            with open(CIVITAI_CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return (data.get("api_key") or "").strip()
        except Exception:
            pass
    return ""

def save_civitai_key(api_key: str) -> None:
    """Persist Civitai API key to assets/civitai_config.json."""
    clean_key = (api_key or "").strip()
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    with open(CIVITAI_CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump({"api_key": clean_key}, f, indent=2)

def determine_comfyui_destination(category: str) -> str:
    """Determine the appropriate remote ComfyUI destination subfolder based on model category."""
    cat = (category or "").strip().lower()
    if any(k in cat for k in ["lora", "dora", "locon", "lycoris"]):
        return "models/loras/"
    if any(k in cat for k in ["controlnet", "t2i", "adapter"]):
        return "models/controlnet/"
    if "vae" in cat:
        return "models/vae/"
    if any(k in cat for k in ["upscaler", "upscale", "esrgan"]):
        return "models/upscale_models/"
    if any(k in cat for k in ["embedding", "textualinversion", "textual inversion"]):
        return "models/embeddings/"
    if any(k in cat for k in ["animatediff", "motionmodule", "motion"]):
        return "models/animatediff_models/"
    if any(k in cat for k in ["clipvision", "clip_vision", "clip vision"]):
        return "models/clip_vision/"
    if any(k in cat for k in ["unet", "diffusion_models", "diffusionmodel"]):
        return "models/diffusion_models/"
    return "models/checkpoints/"

def format_bytes(bytes_val: int) -> str:
    """Format bytes to readable human size (GB / MB)."""
    if not bytes_val or bytes_val <= 0:
        return "Unknown size"
    gb = bytes_val / (1024 * 1024 * 1024)
    if gb >= 1:
        return f"{gb:.2f} GB"
    mb = bytes_val / (1024 * 1024)
    return f"{mb:.1f} MB"

def parse_civitai_query(raw_query: str) -> Dict[str, Optional[int]]:
    """Parse input string or URL to extract version ID and/or model ID."""
    query = (raw_query or "").strip()
    if not query:
        return {}
    if re.match(r"^\d+$", query):
        num = int(query)
        return {"version_id": num, "model_id": num}
    
    # Check URL parameter modelVersionId=123
    version_param_match = re.search(r"modelVersionId=(\d+)", query, re.IGNORECASE)
    version_id = int(version_param_match.group(1)) if version_param_match else None

    # Check path matches
    model_match = re.search(r"/models/(\d+)", query, re.IGNORECASE)
    model_id = int(model_match.group(1)) if model_match else None

    version_path_match = re.search(r"/model-versions/(\d+)", query, re.IGNORECASE)
    if version_path_match and not version_id:
        version_id = int(version_path_match.group(1))

    return {"model_id": model_id, "version_id": version_id}

async def fetch_civitai_model_info(query: str, token_override: Optional[str] = None) -> Dict[str, Any]:
    """Query Civitai API to fetch detailed model metadata."""
    token = (token_override or get_stored_civitai_key()).strip()
    parsed = parse_civitai_query(query)
    model_id = parsed.get("model_id")
    version_id = parsed.get("version_id")

    if not model_id and not version_id:
        raise ValueError("Invalid Civitai query. Please enter a valid Civitai Model ID, Version ID, or Civitai URL.")

    headers = {
        "Accept": "application/json",
        "User-Agent": "ComfyUI-Bridge/1.0 (AI Studio)"
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    version_data = None
    model_data = None

    async with httpx.AsyncClient(timeout=15.0) as client:
        # Case 1: Specific version ID identified
        if version_id:
            version_url = f"https://civitai.com/api/v1/model-versions/{version_id}"
            try:
                res = await client.get(version_url, headers=headers)
                if res.status_code == 200:
                    version_data = res.json()
            except Exception:
                pass

        # Case 2: Model ID identified or version lookup fell back
        if not version_data and model_id:
            model_url = f"https://civitai.com/api/v1/models/{model_id}"
            res = await client.get(model_url, headers=headers)
            if res.status_code != 200:
                if res.status_code == 404:
                    raise ValueError(f"Civitai model not found (ID {model_id}). Ensure token is configured for early access/private models.")
                raise ValueError(f"Civitai API error (HTTP {res.status_code}): {res.text[:200]}")
            model_data = res.json()

        # If we fetched version data, optionally fetch parent model data
        if version_data and not model_data and version_data.get("modelId"):
            try:
                model_res = await client.get(f"https://civitai.com/api/v1/models/{version_data['modelId']}", headers=headers)
                if model_res.status_code == 200:
                    model_data = model_res.json()
            except Exception:
                pass

        # If we only have modelData, extract first model version
        if not version_data and model_data:
            versions = model_data.get("modelVersions", [])
            if not versions:
                raise ValueError(f"Civitai model '{model_data.get('name')}' has no available versions.")
            version_data = versions[0]

    if not version_data:
        raise ValueError("Could not retrieve model version metadata from Civitai API.")

    resolved_model_id = (model_data or {}).get("id") or version_data.get("modelId") or model_id or 0
    resolved_model_name = (model_data or {}).get("name") or version_data.get("model", {}).get("name") or version_data.get("name") or "Untitled Model"
    resolved_version_id = version_data.get("id")
    resolved_version_name = version_data.get("name") or "Default Version"
    category = (model_data or {}).get("type") or version_data.get("model", {}).get("type") or "Checkpoint"
    base_model = version_data.get("baseModel") or "SDXL 1.0"

    # Identify primary file
    files = version_data.get("files", [])
    primary_file = next((f for f in files if f.get("primary") is True), None)
    if not primary_file and files:
        primary_file = next((f for f in files if str(f.get("name", "")).endswith(".safetensors")), files[0])

    filename = (primary_file or {}).get("name") or f"{re.sub(r'[^a-zA-Z0-9_-]', '_', resolved_model_name.lower())}.safetensors"
    size_kb = (primary_file or {}).get("sizeKB", 0)
    file_size_bytes = int(size_kb * 1024)

    images = version_data.get("images", []) or (model_data or {}).get("images", [])
    preview_image_url = images[0].get("url", "") if images else ""

    download_url = version_data.get("downloadUrl") or f"https://civitai.com/api/download/models/{resolved_version_id}"
    if token and "token=" not in download_url:
        sep = "&" if "?" in download_url else "?"
        download_url = f"{download_url}{sep}token={token}"

    default_dest = determine_comfyui_destination(category)
    suggested_remote_path = f"{default_dest.rstrip('/')}/{filename}"

    available_versions = []
    if model_data and "modelVersions" in model_data:
        for v in model_data["modelVersions"]:
            available_versions.append({
                "id": v.get("id"),
                "name": v.get("name"),
                "baseModel": v.get("baseModel"),
                "downloadUrl": v.get("downloadUrl"),
                "createdAt": v.get("createdAt")
            })

    return {
        "model_id": resolved_model_id,
        "model_name": resolved_model_name,
        "version_id": resolved_version_id,
        "version_name": resolved_version_name,
        "category": category,
        "base_model": base_model,
        "file_size_bytes": file_size_bytes,
        "file_size_formatted": format_bytes(file_size_bytes),
        "filename": filename,
        "preview_image_url": preview_image_url,
        "download_url": download_url,
        "default_destination_folder": default_dest,
        "suggested_remote_path": suggested_remote_path,
        "description": (model_data or {}).get("description") or version_data.get("description") or "",
        "tags": (model_data or {}).get("tags") or [],
        "allow_commercial_use": (model_data or {}).get("allowCommercialUse"),
        "nsfw": (model_data or {}).get("nsfw") or False,
        "versions": available_versions
    }
