with open("src/App.tsx", "r") as f:
    content = f.read()

target1 = """setAvailableScenes(data.projects.filter((p: string) => p.startsWith("scene_")));"""
replacement1 = """setAvailableScenes(data.projects.map((p: any) => typeof p === 'string' ? p : p.filename).filter((p: string) => p.startsWith("scene_")));"""

content = content.replace(target1, replacement1)

target2 = """setAvailableScenes(listData.projects.filter((p: string) => p.startsWith("scene_")));"""
replacement2 = """setAvailableScenes(listData.projects.map((p: any) => typeof p === 'string' ? p : p.filename).filter((p: string) => p.startsWith("scene_")));"""

content = content.replace(target2, replacement2)

with open("src/App.tsx", "w") as f:
    f.write(content)
