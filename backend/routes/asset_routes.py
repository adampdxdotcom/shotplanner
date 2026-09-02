from typing import Optional, List, Union, Dict, Any
from fastapi import APIRouter, UploadFile, File, Form, Request, HTTPException
from pydantic import BaseModel, Field

from backend.services.asset_service import (
    save_single_asset,
    list_scene_and_shared_assets,
    get_asset_file_response,
    get_thumbnail_file_response,
    delete_asset_file,
    handle_chunk_upload,
    update_asset_metadata_service
)

router = APIRouter(tags=["Assets"])

class AssetUpdate(BaseModel):
    type: Optional[str] = None
    assetType: Optional[str] = None
    asset_type: Optional[str] = None
    subject_name: Optional[str] = None
    subjectName: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[Union[List[str], str]] = None
    scene_name: Optional[str] = None
    sceneName: Optional[str] = None
    original_filename: Optional[str] = None
    filename: Optional[str] = None

    class Config:
        extra = "allow"
        populate_by_name = True

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

@router.put("/assets/update")
@router.put("/assets/{filename}")
async def update_asset_metadata(
    request: Request,
    filename: Optional[str] = None
):
    """
    Update asset metadata with full persistence into companion registry and project files.
    Resiliently handles both JSON payloads and Multipart FormData (with optional file replacement).
    """
    content_type = request.headers.get("content-type", "").lower()
    replacement_bytes = None
    replacement_filename = None
    updates_dict: Dict[str, Any] = {}

    if "multipart/form-data" in content_type or "application/x-www-form-urlencoded" in content_type:
        form = await request.form()
        for k, v in form.items():
            if k == "file" and hasattr(v, "read"):
                replacement_bytes = await v.read()
                replacement_filename = getattr(v, "filename", None)
            else:
                updates_dict[k] = v
    elif "application/json" in content_type:
        try:
            updates_dict = await request.json()
        except Exception:
            updates_dict = {}
    else:
        # Fallback query / raw attempt
        try:
            updates_dict = await request.json()
        except Exception:
            pass

    target_name = (
        updates_dict.get("original_filename")
        or updates_dict.get("filename")
        or (filename if filename and filename != "update" else None)
        or "asset"
    )

    updated_record = update_asset_metadata_service(
        filename=target_name,
        updates=updates_dict,
        replacement_content=replacement_bytes,
        replacement_filename=replacement_filename
    )

    return {
        "success": True,
        "asset": updated_record
    }

@router.delete("/assets/{filename}")
async def delete_asset_endpoint(filename: str):
    """Delete asset and companion thumbnail."""
    delete_asset_file(filename)
    return {"success": True}
