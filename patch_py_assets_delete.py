import re

with open("backend/routes/api.py", "r") as f:
    content = f.read()

t_del = """@router.delete("/projects/{filename}")"""
r_del = """@router.delete("/assets/{filename}")
async def delete_asset_endpoint(filename: str):
    file_path = find_asset_file_path(filename)
    if not file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail="Asset not found")
    try:
        file_path.unlink()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/projects/{filename}")"""

content = content.replace(t_del, r_del)

with open("backend/routes/api.py", "w") as f:
    f.write(content)
