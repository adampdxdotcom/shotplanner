import re

with open("src/components/AssetManagerSection.tsx", "r") as f:
    content = f.read()

content = re.sub(
    r'const groupedLibraryAssets = filteredLibraryAssets\.reduce\(\(acc, asset\) => \{',
    r'const groupedLibraryAssets = filteredLibraryAssets.reduce<Record<string, MediaAsset[]>>((acc, asset) => {',
    content
)

content = re.sub(
    r'Object\.entries\(groupedLibraryAssets\)\.map\(\(\[subject, assets\]\) => \(',
    r'Object.entries(groupedLibraryAssets).map(([subject, groupAssets]) => (',
    content
)

content = re.sub(
    r'\{assets\.length\}',
    r'{groupAssets.length}',
    content
)

content = re.sub(
    r'assets\.length === 1',
    r'groupAssets.length === 1',
    content
)

content = re.sub(
    r'\{assets\.map\(asset => \(',
    r'{groupAssets.map(asset => (',
    content
)

with open("src/components/AssetManagerSection.tsx", "w") as f:
    f.write(content)

with open("src/components/SceneProjectHub.tsx", "r") as f:
    hub_content = f.read()

hub_content = re.sub(
    r'const matchedAsset = assets\.find\(a => a\.filename === shotFilenameOverride \|\| a\.name === shotFilenameOverride\);',
    r'const matchedAsset = assets.find(a => a.filename === shotFilenameOverride || (a as any).name === shotFilenameOverride);',
    hub_content
)

with open("src/components/SceneProjectHub.tsx", "w") as f:
    f.write(hub_content)

