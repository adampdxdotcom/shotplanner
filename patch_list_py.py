import re

with open("backend/routes/api.py", "r") as f:
    content = f.read()

target = """@router.get("/projects")
async def list_projects():
    if not PROJECTS_DIR.exists():
        return {"projects": []}
    files = [f.name for f in PROJECTS_DIR.glob("*.json")]
    return {"projects": files}"""

replacement = """@router.get("/projects")
async def list_projects():
    import os
    from datetime import datetime
    if not PROJECTS_DIR.exists():
        return {"projects": []}
    
    projects = []
    for f in PROJECTS_DIR.glob("*.json"):
        if f.is_file():
            stat = f.stat()
            mtime = datetime.fromtimestamp(stat.st_mtime).isoformat() + "Z"
            projects.append({
                "filename": f.name,
                "display_name": f.name[:-5] if f.name.endswith(".json") else f.name,
                "mtime": mtime,
                "size": stat.st_size
            })
            
    projects.sort(key=lambda x: x["mtime"], reverse=True)
    return {"projects": projects}"""

content = content.replace(target, replacement)

with open("backend/routes/api.py", "w") as f:
    f.write(content)
