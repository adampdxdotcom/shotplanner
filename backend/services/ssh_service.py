import os
import io
import paramiko
from scp import SCPClient
from pathlib import Path
from typing import List, Dict, Any, Callable, Optional


def load_private_key(key_string: str, passphrase: Optional[str] = None):
    """
    Robust private key loader supporting Ed25519, RSA, and ECDSA keys.
    Handles OpenSSH format and traditional PEM formats cleanly via io.StringIO.
    """
    key_file = io.StringIO(key_string.strip())
    # Try Ed25519 first (modern default for RunPod), then fall back to RSA and ECDSA
    for key_class in (paramiko.Ed25519Key, paramiko.RSAKey, paramiko.ECDSAKey):
        key_file.seek(0)
        try:
            return key_class.from_private_key(key_file, password=passphrase)
        except (paramiko.SSHException, ValueError, Exception):
            continue
    raise ValueError("Unable to parse private key. Ensure it is a valid RSA or Ed25519 key.")


class RunPodSSHService:
    def __init__(
        self,
        host: str,
        port: int = 22,
        username: str = "root",
        password: Optional[str] = None,
        key_path: Optional[str] = None,
        private_key: Optional[str] = None
    ):
        self.host = host.strip()
        self.port = int(port)
        self.username = username.strip() or "root"
        self.password = password
        self.key_path = key_path.strip() if key_path else None
        self.private_key = private_key.strip() if private_key else None
        self.client: Optional[paramiko.SSHClient] = None

    def connect(self) -> paramiko.SSHClient:
        """Establish SSH connection using Paramiko with explicit publickey or password auth."""
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        # 1. Determine if a direct private key string was provided
        raw_key_string = self.private_key

        # If private key string wasn't explicitly in self.private_key, check if key_path is actually key content or if password contains a key block
        if not raw_key_string and self.key_path and ("BEGIN" in self.key_path or "-----" in self.key_path):
            raw_key_string = self.key_path
        elif not raw_key_string and self.password and ("BEGIN" in self.password or "-----" in self.password):
            raw_key_string = self.password
        elif not raw_key_string and self.key_path and os.path.exists(self.key_path):
            try:
                with open(self.key_path, "r", encoding="utf-8") as kf:
                    raw_key_string = kf.read()
            except Exception as e:
                raise ValueError(f"Could not read private key file at '{self.key_path}': {str(e)}")

        # 2. If private key content is available, parse with load_private_key and connect with explicit pkey
        if raw_key_string:
            pkey = load_private_key(raw_key_string, passphrase=self.password if self.password and "BEGIN" not in self.password else None)
            client.connect(
                hostname=self.host,
                port=self.port,
                username=self.username,
                pkey=pkey,
                look_for_keys=False,
                allow_agent=False,
                timeout=10
            )
            self.client = client
            return client

        # 3. Fallback: Password authentication if no private key was provided
        if self.password:
            client.connect(
                hostname=self.host,
                port=self.port,
                username=self.username,
                password=self.password,
                timeout=10
            )
            self.client = client
            return client

        # 4. Default system key lookup if nothing is specified
        client.connect(
            hostname=self.host,
            port=self.port,
            username=self.username,
            timeout=10
        )
        self.client = client
        return client

    def test_connection(self, remote_dir: str = "/workspace/runpod-slim/ComfyUI/input") -> Dict[str, Any]:
        """Verify SSH credentials and ensure remote input directory exists."""
        try:
            client = self.connect()
            stdin, stdout, stderr = client.exec_command(f"mkdir -p {remote_dir} && ls -la {remote_dir}")
            output = stdout.read().decode("utf-8")
            client.close()
            return {
                "success": True,
                "message": f"Connected to {self.username}@{self.host}:{self.port} successfully via publickey auth. Remote input directory '{remote_dir}' is verified.",
                "output": output
            }
        except paramiko.AuthenticationException as e:
            return {
                "success": False,
                "message": f"SSH authentication failed: {str(e)}. RunPod requires a valid SSH private key (Ed25519 or RSA)."
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"SSH connection failed: {str(e)}"
            }

    def transfer_files_to_runpod(
        self,
        local_files: List[Path],
        remote_dir: str = "/workspace/runpod-slim/ComfyUI/input",
        progress_callback: Optional[Callable[[str, int, int], None]] = None
    ) -> List[Dict[str, Any]]:
        """
        Step A: Push all mapped, renamed media assets from local /assets/uploads
        directly to the RunPod remote /workspace/runpod-slim/ComfyUI/input/ directory via SCP.
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
