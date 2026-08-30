import re

with open("backend/routes/api.py", "r") as f:
    content = f.read()

replacement = """async def save_project(req: Dict[str, Any]):
    raw_name = str(req.get("filename") or req.get("name") or (req.get("data", {}).get("scene_name") if isinstance(req.get("data"), dict) else None) or "project")
    
    # Strip existing .json suffix if present before sanitization
    if raw_name.lower().endswith(".json"):
        raw_name = raw_name[:-5]
        
    sanitized_name = "".join(c for c in raw_name if c.isalnum() or c in ("_", "-"))
    if not sanitized_name:
        sanitized_name = "project"
        
    final_filename = f"{sanitized_name}.json"
    file_path = PROJECTS_DIR / final_filename"""

content = re.sub(
    r'async def save_project\(req: Dict\[str, Any\]\):\n    raw_name = req\.get\("filename"\) or req\.get\("name"\) or \(req\.get\("data", \{\}\)\.get\("scene_name"\) if isinstance\(req\.get\("data"\), dict\) else None\) or "project"\n    sanitized_name = "".join\(c for c in str\(raw_name\) if c\.isalnum\(\) or c in \("_", "-"\)\)\n    if not sanitized_name:\n        sanitized_name = "project"\n    final_filename = sanitized_name\[:-5\] \+ "\.json" if sanitized_name\.endswith\("_json"\) else \(sanitized_name if sanitized_name\.endswith\("\.json"\) else f"\{sanitized_name\}\.json"\)\n    file_path = PROJECTS_DIR / final_filename',
    replacement,
    content
)

with open("backend/routes/api.py", "w") as f:
    f.write(content)
