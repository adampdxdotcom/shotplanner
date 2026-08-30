import re

with open("backend/routes/api.py", "r") as f:
    content = f.read()

# save_project
t_save = """async def save_project(req: Dict[str, Any]):
    raw_name = str(req.get("filename") or req.get("name") or (req.get("data", {}).get("scene_name") if isinstance(req.get("data"), dict) else None) or "project")
    
    # Strip existing .json suffix if present before sanitization
    if raw_name.lower().endswith(".json"):
        raw_name = raw_name[:-5]
        
    sanitized_name = "".join(c for c in raw_name if c.isalnum() or c in ("_", "-"))
    if not sanitized_name:
        sanitized_name = "project"
        
    final_filename = f"{sanitized_name}.json"
    file_path = PROJECTS_DIR / final_filename"""

r_save = """async def save_project(req: Dict[str, Any]):
    raw_name = str(req.get("filename") or req.get("name") or (req.get("data", {}).get("scene_name") if isinstance(req.get("data"), dict) else None) or "project")
    sanitized_name = sanitize_project_name(raw_name)
    final_filename = f"{sanitized_name}.json"
    file_path = PROJECTS_DIR / final_filename"""

content = content.replace(t_save, r_save)

# get_project
t_get = """async def get_project(filename: str):
    safe_filename = filename if filename.endswith(".json") else f"{filename}.json"
    file_path = PROJECTS_DIR / safe_filename"""
r_get = """async def get_project(filename: str):
    sanitized_name = sanitize_project_name(filename)
    safe_filename = f"{sanitized_name}.json"
    file_path = PROJECTS_DIR / safe_filename"""
content = content.replace(t_get, r_get)

# delete_project_endpoint
t_del = """async def delete_project_endpoint(filename: str):
    safe_filename = filename if filename.endswith(".json") else f"{filename}.json"
    file_path = PROJECTS_DIR / safe_filename"""
r_del = """async def delete_project_endpoint(filename: str):
    sanitized_name = sanitize_project_name(filename)
    safe_filename = f"{sanitized_name}.json"
    file_path = PROJECTS_DIR / safe_filename"""
content = content.replace(t_del, r_del)

# export_project_zip
t_export = """async def export_project_zip(filename: str):
    clean_name = filename
    if clean_name.lower().endswith(".json"):
        clean_name = clean_name[:-5]
    clean_name = "".join(c for c in clean_name if c.isalnum() or c in ("_", "-"))
    if not clean_name:
        clean_name = "project"
    file_path = PROJECTS_DIR / f"{clean_name}.json\""""
r_export = """async def export_project_zip(filename: str):
    clean_name = sanitize_project_name(filename)
    file_path = PROJECTS_DIR / f"{clean_name}.json\""""
content = content.replace(t_export, r_export)

with open("backend/routes/api.py", "w") as f:
    f.write(content)
