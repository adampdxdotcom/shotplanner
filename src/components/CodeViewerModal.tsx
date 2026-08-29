import React, { useState } from "react";
import { 
  X, 
  Copy, 
  Check, 
  FileCode2, 
  FolderTree, 
  Terminal, 
  FileText
} from "lucide-react";

interface CodeViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CodeViewerModal: React.FC<CodeViewerModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<string>("main.py");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const codeFiles: Record<string, { lang: string; path: string; desc: string; content: string }> = {
    "main.py": {
      lang: "python",
      path: "/backend/main.py",
      desc: "FastAPI initialization, CORS setup, and route mounting",
      content: `import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from backend.routes.api import router as api_router
from backend.utils.file_handlers import ASSETS_DIR

app = FastAPI(
    title="ComfyUI Bridge & RunPod Orchestrator API",
    description="Backend bridge service connecting local assets, LM Studio, and remote RunPod ComfyUI instances",
    version="1.0.0"
)

# Enable CORS for local dev and web client
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes
app.include_router(api_router)

# Mount static asset files
app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "comfyui-bridge-fastapi"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)`
    },
    "routes/api.py": {
      lang: "python",
      path: "/backend/routes/api.py",
      desc: "Modular REST API endpoints for workflow parsing, asset upload, prompt expansion & execution",
      content: `import os
import httpx
from pathlib import Path
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel, Field

from backend.utils.file_handlers import (
    save_uploaded_file,
    generate_target_filename,
    list_workflows,
    load_workflow_json,
    save_workflow_json,
    UPLOADS_DIR
)
from backend.services.workflow_service import inspect_workflow_nodes, inject_and_prepare_workflow
from backend.services.ssh_service import RunPodSSHService
from backend.services.llm_service import expand_prompt_with_llm

router = APIRouter(prefix="/api", tags=["ComfyUI Bridge API"])

# Master Execution Pipeline: Step A -> Step B -> Step C -> Step D
# Pushes assets via SSH, injects prompt into flat JSON dictionary, submits to /prompt endpoint`
    },
    "services/ssh_service.py": {
      lang: "python",
      path: "/backend/services/ssh_service.py",
      desc: "Paramiko & SCP client pushing local assets to RunPod /workspace/ComfyUI/input/ with robust Ed25519/RSA key auth",
      content: `import os
import io
import paramiko
from scp import SCPClient
from pathlib import Path
from typing import List, Dict, Any, Optional

def load_private_key(key_string: str, passphrase: Optional[str] = None):
    key_file = io.StringIO(key_string.strip())
    for key_class in (paramiko.Ed25519Key, paramiko.RSAKey, paramiko.ECDSAKey):
        key_file.seek(0)
        try:
            return key_class.from_private_key(key_file, password=passphrase)
        except (paramiko.SSHException, ValueError, Exception):
            continue
    raise ValueError("Unable to parse private key. Ensure it is a valid RSA or Ed25519 key.")

class RunPodSSHService:
    def __init__(self, host: str, port: int = 22, username: str = "root", password: Optional[str] = None, key_path: Optional[str] = None, private_key: Optional[str] = None):
        self.host = host.strip()
        self.port = int(port)
        self.username = username.strip() or "root"
        self.password = password
        self.key_path = key_path.strip() if key_path else None
        self.private_key = private_key.strip() if private_key else None

    def connect(self) -> paramiko.SSHClient:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        # Explicit publickey authentication (Ed25519 / RSA)
        if self.private_key:
            pkey = load_private_key(self.private_key, passphrase=self.password)
            client.connect(
                hostname=self.host,
                port=self.port,
                username=self.username,
                pkey=pkey,
                look_for_keys=False,
                allow_agent=False,
                timeout=10
            )
            return client
        # Fallback to password or file path...
        return client`
    },
    "services/workflow_service.py": {
      lang: "python",
      path: "/backend/services/workflow_service.py",
      desc: "Parses ComfyUI flat dictionary graph and injects prompt & asset filenames + bypass logic",
      content: `import copy
from typing import Dict, Any, List, Optional

def inspect_workflow_nodes(workflow: Dict[str, Any]) -> Dict[str, Any]:
    # Parses flat dictionary keyed by node ID
    # Identifies PrimitiveStringMultiline and LoadImage/Video/Audio loader nodes
    pass

def inject_and_prepare_workflow(workflow_data, prompt_node_id, expanded_prompt, node_mappings, bypass_missing=True, safe_placeholder="empty.png"):
    # Injects text into inputs.value / inputs.text
    # Injects filenames into inputs.image / inputs.video
    # Injects safe placeholder if unmapped
    pass`
    },
    "docker-compose.yml": {
      lang: "yaml",
      path: "/docker-compose.yml",
      desc: "Multi-container setup with mounted ./assets volume",
      content: `services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    container_name: comfyui_bridge_backend
    ports:
      - "8000:8000"
    volumes:
      - ./assets:/app/assets
      - ./backend:/app/backend
    environment:
      - PYTHONUNBUFFERED=1
      - LM_STUDIO_DEFAULT_URL=http://host.docker.internal:1234/v1
    extra_hosts:
      - "host.docker.internal:host-gateway"

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    container_name: comfyui_bridge_frontend
    ports:
      - "3000:80"
    depends_on:
      - backend`
    },
    "README.md": {
      lang: "markdown",
      path: "/README.md",
      desc: "Complete documentation, architecture diagram, and usage tutorial",
      content: `# ComfyUI Bridge & RunPod Orchestrator
See README.md in root for complete instructions and setup guide.`
    }
  };

  const currentFile = codeFiles[activeTab] || codeFiles["main.py"];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
      <div className="bg-zinc-950 border-2 border-zinc-700 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <FileCode2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Modular Python Backend &amp; Docker Configuration</h3>
              <p className="text-xs text-zinc-400">Complete file tree ready to run locally via Docker Compose or standalone FastAPI.</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab selector */}
        <div className="flex overflow-x-auto border-b border-zinc-800 bg-zinc-900/30 px-3 pt-2 gap-1 scrollbar-none">
          {Object.keys(codeFiles).map((filename) => (
            <button
              key={filename}
              onClick={() => setActiveTab(filename)}
              className={`px-3 py-2 text-xs font-mono rounded-t-lg transition-colors border-t border-x whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === filename
                  ? "bg-zinc-950 text-indigo-400 border-zinc-800 font-semibold"
                  : "bg-transparent text-zinc-400 border-transparent hover:text-zinc-200"
              }`}
            >
              <span>{filename}</span>
            </button>
          ))}
        </div>

        {/* File detail bar */}
        <div className="px-5 py-2.5 bg-zinc-900/40 border-b border-zinc-800/80 flex items-center justify-between text-xs">
          <div>
            <span className="font-mono text-zinc-300 font-semibold">{currentFile.path}</span>
            <span className="text-zinc-500 ml-2">— {currentFile.desc}</span>
          </div>

          <button
            onClick={handleCopy}
            className="px-2.5 py-1 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-md border border-zinc-700 transition-all flex items-center gap-1.5 shadow-xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
            <span>{copied ? "Copied" : "Copy Code"}</span>
          </button>
        </div>

        {/* Code Content */}
        <div className="flex-1 overflow-auto p-5 bg-zinc-950 font-mono text-xs text-zinc-200 leading-relaxed">
          <pre>{currentFile.content}</pre>
        </div>
      </div>
    </div>
  );
};
