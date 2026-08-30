with open("server/routes/projectRoutes.ts", "r") as f:
    content = f.read()

t1 = """    const rawName = req.params.filename.replace(/\\.json$/, "");
    const projectData = getProjectData(rawName);
    if (!projectData) {
      return res.status(404).json({ error: `Project '${rawName}' not found` });
    }"""
r1 = """    const rawName = req.params.filename;
    const projectData = getProjectData(rawName);
    if (!projectData) {
      return res.status(404).json({ error: `Project '${rawName}' not found` });
    }"""

content = content.replace(t1, r1)

t2 = """    const rawName = req.params.filename.replace(/\\.json$/, "");
    const success = deleteProject(rawName);
    if (!success) {
      return res.status(404).json({ error: `Project '${rawName}' not found` });
    }"""
r2 = """    const rawName = req.params.filename;
    const success = deleteProject(rawName);
    if (!success) {
      return res.status(404).json({ error: `Project '${rawName}' not found` });
    }"""

content = content.replace(t2, r2)

with open("server/routes/projectRoutes.ts", "w") as f:
    f.write(content)
