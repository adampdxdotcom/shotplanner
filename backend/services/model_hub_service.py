import os
import io
import re
import time
import posixpath
import paramiko
from pathlib import Path
from typing import Dict, Any, List, Optional
from backend.services.civitai_service import get_stored_civitai_key
from backend.services.huggingface_service import get_stored_huggingface_token

COMFYUI_MODEL_CATEGORIES = [
    {
        "id": "checkpoints",
        "label": "Checkpoints",
        "subfolder": "models/checkpoints/",
        "description": "Standard base models (SD 1.5, SDXL, Pony, Illustrious)"
    },
    {
        "id": "diffusion_models",
        "label": "Diffusion Models (Wan / Flux / Hunyuan)",
        "subfolder": "models/diffusion_models/",
        "description": "Modern standalone DiT / UNet models (Wan2.1, FLUX, HunyuanVideo)"
    },
    {
        "id": "loras",
        "label": "LoRAs",
        "subfolder": "models/loras/",
        "description": "Low-Rank Adaptation weights, DoRA, LoCon, LyCORIS"
    },
    {
        "id": "controlnet",
        "label": "ControlNet",
        "subfolder": "models/controlnet/",
        "description": "ControlNet, T2I-Adapter, IP-Adapter models"
    },
    {
        "id": "clip",
        "label": "Text Encoders / CLIP",
        "subfolder": "models/clip/",
        "description": "Text encoders (T5-XXL, CLIP-L, CLIP-G, ViT)"
    },
    {
        "id": "vae",
        "label": "VAE",
        "subfolder": "models/vae/",
        "description": "Variational Autoencoders"
    },
    {
        "id": "upscalers",
        "label": "Upscalers",
        "subfolder": "models/upscale_models/",
        "description": "ESRGAN, Real-ESRGAN, SwinIR upscaling models"
    },
    {
        "id": "embeddings",
        "label": "Embeddings",
        "subfolder": "models/embeddings/",
        "description": "Textual inversions and prompt embeddings"
    },
    {
        "id": "custom",
        "label": "Custom Subfolder...",
        "subfolder": "",
        "description": "Specify a custom relative path under ComfyUI root"
    }
]

def load_ssh_key(key_string: str, passphrase: Optional[str] = None):
    """Load Ed25519, RSA, or ECDSA key from string."""
    key_file = io.StringIO(key_string.strip())
    for key_class in (paramiko.Ed25519Key, paramiko.RSAKey, paramiko.ECDSAKey):
        key_file.seek(0)
        try:
            return key_class.from_private_key(key_file, password=passphrase)
        except Exception:
            continue
    raise ValueError("Unable to parse private key. Ensure it is a valid RSA or Ed25519 key.")

def run_ssh_command(
    host: str,
    port: int = 22,
    username: str = "root",
    password: Optional[str] = None,
    private_key: Optional[str] = None,
    key_path: Optional[str] = None,
    command: str = "",
    timeout_sec: int = 900
) -> Dict[str, Any]:
    """Execute a remote shell command via SSH and capture stdout, stderr, and exit code."""
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    raw_key_string = private_key
    if not raw_key_string and key_path and ("BEGIN" in key_path or "-----" in key_path):
        raw_key_string = key_path
    elif not raw_key_string and password and ("BEGIN" in password or "-----" in password):
        raw_key_string = password
    elif not raw_key_string and key_path and os.path.exists(key_path):
        try:
            with open(key_path, "r", encoding="utf-8") as f:
                raw_key_string = f.read()
        except Exception:
            pass

    try:
        if raw_key_string:
            pkey = load_ssh_key(raw_key_string, passphrase=password if password and "BEGIN" not in password else None)
            client.connect(
                hostname=host,
                port=port,
                username=username,
                pkey=pkey,
                look_for_keys=False,
                allow_agent=False,
                timeout=15
            )
        elif password:
            client.connect(
                hostname=host,
                port=port,
                username=username,
                password=password,
                timeout=15
            )
        else:
            client.connect(
                hostname=host,
                port=port,
                username=username,
                timeout=15
            )

        stdin, stdout, stderr = client.exec_command(command, timeout=timeout_sec)
        out_text = stdout.read().decode("utf-8")
        err_text = stderr.read().decode("utf-8")
        code = stdout.channel.recv_exit_status()
        client.close()
        return {"stdout": out_text, "stderr": err_text, "code": code}
    except Exception as e:
        client.close()
        raise e

async def execute_unified_remote_download(options: Dict[str, Any]) -> Dict[str, Any]:
    """Execute unified multi-connection accelerated model download to remote ComfyUI via SSH."""
    download_url = options.get("download_url") or ""
    destination_folder = options.get("destination_folder") or "models/checkpoints/"
    filename = options.get("filename") or ""
    auth_type = options.get("auth_type")
    api_token = options.get("api_token") or options.get("civitai_token") or options.get("hf_token") or ""
    remote_host = options.get("remote_host") or ""
    ssh_port = int(options.get("ssh_port") or 22)
    ssh_username = options.get("ssh_username") or "root"
    ssh_password = options.get("ssh_password")
    ssh_private_key = options.get("ssh_private_key")
    ssh_key_path = options.get("ssh_key_path")
    remote_comfyui_root = options.get("remote_comfyui_root") or "/workspace/runpod-slim/ComfyUI"

    if not remote_host:
        raise ValueError("Remote Host IP / Address is required for SSH download.")
    if not download_url:
        raise ValueError("Download URL is required.")
    if not filename:
        raise ValueError("Filename is required.")

    # Resolve token based on URL or auth_type
    resolved_token = (api_token or "").strip()
    lower_url = download_url.lower()

    if not resolved_token:
        if auth_type == "civitai" or "civitai.com" in lower_url:
            resolved_token = get_stored_civitai_key()
        elif auth_type == "huggingface" or "huggingface.co" in lower_url:
            resolved_token = get_stored_huggingface_token()

    clean_root = remote_comfyui_root.rstrip("/")
    clean_dest_folder = destination_folder.strip()
    if not clean_dest_folder.startswith("/"):
        clean_dest_folder = posixpath.join(clean_root, clean_dest_folder)
    clean_target_file_path = posixpath.join(clean_dest_folder, filename)

    final_download_url = download_url
    if "civitai.com" in lower_url and resolved_token and "token=" not in final_download_url:
        sep = "&" if "?" in final_download_url else "?"
        final_download_url = f"{final_download_url}{sep}token={resolved_token}"

    safe_dest_dir = clean_dest_folder.replace("'", "'\\''")
    safe_filename = filename.replace("'", "'\\''")
    safe_url = final_download_url.replace("'", "'\\''")

    auth_header_aria = f'--header="Authorization: Bearer {resolved_token}"' if resolved_token else ""
    auth_header_curl = f'-H "Authorization: Bearer {resolved_token}"' if resolved_token else ""
    auth_header_wget = f'--header="Authorization: Bearer {resolved_token}"' if resolved_token else ""

    remote_script = f"""
set -e
mkdir -p '{safe_dest_dir}'
cd '{safe_dest_dir}'

echo "[Model Hub] Target destination: {safe_dest_dir}/{safe_filename}"
echo "[Model Hub] Downloading from: {safe_url}"

if command -v aria2c >/dev/null 2>&1; then
  echo "[Model Hub] Executing aria2c accelerated multi-stream download..."
  aria2c -c -x 8 -s 8 -k 1M --allow-overwrite=true {auth_header_aria} -d '{safe_dest_dir}' -o '{safe_filename}' '{safe_url}'
elif command -v curl >/dev/null 2>&1; then
  echo "[Model Hub] Executing curl stream download with resume..."
  curl -L -C - --fail --retry 3 {auth_header_curl} -o '{safe_dest_dir}/{safe_filename}' '{safe_url}'
elif command -v wget >/dev/null 2>&1; then
  echo "[Model Hub] Executing wget download..."
  wget -c --tries=3 {auth_header_wget} -O '{safe_dest_dir}/{safe_filename}' '{safe_url}'
else
  echo "[Model Hub] Error: Neither aria2c, curl, nor wget is installed on remote instance." >&2
  exit 1
fi

if [ -f '{safe_dest_dir}/{safe_filename}' ]; then
  FILE_SIZE=$(ls -lh '{safe_dest_dir}/{safe_filename}' | awk '{{print $5}}')
  echo "[Model Hub] Ingestion complete! Stored at: {safe_dest_dir}/{safe_filename} ($FILE_SIZE)"
else
  echo "[Model Hub] Error: Target model file not found on disk after download." >&2
  exit 1
fi
""".strip()

    start_time = time.time()
    try:
        res = run_ssh_command(
            host=remote_host,
            port=ssh_port,
            username=ssh_username,
            password=ssh_password,
            private_key=ssh_private_key,
            key_path=ssh_key_path,
            command=remote_script,
            timeout_sec=900
        )

        duration_sec = int(time.time() - start_time)
        if res.get("code") != 0:
            err_msg = res.get("stderr") or res.get("stdout") or f"Exited with code {res.get('code')}"
            return {
                "success": False,
                "message": f"Download failed: {err_msg}",
                "error": err_msg,
                "destination_path": clean_target_file_path,
                "duration_seconds": duration_sec
            }

        size_match = re.search(r"\(([\d\.]+\s*[GMK]B?)\)", res.get("stdout", ""), re.IGNORECASE)
        resolved_size = size_match.group(1) if size_match else None

        return {
            "success": True,
            "message": f"Model '{filename}' downloaded successfully to {clean_target_file_path} in {duration_sec}s.",
            "destination_path": clean_target_file_path,
            "file_size": resolved_size,
            "duration_seconds": duration_sec,
            "logs": res.get("stdout")
        }
    except Exception as err:
        duration_sec = int(time.time() - start_time)
        return {
            "success": False,
            "message": f"Failed to download model to remote machine: {str(err)}",
            "error": str(err),
            "destination_path": clean_target_file_path,
            "duration_seconds": duration_sec
        }
