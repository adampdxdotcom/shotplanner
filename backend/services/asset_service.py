import os
import json
import time
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
    ensure_scene_directories,
    parse_asset_filename,
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
    """Scan and list assets for a scene and global shared folder, augmented by assets_db.json registry."""
    assets = []
    seen = set()
    
    # Load registered metadata from assets_db.json if present
    db_meta = {}
    db_file = ASSETS_DIR / "assets_db.json"
    if db_file.exists():
        try:
            with open(db_file, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                if isinstance(loaded, list):
                    for item in loaded:
                        if isinstance(item, dict) and item.get("filename"):
                            db_meta[item["filename"]] = item
                elif isinstance(loaded, dict):
                    for k, item in loaded.items():
                        if isinstance(item, dict):
                            db_meta[k] = item
        except Exception:
            pass

    def process_file(f: Path, sn: Optional[str]):
        if not f.is_file(): return
        if f.name == ".DS_Store" or f.name == "empty.png" or f.name in seen: return
        seen.add(f.name)
        
        # Check if we have authoritative metadata stored in assets_db.json
        if f.name in db_meta:
            rec = db_meta[f.name]
            assets.append({
                "id": f.name,
                "filename": f.name,
                "original_name": rec.get("original_name", f.name),
                "media_type": rec.get("media_type", "image"),
                "type": rec.get("type", "unknown"),
                "subject_name": rec.get("subject_name", "subject"),
                "description": rec.get("description", ""),
                "tags": rec.get("tags", []),
                "size_bytes": rec.get("size_bytes", f.stat().st_size if f.exists() else 0),
                "scene_name": sn or rec.get("scene_name", "scene01"),
                "preview_url": f"/api/uploads/{f.name}",
                "path": str(f)
            })
            return

        # Fallback to robust filename parser
        parsed = parse_asset_filename(f.name)
        assets.append({
            "id": f.name,
            "filename": f.name,
            "original_name": f.name,
            "media_type": parsed["media_type"],
            "type": parsed["type"],
            "subject_name": parsed["subject_name"],
            "description": "",
            "tags": [],
            "size_bytes": f.stat().st_size if f.exists() else 0,
            "scene_name": sn,
            "preview_url": f"/api/uploads/{f.name}",
            "path": str(f)
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

def update_asset_metadata_service(
    filename: str,
    updates: Dict[str, Any],
    replacement_content: Optional[bytes] = None,
    replacement_filename: Optional[str] = None
) -> Dict[str, Any]:
    """
    Persists updated asset metadata (type, subject_name, description, tags)
    into the companion assets_db.json registry and across active scene project files.
    """
    target_filename = updates.get("original_filename") or updates.get("filename") or filename
    if not target_filename or target_filename == "update":
        target_filename = filename

    # Extract update fields with alias fallbacks
    updated_type = updates.get("type") or updates.get("assetType") or updates.get("asset_type") or "unknown"
    updated_subject = updates.get("subject_name") or updates.get("subjectName") or "subject"
    updated_desc = updates.get("description") or ""
    
    raw_tags = updates.get("tags")
    if isinstance(raw_tags, str):
        try:
            updated_tags = json.loads(raw_tags)
        except Exception:
            updated_tags = [t.strip() for t in raw_tags.split(",") if t.strip()]
    elif isinstance(raw_tags, list):
        updated_tags = raw_tags
    else:
        updated_tags = []

    scene_name = updates.get("scene_name") or updates.get("sceneName")

    # 1. Locate physical file or handle replacement
    file_path = find_asset_file_path(target_filename)
    if replacement_content and len(replacement_content) > 0:
        if file_path and file_path.exists():
            with open(file_path, "wb") as f:
                f.write(replacement_content)
            if file_path.suffix.lower() in [".png", ".jpg", ".jpeg", ".webp"]:
                generate_thumbnail(file_path)
        else:
            if scene_name:
                dirs = ensure_scene_directories(scene_name)
                dest = dirs["images"] / target_filename
            else:
                dest = ASSETS_DIR / "uploads" / target_filename
            dest.parent.mkdir(parents=True, exist_ok=True)
            with open(dest, "wb") as f:
                f.write(replacement_content)
            file_path = dest
            if file_path.suffix.lower() in [".png", ".jpg", ".jpeg", ".webp"]:
                generate_thumbnail(file_path)

    # 2. Determine file stats & media type
    parsed = parse_asset_filename(target_filename)
    media_type = parsed["media_type"]
    size_bytes = file_path.stat().st_size if file_path and file_path.exists() else 0

    # 3. Persist to companion registry assets_db.json
    db_file = ASSETS_DIR / "assets_db.json"
    db_records = []
    if db_file.exists():
        try:
            with open(db_file, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                if isinstance(loaded, list):
                    db_records = loaded
                elif isinstance(loaded, dict):
                    db_records = list(loaded.values())
        except Exception:
            db_records = []

    found_in_db = False
    for r in db_records:
        if isinstance(r, dict) and (r.get("filename") == target_filename or r.get("id") == target_filename):
            r["type"] = updated_type
            r["subject_name"] = updated_subject
            r["description"] = updated_desc
            r["tags"] = updated_tags
            r["media_type"] = media_type
            r["size_bytes"] = size_bytes
            r["preview_url"] = f"/api/uploads/{target_filename}"
            if scene_name:
                r["scene_name"] = scene_name
            found_in_db = True
            break

    if not found_in_db:
        db_records.append({
            "id": target_filename,
            "filename": target_filename,
            "original_name": target_filename,
            "media_type": media_type,
            "type": updated_type,
            "subject_name": updated_subject,
            "description": updated_desc,
            "tags": updated_tags,
            "size_bytes": size_bytes,
            "scene_name": scene_name or "scene01",
            "preview_url": f"/api/uploads/{target_filename}",
            "path": str(file_path) if file_path else ""
        })

    try:
        with open(db_file, "w", encoding="utf-8") as f:
            json.dump(db_records, f, indent=2)
    except Exception as e:
        print(f"[Asset Service] Failed to write assets_db.json: {e}")

    # 4. Synchronize across all active scene project files
    ignored_files = {"assets_db.json", "gemini_config.json", "package.json", "tsconfig.json", "metadata.json"}
    project_files_to_check = []

    if ASSETS_DIR.exists():
        for d in ASSETS_DIR.iterdir():
            if d.is_dir() and d.name not in {"tmp_uploads"}:
                for f in d.glob("*.json"):
                    if f.name.lower() not in ignored_files and not f.name.startswith("."):
                        project_files_to_check.append(f)

    for pfile in project_files_to_check:
        try:
            with open(pfile, "r", encoding="utf-8") as f:
                proj_data = json.load(f)

            if not isinstance(proj_data, dict):
                continue

            modified = False

            # Update assets list inside project JSON
            if "assets" in proj_data and isinstance(proj_data["assets"], list):
                for a in proj_data["assets"]:
                    if isinstance(a, dict) and (a.get("filename") == target_filename or a.get("id") == target_filename):
                        a["type"] = updated_type
                        a["subject_name"] = updated_subject
                        a["description"] = updated_desc
                        a["tags"] = updated_tags
                        modified = True

            # Synchronize subjects registry in project JSON
            if updated_subject and updated_subject.lower() not in ("unknown", "subject", ""):
                if "subjects" in proj_data and isinstance(proj_data["subjects"], list):
                    clean_existing = [s.strip().lower() for s in proj_data["subjects"] if isinstance(s, str)]
                    if updated_subject.strip().lower() not in clean_existing:
                        proj_data["subjects"].append(updated_subject.strip())
                        modified = True

            # Synchronize shared_assets in project JSON
            if "shared_assets" in proj_data and isinstance(proj_data["shared_assets"], list):
                for s in proj_data["shared_assets"]:
                    if isinstance(s, dict) and s.get("filename") == target_filename:
                        s["label"] = f"{updated_type}: {updated_subject}"
                        modified = True

            if modified:
                with open(pfile, "w", encoding="utf-8") as f:
                    json.dump(proj_data, f, indent=2)
        except Exception as e:
            print(f"[Asset Service] Failed to sync project file {pfile}: {e}")

    # 5. Return complete updated asset record
    return {
        "id": target_filename,
        "filename": target_filename,
        "original_name": target_filename,
        "media_type": media_type,
        "type": updated_type,
        "subject_name": updated_subject,
        "description": updated_desc,
        "tags": updated_tags,
        "size_bytes": size_bytes,
        "scene_name": scene_name or "scene01",
        "preview_url": f"/api/uploads/{target_filename}",
        "path": str(file_path) if file_path else ""
    }

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
