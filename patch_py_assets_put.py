import re

with open("backend/routes/api.py", "r") as f:
    content = f.read()

t_put = """@router.delete("/assets/{filename}")"""
r_put = """from pydantic import BaseModel
class AssetUpdate(BaseModel):
    type: str = None
    subject_name: str = None
    description: str = None

@router.put("/assets/{filename}")
async def update_asset_metadata(filename: str, updates: AssetUpdate):
    # Purely a stub to satisfy frontend, metadata is persisted in project JSON
    return {
        "success": True,
        "asset": {
            "id": filename,
            "filename": filename,
            "original_name": filename,
            "media_type": "image",
            "type": updates.type or "unknown",
            "subject_name": updates.subject_name or "subject",
            "description": updates.description or "",
            "size_bytes": 0,
            "preview_url": f"/api/uploads/{filename}",
            "path": ""
        }
    }

@router.delete("/assets/{filename}")"""

content = content.replace(t_put, r_put)

with open("backend/routes/api.py", "w") as f:
    f.write(content)
