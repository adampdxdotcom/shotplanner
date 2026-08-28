import os
import re
import time
import json
import aiofiles
from pathlib import Path
from typing import Dict, Any, List

BASE_DIR = Path(__file__).resolve().parent.parent.parent
ASSETS_DIR = BASE_DIR / "assets"
WORKFLOWS_DIR = ASSETS_DIR / "workflows"
UPLOADS_DIR = ASSETS_DIR / "uploads"

# Ensure directories exist
WORKFLOWS_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

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

async def save_uploaded_file(file_bytes: bytes, target_filename: str) -> Path:
    """Save uploaded media file into the uploads directory."""
    destination = UPLOADS_DIR / target_filename
    async with aiofiles.open(destination, "wb") as f:
        await f.write(file_bytes)
    return destination

def list_workflows() -> List[Dict[str, Any]]:
    """Scan /assets/workflows for ComfyUI API json files."""
    workflows = []
    for file_path in WORKFLOWS_DIR.glob("*.json"):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                workflows.append({
                    "filename": file_path.name,
                    "path": str(file_path),
                    "node_count": len(data) if isinstance(data, dict) else 0,
                    "title": file_path.stem.replace("_", " ").title()
                })
        except Exception:
            continue
    return sorted(workflows, key=lambda x: x["filename"])

def load_workflow_json(filename: str) -> Dict[str, Any]:
    """Load and parse a workflow API JSON file."""
    file_path = WORKFLOWS_DIR / filename
    if not file_path.exists():
        raise FileNotFoundError(f"Workflow file '{filename}' not found in {WORKFLOWS_DIR}")
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)

async def save_workflow_json(filename: str, content: Dict[str, Any]) -> str:
    """Save a new workflow JSON to the workflows directory."""
    if not filename.endswith(".json"):
        filename = f"{filename}.json"
    file_path = WORKFLOWS_DIR / filename
    async with aiofiles.open(file_path, "w", encoding="utf-8") as f:
        await f.write(json.dumps(content, indent=2))
    return filename
