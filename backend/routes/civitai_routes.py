from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel

from backend.services.civitai_service import (
    fetch_civitai_model_info,
    get_civitai_favorites,
    save_civitai_favorite,
    delete_civitai_favorite
)
from backend.services.model_hub_service import execute_unified_remote_download

router = APIRouter(prefix="/civitai", tags=["Civitai Integration"])

class CivitaiDownloadRequest(BaseModel):
    download_url: str
    destination_folder: str
    filename: str
    civitai_token: Optional[str] = None
    remote_host: str
    ssh_port: Optional[int] = 22
    ssh_username: Optional[str] = "root"
    ssh_password: Optional[str] = None
    ssh_private_key: Optional[str] = None
    ssh_key_path: Optional[str] = None
    remote_comfyui_root: Optional[str] = "/workspace/runpod-slim/ComfyUI"

    class Config:
        extra = "allow"

@router.get("/favorites")
async def list_civitai_favorites():
    """Return all saved Civitai favorites from persistent storage."""
    try:
        favorites = get_civitai_favorites()
        return {
            "success": True,
            "favorites": favorites,
            "count": len(favorites)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load favorites: {str(e)}")

@router.post("/favorites")
async def add_or_update_civitai_favorite(payload: Dict[str, Any] = Body(...)):
    """Add or update a model record in persistent favorites."""
    try:
        saved = save_civitai_favorite(payload)
        return {
            "success": True,
            "favorite": saved,
            "message": f"Successfully favorited '{saved.get('name')}'"
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save favorite: {str(e)}")

@router.delete("/favorites/{version_id}")
async def remove_civitai_favorite(version_id: str):
    """Remove a model from favorites by version ID."""
    try:
        removed = delete_civitai_favorite(version_id)
        return {
            "success": True,
            "removed": removed,
            "version_id": version_id,
            "message": f"Removed favorite {version_id}" if removed else f"Favorite {version_id} not found"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete favorite: {str(e)}")

@router.get("/model-info")
async def get_civitai_model_info(
    query: Optional[str] = Query(None),
    url: Optional[str] = Query(None),
    modelId: Optional[str] = Query(None),
    versionId: Optional[str] = Query(None),
    model_id: Optional[str] = Query(None),
    version_id: Optional[str] = Query(None),
    token: Optional[str] = Query(None)
):
    """Look up model metadata and auto-route destination folder from Civitai API."""
    search_query = (query or url or modelId or versionId or model_id or version_id or "").strip()
    if not search_query:
        raise HTTPException(
            status_code=400,
            detail="Missing required query parameter (Civitai Model ID, Version ID, or Web URL)."
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
async def download_civitai_model_remote(req: CivitaiDownloadRequest):
    """Download model directly to remote GPU ComfyUI instance via SSH."""
    if not req.download_url:
        raise HTTPException(status_code=400, detail="Parameter 'download_url' is required.")
    if not req.destination_folder:
        raise HTTPException(status_code=400, detail="Parameter 'destination_folder' is required.")
    if not req.filename:
        raise HTTPException(status_code=400, detail="Parameter 'filename' is required.")
    if not req.remote_host:
        raise HTTPException(status_code=400, detail="Remote Host IP / Address is required for SSH download.")

    result = await execute_unified_remote_download({
        "download_url": req.download_url,
        "destination_folder": req.destination_folder,
        "filename": req.filename,
        "auth_type": "civitai",
        "api_token": req.civitai_token,
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
