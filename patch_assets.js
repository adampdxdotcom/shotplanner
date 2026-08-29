import fs from 'fs';

let content = fs.readFileSync('src/components/AssetManagerSection.tsx', 'utf8');

const replacement = `
      {/* Uploaded Assets Grid */}
      <div className="space-y-8 pt-6">
        
        {/* Images Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-zinc-200">
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
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-zinc-200">
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
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-zinc-200">
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
`;

// we need to extract the existing card render logic into a function `renderAssetCard` and create `renderEmptySlot`.
