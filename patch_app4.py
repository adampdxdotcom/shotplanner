import re

with open("src/App.tsx", "r") as f:
    content = f.read()

target = """    if (data.schema_version === "1.0") {
      setSceneProject(data);
      setCurrentProjectName(filename);
      setActiveSection("scene");
      setIsDirty(false);
      return;
    }"""

replacement = """    if (data.schema_version === "1.0") {
      setSceneProject(data);
      setCurrentProjectName(filename.replace(/\\.json$/i, ""));
      setActiveSection("scene");
      setIsDirty(false);
      return;
    }"""

content = content.replace(target, replacement)

with open("src/App.tsx", "w") as f:
    f.write(content)
