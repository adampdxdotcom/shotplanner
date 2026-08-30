import re

with open("server/services/projectService.ts", "r") as f:
    content = f.read()

t_del = """export function deleteProject(projectName: string): boolean {
  const cleanName = projectName.replace(/\\.json$/i, "");
  const targetPath = path.join(PROJECTS_DIR, `${cleanName}.json`);"""

r_del = """export function deleteProject(projectName: string): boolean {
  const cleanName = sanitizeProjectName(projectName);
  const targetPath = path.join(PROJECTS_DIR, `${cleanName}.json`);"""
content = content.replace(t_del, r_del)

t_zip = """export async function exportProjectZip(projectName: string, res: Response): Promise<void> {
  const rawName = projectName.replace(/\\.json$/, "");
  const projectData = getProjectData(rawName);"""

r_zip = """export async function exportProjectZip(projectName: string, res: Response): Promise<void> {
  const cleanName = sanitizeProjectName(projectName);
  const projectData = getProjectData(cleanName);"""
content = content.replace(t_zip, r_zip)

with open("server/services/projectService.ts", "w") as f:
    f.write(content)
