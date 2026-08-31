import React from "react";
import { MediaAsset } from "../../types";
import { Image as ImageIcon, Video as VideoIcon, Music, Edit3, Trash2, Play, Pause, Eye } from "lucide-react";
import { formatSize } from "../../utils/formatters";

interface GalleryListViewProps {
  assets: MediaAsset[];
  playingAudioUrl: string | null;
  toggleAudio: (e: React.MouseEvent, url: string) => void;
  setLightboxAsset: (asset: MediaAsset) => void;
  setEditingAsset: (asset: MediaAsset) => void;
  handleDeleteAsset: (asset: MediaAsset) => void;
}

export const GalleryListView: React.FC<GalleryListViewProps> = ({
  assets, playingAudioUrl, toggleAudio, setLightboxAsset, setEditingAsset, handleDeleteAsset
}) => {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
      <table className="w-full text-left text-sm whitespace-nowrap">
        <thead className="bg-zinc-950/50 text-zinc-500 uppercase tracking-wider text-[10px] font-bold">
          <tr>
            <th className="p-4 font-semibold w-16">Preview</th>
            <th className="p-4 font-semibold">Details</th>
            <th className="p-4 font-semibold">Semantic Type</th>
            <th className="p-4 font-semibold">Size</th>
            <th className="p-4 font-semibold text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50">
          {assets.map((asset, idx) => {
            const isVideoOrAudio = /\.(mp3|wav|ogg|m4a|flac|mp4|mov|webm|mkv)$/i.test(asset.filename);
            const isAudio = /\.(mp3|wav|ogg|m4a|flac)$/i.test(asset.filename);
            const isVideo = /\.(mp4|mov|webm|mkv)$/i.test(asset.filename);
            const mediaUrl = `/api/assets/stream/${asset.filename}`;

            return (
              <tr key={idx} className="hover:bg-zinc-800/30 transition-colors group">
                <td className="p-4">
                  <div className="w-12 h-12 bg-zinc-950 rounded flex items-center justify-center border border-zinc-800/80 overflow-hidden relative group cursor-pointer"
                       onClick={() => setLightboxAsset(asset)}>
                    {asset.media_type === "image" || (!isVideo && !isAudio) ? (
                      <img
                        src={`/api/assets/stream/${asset.filename}`}
                        alt={asset.subject_name || "Asset"}
                        className="w-full h-full object-cover group-hover:opacity-75 transition-opacity"
                        referrerPolicy="no-referrer"
                      />
                    ) : isAudio ? (
                      <button
                        onClick={(e) => toggleAudio(e, mediaUrl)}
                        className={`absolute inset-0 flex items-center justify-center transition-colors ${
                          playingAudioUrl === mediaUrl ? 'bg-amber-500/20 text-amber-500' : 'bg-zinc-900 text-emerald-400 group-hover:bg-emerald-900/40 group-hover:text-emerald-300'
                        }`}
                      >
                        {playingAudioUrl === mediaUrl ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                      </button>
                    ) : (
                      <>
                        <VideoIcon className="w-4 h-4 text-indigo-400" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-4 h-4 text-white" />
                        </div>
                      </>
                    )}
                  </div>
                </td>
                <td className="p-4">
                  <p className="font-bold text-zinc-200 text-xs truncate max-w-[200px]">
                    {asset.subject_name || asset.original_name}
                  </p>
                  <p className="text-[10px] font-mono text-zinc-500 truncate max-w-[200px] mt-0.5">
                    {asset.original_name}
                  </p>
                </td>
                <td className="p-4">
                  <span className="inline-flex items-center px-2 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-bold rounded">
                    {asset.type || "Scene Reference"}
                  </span>
                </td>
                <td className="p-4 text-zinc-400 text-xs">{formatSize(asset.size_bytes || 0)}</td>
                <td className="p-4 text-right space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setLightboxAsset(asset)} className="p-1.5 bg-zinc-800 text-zinc-400 hover:text-white rounded-md transition-colors" title="View Full Asset">
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setEditingAsset(asset)} className="p-1.5 bg-zinc-800 text-zinc-400 hover:text-white rounded-md transition-colors">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDeleteAsset(asset)} className="p-1.5 bg-zinc-800 text-red-500 hover:text-red-400 hover:bg-red-950 rounded-md transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
