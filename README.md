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
- **AI Staging & Reference Studio**: Interactive visual staging canvas, actor chroma-keying / mask extraction, headshot generation, and turnaround/expression sheet tools.
- **Multimodal Asset Matrix**: 9-slot reference matrix mapping characters, wardrobe, and environments directly into ComfyUI `LoadImage` node slots.
- **LLM Story Director & Prompt Expansion**: Multi-provider LLM support (Google Gemini, Local LM Studio, Ollama, OpenAI-compatible APIs) for screenplay-to-shot parsing, character beat expansion, and MiniMax/Wan2 syntax compilation.
- **Civitai & Hugging Face Model Ingestion**: In-app search, metadata inspection, and download pipeline for Checkpoints, LoRAs, and VAEs directly to remote ComfyUI storage.
- **Remote SSH & RunPod Deployment**: Automated SCP synchronization that compiles individual shot workflows, deduplicates reference media, and deploys ready-to-queue jobs to remote ComfyUI pods.
