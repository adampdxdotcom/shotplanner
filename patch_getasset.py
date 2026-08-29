import re

with open("src/components/AssetManagerSection.tsx", "r") as f:
    content = f.read()

replacement = """  const getAssetForSlot = (type: "image" | "audio" | "video", slotIdx: number): MediaAsset | undefined => {
    if (!activeShot) return undefined;
    
    const globalSlot = getGlobalSlotIndex(type, slotIdx);

    // 1. Look up the assigned identifier for this slot from the ACTIVE SHOT ONLY
    const assignedIdentifier = activeShot.assigned_slots?.[globalSlot] 
                            || activeShot.assigned_slots?.[globalSlot + 1]
                            || activeShot.assigned_slots?.[`slot_${globalSlot}`];

    if (!assignedIdentifier) {
      // If the active shot has nothing mapped to this slot, it MUST remain empty!
      return undefined;
    }

    // 2. Resolve the asset from the master asset library by filename or ID
    return assets.find(a => 
      a.filename === assignedIdentifier || 
      (a as any).name === assignedIdentifier ||
      (a as any).id === assignedIdentifier
    );
  };"""

content = re.sub(
    r'(  const getAssetForSlot = \(type: "image" \| "audio" \| "video", slotIdx: number\): MediaAsset \| undefined => \{[\s\S]*?return undefined;\n  \};)',
    replacement,
    content,
    count=1
)

with open("src/components/AssetManagerSection.tsx", "w") as f:
    f.write(content)
