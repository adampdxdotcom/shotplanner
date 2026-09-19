# ComfyUI Bridge & RunPod Scene Stager

A dedicated pre-production staging workbench, narrative storyboard tool, and asset director that bridges local creative workflows with remote RunPod / ComfyUI GPU execution and multi-provider LLMs.

The platform decouples scene asset staging, character consistency, and multimodal prompt engineering from GPU execution: it compiles ready-to-run ComfyUI visual workflow graphs, synchronizes required assets over SSH/SCP to your remote pod, and allows direct execution.

---

## Quick Start with Docker

### Prerequisites
- Docker & Docker Compose installed on your system.

### Running with Docker Compose (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/adampdxdotcom/shotplanner
cd shotplanner

# 2. Start the container
docker compose up --build -d

# 3. Open in your browser
http://localhost:3000

# 4. Updating
git pull
docker compose up --build -d
```

### Running with Standalone Docker

```bash
# Build the image
docker build -t runpod-scene-stager .

# Run the container with persistent asset & data storage
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/assets:/app/assets \
  -v $(pwd)/data:/app/data \
  --name scene-stager \
  runpod-scene-stager
```

---

## Core Features

- **Scene Board & Storyboard Sequencer**: Visual shot timeline with drag-and-drop shot reordering, camera motion planning, framing presets, and instant shot duplication.
- **Cast & Character Management**: Per-scene character profiles, location entity management, outfit references, physical traits, and multi-angle reference collections.
- **Global Universe Roster**: Persistent cross-scene entity pool allowing characters and locations to be imported, synchronized, diff-inspected, and promoted across projects.
- **AI Staging & Reference Studio**: Interactive visual staging canvas, actor chroma-keying / mask extraction, headshot generation, turnaround/expression sheet tools, and pose framing.
- **Multimodal Asset Matrix**: 9-slot reference matrix mapping characters, wardrobe, and environments directly into ComfyUI `LoadImage` node slots with quick reassign/clear controls.
- **LLM Story Director & Prompt Expansion**: Multi-provider LLM support (Google Gemini, Local LM Studio, Ollama, OpenAI-compatible APIs) for screenplay-to-shot parsing, character beat expansion, variation generation, and Wan 2.1 / MiniMax syntax compilation.
- **Civitai & Hugging Face Model Ingestion**: In-app search, metadata inspection, and download pipeline for Checkpoints, LoRAs, VAEs, and ControlNets directly to remote ComfyUI storage.
- **Remote SSH & RunPod Deployment**: Automated SCP synchronization that compiles individual shot workflows, deduplicates reference media, and deploys ready-to-queue jobs to remote ComfyUI pods.
- **Real-Time ComfyUI HUD & WebSocket Monitoring**: Live execution tracker displaying queue position, node-by-node execution progress, sampling step timers, and live visual preview updates.
- **Automatic Asset Ingestion & Takes Cataloging**: Automated background listener capturing `SaveImage` and `SaveVideo` outputs from ComfyUI's `/view` API, archiving them to project storage with thumbnail generation and metadata logging (`Take 01`, `Take 02`, etc.).
- **Take Review & Side-by-Side Comparison**: Comprehensive Take Review modal with video/image playback, director ratings ("Good" / "Needs Work"), notes logging, Hero Take designation, and side-by-side Take Comparison with generation parameter diffs.

---

## AI Production Assistant

An intelligent, context-aware co-director embedded directly in your production workspace. Powered by local LLMs (LM Studio, Ollama, OpenAI-compatible APIs) or Google Gemini, it has live access to your scene dossier, character roster, and universe lore:

- **Cinematography & Pacing**: Recommends framing, focal lengths, camera movements, and lighting schemes aligned with your scene's overarching narrative goal.
- **Script Supervision & Continuity**: Monitors character presence, wardrobe consistency across shots, and alerts you if a character lacks required reference photos.
- **One-Click Action Cards**: Proposes executable project changes—instantly add new shots, update camera settings, tweak scene plans, or modify cast wardrobe with single-click approval and full undo support.
- **Prompt Crafting & Staging**: Expands simple shot stubs into detailed generative prompts (Wan 2.1, MiniMax, Flux) and can trigger asset staging to remote ComfyUI pods.
- **Conversational Memory**: Retains scene context across your session for ongoing iterative direction and shot refinement.

