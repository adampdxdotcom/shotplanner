import re

with open("src/components/AssetManagerSection.tsx", "r") as f:
    content = f.read()

# 1. Update handleAssignExistingAsset to include staged: false
content = re.sub(
    r'(\[globalSlot\]: selectedLibraryAsset\.filename\n\s*)\}',
    r'\g<1>},\n              staged: false',
    content,
    count=1
)

# 2. Update handleFileSelect completion to include staged: false
content = re.sub(
    r'(\[globalSlot\]: finalizedAsset\.filename\n\s*)\}',
    r'\g<1>},\n                staged: false',
    content,
    count=1
)

# 3. Update handleDelete unassign logic to include staged: false
content = re.sub(
    r'(shots\[shotIdx\] = \{ \.\.\.shots\[shotIdx\], assigned_slots: nextSlots )\};',
    r'\g<1>, staged: false };',
    content,
    count=1
)

with open("src/components/AssetManagerSection.tsx", "w") as f:
    f.write(content)
