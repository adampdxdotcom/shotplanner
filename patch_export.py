import re

with open("backend/routes/api.py", "r") as f:
    content = f.read()
    
t = """    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Project '{clean_name}' not found on server. Please save it first.")"""
r = """"""
content = content.replace(t, r)

with open("backend/routes/api.py", "w") as f:
    f.write(content)
