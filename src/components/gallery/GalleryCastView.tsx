import React from "react";
import { MediaAsset, CharacterProfile } from "../../types";
import { ChevronRight, Settings } from "lucide-react";
import { getAssetMediaUrl } from "../../utils/assetUrl";

interface GalleryCastViewProps {
  subjects: string[];
  sortedAssets: MediaAsset[];
  characters: Record<string, CharacterProfile>;
  onUpdateCharacter?: (profile: CharacterProfile) => void;
  setLightboxAsset: (asset: MediaAsset) => void;
}

export const GalleryCastView: React.FC<GalleryCastViewProps> = ({
  subjects, sortedAssets, characters, onUpdateCharacter, setLightboxAsset
}) => {
  return (
    <div className="space-y-8">
      {subjects.map(subject => {
        const charAssets = sortedAssets.filter(a => (a.subject_name || "").toLowerCase() === subject.toLowerCase());
        if (charAssets.length === 0) return null;
        
        const profile = characters[subject] || { name: subject, notes: "", quick_slots: [], scene_outfit_ref: "" };
        
        // Find best profile pic (prefer Headshot, then Body Ref, then whatever image)
        const profilePic = charAssets.find(a => a.type === "Headshot") || 
                           charAssets.find(a => a.type === "Body Reference") || 
                           charAssets.find(a => a.media_type === "image");

        return (
          <div key={subject} className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl overflow-hidden flex flex-col md:flex-row">
            {/* Character Header / Sidebar */}
            <div className="md:w-64 bg-zinc-900 p-6 border-b md:border-b-0 md:border-r border-zinc-800 flex flex-col shrink-0">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-zinc-950 border-2 border-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
                  {profilePic ? (
                    <img src={getAssetMediaUrl(profilePic.filename, true)} className="w-full h-full object-cover" alt={subject} referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-xl font-bold text-zinc-600">{subject.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-100 line-clamp-1" title={subject}>{subject}</h3>
                  <p className="text-xs text-amber-500 font-medium">{charAssets.length} references</p>
                </div>
              </div>
              
              <div className="flex-1 space-y-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1.5 flex items-center justify-between">
                    Notes
                    <Settings className="w-3 h-3 text-zinc-600" />
                  </label>
                  <textarea
                    value={profile.notes || ""}
                    onChange={e => onUpdateCharacter?.({ ...profile, notes: e.target.value })}
                    placeholder="Physical traits, lore, etc..."
                    className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-300 resize-none outline-none focus:border-amber-500/50 min-h-[60px]"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1.5 block">Scene Outfit</label>
                  <input
                    type="text"
                    value={profile.scene_outfit_ref || ""}
                    onChange={e => onUpdateCharacter?.({ ...profile, scene_outfit_ref: e.target.value })}
                    placeholder="e.g. Red leather jacket, torn jeans"
                    className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-300 outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>
            </div>

            {/* Asset Strip */}
            <div className="p-4 md:p-6 flex-1 bg-zinc-950/20 overflow-x-auto min-w-0">
              <div className="flex gap-4 min-w-max pb-2">
                {charAssets.map(asset => (
                  <div 
                    key={asset.filename}
                    onClick={() => setLightboxAsset(asset)}
                    className="w-32 group cursor-pointer"
                  >
                    <div className="w-32 h-40 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-2 relative hover:border-amber-500/50 transition-colors">
                      {asset.media_type === "image" || !asset.media_type || !/\.(mp4|mov|webm|mp3|wav)$/i.test(asset.filename) ? (
                        <img 
                          src={getAssetMediaUrl(asset.filename, true)} 
                          className="w-full h-full object-cover group-hover:opacity-75 transition-opacity" 
                          alt={asset.filename} 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-zinc-950 text-xs text-zinc-600 font-mono p-2 text-center break-all">
                          {asset.filename.split('.').pop()?.toUpperCase()}
                        </div>
                      )}
                      {asset.type && (
                        <div className="absolute bottom-0 inset-x-0 bg-black/80 backdrop-blur-sm p-1.5">
                          <p className="text-[9px] font-bold text-zinc-300 truncate text-center">{asset.type}</p>
                        </div>
                      )}
                    </div>
                    {asset.description && (
                      <p className="text-[10px] text-zinc-500 line-clamp-2 leading-relaxed" title={asset.description}>{asset.description}</p>
                    )}
                  </div>
                ))}
                
                <div className="w-32 h-40 border-2 border-dashed border-zinc-800 rounded-xl flex flex-col items-center justify-center text-zinc-600 hover:text-zinc-400 hover:border-zinc-600 hover:bg-zinc-900/50 transition-colors cursor-pointer shrink-0">
                  <ChevronRight className="w-6 h-6 mb-1" />
                  <span className="text-[10px] font-bold">Add Ref</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
