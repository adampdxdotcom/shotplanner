import re

with open("backend/routes/api.py", "r") as f:
    content = f.read()

target = "from backend.utils.file_handlers import ("
replacement = "from backend.utils.file_handlers import (\n    sanitize_project_name,"

content = content.replace(target, replacement)

with open("backend/routes/api.py", "w") as f:
    f.write(content)
