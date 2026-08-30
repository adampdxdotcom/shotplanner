import re

with open("server/services/projectService.ts", "r") as f:
    content = f.read()

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

content = re.sub(
    r'export function saveProjectData\(projectName: string, projectData: any\): string \{\n  const cleanName = projectName\.replace\(/\\\\\.json\$\/, ""\);\n  const targetPath = path\.join\(PROJECTS_DIR, `\$\{cleanName\}\.json`\);',
    replacement,
    content
)

with open("server/services/projectService.ts", "w") as f:
    f.write(content)
