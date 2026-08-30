import re

with open("backend/utils/file_handlers.py", "r") as f:
    content = f.read()

find_fn = """
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

def sanitize_project_name"""

content = content.replace("def sanitize_project_name", find_fn)

with open("backend/utils/file_handlers.py", "w") as f:
    f.write(content)
