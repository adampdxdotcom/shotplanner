import re

with open("backend/routes/api.py", "r") as f:
    content = f.read()

content = content.replace("sanitize_project_name,", "sanitize_project_name,\n    find_project_file,")

with open("backend/routes/api.py", "w") as f:
    f.write(content)
