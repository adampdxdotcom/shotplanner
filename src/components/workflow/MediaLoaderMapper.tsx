import React from "react";
import { Layers, Image as ImageIcon, Video as VideoIcon, Music, ArrowRight } from "lucide-react";
import { MediaAsset, ShotItem } from "../../types";
import { getAssetMediaUrl } from "../../utils/assetUrl";

interface MediaLoaderMapperProps {
  imageNodes: any[];
  videoNodes: any[];
  audioNodes: any[];
  activeShot: ShotItem | undefined;
  activeShotId: string | null;
  nodeMappings: Record<string, string>;
  uploadedAssets: MediaAsset[];
  onUpdateMapping: (nodeId: string, assetFilename: string) => void;
  onUpdateShot: (updater: (prev: ShotItem) => ShotItem) => void;
}

export const MediaLoaderMapper: React.FC<MediaLoaderMapperProps> = ({
  imageNodes,
  videoNodes,
  audioNodes,
  activeShot,
  activeShotId,
  nodeMappings,
  uploadedAssets,
  onUpdateMapping,
  onUpdateShot
}) => {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          Dynamic Media Loader Node Mappings (inputs.image / inputs.video / inputs.audio)
        </span>
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {imageNodes.length + videoNodes.length + audioNodes.length} media loader node(s) detected
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Image Loaders */}
        {imageNodes.map((node, idx) => {
          const assignedFile = activeShot?.assigned_slots[idx] || nodeMappings[node.id] || "";
          const mappedAsset = uploadedAssets.find(a => a.filename === assignedFile);

          return (
            <div key={node.id} className="bg-white dark:bg-zinc-950/60 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-transparent">
                    <ImageIcon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 font-mono">Node #{node.id} — {node.title}</p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">class_type: {node.class_type} | default: "{node.current_file || 'example.png'}"</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                {mappedAsset && (
                  <img 
                    src={getAssetMediaUrl(mappedAsset, true)} 
                    alt={mappedAsset.subject_name} 
                    className="w-7 h-7 rounded object-cover border border-zinc-300 dark:border-zinc-700 shrink-0" 
                  />
                )}
                <select
                  value={assignedFile}
                  onChange={(e) => {
                    const val = e.target.value;
                    onUpdateMapping(node.id, val);
                    if (activeShotId) {
                      onUpdateShot(prev => ({
                        ...prev,
                        assigned_slots: {
                          ...prev.assigned_slots,
                          [idx]: val
                        }
                      }));
                    }
                  }}
                  className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 focus:border-amber-500 rounded-md px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-200 outline-none shadow-2xs"
                >
                  <option key="empty" value="">-- Assign Uploaded Asset (or Use Bypass) --</option>
                  {uploadedAssets.map((asset, i) => (
                    <option key={`asset-${asset.filename}-${i}`} value={asset.filename}>
                      [{asset.type}] {asset.subject_name} ({asset.filename})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}

        {/* Video Loaders */}
        {videoNodes.map((node) => {
          const assignedFile = nodeMappings[node.id] || "";
          return (
            <div key={node.id} className="bg-white dark:bg-zinc-950/60 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-transparent">
                    <VideoIcon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 font-mono">Node #{node.id} — {node.title}</p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">class_type: {node.class_type}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                <select
                  value={assignedFile}
                  onChange={(e) => onUpdateMapping(node.id, e.target.value)}
                  className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 focus:border-indigo-500 rounded-md px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-200 outline-none shadow-2xs"
                >
                  <option key="empty" value="">-- Assign Uploaded Video --</option>
                  {uploadedAssets.filter(a => a.media_type === "video").map((asset, i) => (
                    <option key={`vid-${asset.filename}-${i}`} value={asset.filename}>
                      [Video] {asset.subject_name} ({asset.filename})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}

        {/* Audio Loaders */}
        {audioNodes.map((node) => {
          const assignedFile = nodeMappings[node.id] || "";
          return (
            <div key={node.id} className="bg-white dark:bg-zinc-950/60 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-transparent">
                    <Music className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 font-mono">Node #{node.id} — {node.title}</p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">class_type: {node.class_type}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                <select
                  value={assignedFile}
                  onChange={(e) => onUpdateMapping(node.id, e.target.value)}
                  className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 focus:border-emerald-500 rounded-md px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-200 outline-none shadow-2xs"
                >
                  <option key="empty" value="">-- Assign Uploaded Audio --</option>
                  {uploadedAssets.filter(a => a.media_type === "audio").map((asset, i) => (
                    <option key={`aud-${asset.filename}-${i}`} value={asset.filename}>
                      [Audio] {asset.subject_name} ({asset.filename})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
