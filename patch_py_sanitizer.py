import re

with open("backend/utils/file_handlers.py", "r") as f:
    content = f.read()

target = """def format_scene_folder_name(scene_name: Optional[str] = "scene01") -> str:"""

replacement = """def sanitize_project_name(name: str) -> str:
    if not name:
        return "project"
    clean = name.strip()
    if clean.lower().endswith(".json"):
        clean = clean[:-5]
    clean = re.sub(r'[^a-z0-9_-]', '_', clean.lower())
    clean = re.sub(r'_+', '_', clean).strip('_')
    return clean or "project"

def format_scene_folder_name(scene_name: Optional[str] = "scene01") -> str:"""

content = content.replace(target, replacement)

with open("backend/utils/file_handlers.py", "w") as f:
    f.write(content)
