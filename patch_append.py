import re

with open("src/App.tsx", "r") as f:
    app = f.read()

# Replace the append logic to deduplicate by filename
dedup = """    setAssets(prev => {
      // Find if this exact asset file already exists
      const exactMatch = prev.findIndex(a => a.filename === newAsset.filename);
      if (exactMatch !== -1) {
        const next = [...prev];
        next[exactMatch] = assetWithSlot; // update its latest slot assignment globally
        return next;
      }
      return [...prev, assetWithSlot];
    });"""

app = re.sub(
    r'(    setAssets\(prev => \{[\s\S]*?return \[\.\.\.prev, assetWithSlot\];\n    \}\);)',
    dedup,
    app,
    count=1
)

with open("src/App.tsx", "w") as f:
    f.write(app)
