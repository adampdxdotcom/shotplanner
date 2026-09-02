import os
import json
import httpx
from typing import Dict, Any, List, Optional, Union
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from backend.utils.file_handlers import ASSETS_DIR
from backend.services.llm_service import expand_prompt_with_llm

router = APIRouter(tags=["Prompt Expansion & LLM"])

class LLMGenerateRequest(BaseModel):
    basic_stub: str
    assets: List[Dict[str, Any]] = Field(default_factory=list)
    lm_studio_url: str = "http://localhost:1234/v1"
    model: Optional[str] = None
    provider: Optional[str] = None
    prompt_prefix: Optional[str] = None
    scene_planning: Optional[Dict[str, Any]] = None
    planning: Optional[Dict[str, Any]] = None
    gemini_api_key: Optional[str] = None
    active_shot: Optional[Dict[str, Any]] = None
    shot_type: Optional[str] = None
    camera_movement: Optional[str] = None
    lens_focal_length: Optional[str] = None
    aspect_ratio: Optional[str] = None
    ots_anchor_subject: Optional[str] = None
    ots_focus_subject: Optional[str] = None
    ots_side: Optional[str] = None
    shot_number: Optional[Union[str, int]] = None
    scene_name: Optional[str] = None
    framing_directive: Optional[str] = None
    characters: Optional[Dict[str, Any]] = None

    class Config:
        extra = "allow"

class GeminiSettingsRequest(BaseModel):
    api_key: Optional[str] = None

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

@router.post("/generate-prompt")
@router.post("/llm/expand")
async def generate_prompt_endpoint(req: LLMGenerateRequest):
    """
    Call LM Studio / Gemini to expand basic prompt stub with structured multimodal metadata.
    """
    if not req.basic_stub.strip():
        raise HTTPException(status_code=400, detail="Basic prompt stub is required.")
    
    expanded = await expand_prompt_with_llm(
        basic_stub=req.basic_stub,
        assets=req.assets,
        lm_studio_url=req.lm_studio_url,
        model=req.model,
        provider=req.provider,
        prompt_prefix=req.prompt_prefix,
        gemini_api_key=req.gemini_api_key,
        active_shot=req.active_shot,
        shot_type=req.shot_type,
        camera_movement=req.camera_movement,
        lens_focal_length=req.lens_focal_length,
        aspect_ratio=req.aspect_ratio,
        ots_anchor_subject=req.ots_anchor_subject,
        ots_focus_subject=req.ots_focus_subject,
        ots_side=req.ots_side,
        shot_number=req.shot_number,
        scene_name=req.scene_name,
        framing_directive=req.framing_directive,
        characters=req.characters
    )
    return {"expanded_prompt": expanded, "provider": req.provider or "lm_studio"}

@router.get("/settings/gemini")
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
    return {
        "configured": bool(key),
        "api_key": f"{key[:5]}..." if key else None
    }

@router.post("/settings/gemini")
async def save_gemini_settings(req: GeminiSettingsRequest):
    """Save Gemini API key to local configuration."""
    gemini_file = ASSETS_DIR / "gemini_config.json"
    try:
        with open(gemini_file, "w", encoding="utf-8") as f:
            json.dump({"api_key": req.api_key or ""}, f, indent=2)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/settings/test-lm-studio")
async def test_lm_studio(req: LMStudioTestRequest):
    """Test LM Studio endpoint reachability and list available models."""
    raw_url = req.url or req.lm_studio_url or req.endpoint or req.targetUrl or "http://localhost:1234/v1"
    url = raw_url.strip().rstrip("/")
    print(f"[LM Studio Test] Testing reachability for URL: {url}", flush=True)

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
            status_code = res.status_code
            if status_code == 200:
                data = res.json()
                models_data = data.get("data", []) if isinstance(data, dict) else []
                count = len(models_data)
                names_list = [m.get("id") or m.get("name") or str(m) for m in models_data if isinstance(m, dict)]
                model_names_str = ", ".join(names_list[:3]) if names_list else "None"
                print(f"[LM Studio Test] Success (HTTP {status_code}) - Found {count} models: {model_names_str}", flush=True)
                return {
                    "success": True,
                    "modelsCount": count,
                    "models": names_list,
                    "modelNames": model_names_str,
                    "probeUrl": probe_url
                }
            else:
                err_msg = f"HTTP {status_code} - {res.text[:200]}"
                print(f"[LM Studio Test] Failed to connect to {url}: {err_msg}", flush=True)
                return JSONResponse(status_code=400, content={"success": False, "error": f"Failed to connect to LM Studio: {err_msg}"})
    except Exception as e:
        err_msg = str(e)
        print(f"[LM Studio Test] Failed to connect to {url}: {err_msg}", flush=True)
        return JSONResponse(status_code=400, content={"success": False, "error": f"Failed to connect to {url}: {err_msg}"})

@router.post("/settings/test-gemini")
async def test_gemini(req: GeminiTestRequest):
    """Test Gemini API key validity with a lightweight test query."""
    print("[Gemini Test] Validating API key...", flush=True)
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
        err_text = "No Gemini API key is configured"
        print(f"[Gemini Test] Validation failed: {err_text}", flush=True)
        return JSONResponse(status_code=400, content={
            "success": False,
            "error": err_text
        })

    model_name = "gemini-3.7-flash"
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={key_to_use}"
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": "Ping test connection verification"}
                ]
            }
        ]
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(endpoint, json=payload)
            if res.status_code == 200:
                print(f"[Gemini Test] Verified successfully with model {model_name}", flush=True)
                return {
                    "success": True,
                    "activeModel": model_name,
                    "modelUsed": model_name
                }
            else:
                err_data = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
                err_msg = err_data.get("error", {}).get("message") or f"HTTP {res.status_code}: {res.text[:200]}"
                print(f"[Gemini Test] Validation failed: {err_msg}", flush=True)
                return JSONResponse(status_code=400, content={
                    "success": False,
                    "error": err_msg
                })
    except Exception as e:
        err_msg = str(e)
        print(f"[Gemini Test] Validation failed: {err_msg}", flush=True)
        return JSONResponse(status_code=400, content={
            "success": False,
            "error": err_msg
        })

@router.post("/settings/test-comfyui")
async def test_comfyui(req: ComfyUITestRequest):
    """Test ComfyUI endpoint reachability and extract system/device stats."""
    raw_url = req.comfyui_url or req.url or req.comfyui_api_url or "http://127.0.0.1:8188"
    url = raw_url.strip().rstrip("/")
    token = (req.remote_api_token or req.token or "").strip()

    print(f"[ComfyUI Test] Testing reachability for URL: {url}", flush=True)

    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    probe_url = f"{url}/system_stats"

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            try:
                res = await client.get(probe_url, headers=headers)
            except Exception as probe_err:
                # If /system_stats failed, try /object_info as fallback probe
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
                print(f"[ComfyUI Test] Success (HTTP 200) - Connected to: {device_info}", flush=True)

                return {
                    "success": True,
                    "message": f"ComfyUI server responsive at {url}",
                    "systemInfo": device_info,
                    "probeUrl": probe_url,
                    "system_stats": data
                }
            else:
                err_msg = f"Server responded with HTTP {res.status_code}"
                if res.reason_phrase:
                    err_msg += f" {res.reason_phrase}"
                print(f"[ComfyUI Test] Failed to connect to {url}: {err_msg}", flush=True)
                return JSONResponse(
                    status_code=400,
                    content={"success": False, "error": err_msg}
                )
    except httpx.TimeoutException:
        err_msg = "Connection timed out (5s limit reached)"
        print(f"[ComfyUI Test] Failed to connect to {url}: {err_msg}", flush=True)
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": err_msg}
        )
    except Exception as e:
        err_msg = str(e) or "Connection refused or endpoint unreachable"
        print(f"[ComfyUI Test] Failed to connect to {url}: {err_msg}", flush=True)
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": err_msg}
        )


