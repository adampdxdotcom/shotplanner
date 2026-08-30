import re

with open("server/services/projectService.ts", "r") as f:
    content = f.read()

sanitizer = """export function sanitizeProjectName(name: string): string {
  let clean = name.trim();
  if (clean.toLowerCase().endsWith(".json")) {
    clean = clean.slice(0, -5);
  }
  clean = clean.toLowerCase().replace(/[^a-z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return clean || "project";
}

export function saveProjectData"""

content = content.replace("export function saveProjectData", sanitizer)

# patch saveProjectData
t_save = """export function saveProjectData(projectName: string, projectData: any): string {
  let cleanName = projectName;
  if (cleanName.toLowerCase().endsWith(".json")) {
    cleanName = cleanName.slice(0, -5);
  }
  
  cleanName = cleanName.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!cleanName) {
    cleanName = "project";
  }
  
  const targetPath = path.join(PROJECTS_DIR, `${cleanName}.json`);"""

r_save = """export function saveProjectData(projectName: string, projectData: any): string {
  const cleanName = sanitizeProjectName(projectName);
  const targetPath = path.join(PROJECTS_DIR, `${cleanName}.json`);"""
content = content.replace(t_save, r_save)

# patch getProjectData
t_get = """export function getProjectData(projectName: string): any | null {
  const cleanName = projectName.replace(/\\.json$/i, "");
  const p = path.join(PROJECTS_DIR, `${cleanName}.json`);"""
r_get = """export function getProjectData(projectName: string): any | null {
  const cleanName = sanitizeProjectName(projectName);
  const p = path.join(PROJECTS_DIR, `${cleanName}.json`);"""
content = content.replace(t_get, r_get)

# patch deleteProject
t_del = """export function deleteProject(projectName: string): boolean {
  let cleanName = projectName.trim();
  if (cleanName.toLowerCase().endsWith(".json")) {
    cleanName = cleanName.slice(0, -5);
  }
  cleanName = cleanName.toLowerCase().replace(/[^a-z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  const targetPath = path.join(PROJECTS_DIR, `${cleanName}.json`);"""
r_del = """export function deleteProject(projectName: string): boolean {
  const cleanName = sanitizeProjectName(projectName);
  const targetPath = path.join(PROJECTS_DIR, `${cleanName}.json`);"""
content = content.replace(t_del, r_del)

# Wait, deleteProject might still be the old one. Let's check deleteProject:
with open("server/services/projectService.ts", "w") as f:
    f.write(content)
