from typing import Dict, Any
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse

from backend.services.project_service import (
    save_project_data,
    list_all_projects,
    get_project_data,
    delete_project_data,
    export_project_zip_buffer,
    extract_project_zip_buffer
)

router = APIRouter(tags=["Projects"])

@router.post("/projects")
async def save_project(req: Dict[str, Any]):
    """Save or update a project JSON file."""
    filename = save_project_data(req)
    return {"success": True, "filename": filename}

@router.get("/projects")
async def list_projects():
    """List all saved projects sorted by modification time."""
    return {"projects": list_all_projects()}

@router.get("/projects/{filename}")
async def get_project(filename: str):
    """Retrieve full project JSON configuration."""
    return get_project_data(filename)

@router.delete("/projects/{filename}")
async def delete_project_endpoint(filename: str):
    """Delete project JSON and remove its scene directory if isolated."""
    delete_project_data(filename)
    return {"success": True}

@router.get("/projects/{filename}/export")
async def export_project_zip(filename: str):
    """Export complete project archive as ZIP including synthesized shot workflows and full-res media."""
    zip_buffer = export_project_zip_buffer(filename)
    clean_name = filename[:-5] if filename.endswith(".json") else filename
    headers = {
        "Content-Disposition": f'attachment; filename="{clean_name}.zip"',
        "Content-Type": "application/zip"
    }
    return StreamingResponse(zip_buffer, media_type="application/zip", headers=headers)

@router.post("/projects/import")
async def import_project_zip(file: UploadFile = File(...)):
    """Import and unpack a project ZIP archive into scene directories using streamed extraction."""
    try:
        # file.file is a SpooledTemporaryFile streaming to disk/buffer, avoiding 500MB memory spikes
        imported_project = extract_project_zip_buffer(file.file)
        if not imported_project:
            raise HTTPException(status_code=400, detail="No project JSON found in zip archive")
        return {"success": True, "filename": imported_project}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to import ZIP archive: {str(e)}")
