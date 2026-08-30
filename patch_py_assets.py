import re

with open("backend/routes/api.py", "r") as f:
    content = f.read()

# Remove in_memory_asset_metadata
content = re.sub(r'in_memory_asset_metadata: List\[Dict\[str, Any\]\] = \[\]\n?', '', content)

t_upload1 = """    in_memory_asset_metadata.append(asset_record)
    return {"success": True, "asset": asset_record}"""
r_upload1 = """    return {"success": True, "asset": asset_record}"""
content = content.replace(t_upload1, r_upload1)

t_get_assets = """@router.get("/assets")
async def get_assets():
    \"\"\"List all registered uploaded assets.\"\"\"
    return {"assets": in_memory_asset_metadata}"""
r_get_assets = """@router.get("/assets")
async def get_assets(scene_name: Optional[str] = None):
    \"\"\"List assets dynamically from the requested scene directory and global shared.\"\"\"
    assets = []
    seen = set()
    
    def process_file(f, sn):
        if not f.is_file(): return
        if f.name == ".DS_Store" or f.name == "empty.png" or f.name in seen: return
        seen.add(f.name)
        ext = f.suffix.lower()
        if ext in [".mp4", ".mov", ".webm", ".mkv", ".avi"]: media_type = "video"
        elif ext in [".mp3", ".wav", ".ogg", ".flac", ".m4a"]: media_type = "audio"
        else: media_type = "image"
        assets.append({
            "filename": f.name,
            "media_type": media_type,
            "scene_name": sn,
            "preview_url": f"/api/uploads/{f.name}"
        })

    dirs_to_scan = []
    if scene_name:
        scene_dirs = get_scene_directories(scene_name)
        dirs_to_scan.extend([scene_dirs["images"], scene_dirs["videos"], scene_dirs["audios"], scene_dirs["shared"]])
    
    global_shared = ASSETS_DIR / "shared"
    dirs_to_scan.append(global_shared)
    
    # Also fallback to legacy flat directories if scene_name is missing or for backward compat
    if not scene_name:
        dirs_to_scan.extend([LEGACY_IMAGES_DIR, LEGACY_VIDEOS_DIR, LEGACY_AUDIOS_DIR, LEGACY_UPLOADS_DIR])

    for d in dirs_to_scan:
        if d.exists() and d.is_dir():
            for f in d.iterdir():
                process_file(f, scene_name if d != global_shared else "shared")
                
    return {"assets": assets}"""
content = content.replace(t_get_assets, r_get_assets)

t_save_sync = """    # Sync assets into memory if provided
    if isinstance(data_to_save, dict) and isinstance(data_to_save.get("assets"), list):
        for asset in data_to_save["assets"]:
            if isinstance(asset, dict) and asset.get("filename"):
                if not any(a.get("filename") == asset["filename"] for a in in_memory_asset_metadata):
                    in_memory_asset_metadata.append(asset)"""
r_save_sync = """    # No global memory sync, strict isolation"""
content = content.replace(t_save_sync, r_save_sync)

t_get_sync = """        if isinstance(data, dict) and isinstance(data.get("assets"), list):
            for asset in data["assets"]:
                if isinstance(asset, dict) and asset.get("filename"):
                    if not any(a.get("filename") == asset["filename"] for a in in_memory_asset_metadata):
                        in_memory_asset_metadata.append(asset)"""
r_get_sync = """"""
content = content.replace(t_get_sync, r_get_sync)

t_export_zip = """        # Write assets_db.json
        relevant_meta = [a for a in in_memory_asset_metadata if a.get("filename") in added_files]
        final_meta = relevant_meta if relevant_meta else assets_list
        zip_file.writestr("assets_db.json", json.dumps(final_meta, indent=2))"""
r_export_zip = """        # Write assets_db.json purely from the isolated project JSON
        relevant_meta = [a for a in assets_list if a.get("filename") in added_files]
        final_meta = relevant_meta if relevant_meta else assets_list
        zip_file.writestr("assets_db.json", json.dumps(final_meta, indent=2))"""
content = content.replace(t_export_zip, r_export_zip)

t_import_zip = """            elif filename == "assets_db.json":
                for a in assets_db_meta:
                    if not any(x.get("filename") == a["filename"] for x in in_memory_asset_metadata):
                        in_memory_asset_metadata.append(a)"""
r_import_zip = """"""
content = content.replace(t_import_zip, r_import_zip)

t_import_zip2 = """                # Also load assets from the project JSON into memory meta if needed
                if isinstance(project_json_data, dict) and isinstance(project_json_data.get("assets"), list):
                    for a in project_json_data["assets"]:
                        if isinstance(a, dict) and a.get("filename"):
                            if not any(x.get("filename") == a["filename"] for x in in_memory_asset_metadata):
                                in_memory_asset_metadata.append(a)"""
r_import_zip2 = """"""
content = content.replace(t_import_zip2, r_import_zip2)

t_upload_chunk = """        in_memory_asset_metadata.append(asset_record)
        return {"success": True, "asset": asset_record}"""
r_upload_chunk = """        return {"success": True, "asset": asset_record}"""
content = content.replace(t_upload_chunk, r_upload_chunk)

with open("backend/routes/api.py", "w") as f:
    f.write(content)
