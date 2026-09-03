import json
from typing import Dict
from fastapi import APIRouter, UploadFile, File, HTTPException
from backend.utils.file_handlers import list_workflows, load_workflow_json, save_workflow_json
from backend.services.workflow_service import inspect_workflow_nodes

router = APIRouter(tags=["Workflows"])

@router.get("/workflows")
async def get_workflows():
    """List all available ComfyUI workflow JSON files."""
    return {"workflows": list_workflows()}

@router.post("/workflows/upload")
async def upload_workflow(file: UploadFile = File(...)):
    """Upload a new workflow_api.json file."""
    if not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Only .json files are supported.")
    
    content = await file.read()
    try:
        data = json.loads(content.decode("utf-8"))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")

    filename = await save_workflow_json(file.filename, data)
    return {"success": True, "filename": filename, "nodes": len(data) if isinstance(data, dict) else 0}

@router.post("/workflows/parse")
async def parse_workflow(payload: Dict[str, str]):
    """Parse workflow JSON to identify prompt nodes and media loader nodes."""
    filename = payload.get("filename")
    scene_name = payload.get("scene_name")
    if not filename:
        raise HTTPException(status_code=400, detail="Filename is required")
    
    data = load_workflow_json(filename, scene_name=scene_name)
    nodes_info = inspect_workflow_nodes(data)
    return {
        "filename": filename,
        "nodes_info": nodes_info,
        "raw_json": data,
        "workflow": data,
        "raw_workflow": data,
        "detected_nodes": nodes_info.get("detected_nodes"),
        "detected_values": nodes_info.get("detected_values")
    }
