import re

with open("src/App.tsx", "r") as f:
    content = f.read()

t_fetch = """  const fetchAssets = async () => {
    try {
      const res = await fetch("/api/assets");"""
r_fetch = """  const fetchAssets = async (sceneName?: string) => {
    try {
      const url = sceneName ? `/api/assets?scene_name=${encodeURIComponent(sceneName)}` : "/api/assets";
      const res = await fetch(url);"""
content = content.replace(t_fetch, r_fetch)

t_load = """    } else {
      await fetchAssets();
    }"""
r_load = """    } else {
      await fetchAssets(data.scene_name || cleanName);
    }"""
content = content.replace(t_load, r_load)

with open("src/App.tsx", "w") as f:
    f.write(content)
