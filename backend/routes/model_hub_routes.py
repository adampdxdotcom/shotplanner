from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from backend.services.civitai_service import fetch_civitai_model_info
from backend.services.huggingface_service import fetch_huggingface_model_info
from backend.services.model_hub_service import (
    COMFYUI_MODEL_CATEGORIES,
    execute_unified_remote_download
)

router = APIRouter(prefix="/model-hub", tags=["Model Ingestion Hub"])

class UnifiedDownloadRequest(BaseModel):
    download_url: str
    destination_folder: str
    filename: str
    auth_type: Optional[str] = None
    api_token: Optional[str] = None
    civitai_token: Optional[str] = None
    hf_token: Optional[str] = None
    remote_host: str
    ssh_port: Optional[int] = 22
    ssh_username: Optional[str] = "root"
    ssh_password: Optional[str] = None
    ssh_private_key: Optional[str] = None
    ssh_key_path: Optional[str] = None
    remote_comfyui_root: Optional[str] = "/workspace/runpod-slim/ComfyUI"

    class Config:
        extra = "allow"

@router.get("/categories")
async def get_model_categories():
    """Returns standard ComfyUI model category presets."""
    return {
        "success": True,
        "categories": COMFYUI_MODEL_CATEGORIES
    }

@router.get("/hf-info")
async def get_huggingface_info(
    url: Optional[str] = Query(None),
    query: Optional[str] = Query(None),
    model: Optional[str] = Query(None),
    token: Optional[str] = Query(None)
):
    """Look up Hugging Face repository/file or direct model URL."""
    search_query = (url or query or model or "").strip()
    if not search_query:
        raise HTTPException(
            status_code=400,
            detail="Missing required parameter 'url' or 'query' (Hugging Face URL, repo ID, or direct model link)."
        )

    try:
        metadata = await fetch_huggingface_model_info(search_query, token_override=token)
        return {
            "success": True,
            "data": metadata,
            **metadata
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/civitai-info")
async def get_civitai_info(
    query: Optional[str] = Query(None),
    url: Optional[str] = Query(None),
    modelId: Optional[str] = Query(None),
    versionId: Optional[str] = Query(None),
    token: Optional[str] = Query(None)
):
    """Look up Civitai model metadata."""
    search_query = (query or url or modelId or versionId or "").strip()
    if not search_query:
        raise HTTPException(
            status_code=400,
            detail="Missing required parameter 'query' or 'url' (Civitai Model ID, Version ID, or URL)."
        )

    try:
        metadata = await fetch_civitai_model_info(search_query, token_override=token)
        return {
            "success": True,
            "data": metadata,
            **metadata
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/download-remote")
async def download_remote_model(req: UnifiedDownloadRequest):
    """Download any model directly to remote GPU ComfyUI instance via SSH."""
    if not req.download_url:
        raise HTTPException(status_code=400, detail="Parameter 'download_url' is required.")
    if not req.destination_folder:
        raise HTTPException(status_code=400, detail="Parameter 'destination_folder' is required.")
    if not req.filename:
        raise HTTPException(status_code=400, detail="Parameter 'filename' is required.")
    if not req.remote_host:
        raise HTTPException(status_code=400, detail="Remote Host IP / Address is required for SSH download.")

    token = req.api_token or req.civitai_token or req.hf_token

    result = await execute_unified_remote_download({
        "download_url": req.download_url,
        "destination_folder": req.destination_folder,
        "filename": req.filename,
        "auth_type": req.auth_type,
        "api_token": token,
        "remote_host": req.remote_host,
        "ssh_port": req.ssh_port or 22,
        "ssh_username": req.ssh_username or "root",
        "ssh_password": req.ssh_password,
        "ssh_private_key": req.ssh_private_key,
        "ssh_key_path": req.ssh_key_path,
        "remote_comfyui_root": req.remote_comfyui_root or "/workspace/runpod-slim/ComfyUI"
    })

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message") or "Download failed")
    return result
