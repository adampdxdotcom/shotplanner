from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.services.ssh_service import RunPodSSHService
from backend.services.execution_service import (
    transfer_assets_to_remote,
    stage_scene_pipeline,
    execute_workflow_pipeline,
    generate_ed25519_keypair
)

router = APIRouter(tags=["Execution & Remote RunPod"])

class SSHTestRequest(BaseModel):
    host: str
    port: int = 22
    username: str = "root"
    password: Optional[str] = None
    key_path: Optional[str] = None
    ssh_private_key: Optional[str] = None
    remote_dir: str = "/workspace/runpod-slim/ComfyUI/input"

class SSHTransferRequest(BaseModel):
    runpod_ip: Optional[str] = None
    remote_host: Optional[str] = None
    ssh_port: int = 22
    ssh_username: str = "root"
    ssh_password: Optional[str] = None
    ssh_key_path: Optional[str] = None
    ssh_private_key: Optional[str] = None
    remote_input_dir: Optional[str] = None
    remote_comfyui_root: Optional[str] = None
    node_mappings: Dict[str, str] = Field(default_factory=dict)
    filenames: List[str] = Field(default_factory=list)

    class Config:
        extra = "allow"

class StageSceneShot(BaseModel):
    shot_number: Any = 1
    shot_type: Optional[str] = None
    camera_movement: Optional[str] = None
    expanded_prompt: Optional[str] = None
    prompt_node_id: Optional[str] = None
    node_mappings: Dict[str, str] = Field(default_factory=dict)
    workflow_filename: Optional[str] = None
    generation_parameters: Optional[Dict[str, Any]] = None
    parameter_node_mappings: Optional[Dict[str, str]] = None

    class Config:
        extra = "allow"

class StageSceneRequest(BaseModel):
    remote_host: Optional[str] = None
    runpod_ip: Optional[str] = None
    ssh_port: int = 22
    ssh_username: str = "root"
    ssh_password: Optional[str] = None
    ssh_key_path: Optional[str] = None
    ssh_private_key: Optional[str] = None
    remote_comfyui_root: Optional[str] = "/workspace/runpod-slim/ComfyUI"
    remote_input_dir: Optional[str] = None
    scene_name: Optional[str] = "Scene"
    workflow_filename: Optional[str] = None
    shots: List[StageSceneShot] = Field(default_factory=list)
    bypass_missing: bool = True
    safe_placeholder: str = "empty.png"
    project_data: Optional[Dict[str, Any]] = None

    class Config:
        extra = "allow"

class ExecuteWorkflowRequest(BaseModel):
    runpod_ip: Optional[str] = None
    remote_host: Optional[str] = None
    ssh_port: int = 22
    ssh_username: str = "root"
    ssh_password: Optional[str] = None
    ssh_key_path: Optional[str] = None
    ssh_private_key: Optional[str] = None
    remote_input_dir: str = "/workspace/runpod-slim/ComfyUI/input"
    comfyui_api_url: str = "http://127.0.0.1:8188"
    runpod_api_token: Optional[str] = None
    workflow_filename: str
    prompt_node_id: Optional[str] = None
    expanded_prompt: str
    node_mappings: Dict[str, str] = Field(default_factory=dict)
    assigned_slots: Dict[str, str] = Field(default_factory=dict)
    bypass_missing: bool = True
    safe_placeholder: str = "empty.png"
    parameter_overrides: Dict[str, Any] = Field(default_factory=dict)
    parameter_node_mappings: Dict[str, str] = Field(default_factory=dict)
    generation_parameters: Optional[Dict[str, Any]] = None
    dry_run_only: bool = False
    scene_name: Optional[str] = "Scene"
    shot_number: Optional[Any] = 1
    shared_assets: Optional[List[Any]] = None

    class Config:
        extra = "allow"

@router.post("/ssh/test")
async def test_ssh_connection(req: SSHTestRequest):
    """Test SSH connectivity to RunPod instance and verify remote input directory."""
    ssh_service = RunPodSSHService(
        host=req.host,
        port=req.port,
        username=req.username,
        password=req.password,
        key_path=req.key_path,
        private_key=req.ssh_private_key
    )
    return ssh_service.test_connection(remote_dir=req.remote_dir)

@router.post("/ssh/transfer")
@router.post("/assets/sync_remote")
async def transfer_assets_only(req: SSHTransferRequest):
    """Decoupled asset transfer to remote ComfyUI input directory."""
    host = req.runpod_ip or req.remote_host
    if not host:
        raise HTTPException(status_code=400, detail="RunPod Host/IP is required for remote transfer.")

    remote_dir = req.remote_input_dir
    if not remote_dir:
        if req.remote_comfyui_root:
            remote_dir = f"{req.remote_comfyui_root.rstrip('/')}/input"
        else:
            remote_dir = "/workspace/runpod-slim/ComfyUI/input"

    return transfer_assets_to_remote(
        host=host,
        port=req.ssh_port,
        username=req.ssh_username,
        password=req.ssh_password,
        key_path=req.ssh_key_path,
        private_key=req.ssh_private_key,
        remote_dir=remote_dir,
        node_mappings=req.node_mappings,
        filenames=req.filenames
    )

@router.post("/workflow/stage-scene")
@router.post("/workflow/stage")
@router.post("/ssh/transfer-scene")
async def stage_scene_endpoint(req: StageSceneRequest):
    """Stage all shots in a scene: asset transfer + workflow injection + staged upload."""
    host = req.runpod_ip or req.remote_host
    return stage_scene_pipeline(
        host=host,
        port=req.ssh_port,
        username=req.ssh_username,
        password=req.ssh_password,
        key_path=req.ssh_key_path,
        private_key=req.ssh_private_key,
        remote_root=req.remote_comfyui_root or "/workspace/runpod-slim/ComfyUI",
        remote_input_dir=req.remote_input_dir,
        scene_name=req.scene_name or "Scene",
        workflow_filename=req.workflow_filename,
        shots=req.shots,
        bypass_missing=req.bypass_missing,
        safe_placeholder=req.safe_placeholder,
        project_data=req.project_data
    )

@router.post("/execute")
async def execute_workflow(req: ExecuteWorkflowRequest):
    """Master Execution Pipeline (Step A, B, C, D)."""
    return await execute_workflow_pipeline(req.dict())

@router.post("/ssh/generate_keypair")
def generate_ssh_keypair():
    """Generate Ed25519 keypair for seamless RunPod authentication."""
    return generate_ed25519_keypair()
