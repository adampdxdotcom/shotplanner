with open("src/App.tsx", "r") as f:
    content = f.read()

target = "setCurrentProjectName(filename.replace(/\\.json$/, \"\"));"
replacement = "setCurrentProjectName(filename.replace(/\\.json$/i, \"\"));"

content = content.replace(target, replacement)

with open("src/App.tsx", "w") as f:
    f.write(content)
