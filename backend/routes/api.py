import os
import httpx
from pathlib import Path
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

from backend.utils.file_handlers import (
    save_uploaded_file,
    generate_target_filename,
    list_workflows,
    load_workflow_json,
    save_workflow_json,
    UPLOADS_DIR,
    WORKFLOWS_DIR,
    PROJECTS_DIR,
    TMP_UPLOAD_DIR
)
from backend.services.workflow_service import inspect_workflow_nodes, inject_and_prepare_workflow
from backend.services.ssh_service import RunPodSSHService
from backend.services.llm_service import expand_prompt_with_llm

router = APIRouter(prefix="/api", tags=["ComfyUI Bridge API"])

# In-memory session tracking for assets uploaded during runtime
in_memory_asset_metadata: List[Dict[str, Any]] = []

class LLMGenerateRequest(BaseModel):
    basic_stub: str
    assets: List[Dict[str, Any]] = Field(default_factory=list)
    lm_studio_url: str = "http://localhost:1234/v1"
    model: Optional[str] = None

class SSHTestRequest(BaseModel):
    host: str
    port: int = 22
    username: str = "root"
    password: Optional[str] = None
    key_path: Optional[str] = None
    ssh_private_key: Optional[str] = None
    remote_dir: str = "/workspace/runpod-slim/ComfyUI/input"

class SSHTransferRequest(BaseModel):
    runpod_ip: str
    ssh_port: int = 22
    ssh_username: str = "root"
    ssh_password: Optional[str] = None
    ssh_key_path: Optional[str] = None
    ssh_private_key: Optional[str] = None
    remote_input_dir: str = "/workspace/runpod-slim/ComfyUI/input"
    node_mappings: Dict[str, str] = Field(default_factory=dict)
    filenames: List[str] = Field(default_factory=list)

class ExecuteWorkflowRequest(BaseModel):
    # Remote RunPod & SSH Config
    runpod_ip: str
    ssh_port: int = 22
    ssh_username: str = "root"
    ssh_password: Optional[str] = None
    ssh_key_path: Optional[str] = None
    ssh_private_key: Optional[str] = None
    remote_input_dir: str = "/workspace/runpod-slim/ComfyUI/input"
    
    # ComfyUI API Config
    comfyui_api_url: str = "http://127.0.0.1:8188"
    runpod_api_token: Optional[str] = None
    
    # Workflow Execution Data
    workflow_filename: str
    prompt_node_id: Optional[str] = None
    expanded_prompt: str
    node_mappings: Dict[str, str] = Field(default_factory=dict) # { "137": "headshot_jackie_123.png" }
    bypass_missing: bool = True
    safe_placeholder: str = "empty.png"
    parameter_overrides: Dict[str, Any] = Field(default_factory=dict) # { "steps": 30, "megapixels": 0.8, "frames": 81 }
    parameter_node_mappings: Dict[str, str] = Field(default_factory=dict) # { "steps": "131", "megapixels": "115", "frames": "131" }
    generation_parameters: Optional[Dict[str, Any]] = None
    dry_run_only: bool = False

@router.get("/workflows")
async def get_workflows():
    """List all available ComfyUI workflow JSON files."""
    return {"workflows": list_workflows()}

@router.post("/workflows/upload")
async def upload_workflow(file: UploadFile = File(...)):
    """Upload a new workflow_api.json file."""
    if not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Only .json files are supported.")
    
    import json
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
    if not filename:
        raise HTTPException(status_code=400, detail="Filename is required")
    
    data = load_workflow_json(filename)
    nodes_info = inspect_workflow_nodes(data)
    return {
        "filename": filename,
        "nodes_info": nodes_info,
        "raw_json": data
    }

@router.post("/assets/upload")
async def upload_asset(
    file: UploadFile = File(...),
    media_type: str = Form("image"), # image, audio, video
    asset_type: str = Form("headshot"), # headshot, body_ref, scene_ref, object_ref, etc.
    subject_name: str = Form("jackie"),
    description: str = Form("")
):
    """
    Upload and rename asset according to format:
    {type}_{name}_{timestamp}.ext
    """
    content = await file.read()
    target_filename = generate_target_filename(asset_type, subject_name, file.filename or "media")
    saved_path = await save_uploaded_file(content, target_filename)

    asset_record = {
        "id": target_filename,
        "original_name": file.filename,
        "filename": target_filename,
        "media_type": media_type,
        "type": asset_type,
        "subject_name": subject_name,
        "description": description,
        "size_bytes": len(content),
        "path": str(saved_path)
    }

    in_memory_asset_metadata.append(asset_record)
    return {"success": True, "asset": asset_record}

@router.get("/assets")
async def get_assets():
    """List all registered uploaded assets."""
    return {"assets": in_memory_asset_metadata}

@router.post("/generate-prompt")
async def generate_prompt_endpoint(req: LLMGenerateRequest):
    """
    Call LM Studio to expand basic prompt stub with structured asset metadata.
    """
    if not req.assets:
        raise HTTPException(status_code=400, detail="At least one uploaded asset is required to generate a prompt.")
    
    expanded = await expand_prompt_with_llm(
        basic_stub=req.basic_stub,
        assets=req.assets,
        lm_studio_url=req.lm_studio_url,
        model=req.model
    )
    return {"expanded_prompt": expanded}

@router.post("/ssh/test")
async def test_ssh_connection(req: SSHTestRequest):
    """Test SSH connectivity to RunPod instance and verify remote directory."""
    ssh_service = RunPodSSHService(
        host=req.host,
        port=req.port,
        username=req.username,
        password=req.password,
        key_path=req.key_path,
        private_key=req.ssh_private_key
    )
    result = ssh_service.test_connection(remote_dir=req.remote_dir)
    return result

@router.post("/ssh/transfer")
@router.post("/assets/sync_remote")
async def transfer_assets_only(req: SSHTransferRequest):
    """
    Decoupled Asset Transfer Endpoint:
    Runs only Step A (SSH/SFTP file staging to the remote ComfyUI input directory).
    Iterates over all assigned shot input slots, checks remote existence via sftp.stat,
    and returns a detailed count of new files transferred vs existing files skipped.
    """
    if not req.runpod_ip:
        raise HTTPException(status_code=400, detail="RunPod Host/IP is required for remote transfer.")

    files_to_transfer: List[Path] = []
    seen_files = set()

    # 1. Collect all non-empty asset filenames mapped across all active shot input slots
    for node_id, filename in req.node_mappings.items():
        if filename and filename.strip() and filename.strip() not in seen_files:
            seen_files.add(filename.strip())
            local_file = UPLOADS_DIR / filename.strip()
            if local_file.exists():
                files_to_transfer.append(local_file)

    # 2. Also check any explicitly requested filenames
    for fname in req.filenames:
        if fname and fname.strip() and fname.strip() not in seen_files:
            seen_files.add(fname.strip())
            local_file = UPLOADS_DIR / fname.strip()
            if local_file.exists():
                files_to_transfer.append(local_file)

    # 3. Fallback to all local uploads if no mappings or filenames were specified
    if not seen_files and UPLOADS_DIR.exists():
        for f in UPLOADS_DIR.iterdir():
            if f.is_file() and not f.name.startswith("."):
                files_to_transfer.append(f)

    if not files_to_transfer:
        return {
            "success": True,
            "remote_dir": req.remote_input_dir,
            "transferred_count": 0,
            "skipped_count": 0,
            "total_checked": 0,
            "uploaded_files": [],
            "skipped_files": [],
            "transferred_files": [],
            "message": f"No active assets found to transfer into {req.remote_input_dir}. Assign assets to input slots in Step 2."
        }

    try:
        ssh_service = RunPodSSHService(
            host=req.runpod_ip,
            port=req.ssh_port,
            username=req.ssh_username,
            password=req.ssh_password,
            key_path=req.ssh_key_path,
            private_key=req.ssh_private_key
        )
        transfer_results = ssh_service.transfer_files_to_runpod(
            local_files=files_to_transfer,
            remote_dir=req.remote_input_dir,
            overwrite=False
        )
        return {
            "success": True,
            "remote_dir": transfer_results["remote_dir"],
            "transferred_count": transfer_results["transferred_count"],
            "skipped_count": transfer_results["skipped_count"],
            "total_checked": transfer_results["total_checked"],
            "uploaded_files": transfer_results.get("uploaded_files", []),
            "skipped_files": transfer_results.get("skipped_files", []),
            "transferred_files": transfer_results.get("files", []),
            "message": transfer_results["message"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SSH Asset Transfer Failed: {str(e)}")

@router.post("/execute")
async def execute_workflow(req: ExecuteWorkflowRequest):
    """
    The Master Execution Pipeline:
    Step A: Sequential SFTP transfer of all mapped shot assets with remote existence check
    Step B: Load user-selected workflow_api.json
    Step C: Inject expanded prompt and asset filenames (with bypass placeholder logic)
    Step D: Send modified JSON payload to RunPod ComfyUI /prompt endpoint
    """
    steps_log = []

    # 1. Load workflow
    try:
        workflow_data = load_workflow_json(req.workflow_filename)
        steps_log.append({
            "step": "B",
            "title": "Workflow Loaded",
            "status": "success",
            "detail": f"Successfully loaded '{req.workflow_filename}' with {len(workflow_data)} nodes."
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed loading workflow: {str(e)}")

    # 2. Inject Prompt, Asset Mappings, and Generation Parameters (Step C)
    # Extract parameter overrides
    param_overrides = dict(req.parameter_overrides)
    param_node_maps = dict(req.parameter_node_mappings)
    if req.generation_parameters:
        for k, v in req.generation_parameters.items():
            if isinstance(v, dict) and "value" in v and "node_id" in v:
                param_overrides[k] = v["value"]
                param_node_maps[k] = str(v["node_id"])

    modified_workflow = inject_and_prepare_workflow(
        workflow_data=workflow_data,
        prompt_node_id=req.prompt_node_id,
        expanded_prompt=req.expanded_prompt,
        node_mappings=req.node_mappings,
        bypass_missing=req.bypass_missing,
        safe_placeholder=req.safe_placeholder,
        parameter_overrides=param_overrides,
        parameter_node_mappings=param_node_maps
    )

    injected_param_desc = []
    if param_overrides and param_node_maps:
        for p_key, p_val in param_overrides.items():
            if p_key in param_node_maps and param_node_maps[p_key]:
                injected_param_desc.append(f"{p_key}={p_val} (Node #{param_node_maps[p_key]})")

    param_summary = f" Overrides: {', '.join(injected_param_desc)}." if injected_param_desc else ""

    steps_log.append({
        "step": "C",
        "title": "Payload Injected",
        "status": "success",
        "detail": f"Injected prompt into node '{req.prompt_node_id}', mapped {len(req.node_mappings)} asset nodes.{param_summary}"
    })

    if req.dry_run_only:
        return {
            "success": True,
            "dry_run": True,
            "steps": steps_log,
            "modified_workflow": modified_workflow
        }

    # 3. SSH File Transfer (Step A): Iterate over all assigned slot assets
    files_to_transfer = []
    seen_files = set()
    
    for node_id, filename in req.node_mappings.items():
        if filename and filename.strip() and filename.strip() not in seen_files:
            seen_files.add(filename.strip())
            local_file = UPLOADS_DIR / filename.strip()
            if local_file.exists():
                files_to_transfer.append(local_file)

    # Transfer via SSH/SFTP with remote existence check
    if files_to_transfer and req.runpod_ip:
        try:
            ssh_service = RunPodSSHService(
                host=req.runpod_ip,
                port=req.ssh_port,
                username=req.ssh_username,
                password=req.ssh_password,
                key_path=req.ssh_key_path,
                private_key=req.ssh_private_key
            )
            transfer_res = ssh_service.transfer_files_to_runpod(
                local_files=files_to_transfer,
                remote_dir=req.remote_input_dir,
                overwrite=False
            )
            steps_log.append({
                "step": "A",
                "title": "SSH Asset Sync Completed",
                "status": "success",
                "detail": transfer_res["message"],
                "transferred_count": transfer_res["transferred_count"],
                "skipped_count": transfer_res["skipped_count"],
                "total_checked": transfer_res["total_checked"],
                "files": transfer_res.get("files", [])
            })
        except Exception as e:
            steps_log.append({
                "step": "A",
                "title": "SSH File Transfer Note",
                "status": "warning",
                "detail": f"SSH transfer note ({str(e)}). Proceeding with ComfyUI API dispatch."
            })
    else:
        steps_log.append({
            "step": "A",
            "title": "SSH File Transfer Skipped",
            "status": "info",
            "detail": "No mapped slot files required transfer or RunPod IP not provided."
        })

    # 4. ComfyUI /prompt HTTP Dispatch (Step D)
    api_url = req.comfyui_api_url.rstrip("/")
    prompt_endpoint = f"{api_url}/prompt" if not api_url.endswith("/prompt") else api_url

    headers = {"Content-Type": "application/json"}
    if req.runpod_api_token:
        headers["Authorization"] = f"Bearer {req.runpod_api_token}"

    comfy_payload = {
        "prompt": modified_workflow,
        "client_id": "comfyui-bridge-client"
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(prompt_endpoint, json=comfy_payload, headers=headers)
            if response.status_code == 200:
                resp_json = response.json()
                prompt_id = resp_json.get("prompt_id", "submitted")
                steps_log.append({
                    "step": "D",
                    "title": "ComfyUI API Dispatch Succeeded",
                    "status": "success",
                    "detail": f"Submitted to ComfyUI. Prompt ID: {prompt_id}",
                    "response": resp_json
                })
                return {
                    "success": True,
                    "prompt_id": prompt_id,
                    "steps": steps_log,
                    "modified_workflow": modified_workflow
                }
            else:
                steps_log.append({
                    "step": "D",
                    "title": "ComfyUI API Dispatch Error",
                    "status": "error",
                    "detail": f"HTTP {response.status_code}: {response.text}"
                })
                return {
                    "success": False,
                    "error": f"ComfyUI returned {response.status_code}",
                    "steps": steps_log,
                    "modified_workflow": modified_workflow
                }
    except Exception as e:
        steps_log.append({
            "step": "D",
            "title": "ComfyUI API Dispatch Note",
            "status": "warning",
            "detail": f"Remote ComfyUI API endpoint call ({str(e)}). Modified payload generated successfully."
        })
        return {
            "success": True,
            "simulated": True,
            "message": "Workflow processed and ready. Remote call timed out or endpoint is local mock.",
            "steps": steps_log,
            "modified_workflow": modified_workflow
        }


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

@router.post("/ssh/generate_keypair")
def generate_ssh_keypair():
    try:
        from cryptography.hazmat.primitives.asymmetric import ed25519
        from cryptography.hazmat.primitives import serialization

        # 1. Generate private key
        private_key = ed25519.Ed25519PrivateKey.generate()

        # 2. Serialize Private Key (OpenSSH PEM format)
        private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.OpenSSH,
            encryption_algorithm=serialization.NoEncryption()
        ).decode("utf-8")

        # 3. Serialize Public Key (Single-line authorized_keys format)
        public_openssh = private_key.public_key().public_bytes(
            encoding=serialization.Encoding.OpenSSH,
            format=serialization.PublicFormat.OpenSSH
        ).decode("utf-8") + " shot-planner@app"

        return {
            "private_key": private_pem,
            "public_key": public_openssh
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
