import fs from 'fs';

let content = fs.readFileSync('src/components/AssetManagerSection.tsx', 'utf8');

const renderFunctions = `
  const renderAssetCard = (asset: MediaAsset, idx: number, type: string) => (
    <div 
      key={asset.filename} 
      className="bg-zinc-950 p-3 rounded-xl border-2 border-zinc-700 hover:border-zinc-700 transition-all space-y-2 relative group flex flex-col"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-zinc-800 text-zinc-300 text-[10px] font-mono font-bold flex items-center justify-center">
            {idx + 1}
          </span>
          <div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
              {asset.type}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => openEditModal(asset)}
            className="text-zinc-500 hover:text-indigo-400 p-1 rounded transition-colors"
            title="Edit asset"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleDelete(asset.filename)}
            className="text-zinc-500 hover:text-red-400 p-1 rounded transition-colors"
            title="Delete asset"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {asset.media_type === "image" && asset.preview_url && (
        <div 
          className="relative w-full aspect-square bg-zinc-900 rounded-lg overflow-hidden cursor-pointer group/img border border-zinc-800"
          onClick={() => setLightboxAsset(asset)}
        >
          <img src={asset.preview_url} alt={asset.subject_name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
            <Maximize className="w-6 h-6 text-white" />
          </div>
        </div>
      )}

      {/* Subject Name & Filename */}
      <div>
        <p className="text-xs font-semibold text-zinc-100 truncate">
          {asset.subject_name}
        </p>
        <p className="text-[11px] font-mono text-zinc-400 truncate mt-0.5">
          {asset.filename}
        </p>
      </div>

      {/* LLM Description preview */}
      {asset.description && (
        <p className="text-[11px] text-zinc-400 line-clamp-2 italic bg-zinc-900/70 p-1.5 rounded border-2 border-zinc-700/50">
          "{asset.description}"
        </p>
      )}

      <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1 border-t border-zinc-900 mt-auto">
        <span>{(asset.size_bytes / 1024).toFixed(1)} KB</span>
        <span className="font-mono text-indigo-400">
          {asset.media_type === "video" ? \`<Video \${idx + 1}>\` : asset.media_type === "audio" ? \`<Audio \${idx + 1}>\` : \`<Picture \${idx + 1}>\`}
        </span>
      </div>
    </div>
  );

  const renderEmptySlot = (idx: number, type: string) => (
    <div 
      key={\`empty-\${type}-\${idx}\`} 
      className="bg-zinc-950/30 p-3 rounded-xl border-2 border-dashed border-zinc-800/80 flex flex-col items-center justify-center min-h-[160px] text-zinc-600 transition-colors"
    >
      <span className="text-xs font-semibold mb-1 uppercase tracking-wider opacity-50">Empty Slot</span>
      <span className="font-mono text-[10px] text-zinc-500">
        {type === "video" ? \`<Video \${idx + 1}>\` : type === "audio" ? \`<Audio \${idx + 1}>\` : \`<Picture \${idx + 1}>\`}
      </span>
    </div>
  );

  const openEditModal`;

content = content.replace("  const openEditModal", renderFunctions);

const regex = /\{\/\* Uploaded Assets Grid \*\/\}.*?\{\/\* Edit Modal \*\/\}/s;

const newGridSection = `{/* Uploaded Assets Grid */}
      <div className="space-y-6 pt-4 border-t border-zinc-800">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-200">
            Uploaded Media Library
          </h2>
          <span className="text-[11px] text-zinc-400">Physically stored in <code className="text-zinc-300 bg-zinc-800 px-1 py-0.5 rounded">/assets/uploads/</code></span>
        </div>

        {/* Images Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-amber-300">
            <ImageIcon className="w-4 h-4" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">
              Images ({images.length} / {MAX_IMAGES})
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: MAX_IMAGES }).map((_, idx) => {
              const asset = images[idx];
              if (asset) return renderAssetCard(asset, idx, "image");
              return renderEmptySlot(idx, "image");
            })}
          </div>
        </div>

        {/* Video Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-indigo-300">
            <VideoIcon className="w-4 h-4" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">
              Video ({videos.length} / {MAX_VIDEOS})
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: MAX_VIDEOS }).map((_, idx) => {
              const asset = videos[idx];
              if (asset) return renderAssetCard(asset, idx, "video");
              return renderEmptySlot(idx, "video");
            })}
          </div>
        </div>

        {/* Audio Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-300">
            <Music className="w-4 h-4" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">
              Audio ({audios.length} / {MAX_AUDIOS})
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: MAX_AUDIOS }).map((_, idx) => {
              const asset = audios[idx];
              if (asset) return renderAssetCard(asset, idx, "audio");
              return renderEmptySlot(idx, "audio");
            })}
          </div>
        </div>
      </div>

      {/* Edit Modal */}`;

content = content.replace(regex, newGridSection);

fs.writeFileSync('src/components/AssetManagerSection.tsx', content);
