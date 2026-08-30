import re

with open("src/App.tsx", "r") as f:
    content = f.read()

t_fetchAssets = """  const fetchAssets = async (sceneName?: string) => {
    try {
      const url = sceneName ? `/api/assets?scene_name=${encodeURIComponent(sceneName)}` : "/api/assets";
      const res = await fetch(url);"""
r_fetchAssets = """  const fetchAssets = async (sceneName?: string) => {
    try {
      const baseUrl = sceneName ? `/api/assets?scene_name=${encodeURIComponent(sceneName)}` : "/api/assets";
      const cacheBuster = `&_t=${Date.now()}`;
      const url = baseUrl.includes("?") ? `${baseUrl}${cacheBuster}` : `${baseUrl}?${cacheBuster}`;
      const res = await fetch(url, { headers: { "Cache-Control": "no-store" } });"""
content = content.replace(t_fetchAssets, r_fetchAssets)


t_loadProject1 = """    if (data.schema_version === "1.0") {
      setSceneProject(data);
      setCurrentProjectName(filename.replace(/\.json$/i, ""));
      setActiveSection("scene");
      setIsDirty(false);
      return;
    }"""
r_loadProject1 = """    if (data.schema_version === "1.0") {
      setAssets([]);
      setNodeMappings({});
      setParameterNodeMappings({});
      setBasicStub("");
      setExpandedPrompt("");
      setSubjects([]);
      
      setSceneProject(data);
      setCurrentProjectName(filename.replace(/\.json$/i, ""));
      setActiveSection("scene");
      setIsDirty(false);
      
      await fetchAssets(data.scene_name || filename.replace(/\.json$/i, ""));
      return;
    }"""
content = content.replace(t_loadProject1, r_loadProject1)

t_loadProjectLegacy = """    // 1. Sync & set saved assets if present"""
r_loadProjectLegacy = """    // 0. Reset state completely before hydrating
    setAssets([]);
    setNodeMappings({});
    setParameterNodeMappings({});
    setBasicStub("");
    setExpandedPrompt("");
    setSubjects([]);
    
    // 1. Sync & set saved assets if present"""
content = content.replace(t_loadProjectLegacy, r_loadProjectLegacy)

t_newProject = """      setSceneProject(newScene);
      setCurrentProjectName(cleanFilename);
      setActiveShotId(newScene.shots[0].id);
      setIsDirty(false);"""
r_newProject = """      setAssets([]);
      setNodeMappings({});
      setParameterNodeMappings({});
      setBasicStub("");
      setExpandedPrompt("");
      setSubjects([]);
      
      setSceneProject(newScene);
      setCurrentProjectName(cleanFilename);
      setActiveShotId(newScene.shots[0].id);
      setIsDirty(false);
      
      await fetchAssets(sceneName);"""
content = content.replace(t_newProject, r_newProject)

with open("src/App.tsx", "w") as f:
    f.write(content)
