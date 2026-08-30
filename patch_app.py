import re

with open("src/App.tsx", "r") as f:
    content = f.read()

replacement = """    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to save project.");
    }
    
    const resData = await res.json();
    const actualFilename = resData.filename || filename;
    const cleanName = actualFilename.replace(/\.json$/i, "");
    
    setCurrentProjectName(cleanName);
    setIsDirty(false);
    addToast(`Project "${cleanName}" saved successfully with ${assets.length} image asset(s) and ${consolidatedSubjects.length} subject(s).`, "success");"""

content = re.sub(
    r'    if \(!res\.ok\) \{\n      const err = await res\.json\(\);\n      throw new Error\(err\.error \|\| "Failed to save project\."\);\n    \}\n    \n    setCurrentProjectName\(filename\.replace\(/\\\.json\$\/, ""\)\);\n    setIsDirty\(false\);\n    addToast\(`Project "\\$\{filename\}" saved successfully with \\$\{assets\.length\} image asset\(s\) and \\$\{consolidatedSubjects\.length\} subject\(s\)\.`, "success"\);',
    replacement,
    content
)

with open("src/App.tsx", "w") as f:
    f.write(content)
