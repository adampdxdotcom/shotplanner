import re
with open("backend/routes/api.py", "r") as f:
    text = f.read()
print(text.count("in_memory_asset_metadata"))
