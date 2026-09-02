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
    """Generate headshot variation preview candidates using Gemini API or fallback rendering."""
    if not variation_keys:
        variation_keys = ["facing", "three_quarter", "profile", "cinematic"]

    print(f"[Headshot Generation] Generating headshots for {character_name} in scene '{scene_name}' with presets: {variation_keys}", flush=True)

    api_key = gemini_api_key or get_stored_gemini_key()
    seed_b64: Optional[str] = None

    if seed_image and seed_image.strip():
        if seed_image.startswith("data:image/"):
            parts = seed_image.split(",", 1)
            seed_b64 = parts[1] if len(parts) > 1 else parts[0]
        else:
            file_path = find_asset_file_path(seed_image.strip())
            if file_path and file_path.exists():
                try:
                    raw_bytes = file_path.read_bytes()
                    seed_b64 = base64.b64encode(raw_bytes).decode("utf-8")
                except Exception as e:
                    print(f"[Headshot Generation] Failed to read seed file {seed_image}: {e}", flush=True)

    candidates = []

    for idx, key in enumerate(variation_keys):
        prompt_text = HEADSHOT_TEMPLATES.get(key, key)
        cand_id = f"cand_{key}_{int(time.time() * 1000)}_{idx}"
        generated_b64: Optional[str] = None

        if api_key:
            try:
                endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
                parts: List[Dict[str, Any]] = []

                if seed_b64:
                    parts.append({
                        "inline_data": {
                            "mime_type": "image/png",
                            "data": seed_b64
                        }
                    })

                parts.append({
                    "text": f"Generate a high-quality character headshot variation for '{character_name}'. Directive: {prompt_text}. Aspect ratio: {aspect_ratio}."
                })

                payload = {
                    "contents": [{"parts": parts}],
                    "generationConfig": {"temperature": 0.7, "maxOutputTokens": 1024}
                }

                async with httpx.AsyncClient(timeout=30.0) as client:
                    res = await client.post(endpoint, json=payload)
                    if res.status_code == 200:
                        res_json = res.json()
                        candidates_data = res_json.get("candidates", [])
                        if candidates_data:
                            parts_resp = candidates_data[0].get("content", {}).get("parts", [])
                            for p in parts_resp:
                                if "inline_data" in p and "data" in p["inline_data"]:
                                    generated_b64 = p["inline_data"]["data"]
                                    break
            except Exception as e:
                print(f"[Headshot Generation] Gemini API request failed for preset {key}: {e}", flush=True)

        if not generated_b64 and seed_b64:
            generated_b64 = seed_b64

        if not generated_b64:
            # Fallback 1x1 placeholder PNG image
            generated_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

        preview_data_uri = f"data:image/png;base64,{generated_b64}"

        candidates.append({
            "candidateId": cand_id,
            "variationKey": key,
            "prompt": prompt_text,
            "aspectRatio": aspect_ratio,
            "base64": preview_data_uri,
            "previewUrl": preview_data_uri
        })

    return {
        "success": True,
        "candidates": candidates,
        "characterName": character_name,
        "sceneName": scene_name
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
