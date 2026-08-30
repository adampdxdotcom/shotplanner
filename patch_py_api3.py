import re

with open("backend/routes/api.py", "r") as f:
    content = f.read()

t_get = """@router.get("/projects/{filename}")
async def get_project(filename: str):
    sanitized_name = sanitize_project_name(filename)
    safe_filename = f"{sanitized_name}.json"
    scene_dir_name = format_scene_folder_name(sanitized_name)
    
    # Check scene folder first
    file_path = ASSETS_DIR / scene_dir_name / safe_filename
    if not file_path.exists():
        # Fallback to legacy
        file_path = PROJECTS_DIR / safe_filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Project not found")"""

r_get = """@router.get("/projects/{filename}")
async def get_project(filename: str):
    file_path = find_project_file(filename)
    if not file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail="Project not found")"""

content = content.replace(t_get, r_get)

t_del = """@router.delete("/projects/{filename}")
async def delete_project_endpoint(filename: str):
    sanitized_name = sanitize_project_name(filename)
    safe_filename = f"{sanitized_name}.json"
    scene_dir_name = format_scene_folder_name(sanitized_name)
    
    file_path = ASSETS_DIR / scene_dir_name / safe_filename
    if not file_path.exists():
        file_path = PROJECTS_DIR / safe_filename
        
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Project not found")
    try:
        file_path.unlink()
        
        # Optional: attempt to remove scene directory if empty?
        # Leaving that out for safety.
        
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))"""

r_del = """@router.delete("/projects/{filename}")
async def delete_project_endpoint(filename: str):
    file_path = find_project_file(filename)
    if not file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail="Project not found")
    try:
        parent_dir = file_path.parent
        file_path.unlink()
        
        # Optional: attempt to remove scene directory if empty
        if parent_dir != ASSETS_DIR and parent_dir != PROJECTS_DIR:
            try:
                parent_dir.rmdir()
            except Exception:
                pass # Not empty or cannot remove
        
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))"""

content = content.replace(t_del, r_del)

t_export = """@router.get("/projects/{filename}/export")
async def export_project_zip(filename: str):
    clean_name = sanitize_project_name(filename)
    file_path = PROJECTS_DIR / f"{clean_name}.json\""""

r_export = """@router.get("/projects/{filename}/export")
async def export_project_zip(filename: str):
    file_path = find_project_file(filename)
    if not file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail="Project not found")"""
content = content.replace(t_export, r_export)

t_export2 = """@router.get("/projects/{filename}/export")
async def export_project_zip(filename: str):
    clean_name = sanitize_project_name(filename)
    file_path = PROJECTS_DIR / f"{clean_name}.json\"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Project not found")"""
content = content.replace(t_export2, r_export)

with open("backend/routes/api.py", "w") as f:
    f.write(content)
