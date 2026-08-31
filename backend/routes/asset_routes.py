from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form
from pydantic import BaseModel

from backend.services.asset_service import (
    save_single_asset,
    list_scene_and_shared_assets,
    get_asset_file_response,
    get_thumbnail_file_response,
    delete_asset_file,
    handle_chunk_upload
)

router = APIRouter(tags=["Assets"])

class AssetUpdate(BaseModel):
    type: Optional[str] = None
    subject_name: Optional[str] = None
    description: Optional[str] = None

@router.get("/assets")
async def get_assets(scene_name: Optional[str] = None):
    """List assets dynamically from the requested scene directory and global shared."""
    assets = list_scene_and_shared_assets(scene_name)
    return {"assets": assets}

@router.post("/assets/upload")
async def upload_asset(
    file: UploadFile = File(...),
    media_type: str = Form("image"),
    asset_type: str = Form("headshot"),
    subject_name: str = Form("jackie"),
    description: str = Form(""),
    scene_name: str = Form("scene01")
):
    """Upload and save media file into scene-specific directory."""
    content = await file.read()
    asset_record = await save_single_asset(
        content=content,
        original_name=file.filename or "media",
        media_type=media_type,
        asset_type=asset_type,
        subject_name=subject_name,
        description=description,
        scene_name=scene_name
    )
    return {"success": True, "asset": asset_record}

@router.post("/assets/upload_chunk")
async def upload_chunk(
    file: UploadFile = File(...),
    upload_id: str = Form(...),
    chunk_index: int = Form(...),
    total_chunks: int = Form(...),
    original_name: str = Form(...),
    media_type: str = Form("image"),
    type: str = Form("headshot"),
    subject_name: str = Form("subject"),
    description: str = Form(""),
    scene_name: str = Form("scene01")
):
    """Receive file chunk and assemble on final chunk."""
    content = await file.read()
    return await handle_chunk_upload(
        chunk_bytes=content,
        upload_id=upload_id,
        chunk_index=chunk_index,
        total_chunks=total_chunks,
        original_name=original_name,
        media_type=media_type,
        asset_type=type,
        subject_name=subject_name,
        description=description,
        scene_name=scene_name
    )

@router.get("/uploads/{filename}")
async def serve_upload_file(filename: str):
    """Serve uploaded asset file with caching."""
    return get_asset_file_response(filename)

@router.get("/uploads/thumb/{filename}")
@router.get("/assets/thumb/{filename}")
async def serve_thumbnail(filename: str):
    """Serve cached lightweight thumbnail or generate on demand."""
    return get_thumbnail_file_response(filename)

@router.put("/assets/{filename}")
async def update_asset_metadata(filename: str, updates: AssetUpdate):
    """Update asset metadata representation."""
    return {
        "success": True,
        "asset": {
            "id": filename,
            "filename": filename,
            "original_name": filename,
            "media_type": "image",
            "type": updates.type or "unknown",
            "subject_name": updates.subject_name or "subject",
            "description": updates.description or "",
            "size_bytes": 0,
            "preview_url": f"/api/uploads/{filename}",
            "path": ""
        }
    }

@router.delete("/assets/{filename}")
async def delete_asset_endpoint(filename: str):
    """Delete asset and companion thumbnail."""
    delete_asset_file(filename)
    return {"success": True}
