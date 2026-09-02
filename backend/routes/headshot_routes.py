import json
from typing import Dict, Any, List, Optional, Union
from fastapi import APIRouter, HTTPException, Request, Form, File, UploadFile
from pydantic import BaseModel, Field

from backend.services.headshot_service import generate_headshots, save_selected_headshots

router = APIRouter(prefix="/headshots", tags=["AI Headshots"])

class HeadshotGenerateRequest(BaseModel):
    seed_image: Optional[str] = None
    seedImage: Optional[str] = None
    aspect_ratio: Optional[str] = "1:1"
    aspectRatio: Optional[str] = None
    character_name: Optional[str] = None
    characterName: Optional[str] = None
    scene_name: Optional[str] = "scene01"
    sceneName: Optional[str] = None
    activeSceneName: Optional[str] = None
    variation_keys: Optional[Union[List[str], str]] = None
    variationKeys: Optional[Union[List[str], str]] = None
    gemini_api_key: Optional[str] = None

    class Config:
        extra = "allow"

class HeadshotSaveRequest(BaseModel):
    selections: List[Dict[str, Any]]
    character_name: Optional[str] = None
    characterName: Optional[str] = None
    scene_name: Optional[str] = None
    sceneName: Optional[str] = None
    activeSceneName: Optional[str] = None
    tags: Optional[List[str]] = None

    class Config:
        extra = "allow"

@router.post("/generate")
async def generate_headshots_endpoint(
    request: Request,
    characterName: Optional[str] = Form(None),
    character_name: Optional[str] = Form(None),
    sceneName: Optional[str] = Form(None),
    scene_name: Optional[str] = Form(None),
    activeSceneName: Optional[str] = Form(None),
    aspectRatio: Optional[str] = Form(None),
    aspect_ratio: Optional[str] = Form(None),
    variationKeys: Optional[str] = Form(None),
    variation_keys: Optional[str] = Form(None),
    seed_file: Optional[UploadFile] = File(None)
):
    """Generate AI character headshot variations for review."""
    content_type = request.headers.get("content-type", "")

    # Handle JSON request body
    if "application/json" in content_type:
        body = await request.json()
        req = HeadshotGenerateRequest(**body)

        char_name = req.characterName or req.character_name
        target_scene = req.sceneName or req.activeSceneName or req.scene_name or "scene01"
        ar = req.aspectRatio or req.aspect_ratio or "1:1"
        seed_img = req.seedImage or req.seed_image

        keys_raw = req.variationKeys or req.variation_keys
        keys_list: List[str] = []
        if isinstance(keys_raw, list):
            keys_list = keys_raw
        elif isinstance(keys_raw, str):
            try:
                keys_list = json.loads(keys_raw)
            except Exception:
                keys_list = [k.strip() for k in keys_raw.split(",") if k.strip()]

        if not char_name:
            raise HTTPException(status_code=400, detail="characterName is required")

        result = await generate_headshots(
            seed_image=seed_img,
            aspect_ratio=ar,
            character_name=char_name,
            scene_name=target_scene,
            variation_keys=keys_list or ["facing", "three_quarter", "profile", "cinematic"],
            gemini_api_key=req.gemini_api_key
        )
        return result

    # Handle multipart / form data request
    char_name = characterName or character_name
    if not char_name:
        raise HTTPException(status_code=400, detail="characterName is required")

    target_scene = sceneName or activeSceneName or scene_name or "scene01"
    ar = aspectRatio or aspect_ratio or "1:1"

    raw_keys = variationKeys or variation_keys
    keys_list: List[str] = []
    if raw_keys:
        try:
            keys_list = json.loads(raw_keys)
        except Exception:
            keys_list = [k.strip() for k in raw_keys.split(",") if k.strip()]

    seed_img_payload: Optional[str] = None
    if seed_file:
        file_bytes = await seed_file.read()
        import base64
        seed_img_payload = base64.b64encode(file_bytes).decode("utf-8")

    result = await generate_headshots(
        seed_image=seed_img_payload,
        aspect_ratio=ar,
        character_name=char_name,
        scene_name=target_scene,
        variation_keys=keys_list or ["facing", "three_quarter", "profile", "cinematic"]
    )
    return result

@router.post("/save-selected")
async def save_selected_headshots_endpoint(req: HeadshotSaveRequest):
    """Save approved headshot candidates into scene asset library."""
    char_name = req.characterName or req.character_name
    target_scene = req.sceneName or req.activeSceneName or req.scene_name or "scene01"

    if not req.selections or len(req.selections) == 0:
        raise HTTPException(status_code=400, detail="selections array is required")
    if not char_name:
        raise HTTPException(status_code=400, detail="characterName is required")

    saved_assets = await save_selected_headshots(
        selections=req.selections,
        character_name=char_name,
        scene_name=target_scene,
        tags=req.tags
    )
    return {"success": True, "savedAssets": saved_assets}
