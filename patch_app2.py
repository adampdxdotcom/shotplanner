with open("src/App.tsx", "r") as f:
    content = f.read()

target = """    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to save project.");
    }
    
    setCurrentProjectName(filename.replace(/\.json$/, ""));
    setIsDirty(false);
    addToast(`Project "${filename}" saved successfully with ${assets.length} image asset(s) and ${consolidatedSubjects.length} subject(s).`, "success");"""

replacement = """    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to save project.");
    }
    
    const resData = await res.json();
    const actualFilename = resData.filename || filename;
    const cleanName = actualFilename.replace(/\.json$/i, "");
    
    setCurrentProjectName(cleanName);
    setIsDirty(false);
    addToast(`Project "${cleanName}" saved successfully.`, "success");"""

content = content.replace(target, replacement)

with open("src/App.tsx", "w") as f:
    f.write(content)
