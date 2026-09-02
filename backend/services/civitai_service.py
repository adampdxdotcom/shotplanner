import os
import re
import json
import time
from datetime import datetime
import httpx
from pathlib import Path
from typing import Dict, Any, List, Optional, Union
from backend.utils.file_handlers import ASSETS_DIR

CIVITAI_CONFIG_FILE = ASSETS_DIR / "civitai_config.json"
CIVITAI_FAVORITES_FILE = ASSETS_DIR / "civitai_favorites.json"

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

def get_civitai_favorites() -> List[Dict[str, Any]]:
    """Retrieve list of saved Civitai favorites from assets/civitai_favorites.json."""
    if not CIVITAI_FAVORITES_FILE.exists():
        return []
    try:
        with open(CIVITAI_FAVORITES_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                return data
            elif isinstance(data, dict) and "favorites" in data:
                return data["favorites"]
            return []
    except Exception:
        return []

def save_civitai_favorite(model_data: Dict[str, Any]) -> Dict[str, Any]:
    """Add or update a Civitai model record in assets/civitai_favorites.json."""
    version_id = model_data.get("version_id") or model_data.get("versionId") or model_data.get("id")
    if not version_id:
        raise ValueError("Missing 'version_id' in model favorite data.")

    try:
        norm_v_id = int(version_id)
    except (ValueError, TypeError):
        norm_v_id = str(version_id)

    model_id = model_data.get("model_id") or model_data.get("modelId")
    try:
        norm_m_id = int(model_id) if model_id else 0
    except (ValueError, TypeError):
        norm_m_id = str(model_id) if model_id else ""

    trained_words = (
        model_data.get("trained_words") or
        model_data.get("trainedWords") or
        model_data.get("trigger_words") or
        []
    )

    clean_item = {
        "version_id": norm_v_id,
        "model_id": norm_m_id,
        "name": model_data.get("name") or model_data.get("model_name") or "Unnamed Model",
        "model_name": model_data.get("model_name") or model_data.get("name") or "Unnamed Model",
        "version_name": model_data.get("version_name") or model_data.get("versionName") or "",
        "category": model_data.get("category") or "Checkpoint",
        "base_model": model_data.get("base_model") or model_data.get("baseModel") or "SDXL 1.0",
        "image_url": (
            model_data.get("image_url") or
            model_data.get("preview_image_url") or
            model_data.get("cover_image_url") or
            ""
        ),
        "preview_image_url": (
            model_data.get("preview_image_url") or
            model_data.get("image_url") or
            ""
        ),
        "file_size": model_data.get("file_size") or model_data.get("file_size_formatted") or "",
        "file_size_formatted": model_data.get("file_size_formatted") or model_data.get("file_size") or "",
        "file_size_bytes": model_data.get("file_size_bytes") or 0,
        "filename": model_data.get("filename") or "",
        "download_url": model_data.get("download_url") or "",
        "default_destination_folder": model_data.get("default_destination_folder") or "models/checkpoints/",
        "suggested_remote_path": model_data.get("suggested_remote_path") or "",
        "trigger_words": trained_words,
        "trained_words": trained_words,
        "trainedWords": trained_words,
        "description": model_data.get("description") or "",
        "clean_description": model_data.get("clean_description") or model_data.get("description") or "",
        "download_command": model_data.get("download_command") or "",
        "tags": model_data.get("tags") or [],
        "added_at": model_data.get("added_at") or datetime.utcnow().isoformat()
    }

    favorites = get_civitai_favorites()
    # Check if existing item exists
    updated = False
    for i, fav in enumerate(favorites):
        fav_vid = fav.get("version_id")
        if str(fav_vid) == str(norm_v_id):
            favorites[i] = clean_item
            updated = True
            break

    if not updated:
        favorites.insert(0, clean_item)

    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    with open(CIVITAI_FAVORITES_FILE, "w", encoding="utf-8") as f:
        json.dump(favorites, f, indent=2)

    return clean_item

def delete_civitai_favorite(version_id: Union[int, str]) -> bool:
    """Remove a favorite model by its version ID from assets/civitai_favorites.json."""
    favorites = get_civitai_favorites()
    target_str = str(version_id).strip()
    new_favorites = [fav for fav in favorites if str(fav.get("version_id")) != target_str]

    if len(new_favorites) == len(favorites):
        return False

    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    with open(CIVITAI_FAVORITES_FILE, "w", encoding="utf-8") as f:
        json.dump(new_favorites, f, indent=2)
    return True

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

def clean_html_description(raw_html: Optional[str]) -> str:
    """Clean raw HTML markup from Civitai descriptions to produce clean plain text."""
    if not raw_html:
        return ""
    text = raw_html
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</p>", "\n\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</li>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</h[1-6]>", "\n\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</div>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = (
        text.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
        .replace("&nbsp;", " ")
        .replace("&ndash;", "–")
        .replace("&mdash;", "—")
    )
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text

def generate_civitai_download_command(
    download_url: str,
    destination_folder: str,
    filename: str,
    token: Optional[str] = None,
    remote_comfyui_root: Optional[str] = "/workspace/runpod-slim/ComfyUI"
) -> str:
    """Synthesize standardized remote CLI download command using curl exclusively."""
    root = (remote_comfyui_root or "/workspace/runpod-slim/ComfyUI").rstrip("/")
    dest = (destination_folder or "models/checkpoints/").strip()
    if not dest.startswith("/"):
        dest = f"{root}/{dest.lstrip('/')}"
    clean_dest = dest.rstrip("/")
    clean_filename = (filename or "model.safetensors").strip()
    clean_token = (token or "").strip()
    clean_url = (download_url or "").strip()

    final_url = clean_url
    if clean_token and "token=" not in final_url:
        sep = "&" if "?" in final_url else "?"
        final_url = f"{final_url}{sep}token={clean_token}"

    return f'mkdir -p "{clean_dest}" && curl -L -C - --fail --retry 3 --user-agent "Mozilla/5.0" -o "{clean_dest}/{clean_filename}" "{final_url}"'

def parse_civitai_query(raw_query: str) -> Dict[str, Any]:
    """
    Parse input string, AIR URN, or URL to extract version ID and/or model ID.
    Strictly prioritizes Model Version ID across all input formats.
    """
    query = (raw_query or "").strip()
    if not query:
        return {}

    # 1. Pure integer ID (e.g. "3193337")
    if re.match(r"^\d+$", query):
        num = int(query)
        return {"version_id": num, "model_id": num, "is_raw_numeric": True}

    # 2. Civitai AIR parser:
    # Extract strictly the numeric digits located between '@' and '+' (or end of string/whitespace).
    # Example: urn:air:minimaxh3:diffusionmodel:civitai:2830065@3193337+3074134 -> version_id: 3193337
    if "@" in query:
        air_version_match = re.search(r"@(\d+)(?:\+|[\s\b]|$)", query)
        air_model_match = re.search(r"(?:civitai:|\/models\/|:|^)(\d+)@", query, re.IGNORECASE)
        version_id = int(air_version_match.group(1)) if air_version_match else None
        model_id = int(air_model_match.group(1)) if air_model_match else None
        if version_id:
            return {"version_id": version_id, "model_id": model_id, "is_air": True}

    # 3. Civitai URL & query parser:
    # Prioritize modelVersionId query parameter over parent model path
    version_param_match = re.search(r"[?&]modelVersionId=(\d+)", query, re.IGNORECASE)
    version_param_id = int(version_param_match.group(1)) if version_param_match else None

    # Check /model-versions/{id} in URL path
    version_path_match = re.search(r"/model-versions/(\d+)", query, re.IGNORECASE)
    version_path_id = int(version_path_match.group(1)) if version_path_match else None

    # Check /models/{id} in URL path
    model_match = re.search(r"/models/(\d+)", query, re.IGNORECASE)
    model_id = int(model_match.group(1)) if model_match else None

    # Check /api/v1/models/{id}
    api_model_match = re.search(r"/api/v1/models/(\d+)", query, re.IGNORECASE)
    if api_model_match and not model_id:
        model_id = int(api_model_match.group(1))

    resolved_version_id = version_param_id or version_path_id

    if resolved_version_id:
        return {"version_id": resolved_version_id, "model_id": model_id}

    if model_id:
        return {"model_id": model_id, "version_id": None}

    return {}

async def fetch_civitai_model_info(query: str, token_override: Optional[str] = None) -> Dict[str, Any]:
    """Query Civitai API to fetch detailed model metadata, strictly prioritizing Model Version ID."""
    token = (token_override or get_stored_civitai_key()).strip()
    parsed = parse_civitai_query(query)
    model_id = parsed.get("model_id")
    version_id = parsed.get("version_id")

    if not model_id and not version_id:
        raise ValueError("Invalid Civitai query. Please enter a valid Civitai Model Version ID, AIR URN, Model ID, or Civitai URL.")

    headers = {
        "Accept": "application/json",
        "User-Agent": "ComfyUI-Bridge/1.0 (AI Studio)"
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    version_data = None
    model_data = None

    async with httpx.AsyncClient(timeout=15.0) as client:
        # Priority 1: Query Civitai Model Version endpoint for version_id / raw numeric / AIR / modelVersionId param
        if version_id:
            version_url = f"https://civitai.com/api/v1/model-versions/{version_id}"
            try:
                res = await client.get(version_url, headers=headers)
                if res.status_code == 200:
                    version_data = res.json()
            except Exception:
                pass

        # Priority 2: Fallback to Model ID endpoint if version lookup failed or model-only URL
        if not version_data and model_id:
            model_url = f"https://civitai.com/api/v1/models/{model_id}"
            res = await client.get(model_url, headers=headers)
            if res.status_code != 200:
                if res.status_code == 404:
                    raise ValueError(f"Civitai model / version not found (ID {version_id or model_id}). Ensure token is configured for early access/private models.")
                raise ValueError(f"Civitai API error (HTTP {res.status_code}): {res.text[:200]}")
            model_data = res.json()

        # If we fetched version data, query parent model data to enrich metadata
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

    # Extract and normalize trained trigger words
    raw_trained_words = version_data.get("trainedWords") or (model_data or {}).get("trainedWords") or []
    trained_words_list = []
    if isinstance(raw_trained_words, list):
        for w in raw_trained_words:
            if isinstance(w, str):
                for part in w.split(","):
                    p = part.strip()
                    if p and p not in trained_words_list:
                        trained_words_list.append(p)

    # Extract and clean HTML description / release notes
    raw_description = version_data.get("description") or (model_data or {}).get("description") or ""
    cleaned_desc = clean_html_description(raw_description)

    # Synthesize pre-formatted remote CLI download command
    download_command = generate_civitai_download_command(
        download_url=download_url,
        destination_folder=default_dest,
        filename=filename,
        token=token
    )

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
        "files": files,
        "trained_words": trained_words_list,
        "trainedWords": trained_words_list,
        "description": cleaned_desc or raw_description,
        "clean_description": cleaned_desc,
        "download_command": download_command,
        "tags": (model_data or {}).get("tags") or [],
        "allow_commercial_use": (model_data or {}).get("allowCommercialUse"),
        "nsfw": (model_data or {}).get("nsfw") or False,
        "versions": available_versions
    }
