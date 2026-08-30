with open("server/services/projectService.ts", "r") as f:
    content = f.read()

target = "const cleanName = projectName.replace(/\\.json$/, \"\");"
replacement = "const cleanName = projectName.replace(/\\.json$/i, \"\");"

content = content.replace(target, replacement)

with open("server/services/projectService.ts", "w") as f:
    f.write(content)
