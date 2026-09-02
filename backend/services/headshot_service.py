import os
import re
import time
import json
import base64
import httpx
from pathlib import Path
from typing import Dict, Any, List, Optional
from fastapi import HTTPException

from backend.utils.file_handlers import (
    ASSETS_DIR,
    find_asset_file_path,
    generate_target_filename,
    save_uploaded_file,
    generate_thumbnail
)

HEADSHOT_TEMPLATES: Dict[str, str] = {
    "facing": "Facing - High quality front facing headshot portrait, crisp facial features, studio lighting, highly detailed",
    "three_quarter": "3/4 Profile - Cinematic 3/4 angle headshot portrait, dramatic lighting, sharp focus",
    "profile": "Full Profile - Side profile headshot portrait, elegant silhouette, studio backdrop",
    "cinematic": "Cinematic / Mood - Atmospheric dramatic lighting portrait, rich contrast, cinematic movie still"
}

def get_stored_gemini_key() -> Optional[str]:
    """Retrieve Gemini API key from local config or environment."""
    gemini_file = ASSETS_DIR / "gemini_config.json"
    if gemini_file.exists():
        try:
            with open(gemini_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                key = data.get("api_key")
                if key and key.strip():
                    return key.strip()
        except Exception:
            pass
    env_key = os.environ.get("GEMINI_API_KEY")
    if env_key and env_key.strip():
        return env_key.strip()
    return None

async def generate_headshots(
    seed_image: Optional[str] = None,
    aspect_ratio: str = "1:1",
    character_name: str = "character",
    scene_name: str = "scene01",
    variation_keys: Optional[List[str]] = None,
    gemini_api_key: Optional[str] = None
) -> Dict[str, Any]:
    """Generate headshot variation preview candidates using Gemini API (gemini-3.1-flash-image with gemini-2.5-flash-image fallback)."""
    if not variation_keys:
        variation_keys = ["Facing", "3/4 Profile", "Full Profile", "Cinematic / Mood"]

    target_scene = scene_name or "scene01"
    print(f"[Headshot Generation] Generating headshots for {character_name} in scene '{target_scene}' with presets: {variation_keys}", flush=True)

    api_key = gemini_api_key or get_stored_gemini_key()
    if not api_key:
        err_msg = "Gemini API key is not configured"
        print(f"[Headshot Generation] Google API Error 400: {err_msg}", flush=True)
        raise HTTPException(status_code=400, detail=err_msg)

    seed_b64: Optional[str] = None
    mime_type: str = "image/png"

    if seed_image and seed_image.strip():
        raw_seed = seed_image.strip()
        if raw_seed.startswith("data:image/"):
            header_part, data_part = raw_seed.split(",", 1) if "," in raw_seed else ("", raw_seed)
            seed_b64 = data_part
            if "image/jpeg" in header_part or "image/jpg" in header_part:
                mime_type = "image/jpeg"
            elif "image/webp" in header_part:
                mime_type = "image/webp"
            else:
                mime_type = "image/png"
        else:
            file_path = find_asset_file_path(raw_seed)
            if file_path and file_path.exists():
                try:
                    raw_bytes = file_path.read_bytes()
                    seed_b64 = base64.b64encode(raw_bytes).decode("utf-8")
                    if file_path.suffix.lower() in [".jpg", ".jpeg"]:
                        mime_type = "image/jpeg"
                    elif file_path.suffix.lower() == ".webp":
                        mime_type = "image/webp"
                    else:
                        mime_type = "image/png"
                except Exception as e:
                    print(f"[Headshot Generation] Failed to read seed file {raw_seed}: {e}", flush=True)
            elif len(raw_seed) > 100:
                seed_b64 = raw_seed
                if seed_b64.startswith("/9j/"):
                    mime_type = "image/jpeg"

    if not seed_b64:
        err_msg = "Seed reference image is required for headshot generation"
        print(f"[Headshot Generation] Google API Error 400: {err_msg}", flush=True)
        raise HTTPException(status_code=400, detail=err_msg)

    candidates = []
    models_to_try = ["gemini-3.1-flash-image", "gemini-2.5-flash-image"]

    for idx, key in enumerate(variation_keys):
        prompt_text = HEADSHOT_TEMPLATES.get(key, key)
        cand_id = f"cand_{key}_{int(time.time() * 1000)}_{idx}"
        generated_b64: Optional[str] = None
        last_error_status: int = 400
        last_error_body: str = ""

        for model_name in models_to_try:
            endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
            parts: List[Dict[str, Any]] = [
                {
                    "inline_data": {
                        "mime_type": mime_type,
                        "data": seed_b64
                    }
                },
                {
                    "text": f"Generate a character portrait for \"{character_name}\". {prompt_text}"
                }
            ]

            payload = {
                "contents": [{"parts": parts}],
                "generationConfig": {
                    "imageConfig": {
                        "aspectRatio": aspect_ratio
                    }
                }
            }

            try:
                async with httpx.AsyncClient(timeout=45.0) as client:
                    res = await client.post(endpoint, json=payload)
                    last_error_status = res.status_code
                    last_error_body = res.text

                    if res.status_code == 200:
                        res_json = res.json()
                        candidates_data = res_json.get("candidates", [])
                        if candidates_data:
                            parts_resp = candidates_data[0].get("content", {}).get("parts", [])
                            for p in parts_resp:
                                if "inline_data" in p and "data" in p["inline_data"]:
                                    generated_b64 = p["inline_data"]["data"]
                                    break
                                elif "inlineData" in p and "data" in p["inlineData"]:
                                    generated_b64 = p["inlineData"]["data"]
                                    break
                        if generated_b64:
                            break
                    else:
                        print(f"[Headshot Generation] Model {model_name} failed (HTTP {res.status_code}): {res.text[:200]}", flush=True)
            except Exception as e:
                last_error_body = str(e)
                print(f"[Headshot Generation] Request exception for {model_name}: {e}", flush=True)

        if not generated_b64:
            print(f"[Headshot Generation] Google API Error {last_error_status}: {last_error_body}", flush=True)
            try:
                err_json = json.loads(last_error_body)
                error_msg = err_json.get("error", {}).get("message") or last_error_body
            except Exception:
                error_msg = last_error_body or "Google API returned no image candidates"
            raise HTTPException(
                status_code=last_error_status if last_error_status >= 400 else 400,
                detail=f"Google API Error ({last_error_status}): {error_msg}"
            )

        preview_data_uri = f"data:image/png;base64,{generated_b64}"

        candidates.append({
            "candidateId": cand_id,
            "variationKey": key,
            "key": key,
            "prompt": prompt_text,
            "aspectRatio": aspect_ratio,
            "base64": generated_b64,
            "previewUrl": preview_data_uri
        })

    return {
        "success": True,
        "candidates": candidates,
        "results": [{"key": c["variationKey"], "base64": c["base64"], "mimeType": "image/png"} for c in candidates],
        "characterName": character_name,
        "sceneName": target_scene
    }

async def save_selected_headshots(
    selections: List[Dict[str, Any]],
    character_name: str,
    scene_name: str = "scene01",
    tags: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    """Save user-approved headshot variations to scene image assets directory."""
    print(f"[Headshot Save] Saving {len(selections)} selected variations for {character_name} in scene '{scene_name}'", flush=True)

    saved_assets: List[Dict[str, Any]] = []

    for idx, item in enumerate(selections):
        raw_data = item.get("base64") or item.get("data") or item.get("previewUrl") or ""
        if not raw_data:
            continue

        if "," in raw_data:
            raw_data = raw_data.split(",", 1)[1]

        try:
            img_bytes = base64.b64decode(raw_data)
        except Exception as e:
            print(f"[Headshot Save] Base64 decode failed for selection {idx}: {e}", flush=True)
            continue

        var_key = item.get("variationKey") or item.get("label") or f"variation_{idx}"
        orig_name = f"{var_key}.png"
        target_filename = generate_target_filename("headshot", character_name, orig_name)

        saved_path = await save_uploaded_file(
            file_bytes=img_bytes,
            target_filename=target_filename,
            scene_name=scene_name,
            media_type="image"
        )

        generate_thumbnail(saved_path)

        asset_record = {
            "id": target_filename,
            "filename": target_filename,
            "original_name": orig_name,
            "media_type": "image",
            "type": "Headshot",
            "subject_name": character_name,
            "scene_name": scene_name,
            "size_bytes": len(img_bytes),
            "path": str(saved_path),
            "preview_url": f"/api/uploads/{target_filename}",
            "tags": tags or []
        }
        saved_assets.append(asset_record)

    return saved_assets
