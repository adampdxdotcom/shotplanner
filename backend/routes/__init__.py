from fastapi import APIRouter
from backend.routes.workflow_routes import router as workflow_router
from backend.routes.asset_routes import router as asset_router
from backend.routes.project_routes import router as project_router
from backend.routes.prompt_routes import router as prompt_router
from backend.routes.execution_routes import router as execution_router
from backend.routes.output_routes import router as output_router
from backend.routes.headshot_routes import router as headshot_router
from backend.routes.settings_routes import router as settings_router
from backend.routes.civitai_routes import router as civitai_router
from backend.routes.model_hub_routes import router as model_hub_router

router = APIRouter(prefix="/api")

# Include all modular domain routers
router.include_router(workflow_router)
router.include_router(asset_router)
router.include_router(project_router)
router.include_router(prompt_router)
router.include_router(execution_router)
router.include_router(output_router)
router.include_router(headshot_router)
router.include_router(settings_router)
router.include_router(civitai_router)
router.include_router(model_hub_router)

