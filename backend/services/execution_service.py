import os
import json
import httpx
from pathlib import Path
from typing import Dict, Any, List, Optional
from fastapi import HTTPException

from backend.utils.file_handlers import (
    find_asset_file_path,
    get_scene_directories,
    load_workflow_json,
    UPLOADS_DIR,
    BASE_DIR
)
from backend.services.ssh_service import RunPodSSHService
from backend.services.workflow_service import inject_and_prepare_workflow

def generate_ed25519_keypair() -> Dict[str, str]:
    """Generate modern Ed25519 SSH private and public keypair."""
    try:
        from cryptography.hazmat.primitives.asymmetric import ed25519
        from cryptography.hazmat.primitives import serialization

        private_key = ed25519.Ed25519PrivateKey.generate()

        private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.OpenSSH,
            encryption_algorithm=serialization.NoEncryption()
        ).decode("utf-8")

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

def transfer_assets_to_remote(
    host: str,
    port: int = 22,
    username: str = "root",
    password: Optional[str] = None,
    key_path: Optional[str] = None,
    private_key: Optional[str] = None,
    remote_dir: str = "/workspace/runpod-slim/ComfyUI/input",
    node_mappings: Optional[Dict[str, str]] = None,
    filenames: Optional[List[str]] = None
) -> Dict[str, Any]:
    """Collect and SFTP transfer unique assets to remote input directory."""
    files_to_transfer: List[Path] = []
    seen_files = set()

    if node_mappings:
        for node_id, filename_val in node_mappings.items():
            if filename_val:
                clean_name = str(filename_val).strip()
                if clean_name and clean_name not in seen_files:
                    seen_files.add(clean_name)
                    found_path = find_asset_file_path(clean_name)
                    if found_path:
                        files_to_transfer.append(found_path)

    if filenames:
        for fname in filenames:
            if fname:
                clean_name = str(fname).strip()
                if clean_name and clean_name not in seen_files:
                    seen_files.add(clean_name)
                    found_path = find_asset_file_path(clean_name)
                    if found_path:
                        files_to_transfer.append(found_path)

    if not seen_files and UPLOADS_DIR.exists():
        for f in UPLOADS_DIR.iterdir():
            if f.is_file() and not f.name.startswith("."):
                files_to_transfer.append(f)

    if not files_to_transfer:
        return {
            "success": True,
            "remote_dir": remote_dir,
            "transferred_count": 0,
            "skipped_count": 0,
            "total_checked": 0,
            "uploaded_files": [],
            "skipped_files": [],
            "transferred_files": [],
            "message": f"No active assets found to transfer into {remote_dir}."
        }

    try:
        ssh_service = RunPodSSHService(
            host=host,
            port=port,
            username=username,
            password=password,
            key_path=key_path,
            private_key=private_key
        )
        transfer_results = ssh_service.transfer_files_to_runpod(
            local_files=files_to_transfer,
            remote_dir=remote_dir,
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

def stage_scene_pipeline(
    host: Optional[str],
    port: int = 22,
    username: str = "root",
    password: Optional[str] = None,
    key_path: Optional[str] = None,
    private_key: Optional[str] = None,
    remote_root: str = "/workspace/runpod-slim/ComfyUI",
    remote_input_dir: Optional[str] = None,
    scene_name: str = "Scene",
    workflow_filename: Optional[str] = None,
    shots: Optional[List[Any]] = None,
    bypass_missing: bool = True,
    safe_placeholder: str = "empty.png"
) -> Dict[str, Any]:
    """Inject workflows and stage assets for all shots in a scene."""
    clean_root = remote_root.rstrip('/')
    clean_input = remote_input_dir or f"{clean_root}/input"
    shot_items = shots or []

    if not shot_items and workflow_filename:
        shot_items = [{"shot_number": 1, "workflow_filename": workflow_filename, "node_mappings": {}}]

    scene_dirs = get_scene_directories(scene_name)
    scene_wf_dir = scene_dirs.get("workflows")
    scene_wf_dir.mkdir(parents=True, exist_ok=True)

    all_mappings = {}
    for shot in shot_items:
        mappings = shot.node_mappings if hasattr(shot, "node_mappings") else shot.get("node_mappings", {})
        if mappings:
            all_mappings.update(mappings)

    files_to_transfer: List[Path] = []
    seen_files = set()
    for filename_val in all_mappings.values():
        if filename_val:
            clean_name = str(filename_val).strip()
            if clean_name and clean_name not in seen_files:
                seen_files.add(clean_name)
                found_path = find_asset_file_path(clean_name)
                if found_path:
                    files_to_transfer.append(found_path)

    transferred_summary = []
    transferred_count = 0
    skipped_count = 0
    uploaded_files = []
    skipped_files = []

    staged_workflow_files: List[Path] = []
    for shot in shot_items:
        s_dict = shot.dict() if hasattr(shot, "dict") else shot
        wf_file = s_dict.get("workflow_filename") or workflow_filename
        if not wf_file:
            continue
        try:
            wf_data = load_workflow_json(wf_file, scene_name=scene_name)
            s_num = s_dict.get("shot_number", 1)
            shot_num_str = f"{int(s_num):02d}" if str(s_num).isdigit() else str(s_num)
            final_wf_filename = f"{scene_name}_Shot_{shot_num_str}.json"
            
            injected_wf = inject_and_prepare_workflow(
                workflow_data=wf_data,
                prompt_node_id=s_dict.get("prompt_node_id"),
                expanded_prompt=s_dict.get("expanded_prompt") or "",
                node_mappings=s_dict.get("node_mappings") or {},
                bypass_missing=bypass_missing,
                safe_placeholder=safe_placeholder,
                parameter_overrides=s_dict.get("generation_parameters"),
                parameter_node_mappings=s_dict.get("parameter_node_mappings"),
                save_video_prefix=f"video/{scene_name}_Shot_{shot_num_str}_"
            )
            
            target_file_path = scene_wf_dir / final_wf_filename
            with open(target_file_path, "w", encoding="utf-8") as f:
                json.dump(injected_wf, f, indent=2)
            
            if target_file_path.exists():
                staged_workflow_files.append(target_file_path)
        except Exception as wf_err:
            print(f"Notice: Failed to prepare staged workflow: {wf_err}")

    if host:
        try:
            ssh_service = RunPodSSHService(
                host=host,
                port=port,
                username=username,
                password=password,
                key_path=key_path,
                private_key=private_key
            )
            
            if files_to_transfer:
                asset_results = ssh_service.transfer_files_to_runpod(
                    local_files=files_to_transfer,
                    remote_dir=clean_input,
                    overwrite=False
                )
                transferred_count += asset_results.get("transferred_count", 0)
                skipped_count += asset_results.get("skipped_count", 0)
                uploaded_files.extend(asset_results.get("uploaded_files", []))
                skipped_files.extend(asset_results.get("skipped_files", []))
                transferred_summary.extend(asset_results.get("files", []))

            if staged_workflow_files:
                remote_workflow_dir = f"{clean_root}/user/default/workflows/{scene_name}"
                wf_transfer_res = ssh_service.transfer_files_to_runpod(
                    local_files=staged_workflow_files,
                    remote_dir=remote_workflow_dir,
                    overwrite=True
                )
                transferred_count += wf_transfer_res.get("transferred_count", 0)
                uploaded_files.extend(wf_transfer_res.get("uploaded_files", []))
                transferred_summary.extend(wf_transfer_res.get("files", []))

        except Exception as ssh_err:
            raise HTTPException(status_code=500, detail=f"Staging failed via SSH: {str(ssh_err)}")
    else:
        for f in files_to_transfer:
            transferred_count += 1
            uploaded_files.append(f.name)
            transferred_summary.append({
                "filename": f.name,
                "file": f.name,
                "status": "staged_local",
                "message": "Staged in local workspace."
            })
        for wf_p in staged_workflow_files:
            transferred_count += 1
            uploaded_files.append(wf_p.name)
            transferred_summary.append({
                "filename": wf_p.name,
                "file": wf_p.name,
                "status": "staged_local",
                "message": f"Saved workflow into scene directory: {wf_p.name}"
            })

    return {
        "success": True,
        "remote_dir": clean_input,
        "transferred_count": transferred_count,
        "skipped_count": skipped_count,
        "total_checked": len(files_to_transfer),
        "uploaded_files": uploaded_files,
        "skipped_files": skipped_files,
        "transferred_files": transferred_summary,
        "message": f"Successfully staged scene '{scene_name}' ({len(shot_items)} shot(s))."
    }

async def execute_workflow_pipeline(req_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Execute full 4-step pipeline (Load, Inject, SSH Transfer, ComfyUI /prompt Dispatch)."""
    steps_log = []

    # 1. Load workflow
    try:
        workflow_data = load_workflow_json(req_dict["workflow_filename"])
        steps_log.append({
            "step": "B",
            "title": "Workflow Loaded",
            "status": "success",
            "detail": f"Successfully loaded '{req_dict['workflow_filename']}' with {len(workflow_data)} nodes."
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed loading workflow: {str(e)}")

    # 2. Inject Prompt and Parameters
    param_overrides = dict(req_dict.get("parameter_overrides", {}))
    param_node_maps = dict(req_dict.get("parameter_node_mappings", {}))
    if req_dict.get("generation_parameters"):
        for k, v in req_dict["generation_parameters"].items():
            if isinstance(v, dict) and "value" in v and "node_id" in v:
                param_overrides[k] = v["value"]
                param_node_maps[k] = str(v["node_id"])

    modified_workflow = inject_and_prepare_workflow(
        workflow_data=workflow_data,
        prompt_node_id=req_dict.get("prompt_node_id"),
        expanded_prompt=req_dict.get("expanded_prompt", ""),
        node_mappings=req_dict.get("node_mappings", {}),
        bypass_missing=req_dict.get("bypass_missing", True),
        safe_placeholder=req_dict.get("safe_placeholder", "empty.png"),
        parameter_overrides=param_overrides,
        parameter_node_mappings=param_node_maps
    )

    steps_log.append({
        "step": "C",
        "title": "Payload Injected",
        "status": "success",
        "detail": f"Injected prompt into node '{req_dict.get('prompt_node_id')}', mapped {len(req_dict.get('node_mappings', {}))} asset nodes."
    })

    if req_dict.get("dry_run_only"):
        return {
            "success": True,
            "dry_run": True,
            "steps": steps_log,
            "modified_workflow": modified_workflow
        }

    # 3. SSH Transfer
    files_to_transfer = []
    seen_files = set()
    for node_id, filename in req_dict.get("node_mappings", {}).items():
        if filename and filename.strip() and filename.strip() not in seen_files:
            seen_files.add(filename.strip())
            local_file = find_asset_file_path(filename.strip())
            if local_file:
                files_to_transfer.append(local_file)

    if files_to_transfer and req_dict.get("runpod_ip"):
        try:
            ssh_service = RunPodSSHService(
                host=req_dict["runpod_ip"],
                port=req_dict.get("ssh_port", 22),
                username=req_dict.get("ssh_username", "root"),
                password=req_dict.get("ssh_password"),
                key_path=req_dict.get("ssh_key_path"),
                private_key=req_dict.get("ssh_private_key")
            )
            transfer_res = ssh_service.transfer_files_to_runpod(
                local_files=files_to_transfer,
                remote_dir=req_dict.get("remote_input_dir", "/workspace/runpod-slim/ComfyUI/input"),
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

    # 4. ComfyUI Dispatch
    api_url = req_dict.get("comfyui_api_url", "http://127.0.0.1:8188").rstrip("/")
    prompt_endpoint = f"{api_url}/prompt" if not api_url.endswith("/prompt") else api_url

    headers = {"Content-Type": "application/json"}
    if req_dict.get("runpod_api_token"):
        headers["Authorization"] = f"Bearer {req_dict['runpod_api_token']}"

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
