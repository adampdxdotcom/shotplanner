import re

with open("src/components/AssetManagerSection.tsx", "r") as f:
    content = f.read()

# Replace the handleDelete call in renderAsset
new_delete = """              onClick={(e) => {
                e.stopPropagation();
                if (activeShotId) {
                  const globalSlot = getGlobalSlotIndex(type as any, idx);
                  onUpdateProject(prev => {
                    const shots = [...prev.shots];
                    const shotIdx = shots.findIndex(s => s.id === activeShotId);
                    if (shotIdx !== -1) {
                      const nextSlots = { ...shots[shotIdx].assigned_slots };
                      delete nextSlots[globalSlot];
                      shots[shotIdx] = { ...shots[shotIdx], assigned_slots: nextSlots };
                    }
                    return { ...prev, shots };
                  });
                } else {
                  handleDelete(asset.filename);
                }
              }}"""

content = re.sub(
    r'              onClick=\{\(\) => handleDelete\(asset\.filename\)\}',
    new_delete,
    content,
    count=1
)

with open("src/components/AssetManagerSection.tsx", "w") as f:
    f.write(content)
