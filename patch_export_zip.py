import re

with open("backend/routes/api.py", "r") as f:
    content = f.read()

replacement = """async def export_project_zip(filename: str):
    clean_name = filename
    if clean_name.lower().endswith(".json"):
        clean_name = clean_name[:-5]
    clean_name = "".join(c for c in clean_name if c.isalnum() or c in ("_", "-"))
    if not clean_name:
        clean_name = "project"
    file_path = PROJECTS_DIR / f"{clean_name}.json\""""

content = re.sub(
    r'async def export_project_zip\(filename: str\):\n    clean_name = filename\[:-5\] if filename\.endswith\("\.json"\) else filename\n    clean_name = "".join\(c for c in clean_name if c\.isalnum\(\) or c in \("_", "-"\)\)\n    file_path = PROJECTS_DIR / f"\{clean_name\}\.json"',
    replacement,
    content
)

with open("backend/routes/api.py", "w") as f:
    f.write(content)
