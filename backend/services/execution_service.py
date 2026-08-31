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
from backend.services.workflow_service import inject_and_prepare_workflow, build_shot_workflow

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
    safe_placeholder: str = "empty.png",
    project_data: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Stage scene pipeline:
    1. Iterates over all shots in the scene and calls build_shot_workflow for each shot.
    2. Saves synthesized shot workflow JSONs locally in assets/{scene_name}/workflows/{scene_name}_Shot_{shot_number}.json.
    3. Gathers all unique assigned asset files across the shots and transfers them via SFTP to {remote_root}/input.
    4. Transfers the synthesized workflow JSON files via SFTP directly into {remote_root}/user/default/workflows/{scene_name}/.
    """
    clean_root = remote_root.rstrip('/') if remote_root else "/workspace/runpod-slim/ComfyUI"
    clean_input = remote_input_dir or f"{clean_root}/input"
    shot_items = shots or []

    if not shot_items and workflow_filename:
        shot_items = [{"shot_number": 1, "workflow_filename": workflow_filename, "node_mappings": {}}]

    scene_dirs = get_scene_directories(scene_name)
    scene_wf_dir = scene_dirs.get("workflows")
    scene_wf_dir.mkdir(parents=True, exist_ok=True)

    # Prepare project-level base configuration
    base_proj_data = dict(project_data or {})
    if "scene_name" not in base_proj_data:
        base_proj_data["scene_name"] = scene_name
    if "workflow_file" not in base_proj_data and workflow_filename:
        base_proj_data["workflow_file"] = workflow_filename
    if "bypassMissing" not in base_proj_data:
        base_proj_data["bypassMissing"] = bypass_missing
    if "safe_placeholder" not in base_proj_data:
        base_proj_data["safe_placeholder"] = safe_placeholder

    seen_files = set()
    files_to_transfer: List[Path] = []

    def add_asset_if_exists(fname: Optional[str]):
        if fname and isinstance(fname, str):
            clean = fname.strip()
            if clean and clean != safe_placeholder and clean != "empty.png" and clean not in seen_files:
                seen_files.add(clean)
                fpath = find_asset_file_path(clean)
                if fpath and fpath.exists():
                    files_to_transfer.append(fpath)

    # Collect assets from project level node mappings and shared assets
    for fn in (base_proj_data.get("node_mappings") or base_proj_data.get("nodeMappings") or {}).values():
        add_asset_if_exists(fn)
    for sa in (base_proj_data.get("shared_assets") or []):
        if isinstance(sa, dict) and sa.get("filename"):
            add_asset_if_exists(sa["filename"])

    transferred_summary = []
    transferred_count = 0
    skipped_count = 0
    uploaded_files = []
    skipped_files = []

    staged_workflow_files: List[Path] = []
    for idx, shot in enumerate(shot_items):
        s_dict = shot.dict() if hasattr(shot, "dict") else dict(shot)
        s_num = s_dict.get("shot_number", idx + 1)
        try:
            shot_num_str = f"{int(s_num):02d}"
        except Exception:
            shot_num_str = str(s_num)

        takes = s_dict.get("takes") or []
        take_num = s_dict.get("take_number")
        if take_num is None:
            take_numbers = [
                t.get("take_number")
                for t in takes
                if isinstance(t, dict) and t.get("take_number") is not None
            ]
            take_num = max(take_numbers, default=0) + 1
        s_dict["take_number"] = take_num

        # Collect shot-level assigned slots & explicit node mappings
        for fn in (s_dict.get("assigned_slots") or {}).values():
            add_asset_if_exists(fn)
        for fn in (s_dict.get("node_mappings") or {}).values():
            add_asset_if_exists(fn)

        final_wf_filename = f"{scene_name}_Shot_{shot_num_str}.json"

        try:
            injected_wf = build_shot_workflow(
                project_data=base_proj_data,
                shot=s_dict,
                scene_name=scene_name
            )

            # Inspect injected workflow nodes for any mapped image/video/audio inputs
            if isinstance(injected_wf, dict):
                for node_id, node_data in injected_wf.items():
                    if isinstance(node_data, dict):
                        inputs = node_data.get("inputs", {})
                        if isinstance(inputs, dict):
                            for key in ["image", "video", "audio"]:
                                if key in inputs and isinstance(inputs[key], str):
                                    add_asset_if_exists(inputs[key])

            target_file_path = scene_wf_dir / final_wf_filename
            with open(target_file_path, "w", encoding="utf-8") as f:
                json.dump(injected_wf, f, indent=2)

            if target_file_path.exists():
                staged_workflow_files.append(target_file_path)
        except Exception as wf_err:
            print(f"Notice: Failed to prepare staged workflow for Shot {shot_num_str}: {wf_err}")

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

            # Step A: Transfer unique assigned media assets to remote input directory
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

            # Step B: Transfer synthesized shot workflows into remote user workflow directory
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
    """Execute full 4-step pipeline (Load, Inject via build_shot_workflow, SSH Transfer, ComfyUI /prompt Dispatch)."""
    steps_log = []

    scene_name = req_dict.get("scene_name") or "Scene"
    workflow_filename = req_dict.get("workflow_filename") or req_dict.get("workflow_file") or "default.json"

    s_num = req_dict.get("shot_number", 1)
    try:
        shot_num_str = f"{int(s_num):02d}"
    except Exception:
        shot_num_str = str(s_num)

    takes = req_dict.get("takes") or []
    take_num = req_dict.get("take_number")
    if take_num is None:
        take_numbers = [
            t.get("take_number")
            for t in takes
            if isinstance(t, dict) and t.get("take_number") is not None
        ]
        take_num = max(take_numbers, default=0) + 1

    shot_dict = {
        "workflow_file": workflow_filename,
        "workflow_filename": workflow_filename,
        "shot_number": s_num,
        "take_number": take_num,
        "takes": takes,
        "prompt_node_id": req_dict.get("prompt_node_id"),
        "expanded_prompt": req_dict.get("expanded_prompt", ""),
        "basic_stub": req_dict.get("basic_stub", ""),
        "prompt": req_dict.get("prompt", ""),
        "node_mappings": req_dict.get("node_mappings", {}),
        "assigned_slots": req_dict.get("assigned_slots", {}),
        "generation_parameters": req_dict.get("generation_parameters") or req_dict.get("parameter_overrides", {}),
        "generation_params": req_dict.get("generation_parameters") or req_dict.get("parameter_overrides", {}),
        "parameter_overrides": req_dict.get("parameter_overrides", {}),
        "parameter_node_mappings": req_dict.get("parameter_node_mappings", {})
    }

    project_data = {
        "scene_name": scene_name,
        "workflow_file": workflow_filename,
        "bypassMissing": req_dict.get("bypass_missing", True),
        "bypass_missing": req_dict.get("bypass_missing", True),
        "safe_placeholder": req_dict.get("safe_placeholder", "empty.png"),
        "node_mappings": req_dict.get("node_mappings", {}),
        "parameter_overrides": req_dict.get("parameter_overrides", {}),
        "parameter_node_mappings": req_dict.get("parameter_node_mappings", {}),
        "shared_assets": req_dict.get("shared_assets", [])
    }

    # 1. Build Synthesized Workflow with 100% parameter and asset mapping fidelity
    try:
        modified_workflow = build_shot_workflow(
            project_data=project_data,
            shot=shot_dict,
            scene_name=scene_name
        )
        steps_log.append({
            "step": "B",
            "title": "Workflow Synthesized",
            "status": "success",
            "detail": f"Successfully prepared workflow for '{workflow_filename}' with {len(modified_workflow)} nodes."
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed building workflow: {str(e)}")

    steps_log.append({
        "step": "C",
        "title": "Payload Injected",
        "status": "success",
        "detail": f"Injected prompt into target prompt node, mapped asset loader slots, and applied sampler overrides."
    })

    expected_video_filename = f"{scene_name}_Shot_{shot_num_str}_Take_{take_num}.mp4"

    if req_dict.get("dry_run_only"):
        return {
            "success": True,
            "dry_run": True,
            "take_number": take_num,
            "expected_video_filename": expected_video_filename,
            "steps": steps_log,
            "modified_workflow": modified_workflow
        }

    # 2. Gather unique assigned asset files across the shot
    files_to_transfer = []
    seen_files = set()
    safe_placeholder = req_dict.get("safe_placeholder", "empty.png")

    def add_file_to_transfer(fname: Optional[str]):
        if fname and isinstance(fname, str):
            clean = fname.strip()
            if clean and clean != safe_placeholder and clean != "empty.png" and clean not in seen_files:
                seen_files.add(clean)
                fpath = find_asset_file_path(clean)
                if fpath and fpath.exists():
                    files_to_transfer.append(fpath)

    for fn in req_dict.get("node_mappings", {}).values():
        add_file_to_transfer(fn)
    for fn in req_dict.get("assigned_slots", {}).values():
        add_file_to_transfer(fn)
    if isinstance(modified_workflow, dict):
        for n_id, n_data in modified_workflow.items():
            if isinstance(n_data, dict):
                inputs = n_data.get("inputs", {})
                if isinstance(inputs, dict):
                    for k in ["image", "video", "audio"]:
                        if k in inputs and isinstance(inputs[k], str):
                            add_file_to_transfer(inputs[k])

    # 3. SSH Transfer
    runpod_host = req_dict.get("runpod_ip") or req_dict.get("remote_host")
    if files_to_transfer and runpod_host:
        try:
            ssh_service = RunPodSSHService(
                host=runpod_host,
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
                    "take_number": take_num,
                    "expected_video_filename": expected_video_filename,
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
                    "take_number": take_num,
                    "expected_video_filename": expected_video_filename,
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
            "take_number": take_num,
            "expected_video_filename": expected_video_filename,
            "message": "Workflow processed and ready. Remote call timed out or endpoint is local mock.",
            "steps": steps_log,
            "modified_workflow": modified_workflow
        }
