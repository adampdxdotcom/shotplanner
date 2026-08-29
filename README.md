# ComfyUI Bridge & RunPod Scene Stager

A dedicated staging workbench and narrative storyboard tool that bridges local multimedia assets, LLM prompt expansion (LM Studio / Gemini), and a remote RunPod ComfyUI instance.

The app decouples pre-production asset staging and prompt engineering from GPU execution: it compiles ready-to-run, standard visual canvas workflow files and transfers only the required assets over SSH/SCP to your remote pod. You open the workflow manually inside ComfyUI on RunPod and queue when ready.

---

## Architecture Overview

```
+-------------------------------------------------------------------------+
|                            Web UI (Frontend)                            |
|  - Scene Hub & Carousel: Visual shot sequencer, thumbnail tracking      |
|  - Scene & Camera Planning: Shot framing, camera motion, prompt prefix  |
|  - Asset Manager: 9 reference slots (<Picture 1-9>) with slot unmuting  |
|  - LLM Prompt Expander: Strict MiniMax-H3 syntax (LM Studio / Gemini)   |
|  - Shot Context Guardrails: Unified activeShotId state across all tabs   |
+------------------------------------+------------------------------------+
                                     | HTTP REST
+------------------------------------v------------------------------------+
|                     TypeScript / Express Backend                        |
|  - /api/scenes: Single-file JSON scene persistence (scene_<name>.json)  |
|  - /api/workflows: Standard visual canvas JSON graph parser & injector  |
|  - /api/prompt/expand: MiniMax-H3 formatting, tag mapping & directives |
|  - /api/stage: Compiles Shot/Scene JSONs & initiates targeted SCP       |
+------------------------------------+------------------------------------+
                                     |
                                     v (SSH / SFTP via OpenSSH)
+-------------------------------------------------------------------------+
|                             Remote RunPod Pod                           |
|                                                                         |
|  /workspace/runpod-slim/ComfyUI/input/                                  |
|   └── [Only mapped shot/scene image references transferred]             |
|                                                                         |
|  /workspace/runpod-slim/ComfyUI/user/default/workflows/{Scene_Name}/     |
|   ├── {Scene}_Shot_01.json  (Pre-configured with Prompt, Assets & Save) |
|   ├── {Scene}_Shot_02.json                                              |
|   └── {Scene}_Shot_03.json                                              |
+-------------------------------------------------------------------------+
                                     |
                                     v (User Action)
                   Open ComfyUI Web UI -> Load Shot Workflow -> Click "Queue"
```

---

## Directory Structure & Projects

```
├── projects/                     # Persistent local Scene projects
│   └── scene_reading_session.json # Self-contained scene data (assets, shots, prompts)
├── assets/
│   ├── workflows/                # Base UI canvas workflow templates (nodes + links)
│   │   ├── minimax_video_template.json
│   │   └── wan2_multimodal_template.json
│   └── uploads/                  # Local reference media assets
│       └── empty.png             # Fallback placeholder for bypassed slots
├── src/
│   ├── components/
│   │   ├── SceneHub/             # 4-card horizontal carousel, drag-and-drop shot reorder
│   │   ├── ScenePlanning/        # Framing dropdowns, movement, live prefix preview
│   │   ├── Assets/               # 9-slot matrix (Slots 1-8: Cast/Wardrobe, Slot 9: Location)
│   │   ├── WorkflowMapper/       # Node inspection, LoadImage slot unmuting (mode: 0)
│   │   └── PromptExpander/       # Stub input, MiniMax syntax builder, LLM cascade
│   ├── services/
│   │   ├── geminiService.ts      # Gemini API prompt expansion fallback
│   │   ├── expandPrompt.ts       # MiniMax-H3 prompt compiler & tag injection
│   │   └── sshService.ts         # Targeted SCP transfer for workflows and assets
│   ├── types/                    # Shared TypeScript interfaces & Scene DTOs
│   └── server.ts                 # Thin backend bootstrap router
├── docker-compose.yml
├── Dockerfile
└── README.md
```

---

## Core Features & Concepts

### 1. Scene & Shot Planning Header
At the top of the workflow, camera and scene tags compile into an industry-standard cinematography prefix:
- **Inputs:** Scene Name, Shot #, Shot Type (dropdown), Camera Movement (dropdown).
- **Cinematography Formats:**
  - **Framing:** Extreme Wide Shot (EWS), Wide Shot (WS), Medium Shot (MS), Close-Up (CU), Extreme Close-Up (ECU), etc.
  - **Movement:** Locked Off (Static), Slow Push In (Dolly In), Pan Left/Right, Tilt Up/Down, Tracking Shot, etc.
- **Auto-Generated Prefix:**
  > `Jackie's reading session - Shot 12 - Close-Up - Locked Off`
- **Automatic SaveVideo Sync:** The scene name and zero-padded shot number sanitize into a clean filesystem path injected directly into the workflow's SaveVideo node:
  `video/Jackies_reading_session_Shot_12_`

### 2. MiniMax-H3 Multimodal Prompt Engineering
The prompt generator enforces structural and syntactic rules required by multi-reference video models:
- **Global Subject Definitions:** Automatically builds the reference index (`Jackie (<Picture 1>)`, `Maggie (<Picture 3>)`, `Location (<Picture 9>)`).
- **Frame 0 Spatial Anchoring:** Forces initial physical placement into the prompt description (e.g., *"At start of shot, seated alone center-frame, angled slightly toward screen-right..."*).
- **Single-Subject Isolation:** When only one character is active, injects strict occupancy constraints to eliminate character morphing or split-screen drift:
  > *"There is only one person visible on screen in this shot. All other characters remain strictly off-screen."*
- **Scene Fidelity Directives:** When a location asset (`<Picture 9>`) is assigned, injects:
  > *"Do not embellish the setting. Use the exact likeness of location."*
- **Tag Granularity:** Strictly separates facial identity tags (`<Picture 3>`) from wardrobe tags to prevent clothing bleed across shots.

### 3. Scene Hub & Storyboard Carousel
- **4-Card Top Carousel:** Displays shots chronologically with `<Picture 9>` (Location) as the 16:9 thumbnail preview.
- **Drag-and-Drop Reordering:** Rearrange cards on the fly; shot numbers and filename prefixes automatically re-sequence.
- **Shot Duplication:** One-click "Duplicate as Next Shot" clones all reference asset mappings and scene settings to Shot `{N+1}`, ready for a new prompt stub.
- **Staged Status Tracking:** Cards show a green checkmark **Staged** badge once transferred. Any edits to prompts, assets, or camera tags toggle the shot back to **Unstaged**.

### 4. Unified Shot Context Guardrails
Tabs across the application (Assets, Workflow & Map, Prompt LLM, Execute) are bound to a shared `activeShotId`. If no shot is selected from the Hub or header dropdown, editor panes remain protected in an unselected state to prevent accidental overwrites.

---

## Step-by-Step Staging Workflow

### Step 1: Configure Pod Connection
In Settings, provide your RunPod SSH credentials:
- **RunPod IP & SSH Port:** e.g., `194.26.196.xxx` and your assigned external SSH port.
- **SSH User & Private Key:** Authenticates SCP access to `/workspace/runpod-slim/`.
- **LLM Selection:** Select Local LM Studio (`http://localhost:1234/v1`) or provide a Google Gemini API Key as an automatic fallback.

### Step 2: Set Up Scene & Reference Assets
1. Open the **Scene Hub** or **Assets** view and create/load a Scene (saved to `/projects/scene_<name>.json`).
2. Map your reference assets into the 9-slot matrix:
   - **Slots 1–8:** Character headshots, expressions, and wardrobe angles.
   - **Slot 9:** Dedicated Location / Environment reference.
3. Configure the active shot's Scene Name, Shot #, Shot Type, and Camera Movement.

### Step 3: Expand the Prompt
1. In the **Prompt LLM** tab, enter a brief beat into **Basic Prompt / Stub** (e.g., *"Maggie smiles and asks if she gets to eat fruit"*).
2. Click **Generate Prompt**. The service compiles the header prefix, definitions block, scene directives, and multimodal description.
3. Make any manual micro-edits in the prompt preview editor.

### Step 4: Map the Workflow Template
1. In **Workflow & Map**, select a visual canvas workflow `.json` (from standard ComfyUI "Save", containing nodes and links).
2. The system binds the active shot's mapped reference assets to the detected `LoadImage` nodes, unmuting assigned slots (`mode: 0`).

### Step 5: Send Shot or Send Scene
Navigate to the **Execute** tab:

- **Option A: Send Shot (Single Shot Staging)**
  - Compiles `{Scene}_Shot_{XX}.json` with the current prompt, asset mappings, and `SaveVideo` prefix.
  - SCPs the single workflow file to `/workspace/runpod-slim/ComfyUI/user/default/workflows/{Scene}/`.
  - SCPs only the image assets assigned to that specific shot into `/workspace/runpod-slim/ComfyUI/input/`.
  - Marks the active shot as **Staged**.

- **Option B: Send Scene (Full Scene Batch Staging)**
  - Compiles individual `.json` workflows for every shot in the scene.
  - Deduplicates all referenced images across the entire scene and transfers each unique file once.
  - SCPs all compiled shot workflows into the scene folder on RunPod.
  - Marks every shot in the scene as **Staged**.

### Step 6: Render in ComfyUI
1. Open your ComfyUI web UI on RunPod.
2. Go to **Workflows** -> `{Scene_Name}`.
3. Open any staged shot (`Shot_01.json`, `Shot_02.json`).
4. Click **Queue Prompt**. The input images and prompt are already configured and ready to run.