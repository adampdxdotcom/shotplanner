with open("server/services/projectService.ts", "r") as f:
    content = f.read()

t_zip = """export async function exportProjectZip(projectName: string, res: Response): Promise<void> {
  const rawName = projectName.replace(/\\.json$/, "");
  const jsonFileName = `${rawName}.json`;
  const filePath = path.join(PROJECTS_DIR, jsonFileName);"""

r_zip = """export async function exportProjectZip(projectName: string, res: Response): Promise<void> {
  const cleanName = sanitizeProjectName(projectName);
  const jsonFileName = `${cleanName}.json`;
  const filePath = path.join(PROJECTS_DIR, jsonFileName);"""

content = content.replace(t_zip, r_zip)
content = content.replace("res.status(404).json({ error: `Project '${rawName}' not found", "res.status(404).json({ error: `Project '${cleanName}' not found")

with open("server/services/projectService.ts", "w") as f:
    f.write(content)
