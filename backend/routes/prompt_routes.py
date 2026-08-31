import os
import json
from typing import Dict, Any, List, Optional, Union
from fastapi import APIRouter, HTTPException
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
