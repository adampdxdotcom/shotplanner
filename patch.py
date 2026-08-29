import re

# 1. App.tsx - Fix handleAssetUploaded so it appends
with open("src/App.tsx", "r") as f:
    app = f.read()

app = re.sub(
    r'(      if \(existingIndex !== -1\) \{\n        const next = \[\.\.\.prev\];\n        next\[existingIndex\] = assetWithSlot;\n        return next;\n      \})',
    r'      if (existingIndex !== -1) {\n        // Keep the old asset in the library, just append the new one\n        return [...prev, assetWithSlot];\n      }',
    app
)
with open("src/App.tsx", "w") as f:
    f.write(app)

# 2. SceneProjectHub.tsx - Fix handleAddBlankShot
with open("src/components/SceneProjectHub.tsx", "r") as f:
    hub = f.read()

hub = re.sub(
    r'id: "shot_" \+ Date\.now\(\),',
    r'id: "shot_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),',
    hub
)
with open("src/components/SceneProjectHub.tsx", "w") as f:
    f.write(hub)

# 3. AssetManagerSection.tsx - Fix handleAddBlankShot
with open("src/components/AssetManagerSection.tsx", "r") as f:
    asset_mgr = f.read()

asset_mgr = re.sub(
    r'id: "shot_" \+ Date\.now\(\),',
    r'id: "shot_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),',
    asset_mgr
)
with open("src/components/AssetManagerSection.tsx", "w") as f:
    f.write(asset_mgr)
