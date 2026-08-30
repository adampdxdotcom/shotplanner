import re
with open("backend/routes/api.py", "r") as f:
    content = f.read()

# Make sure we verify existence
chunk_finish = """        # Move the fully assembled file
        shutil.copyfile(temp_assembly_path, destination_path)
        size_bytes = os.path.getsize(temp_assembly_path)
        os.remove(temp_assembly_path)
        
        if not destination_path.exists():
            raise HTTPException(status_code=500, detail="Assembled file missing after write.")
"""

content = re.sub(
    r'        # Move the fully assembled file\n        shutil.copyfile\(temp_assembly_path, destination_path\)\n        size_bytes = os\.path\.getsize\(temp_assembly_path\)\n        os\.remove\(temp_assembly_path\)',
    chunk_finish,
    content
)

with open("backend/routes/api.py", "w") as f:
    f.write(content)
