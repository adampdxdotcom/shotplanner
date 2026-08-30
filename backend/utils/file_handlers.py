import os
import re
import time
import json
import aiofiles
from pathlib import Path
from typing import Dict, Any, List, Optional

# Re-anchor base asset directory to resolve strictly to the container project root assets mount
# Fallback to current working directory (e.g. for AI studio preview environment)
BASE_DIR = Path("/app") if Path("/app/backend").exists() or Path("/app/assets").exists() else Path.cwd()
ASSETS_DIR = BASE_DIR / "assets"
PROJECTS_DIR = ASSETS_DIR / "project_jsons"
TMP_UPLOAD_DIR = ASSETS_DIR / "tmp_uploads"

# Legacy flat structure for fallback compatibility
LEGACY_IMAGES_DIR = ASSETS_DIR / "images"
LEGACY_WORKFLOWS_DIR = ASSETS_DIR / "workflows"
LEGACY_VIDEOS_DIR = ASSETS_DIR / "videos"
LEGACY_AUDIOS_DIR = ASSETS_DIR / "audios"
LEGACY_UPLOADS_DIR = ASSETS_DIR / "uploads"
UPLOADS_DIR = LEGACY_UPLOADS_DIR  # Aliased for backward compatibility in some modules
WORKFLOWS_DIR = LEGACY_WORKFLOWS_DIR


def find_project_file(identifier: str) -> Optional[Path]:
    if not identifier:
        return None
    def normalize(name: str) -> str:
        clean = name.strip().lower()
        if clean.endswith(".json"):
            clean = clean[:-5]
        if clean.startswith("scene_"):
            clean = clean[6:]
        return clean
        
    target_norm = normalize(identifier)
    if not target_norm:
        return None

    sanitized = sanitize_project_name(identifier)
    scene_dir_name = format_scene_folder_name(sanitized)
    p = ASSETS_DIR / scene_dir_name / f"{sanitized}.json"
    if p.is_file(): return p
    
    p = PROJECTS_DIR / f"{sanitized}.json"
    if p.is_file(): return p
    
    directories_to_scan = [PROJECTS_DIR, ASSETS_DIR]
    if ASSETS_DIR.exists():
        for item in ASSETS_DIR.iterdir():
            if item.is_dir():
                directories_to_scan.append(item)
                
    for directory in directories_to_scan:
        if not directory.exists(): continue
        for f in directory.glob("*.json"):
            if f.is_file() and normalize(f.name) == target_norm:
                return f
                
    return None

def sanitize_project_name(name: str) -> str:
    if not name:
        return "project"
    clean = name.strip()
    if clean.lower().endswith(".json"):
        clean = clean[:-5]
    clean = re.sub(r'[^a-z0-9_-]', '_', clean.lower())
    clean = re.sub(r'_+', '_', clean).strip('_')
    return clean or "project"

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
    """Get all scene-specific paths in a Scene-First hierarchy."""
    folder = format_scene_folder_name(scene_name)
    scene_base = ASSETS_DIR / folder
    return {
        "base": scene_base,
        "images": scene_base / "images",
        "workflows": scene_base / "workflows",
        "videos": scene_base / "videos",
        "audios": scene_base / "audios",
        "shared": scene_base / "shared"
    }

def ensure_scene_directories(scene_name: Optional[str] = "scene01") -> Dict[str, Path]:
    """Ensure all directories for a specific scene exist on disk."""
    dirs = get_scene_directories(scene_name)
    for p in dirs.values():
        if isinstance(p, Path):
            p.mkdir(parents=True, exist_ok=True)
    return dirs

# Ensure base directories exist
for base in [ASSETS_DIR, PROJECTS_DIR, TMP_UPLOAD_DIR, LEGACY_IMAGES_DIR, LEGACY_WORKFLOWS_DIR, LEGACY_VIDEOS_DIR, LEGACY_AUDIOS_DIR, LEGACY_UPLOADS_DIR]:
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
    """Save uploaded media file into the scene-specific directory."""
    scene_dirs = get_scene_directories(scene_name)
    
    # Safely resolve subfolder without direct indexing to prevent KeyError
    subfolder_key = f"{media_type}s"
    target_dir = scene_dirs.get(subfolder_key)
    if not target_dir:
        target_dir = scene_dirs.get("images")
        
    target_dir.mkdir(parents=True, exist_ok=True)
    destination = target_dir / target_filename
    async with aiofiles.open(destination, "wb") as f:
        await f.write(file_bytes)
    
    # Also write into legacy uploads for flat fallback
    flat_dest = LEGACY_UPLOADS_DIR / target_filename
    if not flat_dest.exists():
        try:
            async with aiofiles.open(flat_dest, "wb") as f2:
                await f2.write(file_bytes)
        except Exception:
            pass
            
    return destination

def list_workflows(scene_name: Optional[str] = None) -> List[Dict[str, Any]]:
    """Scan scene-specific workflows and legacy workflows for ComfyUI json files."""
    workflows_map = {}
    
    def scan_dir(workflow_dir: Path, scene_context: str = ""):
        if workflow_dir.exists():
            for file_path in workflow_dir.glob("*.json"):
                if file_path.name not in workflows_map:
                    try:
                        with open(file_path, "r", encoding="utf-8") as f:
                            data = json.load(f)
                            node_count = len(data.get("nodes", [])) if isinstance(data, dict) and "nodes" in data else (len(data) if isinstance(data, dict) else 0)
                            workflows_map[file_path.name] = {
                                "filename": file_path.name,
                                "path": f"/assets/{scene_context}/workflows/{file_path.name}" if scene_context else f"/assets/workflows/{file_path.name}",
                                "node_count": node_count,
                                "title": f"[{scene_context}] {file_path.stem.replace('_', ' ').title()}" if scene_context else file_path.stem.replace("_", " ").title()
                            }
                    except Exception:
                        continue

    # 1. Scan requested scene specifically first
    if scene_name:
        scene_dirs = get_scene_directories(scene_name)
        scan_dir(scene_dirs.get("workflows"), format_scene_folder_name(scene_name))

    # 2. Scan all top-level scene directories inside ASSETS_DIR
    if ASSETS_DIR.exists():
        for sub in ASSETS_DIR.iterdir():
            if sub.is_dir() and sub.name.startswith("scene"):
                wf_dir = sub / "workflows"
                if wf_dir.exists():
                    scan_dir(wf_dir, sub.name)
                    
    # 3. Scan legacy workflows
    scan_dir(LEGACY_WORKFLOWS_DIR)
    
    # 4. Scan legacy scene folders inside legacy workflows (for ultimate backward compat)
    if LEGACY_WORKFLOWS_DIR.exists():
        for sub in LEGACY_WORKFLOWS_DIR.iterdir():
            if sub.is_dir():
                scan_dir(sub, f"legacy_{sub.name}")

    return sorted(list(workflows_map.values()), key=lambda x: x["filename"])

def load_workflow_json(filename: str, scene_name: Optional[str] = None) -> Dict[str, Any]:
    """Load and parse a workflow JSON file searching scene folders and legacy folders."""
    clean_name = os.path.basename(filename)
    candidate_paths = []
    
    if scene_name:
        scene_dirs = get_scene_directories(scene_name)
        candidate_paths.append(scene_dirs.get("workflows") / clean_name)
    
    # Add all other scene folders
    if ASSETS_DIR.exists():
        for sub in ASSETS_DIR.iterdir():
            if sub.is_dir() and sub.name.startswith("scene"):
                candidate_paths.append(sub / "workflows" / clean_name)
                
    # Add legacy workflows
    candidate_paths.append(LEGACY_WORKFLOWS_DIR / clean_name)
    if LEGACY_WORKFLOWS_DIR.exists():
        for sub in LEGACY_WORKFLOWS_DIR.iterdir():
            if sub.is_dir():
                candidate_paths.append(sub / clean_name)

    for p in candidate_paths:
        if p.exists() and p.is_file():
            with open(p, "r", encoding="utf-8") as f:
                return json.load(f)
                
    raise FileNotFoundError(f"Workflow file '{filename}' not found in any workflow directory.")

def find_asset_file_path(filename: str) -> Optional[Path]:
    """Finds an asset file path checking recursively across the entire assets directory."""
    clean_name = os.path.basename(filename)
    if ASSETS_DIR.exists():
        # Recursive search across all directories and subdirectories under the base assets directory
        for path in ASSETS_DIR.rglob(clean_name):
            if path.is_file():
                return path
    return None

async def save_workflow_json(filename: str, content: Dict[str, Any], scene_name: Optional[str] = "scene01") -> str:
    """Save a workflow JSON to the scene-specific workflows directory."""
    if not filename.endswith(".json"):
        filename = f"{filename}.json"
    scene_dirs = get_scene_directories(scene_name)
    target_dir = scene_dirs.get("workflows")
    target_dir.mkdir(parents=True, exist_ok=True)
    file_path = target_dir / filename
    async with aiofiles.open(file_path, "w", encoding="utf-8") as f:
        await f.write(json.dumps(content, indent=2))
        
    # Also save to legacy
    LEGACY_WORKFLOWS_DIR.mkdir(parents=True, exist_ok=True)
    legacy_file = LEGACY_WORKFLOWS_DIR / filename
    if not legacy_file.exists():
        try:
            async with aiofiles.open(legacy_file, "w", encoding="utf-8") as f:
                await f.write(json.dumps(content, indent=2))
        except:
            pass
            
    return filename
