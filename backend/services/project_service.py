import os
import io
import re
import json
import shutil
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional
from fastapi import HTTPException

from backend.utils.file_handlers import (
    format_scene_folder_name,
    ensure_scene_directories,
    sanitize_project_name,
    find_project_file,
    find_asset_file_path,
    load_workflow_json,
    ASSETS_DIR,
    PROJECTS_DIR,
    WORKFLOWS_DIR,
    BASE_DIR
)
from backend.services.workflow_service import inspect_workflow_nodes, inject_and_prepare_workflow, build_shot_workflow

IGNORED_JSON_FILENAMES = {
    "assets_db.json",
    "gemini_config.json",
    "civitai_config.json",
    "huggingface_config.json",
    "package.json",
    "tsconfig.json",
    "metadata.json"
}

def save_project_data(req: Dict[str, Any]) -> str:
    """
    Save project JSON into dedicated scene directory with strict 1-to-1 synchronization:
    assets/{scene_name}/{scene_name}.json with synchronized scene_name inside JSON.
    """
    raw_name = str(
        req.get("filename")
        or req.get("name")
        or (req.get("data", {}).get("scene_name") if isinstance(req.get("data"), dict) else None)
        or "project"
    )
    clean_name = sanitize_project_name(raw_name)
    scene_dir_name = format_scene_folder_name(clean_name)
    final_filename = f"{scene_dir_name}.json"
    
    data_to_save = req.get("data") if ("data" in req and isinstance(req["data"], dict)) else req
    
    # Enforce synchronized scene_name inside project JSON data
    if isinstance(data_to_save, dict):
        data_to_save["scene_name"] = scene_dir_name
        if "scene_planning" in data_to_save and isinstance(data_to_save["scene_planning"], dict):
            data_to_save["scene_planning"]["scene_name"] = scene_dir_name
    
    dirs = ensure_scene_directories(scene_dir_name)
    file_path = dirs["base"] / final_filename

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data_to_save, f, indent=2)

    return final_filename

def list_all_projects() -> List[Dict[str, Any]]:
    """
    Scan scene directories and legacy projects folder for saved projects.
    Enforces 1-to-1 Project Synchronization: strictly checks for assets/{scene_name}/{scene_name}.json
    and deduplicates so each physical scene directory yields exactly one project item in the UI.
    """
    projects = []
    seen_scenes = set()
    
    # 1. Scan scene directories in ASSETS_DIR
    if ASSETS_DIR.exists():
        for d in ASSETS_DIR.iterdir():
            if d.is_dir() and d.name not in {"tmp_uploads", "project_jsons"}:
                scene_name = d.name
                if scene_name in seen_scenes:
                    continue
                
                # Check authoritative descriptor assets/{scene_name}/{scene_name}.json
                authoritative_file = d / f"{scene_name}.json"
                target_file = None
                
                if authoritative_file.is_file():
                    target_file = authoritative_file
                else:
                    # Fallback: find any primary scene json excluding auxiliary files
                    for f in d.glob("*.json"):
                        if f.name.lower() not in IGNORED_JSON_FILENAMES and not f.name.startswith("."):
                            target_file = f
                            break
                            
                if target_file and target_file.is_file():
                    seen_scenes.add(scene_name)
                    stat = target_file.stat()
                    mtime = datetime.fromtimestamp(stat.st_mtime).isoformat() + "Z"
                    projects.append({
                        "filename": target_file.name,
                        "display_name": scene_name,
                        "scene_name": scene_name,
                        "mtime": mtime,
                        "size": stat.st_size
                    })
                    
    # 2. Scan legacy projects dir
    if PROJECTS_DIR.exists():
        for f in PROJECTS_DIR.glob("*.json"):
            if f.is_file() and f.name.lower() not in IGNORED_JSON_FILENAMES and not f.name.startswith("."):
                stem = f.stem
                if stem not in seen_scenes:
                    seen_scenes.add(stem)
                    stat = f.stat()
                    mtime = datetime.fromtimestamp(stat.st_mtime).isoformat() + "Z"
                    projects.append({
                        "filename": f.name,
                        "display_name": stem,
                        "scene_name": stem,
                        "mtime": mtime,
                        "size": stat.st_size
                    })
            
    projects.sort(key=lambda x: x["mtime"], reverse=True)
    return projects

def get_project_data(filename: str) -> Dict[str, Any]:
    """Load project JSON and ensure its scene directories exist."""
    file_path = find_project_file(filename)
    if not file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail="Project not found")
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
        scene_name = None
        if isinstance(data, dict):
            scene_name = data.get("scene_name") or data.get("scene_planning", {}).get("scene_name")
        ensure_scene_directories(scene_name or file_path.stem)

        return data

def delete_project_data(filename: str) -> bool:
    """Delete project JSON and clean up scene directory if isolated."""
    file_path = find_project_file(filename)
    if not file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail="Project not found")
    
    parent_dir = file_path.parent
    file_path.unlink()
    
    # Recursively remove the scene directory if not root assets or projects dir
    if parent_dir != ASSETS_DIR and parent_dir != PROJECTS_DIR:
        try:
            shutil.rmtree(parent_dir)
        except Exception:
            pass
            
    return True

def export_project_zip_buffer(filename: str) -> io.BytesIO:
    """
    Build standalone ZIP archive with:
    1. Master project JSON
    2. Original workflow templates
    3. Full-res media in uploads/ (excluding thumbnails)
    4. Master assets_db.json
    5. Injected workflows for each shot in staged_workflows/
    """
    file_path = find_project_file(filename)
    if not file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail="Project not found")

    with open(file_path, "r", encoding="utf-8") as f:
        project_data = json.load(f)

    clean_name = file_path.stem
    scene_name = project_data.get("scene_name") or clean_name or "Scene"
    clean_scene_name = re.sub(r'[^a-zA-Z0-9_-]', '_', str(scene_name)).strip('_') or "Scene"

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        # 1. Master project JSON at root
        zip_file.writestr(f"{clean_name}.json", json.dumps(project_data, indent=2))

        # Helper to find workflow file
        def find_wf_file(wf_fn: str) -> Optional[Path]:
            if not wf_fn:
                return None
            clean_wf = os.path.basename(wf_fn.strip())
            if not clean_wf:
                return None
            cand = WORKFLOWS_DIR / clean_wf
            if cand.exists():
                return cand
            if ASSETS_DIR.exists():
                for sub in ASSETS_DIR.iterdir():
                    if sub.is_dir():
                        sub_wf = sub / "workflows" / clean_wf
                        if sub_wf.exists():
                            return sub_wf
            return None

        # 2. Collect unique original master workflow templates into workflows/
        cached_templates: Dict[str, Any] = {}
        referenced_wfs = set()

        if project_data.get("workflow_file") and isinstance(project_data["workflow_file"], str):
            referenced_wfs.add(os.path.basename(project_data["workflow_file"]))
        if project_data.get("selectedWorkflowFile") and isinstance(project_data["selectedWorkflowFile"], str):
            referenced_wfs.add(os.path.basename(project_data["selectedWorkflowFile"]))

        shots = project_data.get("shots", [])
        if isinstance(shots, list):
            for s in shots:
                if isinstance(s, dict) and s.get("workflow_file") and isinstance(s["workflow_file"], str):
                    referenced_wfs.add(os.path.basename(s["workflow_file"]))

        for wf_fn in referenced_wfs:
            found_path = find_wf_file(wf_fn)
            if found_path and found_path.exists():
                zip_file.write(found_path, arcname=f"workflows/{wf_fn}")
                try:
                    with open(found_path, "r", encoding="utf-8") as wf_f:
                        cached_templates[wf_fn] = json.load(wf_f)
                except Exception:
                    pass

        # 3. Add all project media assets into uploads/ (filtering out thumbnails)
        added_files = set()

        def collect_asset(fn_val: Optional[str]):
            if not fn_val or not isinstance(fn_val, str):
                return
            clean_fn = os.path.basename(fn_val.strip())
            if not clean_fn or clean_fn in added_files or clean_fn == "thumbnails" or clean_fn == ".DS_Store":
                return
            asset_path = find_asset_file_path(clean_fn)
            if asset_path and asset_path.exists() and "thumbnails" not in asset_path.parts:
                zip_file.write(asset_path, arcname=f"uploads/{clean_fn}")
                added_files.add(clean_fn)

        assets_list = project_data.get("assets", [])
        if isinstance(assets_list, list):
            for asset in assets_list:
                if isinstance(asset, dict) and asset.get("filename"):
                    collect_asset(asset["filename"])

        if isinstance(shots, list):
            for shot in shots:
                if isinstance(shot, dict):
                    if isinstance(shot.get("assigned_slots"), dict):
                        for slot_fn in shot["assigned_slots"].values():
                            collect_asset(slot_fn)
                    if isinstance(shot.get("node_mappings"), dict):
                        for map_fn in shot["node_mappings"].values():
                            collect_asset(map_fn)

        shared_assets = project_data.get("shared_assets", [])
        if isinstance(shared_assets, list):
            for sa in shared_assets:
                if isinstance(sa, dict) and sa.get("filename"):
                    collect_asset(sa["filename"])

        node_mappings = project_data.get("nodeMappings", {})
        if isinstance(node_mappings, dict):
            for fn_val in node_mappings.values():
                collect_asset(fn_val)

        node_mappings_snake = project_data.get("node_mappings", {})
        if isinstance(node_mappings_snake, dict):
            for fn_val in node_mappings_snake.values():
                collect_asset(fn_val)

        # Ensure empty.png is included in uploads/
        empty_png_path = find_asset_file_path("empty.png")
        if empty_png_path and empty_png_path.exists():
            zip_file.write(empty_png_path, arcname="uploads/empty.png")
        else:
            empty_bytes = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f1563340000000d49444154789c636000000002000148afa4710000000049454e44ae426082")
            zip_file.writestr("uploads/empty.png", empty_bytes)
        added_files.add("empty.png")

        # 4. Master assets_db.json at root
        relevant_meta = [a for a in assets_list if isinstance(a, dict) and a.get("filename") in added_files]
        final_meta = relevant_meta if relevant_meta else assets_list
        zip_file.writestr("assets_db.json", json.dumps(final_meta, indent=2))

        # 5. Dynamically synthesize injected workflow JSON for every shot in staged_workflows/
        for shot in shots:
            if not isinstance(shot, dict):
                continue
            shot_num = shot.get("shot_number", 1)
            try:
                shot_num_int = int(shot_num)
                shot_num_str = f"{shot_num_int:02d}"
            except Exception:
                shot_num_str = str(shot_num)

            shot_name = shot.get("shot_name", "")
            clean_shot_name = re.sub(r'[^a-zA-Z0-9_-]', '_', str(shot_name).strip()).strip('_') if shot_name else ""
            staged_filename = f"Shot_{shot_num_str}_{clean_shot_name}.json" if clean_shot_name else f"{clean_scene_name}_Shot_{shot_num_str}.json"

            # Ingest and synthesize ready-to-run ComfyUI workflow via centralized builder
            injected_workflow = build_shot_workflow(project_data=project_data, shot=shot, scene_name=clean_scene_name)

            zip_file.writestr(f"staged_workflows/{staged_filename}", json.dumps(injected_workflow, indent=2))

    zip_buffer.seek(0)
    return zip_buffer

def extract_project_zip_buffer(zip_source: Any) -> str:
    """
    Extract uploaded ZIP archive into dedicated Scene directories.
    Streams large media files and assets in 1MB chunks to avoid memory exhaustion on up to 500MB archives.
    Supports file paths, file-like objects (e.g. FastAPI SpooledTemporaryFile / UploadFile.file), and bytes buffers.
    """
    imported_project = ""
    project_json_data = {}
    assets_db_meta = []
    
    # Normalize zip_source to ZipFile compatible source
    if isinstance(zip_source, bytes):
        zip_file_obj = zipfile.ZipFile(io.BytesIO(zip_source), "r")
    elif isinstance(zip_source, (str, Path)):
        zip_file_obj = zipfile.ZipFile(str(zip_source), "r")
    else:
        # File-like object (e.g. SpooledTemporaryFile, BytesIO, etc.)
        if hasattr(zip_source, "seek"):
            try:
                zip_source.seek(0)
            except Exception:
                pass
        zip_file_obj = zipfile.ZipFile(zip_source, "r")

    try:
        # Pass 1: Extract project JSON and assets_db.json metadata (small text files)
        for member in zip_file_obj.infolist():
            if member.is_dir():
                continue
            filename = member.filename
            if filename == "assets_db.json":
                try:
                    with zip_file_obj.open(member) as f:
                        assets_arr = json.loads(f.read().decode("utf-8"))
                        if isinstance(assets_arr, list):
                            assets_db_meta = assets_arr
                except Exception:
                    pass
            elif filename.endswith(".json") and "/" not in filename and "\\" not in filename:
                imported_project = os.path.basename(filename)[:-5]
                try:
                    with zip_file_obj.open(member) as f:
                        project_json_data = json.loads(f.read().decode("utf-8"))
                except Exception:
                    pass

        # Determine authoritative clean scene name
        raw_scene_name = (
            (project_json_data.get("scene_name") if isinstance(project_json_data, dict) else None)
            or (project_json_data.get("scene_planning", {}).get("scene_name") if isinstance(project_json_data, dict) else None)
            or imported_project
            or "imported_scene"
        )
        clean_scene_name = sanitize_project_name(raw_scene_name)
        scene_dir_name = format_scene_folder_name(clean_scene_name)
        
        # Enforce synchronized scene_name inside project JSON data
        if isinstance(project_json_data, dict):
            project_json_data["scene_name"] = scene_dir_name
            if "scene_planning" in project_json_data and isinstance(project_json_data["scene_planning"], dict):
                project_json_data["scene_planning"]["scene_name"] = scene_dir_name
            
        scene_dirs = ensure_scene_directories(scene_dir_name)
        
        # Build lookup for media_type
        media_type_map = {}
        for a in assets_db_meta:
            if isinstance(a, dict) and a.get("filename"):
                media_type_map[a["filename"]] = a.get("media_type", "image")
        if isinstance(project_json_data, dict) and isinstance(project_json_data.get("assets"), list):
            for a in project_json_data["assets"]:
                if isinstance(a, dict) and a.get("filename"):
                    media_type_map[a["filename"]] = a.get("media_type", "image")
        
        # Pass 2: Stream extract files to scene subdirectories in 1MB chunks
        for member in zip_file_obj.infolist():
            if member.is_dir():
                continue
            
            filename = member.filename
            out_name = os.path.basename(filename)
            if not out_name:
                continue
            
            if (filename.startswith("workflows/") or filename.startswith("staged_workflows/")) and out_name:
                dest_path = scene_dirs["workflows"] / out_name
                with zip_file_obj.open(member) as src_file, open(dest_path, "wb") as dest_file:
                    shutil.copyfileobj(src_file, dest_file, length=1024 * 1024)
            
            elif filename.startswith("uploads/") and out_name:
                m_type = media_type_map.get(out_name, "image")
                sub_key = f"{m_type}s"
                target_dir = scene_dirs.get(sub_key, scene_dirs.get("images"))
                target_dir.mkdir(parents=True, exist_ok=True)
                dest_path = target_dir / out_name
                with zip_file_obj.open(member) as src_file, open(dest_path, "wb") as dest_file:
                    shutil.copyfileobj(src_file, dest_file, length=1024 * 1024)
                        
            elif filename.endswith(".json") and "/" not in filename and "\\" not in filename:
                if filename.lower() not in IGNORED_JSON_FILENAMES:
                    # Write authoritative descriptor directly to assets/{scene_dir_name}/{scene_dir_name}.json
                    dest_base = scene_dirs["base"] / f"{scene_dir_name}.json"
                    with open(dest_base, "w", encoding="utf-8") as f:
                        json.dump(project_json_data, f, indent=2)

        # Ensure authoritative project json exists if not written in loop
        authoritative_json = scene_dirs["base"] / f"{scene_dir_name}.json"
        if not authoritative_json.exists() and project_json_data:
            with open(authoritative_json, "w", encoding="utf-8") as f:
                json.dump(project_json_data, f, indent=2)
    finally:
        zip_file_obj.close()
                                
    return f"{scene_dir_name}.json"
