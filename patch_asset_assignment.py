import re

with open("src/components/AssetManagerSection.tsx", "r") as f:
    content = f.read()

helpers = """
  // Maps UI slot indices to global assigned_slots indices to prevent collisions
  const getGlobalSlotIndex = (type: string, idx: number) => {
    if (type === "audio") return 9 + idx;
    if (type === "video") return 11 + idx;
    return idx;
  };

  const getAssetForSlot = (type: "image" | "audio" | "video", slotIdx: number): MediaAsset | undefined => {
    const globalSlot = getGlobalSlotIndex(type, slotIdx);
    
    // 1. Check activeShot.assigned_slots first
    if (activeShotId) {
      const shot = sceneProject.shots.find(s => s.id === activeShotId);
      if (shot && shot.assigned_slots && shot.assigned_slots[globalSlot]) {
        const filename = shot.assigned_slots[globalSlot];
        const match = assets.find(a => a.filename === filename);
        if (match) return match;
      }
    }
    
    // 2. Fallback to global slot_index
    const typeList = assets.filter(a => type === "image" ? isImg(a) : type === "audio" ? isAud(a) : isVid(a));
    const direct = typeList.find(a => a.slot_index === slotIdx);
    if (direct) return direct;
    
    const unassigned = typeList.filter(a => a.slot_index === undefined);
    const assignedSlots = new Set(typeList.map(a => a.slot_index).filter(idx => idx !== undefined));
    let currSlot = 0;
    for (const item of unassigned) {
      while (assignedSlots.has(currSlot)) currSlot++;
      if (currSlot === slotIdx) return item;
      currSlot++;
    }
    return undefined;
  };
"""

content = re.sub(
    r'(  const getAssetForSlot = \(type: "image" \| "audio" \| "video", slotIdx: number\): MediaAsset \| undefined => \{[\s\S]*?return undefined;\n  \};)',
    helpers,
    content,
    count=1
)

# Now update handleAssignExistingAsset
assign_existing = """  const handleAssignExistingAsset = () => {
    if (!selectedLibraryAsset || !uploadModalSlot) return;
    
    if (activeShotId) {
      const globalSlot = getGlobalSlotIndex(uploadModalSlot.type, uploadModalSlot.index);
      onUpdateProject(prev => {
        const shots = [...prev.shots];
        const idx = shots.findIndex(s => s.id === activeShotId);
        if (idx !== -1) {
          shots[idx] = {
            ...shots[idx],
            assigned_slots: {
              ...(shots[idx].assigned_slots || {}),
              [globalSlot]: selectedLibraryAsset.filename
            }
          };
        }
        return { ...prev, shots };
      });
    }
    // Also dispatch the upload event so it binds correctly in the legacy system if needed
    onAssetUploaded(selectedLibraryAsset, uploadModalSlot.index, uploadModalSlot.type);
    
    closeUploadModal();
  };"""

content = re.sub(
    r'(  const handleAssignExistingAsset = \(\) => \{[\s\S]*?closeUploadModal\(\);\n  \};)',
    assign_existing,
    content,
    count=1
)

# Now update handleFileSelect
# Find the part where it does:
#        onAssetUploaded(finalizedAsset, targetSlotIndex, targetMediaType);
#        closeUploadModal();
# And add the assignment
file_select_patch = """        if (activeShotId) {
          const globalSlot = getGlobalSlotIndex(targetMediaType, targetSlotIndex);
          onUpdateProject(prev => {
            const shots = [...prev.shots];
            const idx = shots.findIndex(s => s.id === activeShotId);
            if (idx !== -1) {
              shots[idx] = {
                ...shots[idx],
                assigned_slots: {
                  ...(shots[idx].assigned_slots || {}),
                  [globalSlot]: finalizedAsset.filename
                }
              };
            }
            return { ...prev, shots };
          });
        }
        onAssetUploaded(finalizedAsset, targetSlotIndex, targetMediaType);
        closeUploadModal();"""

content = re.sub(
    r'(        onAssetUploaded\(finalizedAsset, targetSlotIndex, targetMediaType\);\n        closeUploadModal\(\);)',
    file_select_patch,
    content,
    count=1
)

with open("src/components/AssetManagerSection.tsx", "w") as f:
    f.write(content)
