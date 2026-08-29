import re

with open("src/components/AssetManagerSection.tsx", "r") as f:
    content = f.read()

# Fix the reduce call
content = re.sub(
    r'const groupedLibraryAssets = filteredLibraryAssets\.reduce<Record<string, MediaAsset\[\]>>\(\(acc, asset\) => \{',
    r'const groupedLibraryAssets: Record<string, MediaAsset[]> = filteredLibraryAssets.reduce((acc: Record<string, MediaAsset[]>, asset: MediaAsset) => {',
    content
)

with open("src/components/AssetManagerSection.tsx", "w") as f:
    f.write(content)
