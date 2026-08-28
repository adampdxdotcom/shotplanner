import os
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
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
