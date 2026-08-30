with open("server/services/projectService.ts", "r") as f:
    content = f.read()

target = """export function saveProjectData(projectName: string, projectData: any): string {
  const cleanName = projectName.replace(/\.json$/, "");
  const targetPath = path.join(PROJECTS_DIR, `${cleanName}.json`);"""

replacement = """export function saveProjectData(projectName: string, projectData: any): string {
  let cleanName = projectName;
  if (cleanName.toLowerCase().endsWith(".json")) {
    cleanName = cleanName.slice(0, -5);
  }
  
  cleanName = cleanName.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!cleanName) {
    cleanName = "project";
  }
  
  const targetPath = path.join(PROJECTS_DIR, `${cleanName}.json`);"""

content = content.replace(target, replacement)

with open("server/services/projectService.ts", "w") as f:
    f.write(content)
