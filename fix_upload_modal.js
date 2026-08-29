import fs from 'fs';

let content = fs.readFileSync('src/components/AssetManagerSection.tsx', 'utf8');

const replacement = `
  const openUploadModal = (type: "image" | "audio" | "video", index: number) => {
    setActiveTab(type);
    setAssetType(type === "image" ? "Headshot" : type === "audio" ? "Voiceover Audio" : "Motion Reference Video");
    setSubjectName("");
    setDescription("");
    setUploadError(null);
    setUploadModalSlot({ type, index });
  };

  const closeUploadModal = () => {
    setUploadModalSlot(null);
  };

  const openEditModal`;

content = content.replace("  const openEditModal", replacement);

content = content.replace(
  'const renderEmptySlot = (idx: number, type: string) => (\n    <div \n      key={`empty-${type}-${idx}`} \n      className="bg-zinc-950/30 p-3 rounded-xl border-2 border-dashed border-zinc-800/80 flex flex-col items-center justify-center min-h-[160px] text-zinc-600 transition-colors"\n    >',
  'const renderEmptySlot = (idx: number, type: string) => (\n    <div \n      key={`empty-${type}-${idx}`} \n      onClick={() => openUploadModal(type as any, idx)}\n      className="bg-zinc-950/30 p-3 rounded-xl border-2 border-dashed border-zinc-800/80 flex flex-col items-center justify-center min-h-[160px] text-zinc-600 transition-colors cursor-pointer hover:border-zinc-600 hover:bg-zinc-900/50 hover:text-zinc-400 group"\n    >'
);

fs.writeFileSync('src/components/AssetManagerSection.tsx', content);
