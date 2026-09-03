import os
import io
import paramiko
from scp import SCPClient
from pathlib import Path
from typing import List, Dict, Any, Callable, Optional


# Standard 1x1 transparent pixel PNG bytes
EMPTY_1X1_PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc`\x00\x00\x00"
    b"\x02\x00\x01H\xaf\xa4q\x00\x00\x00\x00IEND\xaeB`\x82"
)


def ensure_remote_empty_png(sftp_client: paramiko.SFTPClient, remote_dir: str) -> bool:
    """
    Ensure remote input directory contains default 1x1 transparent pixel empty.png
    for safe loader node bypass. Uploads only if not already present.
    """
    clean_dir = remote_dir.rstrip("/")
    remote_empty = f"{clean_dir}/empty.png"
    try:
        sftp_client.stat(remote_empty)
        return True # already exists
    except Exception:
        pass

    try:
        # Check local assets/uploads/empty.png first
        base_dir = Path(__file__).resolve().parent.parent.parent
        local_empty = base_dir / "assets" / "uploads" / "empty.png"
        if local_empty.exists():
            sftp_client.put(str(local_empty), remote_empty)
        else:
            with sftp_client.file(remote_empty, "wb") as remote_file:
                remote_file.write(EMPTY_1X1_PNG_BYTES)
        return True
    except Exception as e:
        print(f"Warning: Could not auto-upload empty.png to remote directory: {e}")
        return False


def normalize_private_key_string(key_string: Optional[str]) -> Optional[str]:
    """
    Normalize incoming private key string:
    - Trims surrounding whitespace
    - Un-escapes literal '\\n' sequences into true multi-line linebreaks
    - Removes carriage return '\\r' characters
    - Ensures a clean trailing newline for OpenSSH/PEM compatibility
    """
    if not key_string:
        return None
    cleaned = str(key_string).replace("\r", "")
    if "\\n" in cleaned:
        cleaned = cleaned.replace("\\n", "\n")
    cleaned = cleaned.strip()
    if not cleaned:
        return None
    if not cleaned.endswith("\n"):
        cleaned += "\n"
    return cleaned


def load_private_key(key_string: str, passphrase: Optional[str] = None):
    """
    Robust private key loader supporting Ed25519, RSA, and ECDSA keys.
    Attempts loading with paramiko.Ed25519Key.from_private_key(io.StringIO(key_str)) first,
    falling back to paramiko.RSAKey.from_private_key(...), and paramiko.ECDSAKey.
    Returns a tuple: (pkey, key_type_name)
    """
    norm_key = normalize_private_key_string(key_string)
    if not norm_key:
        raise ValueError("Unable to parse private key: key string is empty after normalization.")

    # 1. Attempt Ed25519 first (modern default for RunPod)
    try:
        key_file = io.StringIO(norm_key)
        return paramiko.Ed25519Key.from_private_key(key_file, password=passphrase), "Ed25519"
    except Exception:
        pass

    # 2. Fall back to RSAKey
    try:
        key_file = io.StringIO(norm_key)
        return paramiko.RSAKey.from_private_key(key_file, password=passphrase), "RSA"
    except Exception:
        pass

    # 3. Fall back to ECDSAKey
    try:
        key_file = io.StringIO(norm_key)
        return paramiko.ECDSAKey.from_private_key(key_file, password=passphrase), "ECDSA"
    except Exception:
        pass

    raise ValueError("Unable to parse private key. Ensure it is a valid Ed25519, RSA, or ECDSA key.")


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
        self.host = host.strip() if host else ""
        self.port = int(port) if port else 22
        self.username = username.strip() if username else "root"
        self.password = password
        self.key_path = key_path.strip() if key_path else None
        self.private_key = normalize_private_key_string(private_key)
        self.client: Optional[paramiko.SSHClient] = None
        self.last_auth_method: str = "unknown"

    def connect(self) -> paramiko.SSHClient:
        """Establish SSH connection using Paramiko with explicit publickey or password auth."""
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        # 1. Determine and normalize private key string if provided
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
                detail = f"Could not read private key file at '{self.key_path}': {str(e)}"
                print(f"[SSH Service] Authentication failed with reason: {detail}", flush=True)
                raise ValueError(detail)

        raw_key_string = normalize_private_key_string(raw_key_string)

        # 2. If private key content is available, parse with load_private_key and connect with explicit pkey
        if raw_key_string:
            passphrase = self.password if (self.password and "BEGIN" not in self.password and "-----" not in self.password) else None
            try:
                pkey, key_type = load_private_key(raw_key_string, passphrase=passphrase)
                self.last_auth_method = key_type
                print(f"[SSH Service] Connecting to {self.username}@{self.host}:{self.port} using {key_type}", flush=True)
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
                print(f"[SSH Service] Authentication successful", flush=True)
                return client
            except Exception as e:
                # If key auth failed and a password is available, fallback to password authentication
                if self.password and "BEGIN" not in self.password and "-----" not in self.password:
                    print(f"[SSH Service] Key authentication failed ({e}), falling back to password authentication", flush=True)
                else:
                    detail = str(e)
                    print(f"[SSH Service] Authentication failed with reason: {detail}", flush=True)
                    raise e

        # 3. Fallback: Password authentication if no private key was provided
        if self.password and "BEGIN" not in self.password and "-----" not in self.password:
            key_type = "password"
            self.last_auth_method = "password"
            print(f"[SSH Service] Connecting to {self.username}@{self.host}:{self.port} using {key_type}", flush=True)
            try:
                client.connect(
                    hostname=self.host,
                    port=self.port,
                    username=self.username,
                    password=self.password,
                    timeout=10
                )
                self.client = client
                print(f"[SSH Service] Authentication successful", flush=True)
                return client
            except Exception as e:
                detail = str(e)
                print(f"[SSH Service] Authentication failed with reason: {detail}", flush=True)
                raise e

        # 4. Default system key lookup if nothing is specified
        key_type = "system default keys"
        self.last_auth_method = "system keys"
        print(f"[SSH Service] Connecting to {self.username}@{self.host}:{self.port} using {key_type}", flush=True)
        try:
            client.connect(
                hostname=self.host,
                port=self.port,
                username=self.username,
                timeout=10
            )
            self.client = client
            print(f"[SSH Service] Authentication successful", flush=True)
            return client
        except Exception as e:
            detail = str(e)
            print(f"[SSH Service] Authentication failed with reason: {detail}", flush=True)
            raise e

    def test_connection(self, remote_dir: str = "/workspace/runpod-slim/ComfyUI/input") -> Dict[str, Any]:
        """
        Verify SSH credentials, ensure remote input directory exists,
        and auto-upload default empty.png (1x1 transparent pixel) if not present.
        """
        try:
            client = self.connect()
            clean_remote_dir = remote_dir.rstrip("/")
            client.exec_command(f"mkdir -p {clean_remote_dir}")

            # Automatic Input Validation Check: Ensure empty.png exists remotely
            sftp = client.open_sftp()
            empty_png_staged = False
            try:
                ensure_remote_empty_png(sftp, clean_remote_dir)
                empty_png_staged = True
            except Exception as e:
                print(f"empty.png sync check notice: {e}")
            finally:
                sftp.close()

            stdin, stdout, stderr = client.exec_command(f"ls -la {clean_remote_dir}")
            output = stdout.read().decode("utf-8")
            client.close()

            empty_msg = " [empty.png bypass placeholder verified]" if empty_png_staged else ""
            return {
                "success": True,
                "message": f"Connected to {self.username}@{self.host}:{self.port} successfully using {self.last_auth_method}. Remote input directory '{clean_remote_dir}' is verified{empty_msg}.",
                "output": output,
                "empty_png_staged": empty_png_staged
            }
        except paramiko.AuthenticationException as e:
            return {
                "success": False,
                "message": f"SSH authentication failed: {str(e)}. RunPod requires a valid SSH private key (Ed25519 or RSA) or password."
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
        overwrite: bool = False,
        progress_callback: Optional[Callable[[str, int, int], None]] = None
    ) -> Dict[str, Any]:
        """
        Step A: Push all mapped media assets sequentially to RunPod remote input directory via SFTP.
        Performs remote existence check (sftp.stat) to skip files that already exist unless overwrite=True.
        Also guarantees default empty.png (1x1 transparent pixel) is staged for unmapped loader node bypass.
        """
        results = []
        uploaded_files = []
        skipped_files = []
        clean_remote_dir = remote_dir.rstrip("/")
        
        client = self.connect()

        try:
            # Ensure remote directory exists on host synchronously
            try:
                _stdin, stdout, _stderr = client.exec_command(f"mkdir -p {clean_remote_dir}")
                stdout.channel.recv_exit_status()
            except Exception as cmd_err:
                print(f"Notice: Remote mkdir -p execution exception: {cmd_err}")

            sftp = client.open_sftp()
            try:
                # Automatic input validation: ensure empty.png is present in remote input/ folder
                try:
                    ensure_remote_empty_png(sftp, clean_remote_dir)
                except Exception as png_err:
                    print(f"Warning: ensure_remote_empty_png error: {png_err}")

                for file_path in local_files:
                    filename = file_path.name
                    if not file_path.exists():
                        results.append({
                            "filename": filename,
                            "file": filename,
                            "status": "missing_locally",
                            "size_bytes": 0,
                            "message": "Local file not found"
                        })
                        continue

                    remote_file_path = f"{clean_remote_dir}/{filename}"
                    file_exists_remotely = False

                    # Check if file already exists remotely
                    if not overwrite:
                        try:
                            sftp.stat(remote_file_path)
                            file_exists_remotely = True
                        except Exception:
                            file_exists_remotely = False

                    if file_exists_remotely and not overwrite:
                        skipped_files.append(filename)
                        results.append({
                            "filename": filename,
                            "file": filename,
                            "status": "skipped_existing",
                            "size_bytes": file_path.stat().st_size if file_path.exists() else 0,
                            "remote_path": remote_file_path,
                            "message": "File already exists in remote input directory. Skipped upload."
                        })
                    else:
                        try:
                            # Upload file sequentially via SFTP
                            def sftp_callback(transferred: int, total: int):
                                if progress_callback:
                                    progress_callback(filename, total, transferred)

                            sftp.put(str(file_path), remote_file_path, callback=sftp_callback if progress_callback else None)
                            uploaded_files.append(filename)
                            results.append({
                                "filename": filename,
                                "file": filename,
                                "status": "transferred",
                                "size_bytes": file_path.stat().st_size if file_path.exists() else 0,
                                "remote_path": remote_file_path,
                                "message": "Transferred successfully via SFTP."
                            })
                        except Exception as put_err:
                            results.append({
                                "filename": filename,
                                "file": filename,
                                "status": "failed",
                                "size_bytes": 0,
                                "remote_path": remote_file_path,
                                "message": f"Upload failed: {str(put_err)}"
                            })
            finally:
                sftp.close()

        finally:
            client.close()

        summary_msg = f"Transferred {len(uploaded_files)} new file(s), skipped {len(skipped_files)} already present in {clean_remote_dir}."

        return {
            "success": True,
            "remote_dir": clean_remote_dir,
            "transferred_count": len(uploaded_files),
            "skipped_count": len(skipped_files),
            "total_checked": len(local_files),
            "uploaded_files": uploaded_files,
            "skipped_files": skipped_files,
            "files": results,
            "message": summary_msg
        }

