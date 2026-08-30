import re

with open("backend/routes/api.py", "r") as f:
    content = f.read()

# Make sure we import mimetypes
if "import mimetypes" not in content:
    content = "import mimetypes\n" + content

func_str = """async def serve_upload_file(filename: str):
    \"\"\"Dynamic file serving endpoint that scans all scene subdirectories.\"\"\"
    file_path = find_asset_file_path(filename)
    if not file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    # We use FileResponse to handle proper Content-Type deduction and caching headers
    mime_type, _ = mimetypes.guess_type(str(file_path))
    if not mime_type:
        mime_type = "application/octet-stream"
        
    return FileResponse(path=file_path, media_type=mime_type, headers={"Cache-Control": "public, max-age=3600"})"""

content = re.sub(
    r'async def serve_upload_file\(filename: str\):.*?return FileResponse\(path=file_path, headers=\{"Cache-Control": "public, max-age=3600"\}\)',
    func_str,
    content,
    flags=re.DOTALL
)

with open("backend/routes/api.py", "w") as f:
    f.write(content)
