import re

with open("backend/utils/file_handlers.py", "r") as f:
    content = f.read()

func = """def find_asset_file_path(filename: str) -> Optional[Path]:
    \"\"\"Finds an asset file path checking recursively across the entire assets directory.\"\"\"
    clean_name = os.path.basename(filename)
    if ASSETS_DIR.exists():
        # Recursive search across all directories and subdirectories under the base assets directory
        for path in ASSETS_DIR.rglob(clean_name):
            if path.is_file():
                return path
    return None"""

content = re.sub(r'def find_asset_file_path\(filename: str\) -> Optional\[Path\]:.*?return None', func, content, flags=re.DOTALL)

with open("backend/utils/file_handlers.py", "w") as f:
    f.write(content)
