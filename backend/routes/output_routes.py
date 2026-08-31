import os
import httpx
import mimetypes
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter()

class OutputPullRequest(BaseModel):
    scene_name: str
    filename: str
    subfolder: Optional[str] = None
    comfyui_api_url: str

class ReviewUpdateRequest(BaseModel):
    scene_name: str
    filename: str
    status: str

@router.post("/outputs/pull")
async def pull_output(req: OutputPullRequest):
    safe_scene_name = "".join([c for c in req.scene_name if c.isalnum() or c in ("-", "_")])
    output_dir = os.path.join("assets", safe_scene_name, "outputs")
    os.makedirs(output_dir, exist_ok=True)
    
    file_path = os.path.join(output_dir, req.filename)
    
    base_url = req.comfyui_api_url.rstrip("/")
    download_url = f"{base_url}/view?filename={req.filename}&type=output"
    if req.subfolder:
        download_url += f"&subfolder={req.subfolder}"
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(download_url)
            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code, detail="Failed to download output from ComfyUI")
            with open(file_path, "wb") as f:
                f.write(resp.content)
        return {"status": "success", "filename": req.filename, "path": file_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/outputs")
async def list_outputs(scene_name: str):
    safe_scene_name = "".join([c for c in scene_name if c.isalnum() or c in ("-", "_")])
    output_dir = os.path.join("assets", safe_scene_name, "outputs")
    
    if not os.path.exists(output_dir):
        return []
    
    files = []
    for f in os.listdir(output_dir):
        if os.path.isfile(os.path.join(output_dir, f)):
            if f.endswith('.json'):
                continue
            files.append(f)
    # Sort files by modification time, newest first
    files.sort(key=lambda x: os.path.getmtime(os.path.join(output_dir, x)), reverse=True)
    return files

@router.get("/outputs/stream/{scene_name}/{filename}")
async def stream_output(request: Request, scene_name: str, filename: str):
    safe_scene_name = "".join([c for c in scene_name if c.isalnum() or c in ("-", "_")])
    file_path = os.path.join("assets", safe_scene_name, "outputs", filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    file_size = os.path.getsize(file_path)
    
    content_type, _ = mimetypes.guess_type(file_path)
    if not content_type:
        content_type = "application/octet-stream"
        
    range_header = request.headers.get('Range', None)
    if range_header:
        byte_range = range_header.strip().split('=')[-1]
        start_str, end_str = byte_range.split('-')
        start = int(start_str)
        end = int(end_str) if end_str else file_size - 1
        length = end - start + 1

        with open(file_path, 'rb') as f:
            f.seek(start)
            data = f.read(length)

        headers = {
            'Content-Range': f'bytes {start}-{end}/{file_size}',
            'Accept-Ranges': 'bytes',
            'Content-Length': str(length),
            'Content-Type': content_type,
        }
        return Response(content=data, status_code=206, headers=headers)
    else:
        return FileResponse(file_path, media_type=content_type, headers={'Accept-Ranges': 'bytes'})

import json

@router.post("/outputs/review")
async def update_review_status(req: ReviewUpdateRequest):
    safe_scene_name = "".join([c for c in req.scene_name if c.isalnum() or c in ("-", "_")])
    output_dir = os.path.join("assets", safe_scene_name, "outputs")
    os.makedirs(output_dir, exist_ok=True)
    
    metadata_file = os.path.join(output_dir, "qa_status.json")
    metadata = {}
    if os.path.exists(metadata_file):
        try:
            with open(metadata_file, "r") as f:
                metadata = json.load(f)
        except:
            pass
            
    metadata[req.filename] = req.status
    
    with open(metadata_file, "w") as f:
        json.dump(metadata, f, indent=2)
        
    return {"status": "success"}

@router.get("/outputs/reviews")
async def get_reviews(scene_name: str):
    safe_scene_name = "".join([c for c in scene_name if c.isalnum() or c in ("-", "_")])
    metadata_file = os.path.join("assets", safe_scene_name, "outputs", "qa_status.json")
    
    if os.path.exists(metadata_file):
        try:
            with open(metadata_file, "r") as f:
                return json.load(f)
        except:
            pass
    return {}
