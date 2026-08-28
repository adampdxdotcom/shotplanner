# ComfyUI Bridge & RunPod Orchestrator

A modular, dockerized web application that acts as a UI bridge between **local multimedia assets**, a **local LM Studio LLM**, and a remote **RunPod ComfyUI** instance.

---

## 🌟 Architecture Overview

```
 ┌────────────────────────────────────────────────────────┐
 │                    Web UI (Frontend)                   │
 │   - Configuration (RunPod IP, SSH, ComfyUI, LM Studio) │
 │   - Asset Management (Images, Audio, Video + Metadata) │
 │   - Workflow Selector & Dynamic Node ID Mapper        │
 │   - LLM Prompt Expansion ("Generate from Stub")       │
 └─────────────────────────┬──────────────────────────────┘
                           │ HTTP REST
 ┌─────────────────────────▼──────────────────────────────┐
 │               FastAPI / Express Backend                │
 │  - /api/workflows: Reads /assets/workflows/*.json      │
 │  - /api/assets/upload: Renames {type}_{name}_{ts}.ext  │
 │  - /api/generate-prompt: Contextual LM Studio caller   │
 │  - /api/execute: 4-Step Orchestration Pipeline         │
 └─────────────────────────┬──────────────────────────────┘
                           │
       ┌───────────────────┴───────────────────┐
       ▼ (SSH/SCP via Paramiko)                ▼ (HTTP POST /prompt)
┌───────────────────────────────┐     ┌───────────────────────────────┐
│ RunPod ComfyUI Input Dir      │     │ RunPod ComfyUI API            │
│ /workspace/ComfyUI/input/     │     │ Flat JSON Node Graph Payload  │
│  - headshot_jackie_123.png    │     │  - workflow["137"]["inputs"]  │
│  - empty.png (Safe Placeholder)│     │  - workflow["138"]["inputs"]  │
└───────────────────────────────┘     └───────────────────────────────┘
```

---

## 📁 Directory Structure & Volumes

The application utilizes persistent local directory mapping for workflows and media:

```
├── assets/
│   ├── workflows/                # Stores ComfyUI workflow_api.json files
│   │   ├── minimax_video_workflow.json
│   │   └── wan2_multimodal_workflow.json
│   └── uploads/                  # Stores user uploaded & renamed media files
│       └── empty.png             # Safe placeholder for unmapped nodes
├── backend/
│   ├── main.py                   # FastAPI application initialization & CORS
│   ├── requirements.txt          # Python dependencies (paramiko, scp, httpx, etc.)
│   ├── routes/
│   │   └── api.py                # REST endpoints (/workflows, /assets, /execute, etc.)
│   ├── services/
│   │   ├── ssh_service.py        # Paramiko SSH & SCP file transfer service
│   │   ├── llm_service.py        # LM Studio context formatter & caller
│   │   └── workflow_service.py   # ComfyUI flat dictionary parser & injector
│   └── utils/
│       └── file_handlers.py      # Filename sanitizer & file persistence
├── src/                          # Modular React / Tailwind Frontend
│   ├── components/               # Modular UI modules (Config, Workflow, Assets, LLM, Executor)
│   ├── types.ts                  # Shared TypeScript interfaces
│   └── App.tsx                   # Main orchestrator dashboard
├── docker-compose.yml            # Docker Compose multi-service definition
├── Dockerfile.backend            # Python 3.11 + OpenSSH container
├── Dockerfile.frontend           # Node build + Nginx static server
└── README.md
```

---

## 🚀 How to Run with Docker Compose

### Prerequisites
1. [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/) installed on your machine.
2. [LM Studio](https://lmstudio.ai/) running locally with local server started on port `1234` (enable CORS in LM Studio settings).
3. A running **RunPod GPU Pod** with ComfyUI and SSH enabled.

### 1. Launch Containers
Clone or navigate to the project directory and run:

```bash
docker-compose up --build
```

- **Frontend UI**: `http://localhost:3000`
- **FastAPI Backend**: `http://localhost:8000` (Docs at `http://localhost:8000/docs`)

### 2. Assets Volume Mount
The host `./assets` folder is directly mounted to `/app/assets` inside the backend container. Any `.json` workflow file added to `./assets/workflows/` is immediately available in the UI.

---

## 🛠️ Step-by-Step Usage Guide

### Step 1: Set Configuration
Fill in your connection details in the **Configuration** section:
- **RunPod IP & SSH Port**: e.g., `194.26.196.xxx` and port `22` (or your RunPod SSH assigned port).
- **SSH Username & Password/Key**: usually `root` and your pod password or SSH key.
- **RunPod ComfyUI API URL**: e.g., `https://xxxx-8188.proxy.runpod.net` or `http://127.0.0.1:8188`.
- **RunPod API Token**: (Optional) bearer token if using RunPod proxy authorization headers.
- **LM Studio API URL**: `http://localhost:1234/v1` (or `http://host.docker.internal:1234/v1` from Docker).

### Step 2: Upload Assets with Metadata
Provide references across the segmented sections:
- **Images (up to 9)**: Choose Type (`Headshot`, `Body Reference`, `Scene Reference`, `Object Reference`), enter Subject Name (e.g. `jackie`), and add a detailed Description for the LLM.
- **Audio (up to 2)**: Voiceover or ambient audio clips.
- **Video (up to 1)**: Motion or style reference video.

> **Automatic File Renaming Strategy**:
> Files are saved in `/assets/uploads/` formatted as `{type}_{name}_{timestamp}.ext` (e.g., `headshot_jackie_1724859281.png`).

### Step 3: Select Workflow & Dynamic Node Mapping
1. Choose a workflow from `/assets/workflows/` (e.g. `minimax_video_workflow.json`).
2. The system dynamically inspects the ComfyUI flat dictionary:
   - Detects Text Prompt nodes (`PrimitiveStringMultiline`, `CLIPTextEncode`).
   - Detects Media Loader nodes (`LoadImage`, `LoadVideo`, `LoadAudio`).
3. Assign each uploaded asset to the corresponding Node ID (e.g. Node `137` -> `headshot_jackie_1724859281.png`).
4. **Missing Asset Bypass Logic**: If a workflow loader node is not assigned an asset, the backend automatically injects the safe placeholder `empty.png` to prevent ComfyUI execution failure.

### Step 4: Expand Prompt via LM Studio ("Generate from Stub")
1. Enter your core idea in the **Basic Prompt / Stub** field.
2. Click **Generate Prompt with LM Studio**.
3. The LLM receives the stub along with formatted context of all uploaded assets and generates a rich prompt with `<Picture 1>`, `<Picture 2>`, `<Video 1>` tags.
4. Review and edit the generated prompt in the **Preview/Edit Prompt** area.

### Step 5: Execute & Dispatch to RunPod
Click **Execute Workflow** (or **Dry Run (Preview Payload)**). The backend executes:
- **Step A**: Connects to RunPod via SSH/SCP and pushes all mapped media assets to `/workspace/ComfyUI/input/`.
- **Step B**: Loads the selected workflow JSON.
- **Step C**: Injects the expanded prompt into the text node and injects renamed filenames into the loader nodes.
- **Step D**: Dispatches the prepared JSON payload to RunPod ComfyUI's `/prompt` HTTP endpoint.

---

## 🧪 Testing Without RunPod (Dry Run Mode)
You can use the **Dry Run** button at any time to inspect the full modified ComfyUI API JSON graph without establishing SSH connections or calling external APIs.
