import re

with open("server/services/projectService.ts", "r") as f:
    content = f.read()

t_upsert1 = """  // Sync any saved assets into assetDatabase
  if (Array.isArray(projectData.assets)) {
    for (const item of projectData.assets) {
      if (!item || !item.filename) continue;
      assetService.upsertAsset(item);
    }
  }"""
r_upsert1 = """  // Strict isolation: no global asset database sync"""
content = content.replace(t_upsert1, r_upsert1)

t_upsert2 = """  // If project payload includes assets, sync them into assetDatabase
  if (projectData && Array.isArray(projectData.assets)) {
    for (const item of projectData.assets) {
      if (!item || !item.filename) continue;
      assetService.upsertAsset(item);
    }
  }"""
r_upsert2 = """  // Strict isolation: no global asset database sync"""
content = content.replace(t_upsert2, r_upsert2)

t_upsert3 = """        if (Array.isArray(pData.assets)) {
          for (const item of pData.assets) {
            if (!item || !item.filename) continue;
            assetService.upsertAsset(item);
          }
        }"""
r_upsert3 = """"""
content = content.replace(t_upsert3, r_upsert3)

t_upsert4 = """    } else if (file.path === "assets_db.json") {
      try {
        const importedDb: AssetRecord[] = JSON.parse(buffer.toString("utf-8"));
        for (const item of importedDb) {
          assetService.upsertAsset(item);
        }
      } catch (e) {}"""
r_upsert4 = """    } else if (file.path === "assets_db.json") {
      // Ignored: strictly using project JSON for metadata now"""
content = content.replace(t_upsert4, r_upsert4)

with open("server/services/projectService.ts", "w") as f:
    f.write(content)
