from fastapi import APIRouter
from backend.routes.workflow_routes import router as workflow_router
from backend.routes.asset_routes import router as asset_router
from backend.routes.project_routes import router as project_router
from backend.routes.prompt_routes import router as prompt_router
from backend.routes.execution_routes import router as execution_router
from backend.routes.output_routes import router as output_router

router = APIRouter(prefix="/api")

# Include all modular domain routers
router.include_router(workflow_router)
router.include_router(asset_router)
router.include_router(project_router)
router.include_router(prompt_router)
router.include_router(execution_router)
router.include_router(output_router)
