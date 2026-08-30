import re

with open("server/services/projectService.ts", "r") as f:
    content = f.read()

target = """export function listProjects(): string[] {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  return fs
    .readdirSync(PROJECTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\\.json$/, ""));
}"""

replacement = """export function listProjects(): any[] {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  const files = fs.readdirSync(PROJECTS_DIR).filter((f) => f.endsWith(".json"));
  
  const projects = files.map((f) => {
    const fullPath = path.join(PROJECTS_DIR, f);
    const stats = fs.statSync(fullPath);
    return {
      filename: f,
      display_name: f.replace(/\\.json$/i, ""),
      mtime: stats.mtime.toISOString(),
      size: stats.size
    };
  });
  
  return projects.sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime());
}"""

content = content.replace(target, replacement)

with open("server/services/projectService.ts", "w") as f:
    f.write(content)
