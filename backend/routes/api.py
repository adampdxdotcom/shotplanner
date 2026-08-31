"""
Backward-compatible API router re-export.
Modular routers and domain services are located in:
- backend/routes/workflow_routes.py
- backend/routes/asset_routes.py
- backend/routes/project_routes.py
- backend/routes/prompt_routes.py
- backend/routes/execution_routes.py
- backend/services/project_service.py
- backend/services/asset_service.py
- backend/services/execution_service.py
"""
from backend.routes import router

__all__ = ["router"]
