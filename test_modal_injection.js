import fs from 'fs';

let content = fs.readFileSync('src/components/AssetManagerSection.tsx', 'utf8');

const emptySlotRegex = /const renderEmptySlot = \(idx: number, type: string\) => \(\n\s*<div\n\s*key=\{`empty-\$\{type\}-\$\{idx\}`\}\n\s*className="bg-zinc-950\/30 p-3 rounded-xl border-2 border-dashed border-zinc-800\/80 flex flex-col items-center justify-center min-h-\[160px\] text-zinc-600 transition-colors"\n\s*>/;

const newEmptySlot = `const openUploadModal = (type: "image" | "audio" | "video", index: number) => {
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

  const renderEmptySlot = (idx: number, type: string) => (
    <div 
      key={\`empty-\${type}-\${idx}\`} 
      onClick={() => openUploadModal(type as any, idx)}
      className="bg-zinc-950/30 p-3 rounded-xl border-2 border-dashed border-zinc-800/80 flex flex-col items-center justify-center min-h-[160px] text-zinc-600 transition-colors cursor-pointer hover:border-zinc-600 hover:bg-zinc-900/50 hover:text-zinc-400 group"
    >
      <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center mb-2 group-hover:bg-zinc-800 group-hover:text-amber-400 transition-colors">
        <UploadCloud className="w-4 h-4" />
      </div>
      <span className="text-xs font-semibold mb-1 uppercase tracking-wider opacity-50 group-hover:opacity-100 transition-opacity">Upload Slot</span>
      <span className="font-mono text-[10px] text-zinc-500 group-hover:text-zinc-400 transition-colors">
        {type === "video" ? \`<Video \${idx + 1}>\` : type === "audio" ? \`<Audio \${idx + 1}>\` : \`<Picture \${idx + 1}>\`}
      </span>
    </div>
  `;

content = content.replace(emptySlotRegex, newEmptySlot);

fs.writeFileSync('src/components/AssetManagerSection.tsx', content);
