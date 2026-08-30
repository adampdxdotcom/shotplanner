import re
with open("backend/utils/file_handlers.py", "r") as f:
    content = f.read()

# Replace BASE_DIR = ...
content = re.sub(
    r'BASE_DIR = Path\(__file__\)\.resolve\(\)\.parent\.parent\.parent',
    '# Re-anchor base asset directory to resolve strictly to the container project root assets mount\n# Fallback to current working directory (e.g. for AI studio preview environment)\nBASE_DIR = Path("/app") if Path("/app/backend").exists() or Path("/app/assets").exists() else Path.cwd()',
    content
)

with open("backend/utils/file_handlers.py", "w") as f:
    f.write(content)
