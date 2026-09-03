import os
import re
import time
import json
import aiofiles
from pathlib import Path
from typing import Dict, Any, List, Optional

try:
    from PIL import Image
except ImportError:
    Image = None

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
    
    # 1. Authoritative 1-to-1 path: assets/{scene_dir_name}/{scene_dir_name}.json
    p = ASSETS_DIR / scene_dir_name / f"{scene_dir_name}.json"
    if p.is_file(): return p

    # 2. Check assets/{scene_dir_name}/{sanitized}.json
    p = ASSETS_DIR / scene_dir_name / f"{sanitized}.json"
    if p.is_file(): return p
    
    # 3. Legacy flat path
    p = PROJECTS_DIR / f"{sanitized}.json"
    if p.is_file(): return p
    
    # 4. Search scene subdirectories
    ignored = {"assets_db.json", "gemini_config.json", "package.json", "tsconfig.json", "metadata.json"}
    if ASSETS_DIR.exists():
        for d in ASSETS_DIR.iterdir():
            if d.is_dir() and d.name not in {"tmp_uploads", "project_jsons"}:
                cand = d / f"{d.name}.json"
                if cand.is_file() and normalize(cand.stem) == target_norm:
                    return cand
                for f in d.glob("*.json"):
                    if f.is_file() and f.name.lower() not in ignored and normalize(f.stem) == target_norm:
                        return f
                 
    if PROJECTS_DIR.exists():
        for f in PROJECTS_DIR.glob("*.json"):
            if f.is_file() and f.name.lower() not in ignored and normalize(f.stem) == target_norm:
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
    """Standardize scene folder naming cleanly without destroying numbers"""
    if not scene_name:
        return "scene01"
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
    """Ensure all directories for a specific scene exist on disk Just-In-Time."""
    dirs = get_scene_directories(scene_name)
    for p in dirs.values():
        if isinstance(p, Path):
            p.mkdir(parents=True, exist_ok=True)
            
    # Provision 1x1 empty.png bypass in scene shared folder Just-In-Time
    empty_png = dirs["shared"] / "empty.png"
    if not empty_png.exists():
        try:
            empty_png.write_bytes(bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f1563340000000d49444154789c636000000002000148afa4710000000049454e44ae426082"))
        except Exception:
            pass
            
    return dirs

# Ensure only root base ASSETS_DIR and TMP_UPLOAD_DIR exist on server boot
ASSETS_DIR.mkdir(parents=True, exist_ok=True)
TMP_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

COMPOUND_REFERENCE_TYPES = [
    "motion_reference_video",
    "voiceover_audio",
    "motion_reference",
    "voice_reference",
    "body_reference",
    "scene_reference",
    "object_reference",
    "style_reference",
    "character_reference",
    "location_reference",
    "prop_reference",
    "mood_reference",
    "face_reference",
]

def parse_asset_filename(filename: str) -> Dict[str, str]:
    """
    Parses asset filename extracting compound reference type, clean subject name, and media type.
    Correctly recognizes compound types like 'body_reference_jackie_1724859281.png'
    without splitting 'reference' into the subject name.
    """
    path_obj = Path(filename)
    stem = path_obj.stem
    ext = path_obj.suffix.lower()

    if ext in [".mp4", ".mov", ".webm", ".mkv", ".avi"]:
        media_type = "video"
    elif ext in [".mp3", ".wav", ".ogg", ".flac", ".m4a", ".aac"]:
        media_type = "audio"
    else:
        media_type = "image"

    stem_lower = stem.lower()
    asset_type = "unknown"
    remainder = stem

    # 1. Match compound multi-word prefixes (longest first)
    matched_prefix = False
    for prefix in COMPOUND_REFERENCE_TYPES:
        if stem_lower.startswith(f"{prefix}_"):
            asset_type = prefix
            remainder = stem[len(prefix) + 1:]
            matched_prefix = True
            break

    # 2. Check if second token is 'reference' (e.g. custom_reference_name_123)
    if not matched_prefix:
        parts = stem.split("_")
        if len(parts) >= 3 and parts[1].lower() == "reference":
            asset_type = f"{parts[0]}_reference".lower()
            remainder = "_".join(parts[2:])
        elif len(parts) >= 3:
            asset_type = parts[0].lower()
            remainder = "_".join(parts[1:])
        elif len(parts) == 2:
            asset_type = parts[0].lower()
            remainder = parts[1]
        else:
            asset_type = "headshot" if media_type == "image" else "unknown"
            remainder = stem

    # 3. Strip trailing timestamp / numeric tokens from remainder
    rem_parts = remainder.split("_")
    while len(rem_parts) > 1 and rem_parts[-1].isdigit():
        rem_parts.pop()

    subject_raw = "_".join(rem_parts) if rem_parts else "subject"

    # 4. Strip accidental 'reference_' prefix from subject name
    subject_clean = re.sub(r'^reference[_\-\s]+', '', subject_raw, flags=re.IGNORECASE).strip('_ ')
    if not subject_clean or subject_clean.lower() in ("unknown", "null", "undefined", ""):
        subject_clean = "subject"

    # 5. Format subject display nicely
    if subject_clean.islower():
        subject_display = " ".join([w.capitalize() for w in subject_clean.split("_")])
    else:
        subject_display = subject_clean.replace("_", " ")

    type_display = asset_type
    if asset_type == "body_reference":
        type_display = "Body Reference"
    elif asset_type == "headshot":
        type_display = "Headshot"
    elif asset_type == "scene_reference":
        type_display = "Scene Reference"
    elif asset_type == "scene_location_reference":
        type_display = "Scene / Location Reference"
    elif asset_type == "character_staging_reference":
        type_display = "Character Staging Reference"

    return {
        "type": type_display,
        "subject_name": subject_display,
        "media_type": media_type
    }

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

def generate_thumbnail(image_path: Path, max_size: int = 384) -> Optional[Path]:
    """Generates a lightweight, optimized thumbnail for the given image preserving aspect ratio."""
    if not Image or not image_path.exists():
        return None
    try:
        thumb_dir = image_path.parent / "thumbnails"
        thumb_dir.mkdir(parents=True, exist_ok=True)
        thumb_path = thumb_dir / image_path.name
        
        if thumb_path.exists():
            return thumb_path
            
        with Image.open(image_path) as img:
            # Preserve aspect ratio while fitting within max_size x max_size box
            img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
            
            ext = thumb_path.suffix.lower()
            if ext in ('.jpg', '.jpeg'):
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                img.save(thumb_path, format='JPEG', optimize=True, quality=85)
            elif ext == '.png':
                if img.mode not in ('RGBA', 'RGB', 'L'):
                    img = img.convert('RGBA')
                img.save(thumb_path, format='PNG', optimize=True)
            elif ext == '.webp':
                img.save(thumb_path, format='WEBP', quality=85)
            else:
                img.save(thumb_path, optimize=True)
                
            return thumb_path
    except Exception as e:
        print(f"Error generating thumbnail for {image_path}: {e}")
        return None

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

    # Avoid collision: advance timestamp if destination already exists so references of the same type never overwrite
    if destination.exists():
        stem, ext = os.path.splitext(target_filename)
        parts = stem.split("_")
        if len(parts) >= 3 and parts[-1].isdigit():
            ts = int(parts[-1])
            while destination.exists():
                ts += 1
                new_fn = f"{'_'.join(parts[:-1])}_{ts}{ext}"
                destination = target_dir / new_fn
        else:
            counter = 1
            while destination.exists():
                new_fn = f"{stem}_{counter}{ext}"
                destination = target_dir / new_fn
                counter += 1

    async with aiofiles.open(destination, "wb") as f:
        await f.write(file_bytes)
        
    if media_type == "image" or destination.name.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif')):
        generate_thumbnail(destination)
    
    # Also write into legacy uploads for flat fallback
    flat_dest = LEGACY_UPLOADS_DIR / destination.name
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

def find_workflow_file(filename: str, scene_name: Optional[str] = None) -> Optional[Path]:
    """
    Finds a workflow file path by searching:
    1. Active scene's workflow directory (assets/{scene_name}/workflows/{clean_name})
    2. All other scene workflow directories (assets/*/workflows/{clean_name})
    3. Root workflows directory (assets/workflows/{clean_name}) and legacy subdirectories
    4. Recursive rglob across all assets/*/workflows/ and assets/workflows/
    5. Case-insensitive and stem-based fallback in assets
    """
    if not filename:
        return None
        
    clean_name = os.path.basename(filename).strip()
    if not clean_name:
        return None

    clean_name_json = clean_name if clean_name.endswith(".json") else f"{clean_name}.json"
    candidate_paths: List[Path] = []
    
    # 1. Check requested active scene first
    if scene_name:
        scene_dirs = get_scene_directories(scene_name)
        wf_dir = scene_dirs.get("workflows")
        if wf_dir:
            candidate_paths.append(wf_dir / clean_name_json)
            if clean_name != clean_name_json:
                candidate_paths.append(wf_dir / clean_name)
    
    # 2. Check all top-level scene workflow folders inside ASSETS_DIR
    if ASSETS_DIR.exists():
        for sub in ASSETS_DIR.iterdir():
            if sub.is_dir() and sub.name.startswith("scene"):
                wf_dir = sub / "workflows"
                candidate_paths.append(wf_dir / clean_name_json)
                if clean_name != clean_name_json:
                    candidate_paths.append(wf_dir / clean_name)
                
    # 3. Check legacy workflows and legacy subdirectories
    candidate_paths.append(LEGACY_WORKFLOWS_DIR / clean_name_json)
    if clean_name != clean_name_json:
        candidate_paths.append(LEGACY_WORKFLOWS_DIR / clean_name)

    if LEGACY_WORKFLOWS_DIR.exists():
        for sub in LEGACY_WORKFLOWS_DIR.iterdir():
            if sub.is_dir():
                candidate_paths.append(sub / clean_name_json)
                if clean_name != clean_name_json:
                    candidate_paths.append(sub / clean_name)

    # Check direct candidate paths
    for p in candidate_paths:
        if p.exists() and p.is_file():
            return p

    # 4. Global recursive search for exact filename across entire ASSETS_DIR
    if ASSETS_DIR.exists():
        for match in ASSETS_DIR.rglob(clean_name_json):
            if match.is_file():
                return match
        if clean_name != clean_name_json:
            for match in ASSETS_DIR.rglob(clean_name):
                if match.is_file():
                    return match

    # 5. Case-insensitive fallback
    lower_target = clean_name_json.lower()
    if ASSETS_DIR.exists():
        for match in ASSETS_DIR.rglob("*.json"):
            if match.is_file() and match.name.lower() == lower_target:
                return match

    return None

def load_workflow_json(filename: str, scene_name: Optional[str] = None) -> Dict[str, Any]:
    """Load and parse a workflow JSON file searching scene folders, cross-scene directories, and legacy folders."""
    found_path = find_workflow_file(filename, scene_name=scene_name)
    if found_path and found_path.exists() and found_path.is_file():
        with open(found_path, "r", encoding="utf-8") as f:
            return json.load(f)
                
    raise FileNotFoundError(f"Workflow file '{filename}' not found in any scene or workflow directory.")

def find_asset_file_path(filename: str, include_thumbnails: bool = False) -> Optional[Path]:
    """Finds an asset file path checking recursively across the entire assets directory, prioritizing full-resolution media."""
    clean_name = os.path.basename(filename)
    if not clean_name:
        return None
    if ASSETS_DIR.exists():
        # First pass: look for non-thumbnail files
        for path in ASSETS_DIR.rglob(clean_name):
            if path.is_file():
                if "thumbnails" in path.parts:
                    continue
                return path
        # Fallback to thumbnail only if explicitly permitted
        if include_thumbnails:
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
