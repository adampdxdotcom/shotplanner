import React from "react";
import { CharacterProfile, UniverseCharacterProfile, MediaAsset } from "../../types";
import { 
  Globe, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Check, 
  AlertCircle, 
  Sparkles, 
  Image as ImageIcon, 
  FileText, 
  Shirt, 
  X,
  RefreshCw
} from "lucide-react";
import { getAssetMediaUrl } from "../../utils/assetUrl";

export interface SyncDiffResult {
  hasDifferences: boolean;
  notesDiffer: boolean;
  outfitDiffers: boolean;
  sceneOnlyAssets: MediaAsset[];
  universeOnlyAssets: MediaAsset[];
  sharedAssetCount: number;
}

export function computeCharacterSyncDiff(
  sceneProfile: CharacterProfile,
  universeProfile: UniverseCharacterProfile | undefined,
  allAssets: MediaAsset[],
  universeAssets?: MediaAsset[]
): SyncDiffResult {
  const universeFilenameSet = new Set<string>(
    (universeAssets || []).map(a => a.filename.toLowerCase())
  );

  if (!universeProfile) {
    const charAssets = allAssets.filter(
      a => (a.subject_name || "").trim().toLowerCase() === sceneProfile.name.trim().toLowerCase()
    );
    return {
      hasDifferences: true,
      notesDiffer: !!sceneProfile.notes,
      outfitDiffers: !!sceneProfile.scene_outfit_ref,
      sceneOnlyAssets: charAssets,
      universeOnlyAssets: [],
      sharedAssetCount: 0
    };
  }

  const subjectLower = sceneProfile.name.trim().toLowerCase();
  const charAssets = allAssets.filter(
    a => (a.subject_name || "").trim().toLowerCase() === subjectLower
  );

  const sceneOnlyAssets: MediaAsset[] = [];
  const universeOnlyAssets: MediaAsset[] = [];
  let sharedAssetCount = 0;

  for (const asset of charAssets) {
    const fnLower = (asset.filename || "").toLowerCase();
    const isUniverseAsset = !!asset.is_universe || universeFilenameSet.has(fnLower);
    if (isUniverseAsset) {
      sharedAssetCount++;
    } else {
      sceneOnlyAssets.push(asset);
    }
  }

  const notesDiffer = (sceneProfile.notes || "").trim() !== (universeProfile.notes || "").trim();
  const outfitDiffer = (sceneProfile.scene_outfit_ref || "").trim() !== (universeProfile.default_outfit_ref || universeProfile.scene_outfit_ref || "").trim();

  const hasDifferences = notesDiffer || outfitDiffer || sceneOnlyAssets.length > 0 || universeOnlyAssets.length > 0;

  return {
    hasDifferences,
    notesDiffer,
    outfitDiffers: outfitDiffer,
    sceneOnlyAssets,
    universeOnlyAssets,
    sharedAssetCount
  };
}

interface CharacterSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  sceneProfile: CharacterProfile;
  universeProfile?: UniverseCharacterProfile;
  assets: MediaAsset[];
  universeAssets?: MediaAsset[];
  onPushToUniverse: (subject: string, profile: CharacterProfile, newAssets: MediaAsset[]) => Promise<void>;
  onPullFromUniverse: (universeChar: UniverseCharacterProfile) => void;
  isPushing?: boolean;
}

export const CharacterSyncModal: React.FC<CharacterSyncModalProps> = ({
  isOpen,
  onClose,
  sceneProfile,
  universeProfile,
  assets,
  universeAssets = [],
  onPushToUniverse,
  onPullFromUniverse,
  isPushing = false
}) => {
  if (!isOpen) return null;

  const diff = computeCharacterSyncDiff(sceneProfile, universeProfile, assets, universeAssets);
  const subject = sceneProfile.name;
  const isLoc = sceneProfile.is_location;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/80 dark:bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <RefreshCw className={`w-5 h-5 ${isPushing ? "animate-spin" : ""}`} />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                Universe Importer: <span className="text-amber-600 dark:text-amber-400">{subject}</span>
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Bidirectional synchronization between active Scene and Global Universe Roster
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Diff Overview */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Comparison Cards: Scene vs Universe */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Scene Column */}
            <div className="bg-slate-50/80 dark:bg-zinc-950/80 border border-indigo-200 dark:border-indigo-900/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-indigo-100 dark:border-zinc-800/80 pb-2">
                <span className="font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  🎬 Scene Version
                </span>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-500 font-mono">Current Scene</span>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase flex items-center gap-1 mb-1">
                  <FileText className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                  Notes & Traits
                </label>
                <p className="text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900/90 rounded-lg p-2.5 min-h-[44px] leading-relaxed border border-zinc-200 dark:border-zinc-800/60 break-words whitespace-pre-wrap shadow-2xs">
                  {sceneProfile.notes || <span className="text-zinc-400 dark:text-zinc-500 italic">No notes in scene</span>}
                </p>
              </div>

              {!isLoc && (
                <div>
                  <label className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase flex items-center gap-1 mb-1">
                    <Shirt className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                    Scene Outfit
                  </label>
                  <p className="text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900/90 rounded-lg p-2 border border-zinc-200 dark:border-zinc-800/60 truncate shadow-2xs">
                    {sceneProfile.scene_outfit_ref || <span className="text-zinc-400 dark:text-zinc-500 italic">No outfit specified</span>}
                  </p>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase flex items-center gap-1 mb-1">
                  <ImageIcon className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                  Unpromoted Scene-Local Assets ({diff.sceneOnlyAssets.length})
                </label>
                {diff.sceneOnlyAssets.length === 0 ? (
                  <p className="text-zinc-400 dark:text-zinc-500 italic py-1">All references are synced to universe</p>
                ) : (
                  <div className="flex gap-2 overflow-x-auto py-1">
                    {diff.sceneOnlyAssets.map(a => (
                      <div key={a.filename} className="w-14 h-16 rounded bg-zinc-100 dark:bg-zinc-900 border border-indigo-300 dark:border-indigo-700/50 overflow-hidden shrink-0 relative group shadow-2xs">
                        <img 
                          src={getAssetMediaUrl(a.filename, true)} 
                          className="w-full h-full object-cover" 
                          alt={a.filename} 
                          referrerPolicy="no-referrer"
                        />
                        <span className="absolute bottom-0 inset-x-0 bg-indigo-900/90 dark:bg-indigo-950/90 text-[8px] font-semibold text-center text-indigo-100 dark:text-indigo-200 truncate px-0.5">
                          New
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Universe Column */}
            <div className="bg-amber-50/40 dark:bg-zinc-950/80 border border-amber-200 dark:border-amber-900/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-amber-100 dark:border-zinc-800/80 pb-2">
                <span className="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  🌐 Universe Master Profile
                </span>
                <span className="text-[10px] text-amber-700 dark:text-amber-500/80 font-mono font-medium">
                  {universeProfile ? "Registered" : "Not Registered"}
                </span>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase flex items-center gap-1 mb-1">
                  <FileText className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  Master Notes & Traits
                </label>
                <p className="text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900/90 rounded-lg p-2.5 min-h-[44px] leading-relaxed border border-zinc-200 dark:border-zinc-800/60 break-words whitespace-pre-wrap shadow-2xs">
                  {universeProfile?.notes || <span className="text-zinc-400 dark:text-zinc-500 italic">No notes in Universe</span>}
                </p>
              </div>

              {!isLoc && (
                <div>
                  <label className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase flex items-center gap-1 mb-1">
                    <Shirt className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    Default Master Outfit
                  </label>
                  <p className="text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900/90 rounded-lg p-2 border border-zinc-200 dark:border-zinc-800/60 truncate shadow-2xs">
                    {universeProfile?.default_outfit_ref || universeProfile?.scene_outfit_ref || (
                      <span className="text-zinc-400 dark:text-zinc-500 italic">No default outfit</span>
                    )}
                  </p>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase flex items-center gap-1 mb-1">
                  <Globe className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  Universe Reference Pool ({diff.sharedAssetCount} active in scene)
                </label>
                <p className="text-zinc-600 dark:text-zinc-400 py-1 leading-relaxed">
                  {universeProfile 
                    ? `Globally available across all scenes and projects.` 
                    : `Push this character to register them in the global universe roster.`}
                </p>
              </div>
            </div>
          </div>

          {/* Sync Summary Notice */}
          <div className={`rounded-xl p-3.5 flex items-start gap-3 border ${
            !diff.hasDifferences && universeProfile
              ? "bg-emerald-50/90 border-emerald-200 dark:bg-zinc-950/60 dark:border-emerald-900/40"
              : "bg-amber-50/90 border-amber-200 dark:bg-zinc-950/60 dark:border-amber-900/40"
          }`}>
            {!diff.hasDifferences && universeProfile ? (
              <>
                <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700/60 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5">
                  <Check className="w-3 h-3" />
                </div>
                <div>
                  <p className="font-bold text-emerald-900 dark:text-emerald-300">Fully Synchronized</p>
                  <p className="text-emerald-800 dark:text-zinc-400 text-[11px]">
                    Scene character metadata and references match the Global Universe Profile.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950 border border-amber-300 dark:border-amber-700/60 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0 mt-0.5">
                  <AlertCircle className="w-3 h-3" />
                </div>
                <div>
                  <p className="font-bold text-amber-900 dark:text-amber-300">Pending Changes Detected</p>
                  <p className="text-amber-800 dark:text-zinc-400 text-[11px] leading-relaxed">
                    {diff.sceneOnlyAssets.length > 0 && `${diff.sceneOnlyAssets.length} scene reference photo(s) are not yet in Universe. `}
                    {diff.notesDiffer && "Notes differ between Scene and Universe. "}
                    {diff.outfitDiffers && "Outfit reference differs between Scene and Universe."}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/80 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 dark:border-zinc-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {universeProfile && (
              <button
                type="button"
                onClick={() => {
                  onPullFromUniverse(universeProfile);
                  onClose();
                }}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 text-indigo-700 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:border-indigo-700/60 dark:text-indigo-200 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Overwrite Scene character notes & outfit with Universe master values"
              >
                <ArrowDownLeft className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Pull from Universe</span>
              </button>
            )}

            <button
              type="button"
              disabled={isPushing}
              onClick={async () => {
                await onPushToUniverse(subject, sceneProfile, diff.sceneOnlyAssets);
                onClose();
              }}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 text-xs font-extrabold rounded-lg transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Promote scene-local photos and update Universe master profile"
            >
              <ArrowUpRight className={`w-4 h-4 ${isPushing ? "animate-spin" : ""}`} />
              <span>{isPushing ? "Pushing to Universe..." : "Push Updates to Universe"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
