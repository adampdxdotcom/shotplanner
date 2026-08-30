import re

with open("server/services/projectService.ts", "r") as f:
    content = f.read()

find_fn = """
export function findProjectFile(identifier: string): string | null {
  if (!identifier) return null;

  const normalize = (name: string) => {
    let clean = name.trim().toLowerCase();
    if (clean.endsWith(".json")) clean = clean.slice(0, -5);
    if (clean.startsWith("scene_")) clean = clean.slice(6);
    return clean;
  };

  const targetNorm = normalize(identifier);
  if (!targetNorm) return null;

  const sanitized = sanitizeProjectName(identifier);
  const sceneDirName = formatSceneFolderName(sanitized);
  
  // 1. Check direct structured path
  let p = path.join(ASSETS_DIR, sceneDirName, `${sanitized}.json`);
  if (fs.existsSync(p)) return p;
  
  // 2. Check legacy flat path
  p = path.join(PROJECTS_DIR, `${sanitized}.json`);
  if (fs.existsSync(p)) return p;
  
  // 3. Flexible search
  const dirsToScan = [PROJECTS_DIR, ASSETS_DIR];
  if (fs.existsSync(ASSETS_DIR)) {
    const items = fs.readdirSync(ASSETS_DIR, { withFileTypes: true });
    for (const item of items) {
      if (item.isDirectory()) {
        dirsToScan.push(path.join(ASSETS_DIR, item.name));
      }
    }
  }
  
  for (const dir of dirsToScan) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      if (file.isFile() && file.name.endsWith(".json")) {
        if (normalize(file.name) === targetNorm) {
          return path.join(dir, file.name);
        }
      }
    }
  }
  
  return null;
}

export function sanitizeProjectName"""

content = content.replace("export function sanitizeProjectName", find_fn)

t_get = """export function getProjectData(projectName: string): any | null {
  const cleanName = sanitizeProjectName(projectName);
  const jsonFileName = `${cleanName}.json`;
  const sceneName = formatSceneFolderName(cleanName);
  
  let p = path.join(ASSETS_DIR, sceneName, jsonFileName);
  if (!fs.existsSync(p)) {
    p = path.join(PROJECTS_DIR, jsonFileName);
  }
  
  if (!fs.existsSync(p)) return null;
  const projectData = JSON.parse(fs.readFileSync(p, "utf-8"));"""

r_get = """export function getProjectData(projectName: string): any | null {
  const p = findProjectFile(projectName);
  if (!p) return null;
  const projectData = JSON.parse(fs.readFileSync(p, "utf-8"));"""
content = content.replace(t_get, r_get)

t_del = """export function deleteProject(projectName: string): boolean {
  const cleanName = sanitizeProjectName(projectName);
  const jsonFileName = `${cleanName}.json`;
  const sceneName = formatSceneFolderName(cleanName);
  
  let targetPath = path.join(ASSETS_DIR, sceneName, jsonFileName);
  if (!fs.existsSync(targetPath)) {
    targetPath = path.join(PROJECTS_DIR, jsonFileName);
  }
  
  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
    return true;
  }
  return false;
}"""
r_del = """export function deleteProject(projectName: string): boolean {
  const targetPath = findProjectFile(projectName);
  if (targetPath && fs.existsSync(targetPath)) {
    const parentDir = path.dirname(targetPath);
    fs.unlinkSync(targetPath);
    
    // Optional: attempt to remove scene directory if empty
    if (parentDir !== ASSETS_DIR && parentDir !== PROJECTS_DIR) {
      try {
        fs.rmdirSync(parentDir);
      } catch(e) {
        // Not empty or cannot remove
      }
    }
    return true;
  }
  return false;
}"""
content = content.replace(t_del, r_del)

t_zip = """export async function exportProjectZip(projectName: string, res: Response): Promise<void> {
  const cleanName = sanitizeProjectName(projectName);
  const jsonFileName = `${cleanName}.json`;
  const sceneName = formatSceneFolderName(cleanName);
  
  let filePath = path.join(ASSETS_DIR, sceneName, jsonFileName);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(PROJECTS_DIR, jsonFileName);
  }

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: `Project '${cleanName}' not found on server. Please save it first.` });
    return;
  }"""
r_zip = """export async function exportProjectZip(projectName: string, res: Response): Promise<void> {
  const filePath = findProjectFile(projectName);

  if (!filePath || !fs.existsSync(filePath)) {
    res.status(404).json({ error: `Project '${projectName}' not found on server. Please save it first.` });
    return;
  }"""
content = content.replace(t_zip, r_zip)

with open("server/services/projectService.ts", "w") as f:
    f.write(content)
