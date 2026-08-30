import re

with open("backend/routes/api.py", "r") as f:
    content = f.read()

# We want to replace the `import_project_zip` function.
# Let's find its start and end.
start_idx = content.find("async def import_project_zip")
end_idx = content.find("@router.post(\"/assets/upload_chunk\")", start_idx)

new_func = """async def import_project_zip(file: UploadFile = File(...)):
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a .zip archive")
        
    content_bytes = await file.read()
    zip_buffer = io.BytesIO(content_bytes)
    imported_project = ""
    
    # We will do a two-pass approach to ensure we read project metadata first
    # to determine the active scene directories.
    project_json_data = {}
    assets_db_meta = []
    
    with zipfile.ZipFile(zip_buffer, "r") as zip_file:
        # Pass 1: Extract project JSON and assets_db.json
        for member in zip_file.infolist():
            if member.is_dir():
                continue
            filename = member.filename
            if filename == "assets_db.json":
                try:
                    assets_arr = json.loads(zip_file.read(member).decode("utf-8"))
                    if isinstance(assets_arr, list):
                        assets_db_meta = assets_arr
                except Exception:
                    pass
            elif filename.endswith(".json") and "/" not in filename and "\\\\" not in filename:
                imported_project = os.path.basename(filename)[:-5]
                try:
                    project_json_data = json.loads(zip_file.read(member).decode("utf-8"))
                except Exception:
                    pass

        # Determine the active scene name and initialize directories
        scene_name = imported_project
        if isinstance(project_json_data, dict):
            scene_name = project_json_data.get("scene_name") or project_json_data.get("scene_planning", {}).get("scene_name") or scene_name
            
        scene_dirs = ensure_scene_directories(scene_name)
        
        # Build a lookup for media_type by filename
        media_type_map = {}
        for a in assets_db_meta:
            if isinstance(a, dict) and a.get("filename"):
                media_type_map[a["filename"]] = a.get("media_type", "image")
        if isinstance(project_json_data, dict) and isinstance(project_json_data.get("assets"), list):
            for a in project_json_data["assets"]:
                if isinstance(a, dict) and a.get("filename"):
                    media_type_map[a["filename"]] = a.get("media_type", "image")
        
        # Pass 2: Extract and route files to their respective Scene-First subdirectories
        for member in zip_file.infolist():
            if member.is_dir():
                continue
            
            filename = member.filename
            file_bytes = zip_file.read(member)
            out_name = os.path.basename(filename)
            
            if filename.startswith("workflows/") and out_name:
                with open(scene_dirs["workflows"] / out_name, "wb") as f:
                    f.write(file_bytes)
            
            elif filename.startswith("uploads/") and out_name:
                m_type = media_type_map.get(out_name, "image")
                sub_key = f"{m_type}s"
                target_dir = scene_dirs.get(sub_key, scene_dirs.get("images"))
                target_dir.mkdir(parents=True, exist_ok=True)
                with open(target_dir / out_name, "wb") as f:
                    f.write(file_bytes)
                    
            elif filename == "assets_db.json":
                for a in assets_db_meta:
                    if not any(x.get("filename") == a["filename"] for x in in_memory_asset_metadata):
                        in_memory_asset_metadata.append(a)
                        
            elif filename.endswith(".json") and "/" not in filename and "\\\\" not in filename:
                out_name = os.path.basename(filename)
                with open(PROJECTS_DIR / out_name, "wb") as f:
                    f.write(file_bytes)
                
                # Also load assets from the project JSON into memory meta if needed
                if isinstance(project_json_data, dict) and isinstance(project_json_data.get("assets"), list):
                    for a in project_json_data["assets"]:
                        if isinstance(a, dict) and a.get("filename"):
                            if not any(x.get("filename") == a["filename"] for x in in_memory_asset_metadata):
                                in_memory_asset_metadata.append(a)
                                
    return {"success": True, "filename": imported_project}

"""

new_content = content[:start_idx] + new_func + content[end_idx:]
with open("backend/routes/api.py", "w") as f:
    f.write(new_content)
