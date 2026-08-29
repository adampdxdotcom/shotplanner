import re

with open("src/components/SceneProjectHub.tsx", "r") as f:
    content = f.read()

# 1. Fix getAssetFilenameForSlot
content = re.sub(
    r'(return activeShot\?\.assigned_slots\[slotIndex\] \|\| activeShot\?\.assigned_slots\[slotIndex \+ 1\]) \|\| project\.shared_assets\.find\(a => a\.slot_index === slotIndex\)\?\.filename \|\| "";',
    r'\1 || "";',
    content
)

# 2. Fix getAssetForSlot
content = re.sub(
    r'(// 2\. If no shot override, check the project shared library for an asset inherently assigned to this slot index\s*const libraryAsset = assets\.find\(a => a\.slot_index === slotIndex\);\s*if \(libraryAsset\) \{\s*return \{ \.\.\.libraryAsset, preview_url: getAssetMediaUrl\(libraryAsset\) \};\s*\})',
    r'// 2. Removed global fallback to prevent new shots from bleeding Shot 1\'s assets',
    content
)

# 3. Fix getShotThumbnailUrl (remove fallback to first available image)
content = re.sub(
    r'(// 5\. Fallback to first available image in the project\s*if \(!filename && assets\.length > 0\) \{\s*// Filter out videos/audio to ensure it\'s an image\s*const imageAsset = assets\.find\(a => !a\.filename\.match\(/\\.\(mp4\|webm\|mov\|mp3\|wav\)\$/i\)\);\s*if \(imageAsset\) filename = imageAsset\.filename;\s*\})',
    r'// 5. Removed fallback to random project images so empty shots look empty',
    content
)

with open("src/components/SceneProjectHub.tsx", "w") as f:
    f.write(content)
