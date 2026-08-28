import os
import sys

with open("backend/routes/api.py", "r") as f:
    content = f.read()

content = content.replace(
    "WORKFLOWS_DIR",
    "WORKFLOWS_DIR,\n    PROJECTS_DIR,\n    TMP_UPLOAD_DIR"
)

new_routes = """
import time
import shutil
import json

class ProjectSaveRequest(BaseModel):
    filename: str
    data: dict

@router.post("/projects")
async def save_project(req: ProjectSaveRequest):
    sanitized_name = "".join(c for c in req.filename if c.isalnum() or c in ("_", "-"))
    final_filename = sanitized_name[:-5] + ".json" if sanitized_name.endswith("_json") else (sanitized_name if sanitized_name.endswith(".json") else f"{sanitized_name}.json")
    file_path = PROJECTS_DIR / final_filename
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(req.data, f, indent=2)
    return {"success": True, "filename": final_filename}

@router.get("/projects")
async def list_projects():
    if not PROJECTS_DIR.exists():
        return {"projects": []}
    files = [f.name for f in PROJECTS_DIR.glob("*.json")]
    return {"projects": files}

@router.get("/projects/{filename}")
async def get_project(filename: str):
    safe_filename = filename if filename.endswith(".json") else f"{filename}.json"
    file_path = PROJECTS_DIR / safe_filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Project not found")
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)

@router.post("/assets/upload_chunk")
async def upload_chunk(
    file: UploadFile = File(...),
    upload_id: str = Form(...),
    chunk_index: int = Form(...),
    total_chunks: int = Form(...),
    original_name: str = Form(...),
    media_type: str = Form("image"),
    type: str = Form("headshot"),
    subject_name: str = Form("subject"),
    description: str = Form("")
):
    temp_assembly_path = TMP_UPLOAD_DIR / upload_id
    
    # Append chunk
    content = await file.read()
    with open(temp_assembly_path, "ab") as f:
        f.write(content)
        
    if chunk_index == total_chunks - 1:
        # Final chunk, assemble and finalize
        target_filename = generate_target_filename(type, subject_name, original_name)
        destination_path = UPLOADS_DIR / target_filename
        
        # Move the fully assembled file
        shutil.copyfile(temp_assembly_path, destination_path)
        size_bytes = os.path.getsize(temp_assembly_path)
        os.remove(temp_assembly_path)
        
        asset_record = {
            "id": target_filename,
            "original_name": original_name,
            "filename": target_filename,
            "media_type": media_type,
            "type": type,
            "subject_name": subject_name,
            "description": description,
            "size_bytes": size_bytes,
            "path": str(destination_path),
            "preview_url": f"/assets/uploads/{target_filename}"
        }
        in_memory_asset_metadata.append(asset_record)
        return {"success": True, "asset": asset_record}
        
    return {"success": True, "message": "chunk received"}
"""

content = content + "\n" + new_routes

with open("backend/routes/api.py", "w") as f:
    f.write(content)

print("Patched api.py")
