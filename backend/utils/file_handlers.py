import os
import re
import time
import json
import aiofiles
from pathlib import Path
from typing import Dict, Any, List, Optional

BASE_DIR = Path(__file__).resolve().parent.parent.parent
ASSETS_DIR = BASE_DIR / "assets"
IMAGES_DIR = ASSETS_DIR / "images"
WORKFLOWS_DIR = ASSETS_DIR / "workflows"
VIDEOS_DIR = ASSETS_DIR / "videos"
AUDIOS_DIR = ASSETS_DIR / "audios"
UPLOADS_DIR = ASSETS_DIR / "uploads"
PROJECTS_DIR = ASSETS_DIR / "project_jsons"
TMP_UPLOAD_DIR = ASSETS_DIR / "tmp_uploads"

def format_scene_folder_name(scene_name: Optional[str] = "scene01") -> str:
    """Standardize scene folder naming e.g., 'Scene 1' -> 'scene01'"""
    if not scene_name:
        return "scene01"
    match = re.search(r'\d+', scene_name)
    if match:
        num = int(match.group(0))
        return f"scene{num:02d}"
    clean = re.sub(r'[^a-z0-9_-]', '_', scene_name.strip().lower())
    clean = re.sub(r'_+', '_', clean).strip('_')
    return clean or "scene01"

def get_scene_directories(scene_name: Optional[str] = "scene01") -> Dict[str, Path]:
    """Get all scene-specific paths."""
    folder = format_scene_folder_name(scene_name)
    return {
        "images": IMAGES_DIR / folder,
        "workflows": WORKFLOWS_DIR / folder,
        "videos": VIDEOS_DIR / folder,
        "audios": AUDIOS_DIR / folder,
        "uploads": UPLOADS_DIR / folder
    }

# Ensure base and default scene directories exist
for base in [ASSETS_DIR, IMAGES_DIR, WORKFLOWS_DIR, VIDEOS_DIR, AUDIOS_DIR, UPLOADS_DIR, PROJECTS_DIR, TMP_UPLOAD_DIR]:
    base.mkdir(parents=True, exist_ok=True)

for p in get_scene_directories("scene01").values():
    p.mkdir(parents=True, exist_ok=True)

def sanitize_filename(name: str) -> str:
    """Sanitize subject names or labels to be safe in filenames."""
    name = name.strip().lower()
    name = re.sub(r'[^a-z0-9_-]', '_', name)
    return re.sub(r'_+', '_', name).strip('_') or "asset"

def generate_target_filename(asset_type: str, subject_name: str, original_filename: str) -> str:
    """
    File Renaming Strategy:
    Format: {type}_{name}_{timestamp}.ext
    Example: headshot_jackie_1724859281.png
    """
    clean_type = sanitize_filename(asset_type)
    clean_name = sanitize_filename(subject_name)
    timestamp = int(time.time())
    
    ext = os.path.splitext(original_filename)[1].lower()
    if not ext:
        ext = ".png" if "image" in clean_type or "headshot" in clean_type else ".bin"
        
    return f"{clean_type}_{clean_name}_{timestamp}{ext}"

async def save_uploaded_file(file_bytes: bytes, target_filename: str, scene_name: Optional[str] = "scene01", media_type: str = "image") -> Path:
    """Save uploaded media file into the scene-specific or uploads directory."""
    scene_dirs = get_scene_directories(scene_name)
    target_dir = scene_dirs.get("images" if media_type == "image" else "videos" if media_type == "video" else "audios", scene_dirs["uploads"])
    target_dir.mkdir(parents=True, exist_ok=True)
    destination = target_dir / target_filename
    async with aiofiles.open(destination, "wb") as f:
        await f.write(file_bytes)
    
    # Also write into uploads for flat fallback
    flat_dest = UPLOADS_DIR / target_filename
    if not flat_dest.exists():
        try:
            async with aiofiles.open(flat_dest, "wb") as f2:
                await f2.write(file_bytes)
        except Exception:
            pass
            
    return destination

def list_workflows(scene_name: Optional[str] = None) -> List[Dict[str, Any]]:
    """Scan scene-specific and root /assets/workflows for ComfyUI json files."""
    workflows_map = {}
    
    # Scan all scene workflow subfolders
    if WORKFLOWS_DIR.exists():
        for sub in WORKFLOWS_DIR.iterdir():
            if sub.is_dir():
                for file_path in sub.glob("*.json"):
                    try:
                        with open(file_path, "r", encoding="utf-8") as f:
                            data = json.load(f)
                            node_count = len(data.get("nodes", [])) if isinstance(data, dict) and "nodes" in data else (len(data) if isinstance(data, dict) else 0)
                            workflows_map[file_path.name] = {
                                "filename": file_path.name,
                                "path": f"/assets/workflows/{sub.name}/{file_path.name}",
                                "node_count": node_count,
                                "title": f"[{sub.name}] {file_path.stem.replace('_', ' ').title()}"
                            }
                    except Exception:
                        continue

        # Also scan root workflows
        for file_path in WORKFLOWS_DIR.glob("*.json"):
            if file_path.name not in workflows_map:
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        node_count = len(data.get("nodes", [])) if isinstance(data, dict) and "nodes" in data else (len(data) if isinstance(data, dict) else 0)
                        workflows_map[file_path.name] = {
                            "filename": file_path.name,
                            "path": f"/assets/workflows/{file_path.name}",
                            "node_count": node_count,
                            "title": file_path.stem.replace("_", " ").title()
                        }
                except Exception:
                    continue

    return sorted(list(workflows_map.values()), key=lambda x: x["filename"])

def load_workflow_json(filename: str, scene_name: Optional[str] = None) -> Dict[str, Any]:
    """Load and parse a workflow JSON file searching scene folders and root."""
    clean_name = os.path.basename(filename)
    candidate_paths = []
    if scene_name:
        folder = format_scene_folder_name(scene_name)
        candidate_paths.append(WORKFLOWS_DIR / folder / clean_name)
    
    candidate_paths.append(WORKFLOWS_DIR / "scene01" / clean_name)
    candidate_paths.append(WORKFLOWS_DIR / clean_name)

    # Add all other scene folders
    if WORKFLOWS_DIR.exists():
        for sub in WORKFLOWS_DIR.iterdir():
            if sub.is_dir():
                candidate_paths.append(sub / clean_name)

    for p in candidate_paths:
        if p.exists() and p.is_file():
            with open(p, "r", encoding="utf-8") as f:
                return json.load(f)
                
    raise FileNotFoundError(f"Workflow file '{filename}' not found in any workflow directory.")

async def save_workflow_json(filename: str, content: Dict[str, Any], scene_name: Optional[str] = "scene01") -> str:
    """Save a workflow JSON to the scene-specific workflows directory."""
    if not filename.endswith(".json"):
        filename = f"{filename}.json"
    folder = format_scene_folder_name(scene_name)
    target_dir = WORKFLOWS_DIR / folder
    target_dir.mkdir(parents=True, exist_ok=True)
    file_path = target_dir / filename
    async with aiofiles.open(file_path, "w", encoding="utf-8") as f:
        await f.write(json.dumps(content, indent=2))
    return filename
