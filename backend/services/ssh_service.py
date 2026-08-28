import os
import paramiko
from scp import SCPClient
from pathlib import Path
from typing import List, Dict, Any, Callable, Optional

class RunPodSSHService:
    def __init__(
        self,
        host: str,
        port: int = 22,
        username: str = "root",
        password: Optional[str] = None,
        key_path: Optional[str] = None
    ):
        self.host = host.strip()
        self.port = int(port)
        self.username = username.strip() or "root"
        self.password = password
        self.key_path = key_path.strip() if key_path else None
        self.client: Optional[paramiko.SSHClient] = None

    def connect(self) -> paramiko.SSHClient:
        """Establish SSH connection using Paramiko with password or key."""
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        connect_kwargs = {
            "hostname": self.host,
            "port": self.port,
            "username": self.username,
            "timeout": 15,
        }

        if self.key_path and os.path.exists(self.key_path):
            connect_kwargs["key_filename"] = self.key_path
        elif self.password:
            connect_kwargs["password"] = self.password
        else:
            # Try default SSH agent or system keys
            pass

        client.connect(**connect_kwargs)
        self.client = client
        return client

    def test_connection(self) -> Dict[str, Any]:
        """Verify SSH credentials and ensure remote directories exist."""
        try:
            client = self.connect()
            stdin, stdout, stderr = client.exec_command("mkdir -p /workspace/ComfyUI/input && ls -la /workspace/ComfyUI/input")
            output = stdout.read().decode("utf-8")
            client.close()
            return {
                "success": True,
                "message": f"Connected to {self.username}@{self.host}:{self.port} successfully. Remote input directory is verified.",
                "output": output
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"SSH connection failed: {str(e)}"
            }

    def transfer_files_to_runpod(
        self,
        local_files: List[Path],
        remote_dir: str = "/workspace/ComfyUI/input",
        progress_callback: Optional[Callable[[str, int, int], None]] = None
    ) -> List[Dict[str, Any]]:
        """
        Step A: Push all mapped, renamed media assets from local /assets/uploads
        directly to the RunPod remote /workspace/ComfyUI/input/ directory via SCP.
        """
        results = []
        client = self.connect()

        try:
            # Ensure remote directory exists
            client.exec_command(f"mkdir -p {remote_dir}")

            def scp_progress(filename, size, sent):
                if progress_callback:
                    progress_callback(filename.decode() if isinstance(filename, bytes) else str(filename), size, sent)

            with SCPClient(client.get_transport(), progress=scp_progress) as scp:
                for file_path in local_files:
                    if not file_path.exists():
                        results.append({
                            "file": file_path.name,
                            "status": "error",
                            "message": "Local file not found"
                        })
                        continue

                    # Upload to remote directory
                    scp.put(str(file_path), remote_path=f"{remote_dir}/{file_path.name}")
                    results.append({
                        "file": file_path.name,
                        "status": "transferred",
                        "size_bytes": file_path.stat().st_size,
                        "remote_path": f"{remote_dir}/{file_path.name}"
                    })

        finally:
            client.close()

        return results
