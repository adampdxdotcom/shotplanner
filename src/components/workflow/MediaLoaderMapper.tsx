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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Image Loaders */}
        {imageNodes.map((node, idx) => {
          const assignedFile = activeShot?.assigned_slots[idx] || nodeMappings[node.id] || "";
          const mappedAsset = uploadedAssets.find(a => a.filename === assignedFile);

          return (
            <div 
              key={node.id} 
              className="bg-white dark:bg-zinc-950/60 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between space-y-2.5 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
            >
              {/* Header Info */}
              <div className="flex items-start gap-2">
                <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-transparent shrink-0 mt-0.5">
                  <ImageIcon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 font-mono truncate">
                    Node #{node.id} — {node.title || "LoadImage"}
                  </p>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                    class_type: {node.class_type}
                  </p>
                </div>
              </div>

              {/* Prominent Image Preview Area */}
              <div className="w-full h-36 rounded-lg bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center overflow-hidden relative group">
                {mappedAsset ? (
                  <>
                    <img 
                      src={getAssetMediaUrl(mappedAsset, true)} 
                      alt={mappedAsset.subject_name} 
                      className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform duration-200" 
                    />
                    <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-between">
                      <span className="text-[10px] text-white font-medium truncate drop-shadow-xs px-1">
                        {mappedAsset.subject_name}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-black/60 text-zinc-300 font-mono uppercase">
                        {mappedAsset.type}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-3 text-center space-y-1 text-zinc-400 dark:text-zinc-500">
                    <ImageIcon className="w-6 h-6 stroke-[1.5]" />
                    <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">No Image Assigned</span>
                    <span className="text-[9px] text-zinc-400 dark:text-zinc-500">Auto-bypassed in ComfyUI</span>
                  </div>
                )}
              </div>

              {/* Assignment Select Dropdown */}
              <div className="pt-1">
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
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none shadow-2xs font-medium cursor-pointer"
                >
                  <option key="empty" value="">-- Unassigned (Auto-Bypass) --</option>
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
            <div 
              key={node.id} 
              className="bg-white dark:bg-zinc-950/60 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between space-y-2.5 shadow-xs"
            >
              <div className="flex items-start gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-transparent shrink-0 mt-0.5">
                  <VideoIcon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 font-mono truncate">
                    Node #{node.id} — {node.title || "LoadVideo"}
                  </p>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                    class_type: {node.class_type}
                  </p>
                </div>
              </div>

              <div className="w-full h-36 rounded-lg bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center p-3 text-center space-y-1 text-zinc-400 dark:text-zinc-500">
                <VideoIcon className="w-6 h-6 stroke-[1.5]" />
                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                  {assignedFile ? assignedFile : "No Video Assigned"}
                </span>
                {!assignedFile && (
                  <span className="text-[9px] text-zinc-400 dark:text-zinc-500">Auto-bypassed in ComfyUI</span>
                )}
              </div>

              <div className="pt-1">
                <select
                  value={assignedFile}
                  onChange={(e) => onUpdateMapping(node.id, e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none shadow-2xs font-medium cursor-pointer"
                >
                  <option key="empty" value="">-- Unassigned (Auto-Bypass) --</option>
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
            <div 
              key={node.id} 
              className="bg-white dark:bg-zinc-950/60 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between space-y-2.5 shadow-xs"
            >
              <div className="flex items-start gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-transparent shrink-0 mt-0.5">
                  <Music className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 font-mono truncate">
                    Node #{node.id} — {node.title || "LoadAudio"}
                  </p>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                    class_type: {node.class_type}
                  </p>
                </div>
              </div>

              <div className="w-full h-36 rounded-lg bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center p-3 text-center space-y-1 text-zinc-400 dark:text-zinc-500">
                <Music className="w-6 h-6 stroke-[1.5]" />
                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                  {assignedFile ? assignedFile : "No Audio Assigned"}
                </span>
                {!assignedFile && (
                  <span className="text-[9px] text-zinc-400 dark:text-zinc-500">Auto-bypassed in ComfyUI</span>
                )}
              </div>

              <div className="pt-1">
                <select
                  value={assignedFile}
                  onChange={(e) => onUpdateMapping(node.id, e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none shadow-2xs font-medium cursor-pointer"
                >
                  <option key="empty" value="">-- Unassigned (Auto-Bypass) --</option>
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
