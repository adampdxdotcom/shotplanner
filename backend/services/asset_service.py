import os
import shutil
import mimetypes
from pathlib import Path
from typing import Dict, Any, List, Optional
from fastapi import HTTPException
from fastapi.responses import FileResponse

from backend.utils.file_handlers import (
    generate_target_filename,
    save_uploaded_file,
    generate_thumbnail,
    find_asset_file_path,
    get_scene_directories,
    ASSETS_DIR,
    UPLOADS_DIR,
    TMP_UPLOAD_DIR
)

# Legacy directories for backward compatibility
LEGACY_IMAGES_DIR = ASSETS_DIR / "images"
LEGACY_VIDEOS_DIR = ASSETS_DIR / "videos"
LEGACY_AUDIOS_DIR = ASSETS_DIR / "audios"
LEGACY_UPLOADS_DIR = ASSETS_DIR / "uploads"

async def save_single_asset(
    content: bytes,
    original_name: str,
    media_type: str = "image",
    asset_type: str = "headshot",
    subject_name: str = "jackie",
    description: str = "",
    scene_name: str = "scene01"
) -> Dict[str, Any]:
    """Save a single uploaded asset file to scene media directory."""
    target_filename = generate_target_filename(asset_type, subject_name, original_name)
    saved_path = await save_uploaded_file(content, target_filename, scene_name=scene_name, media_type=media_type)

    return {
        "id": target_filename,
        "original_name": original_name,
        "filename": target_filename,
        "media_type": media_type,
        "type": asset_type,
        "subject_name": subject_name,
        "description": description,
        "size_bytes": len(content),
        "scene_name": scene_name,
        "path": str(saved_path),
        "preview_url": f"/api/uploads/{target_filename}"
    }

def list_scene_and_shared_assets(scene_name: Optional[str] = None) -> List[Dict[str, Any]]:
    """Scan and list assets for a scene and global shared folder."""
    assets = []
    seen = set()
    
    def process_file(f: Path, sn: Optional[str]):
        if not f.is_file(): return
        if f.name == ".DS_Store" or f.name == "empty.png" or f.name in seen: return
        seen.add(f.name)
        ext = f.suffix.lower()
        if ext in [".mp4", ".mov", ".webm", ".mkv", ".avi"]: media_type = "video"
        elif ext in [".mp3", ".wav", ".ogg", ".flac", ".m4a"]: media_type = "audio"
        else: media_type = "image"
        
        parts = f.stem.split('_')
        asset_type = "unknown"
        subject_name = "unknown"
        if len(parts) >= 3:
            asset_type = parts[0]
            subject_name = "_".join(parts[1:-1])
            
        assets.append({
            "filename": f.name,
            "media_type": media_type,
            "type": asset_type,
            "subject_name": subject_name,
            "scene_name": sn,
            "preview_url": f"/api/uploads/{f.name}"
        })

    dirs_to_scan = []
    if scene_name:
        scene_dirs = get_scene_directories(scene_name)
        dirs_to_scan.extend([scene_dirs["images"], scene_dirs["videos"], scene_dirs["audios"], scene_dirs["shared"]])
    
    global_shared = ASSETS_DIR / "shared"
    dirs_to_scan.append(global_shared)
    
    if not scene_name:
        dirs_to_scan.extend([LEGACY_IMAGES_DIR, LEGACY_VIDEOS_DIR, LEGACY_AUDIOS_DIR, LEGACY_UPLOADS_DIR])

    for d in dirs_to_scan:
        if d.exists() and d.is_dir():
            for f in d.iterdir():
                process_file(f, scene_name if d != global_shared else "shared")
                
    return assets

def get_asset_file_response(filename: str) -> FileResponse:
    """Serve asset file with appropriate MIME headers and caching."""
    file_path = find_asset_file_path(filename)
    if not file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    mime_type, _ = mimetypes.guess_type(str(file_path))
    if not mime_type:
        mime_type = "application/octet-stream"
        
    return FileResponse(path=file_path, media_type=mime_type, headers={"Cache-Control": "public, max-age=3600"})

def get_thumbnail_file_response(filename: str) -> FileResponse:
    """Serve cached lightweight thumbnail or generate on-demand."""
    file_path = find_asset_file_path(filename)
    if not file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail="Asset not found")
        
    ext = file_path.suffix.lower()
    if ext not in [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]:
        mime_type, _ = mimetypes.guess_type(str(file_path))
        return FileResponse(file_path, media_type=mime_type or "application/octet-stream", headers={"Cache-Control": "public, max-age=31536000"})
        
    thumb_dir = file_path.parent / "thumbnails"
    thumb_path = thumb_dir / filename
    
    if not thumb_path.exists():
        new_thumb = generate_thumbnail(file_path)
        if new_thumb and new_thumb.exists():
            thumb_path = new_thumb
        else:
            thumb_path = file_path
            
    mime_type, _ = mimetypes.guess_type(str(thumb_path))
    if not mime_type:
        mime_type = "image/png" if ext == ".png" else ("image/jpeg" if ext in [".jpg", ".jpeg"] else "application/octet-stream")
        
    return FileResponse(thumb_path, media_type=mime_type, headers={"Cache-Control": "public, max-age=31536000"})

def delete_asset_file(filename: str) -> bool:
    """Delete asset and its companion thumbnail file."""
    file_path = find_asset_file_path(filename)
    if not file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail="Asset not found")
    try:
        thumb_path = file_path.parent / "thumbnails" / file_path.name
        if thumb_path.exists():
            try:
                thumb_path.unlink()
            except Exception:
                pass
        file_path.unlink()
        return True
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def handle_chunk_upload(
    chunk_bytes: bytes,
    upload_id: str,
    chunk_index: int,
    total_chunks: int,
    original_name: str,
    media_type: str = "image",
    asset_type: str = "headshot",
    subject_name: str = "subject",
    description: str = "",
    scene_name: str = "scene01"
) -> Dict[str, Any]:
    """Append chunk and finalize assembled file on the last chunk."""
    temp_assembly_path = TMP_UPLOAD_DIR / upload_id
    
    with open(temp_assembly_path, "ab") as f:
        f.write(chunk_bytes)
        
    if chunk_index == total_chunks - 1:
        target_filename = generate_target_filename(asset_type, subject_name, original_name)
        scene_dirs = get_scene_directories(scene_name)
        
        subfolder_key = f"{media_type}s"
        target_dir = scene_dirs.get(subfolder_key, scene_dirs.get("images"))
        target_dir.mkdir(parents=True, exist_ok=True)
        destination_path = target_dir / target_filename
        
        shutil.copyfile(temp_assembly_path, destination_path)
        size_bytes = os.path.getsize(temp_assembly_path)
        os.remove(temp_assembly_path)
        
        if media_type == "image":
            generate_thumbnail(destination_path)
        
        if not destination_path.exists():
            raise HTTPException(status_code=500, detail="Assembled file missing after write.")
        
        return {
            "success": True,
            "asset": {
                "id": target_filename,
                "original_name": original_name,
                "filename": target_filename,
                "media_type": media_type,
                "type": asset_type,
                "subject_name": subject_name,
                "description": description,
                "size_bytes": size_bytes,
                "scene_name": scene_name,
                "path": str(destination_path),
                "preview_url": f"/api/uploads/{target_filename}"
            }
        }
        
    return {"success": True, "message": "chunk received"}
