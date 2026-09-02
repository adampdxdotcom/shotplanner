import os
import json
import httpx
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from backend.utils.file_handlers import ASSETS_DIR
from backend.services.civitai_service import get_stored_civitai_key, save_civitai_key
from backend.services.huggingface_service import get_stored_huggingface_token, save_huggingface_token

router = APIRouter(prefix="/settings", tags=["Application Settings"])

class CivitaiSettingsRequest(BaseModel):
    api_key: Optional[str] = None
    apiKey: Optional[str] = None

    class Config:
        extra = "allow"

class HuggingFaceSettingsRequest(BaseModel):
    token: Optional[str] = None
    huggingface_token: Optional[str] = None
    api_token: Optional[str] = None
    apiKey: Optional[str] = None

    class Config:
        extra = "allow"

class GeminiSettingsRequest(BaseModel):
    api_key: Optional[str] = None
    apiKey: Optional[str] = None

    class Config:
        extra = "allow"

class LMStudioTestRequest(BaseModel):
    url: Optional[str] = None
    lm_studio_url: Optional[str] = None
    endpoint: Optional[str] = None
    targetUrl: Optional[str] = None

    class Config:
        extra = "allow"

class GeminiTestRequest(BaseModel):
    api_key: Optional[str] = None
    apiKey: Optional[str] = None

    class Config:
        extra = "allow"

class ComfyUITestRequest(BaseModel):
    url: Optional[str] = None
    comfyui_url: Optional[str] = None
    comfyui_api_url: Optional[str] = None
    token: Optional[str] = None
    remote_api_token: Optional[str] = None

    class Config:
        extra = "allow"


@router.get("/civitai")
async def get_civitai_settings():
    """Read stored Civitai API key and return masked status."""
    key = get_stored_civitai_key()
    masked_key = f"{key[:4]}...{key[-4:]}" if len(key) > 8 else ("***" if key else None)
    return {
        "configured": bool(key),
        "api_key": f"{key[:5]}..." if key else None,
        "masked_key": masked_key
    }

@router.post("/civitai")
async def save_civitai_settings(req: CivitaiSettingsRequest):
    """Save Civitai API key to assets/civitai_config.json."""
    key = (req.api_key or req.apiKey or "").strip()
    try:
        save_civitai_key(key)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/huggingface")
async def get_huggingface_settings():
    """Read stored Hugging Face token and return masked status."""
    token = get_stored_huggingface_token()
    masked_token = f"{token[:4]}...{token[-4:]}" if len(token) > 8 else ("***" if token else None)
    return {
        "configured": bool(token),
        "token": f"{token[:5]}..." if token else None,
        "masked_token": masked_token
    }

@router.post("/huggingface")
async def save_huggingface_settings(req: HuggingFaceSettingsRequest):
    """Save Hugging Face token to assets/huggingface_config.json."""
    token = (req.token or req.huggingface_token or req.api_token or req.apiKey or "").strip()
    try:
        save_huggingface_token(token)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/gemini")
async def get_gemini_settings():
    """Retrieve current Gemini API configuration state."""
    gemini_file = ASSETS_DIR / "gemini_config.json"
    key = None
    if gemini_file.exists():
        try:
            with open(gemini_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                key = data.get("api_key")
        except Exception:
            pass
    if not key:
        key = os.environ.get("GEMINI_API_KEY")
    masked_key = f"{key[:4]}...{key[-4:]}" if key and len(key) > 8 else ("***" if key else None)
    return {
        "configured": bool(key),
        "api_key": f"{key[:5]}..." if key else None,
        "masked_key": masked_key
    }

@router.post("/gemini")
async def save_gemini_settings(req: GeminiSettingsRequest):
    """Save Gemini API key to local configuration."""
    key = (req.api_key or req.apiKey or "").strip()
    gemini_file = ASSETS_DIR / "gemini_config.json"
    try:
        ASSETS_DIR.mkdir(parents=True, exist_ok=True)
        with open(gemini_file, "w", encoding="utf-8") as f:
            json.dump({"api_key": key}, f, indent=2)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/test-lm-studio")
async def test_lm_studio(req: LMStudioTestRequest):
    """Test LM Studio endpoint reachability and list available models."""
    raw_url = req.url or req.lm_studio_url or req.endpoint or req.targetUrl or "http://localhost:1234/v1"
    url = raw_url.strip().rstrip("/")

    if not url.endswith("/models"):
        if url.endswith("/v1"):
            probe_url = f"{url}/models"
        else:
            probe_url = f"{url}/v1/models"
    else:
        probe_url = url

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(probe_url)
            if res.status_code == 200:
                data = res.json()
                models_data = data.get("data", []) if isinstance(data, dict) else []
                count = len(models_data)
                names_list = [m.get("id") or m.get("name") or str(m) for m in models_data if isinstance(m, dict)]
                model_names_str = ", ".join(names_list[:3]) if names_list else "None"
                return {
                    "success": True,
                    "message": f"LM Studio server responsive at {url}",
                    "modelsCount": count,
                    "models": names_list,
                    "modelNames": model_names_str,
                    "probeUrl": probe_url
                }
            else:
                err_msg = f"HTTP {res.status_code} - {res.text[:200]}"
                return JSONResponse(status_code=400, content={"success": False, "error": f"Failed to connect to LM Studio: {err_msg}"})
    except Exception as e:
        return JSONResponse(status_code=400, content={"success": False, "error": f"Failed to connect to {url}: {str(e)}"})

@router.post("/test-gemini")
async def test_gemini(req: GeminiTestRequest):
    """Test Gemini API key validity with a lightweight test query."""
    key_to_use = (req.api_key or req.apiKey or "").strip()

    if not key_to_use:
        gemini_file = ASSETS_DIR / "gemini_config.json"
        if gemini_file.exists():
            try:
                with open(gemini_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    key_to_use = (data.get("api_key") or "").strip()
            except Exception:
                pass
        if not key_to_use:
            key_to_use = (os.environ.get("GEMINI_API_KEY") or "").strip()

    if not key_to_use:
        return JSONResponse(status_code=400, content={"success": False, "error": "No Gemini API key is configured"})

    model_name = "gemini-3.7-flash"
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={key_to_use}"
    payload = {"contents": [{"parts": [{"text": "Ping test connection verification"}]}]}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(endpoint, json=payload)
            if res.status_code == 200:
                return {
                    "success": True,
                    "message": f"Gemini API key verified successfully using {model_name}",
                    "activeModel": model_name,
                    "modelUsed": model_name
                }
            else:
                err_data = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
                err_msg = err_data.get("error", {}).get("message") or f"HTTP {res.status_code}: {res.text[:200]}"
                return JSONResponse(status_code=400, content={"success": False, "error": err_msg})
    except Exception as e:
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})

@router.post("/test-comfyui")
async def test_comfyui(req: ComfyUITestRequest):
    """Test ComfyUI endpoint reachability and extract system/device stats."""
    raw_url = req.comfyui_url or req.url or req.comfyui_api_url or "http://127.0.0.1:8188"
    url = raw_url.strip().rstrip("/")
    token = (req.remote_api_token or req.token or "").strip()

    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    probe_url = f"{url}/system_stats"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            try:
                res = await client.get(probe_url, headers=headers)
            except Exception:
                probe_url = f"{url}/object_info"
                res = await client.get(probe_url, headers=headers)

            if res.status_code == 200:
                data = {}
                try:
                    data = res.json()
                except Exception:
                    pass

                system_info_parts = []
                if isinstance(data, dict):
                    sys_info = data.get("system", {})
                    if isinstance(sys_info, dict) and sys_info.get("os"):
                        system_info_parts.append(f"OS: {sys_info['os']}")

                    devices = data.get("devices", [])
                    if isinstance(devices, list) and len(devices) > 0:
                        first_dev = devices[0]
                        if isinstance(first_dev, dict):
                            dev_name = first_dev.get("name")
                            dev_str = f"GPU: {dev_name}" if dev_name else "GPU detected"
                            vram_total = first_dev.get("vram_total")
                            if vram_total and isinstance(vram_total, (int, float)):
                                vram_gb = f"{vram_total / (1024 * 1024 * 1024):.1f}GB VRAM"
                                dev_str += f" ({vram_gb})"
                            system_info_parts.append(dev_str)

                device_info = " | ".join(system_info_parts) if system_info_parts else f"{url} (Active)"
                return {
                    "success": True,
                    "message": f"ComfyUI server responsive at {url}",
                    "systemInfo": device_info,
                    "probeUrl": probe_url,
                    "system_stats": data
                }
            else:
                err_msg = f"Server responded with HTTP {res.status_code}"
                return JSONResponse(status_code=400, content={"success": False, "error": err_msg})
    except Exception as e:
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})
