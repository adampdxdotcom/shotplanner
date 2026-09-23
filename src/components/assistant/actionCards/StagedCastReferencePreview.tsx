import React from "react";
import { CharacterProfile, MediaAsset } from "../../../types";
import { AlertCircle, Sparkles, UserPlus } from "lucide-react";
import { getAssetMediaUrl } from "../../../utils/assetUrl";

interface StagedCastReferencePreviewProps {
  characters?: string[];
  allCharacters?: Record<string, CharacterProfile>;
  assets?: MediaAsset[];
  sceneName?: string;
  isApplied?: boolean;
  onNavigateToSection?: (section: string) => void;
}

/**
 * Renders thumbnail previews for the up-to-4 Cast Card quick slots
 * that will be bundled and staged into the target shot.
 */
export const StagedCastReferencePreview: React.FC<StagedCastReferencePreviewProps> = ({
  characters = [],
  allCharacters = {},
  assets = [],
  sceneName,
  isApplied = false,
  onNavigateToSection
}) => {
  if (!characters || characters.length === 0) return null;

  return (
    <div className="space-y-1.5 my-2">
      {characters.map((charName) => {
        // Find matching character profile
        const charKey = Object.keys(allCharacters).find(
          k => k.toLowerCase() === charName.toLowerCase()
        );
        const profile = charKey ? allCharacters[charKey] : undefined;
        
        // Resolve up to 4 quick slots from the cast card
        const quickSlots: string[] = Array.isArray(profile?.quick_slots) 
          ? profile.quick_slots.filter(Boolean) 
          : [];

        // Outfit reference fallbacks if quick_slots are empty
        const outfitRefs = [profile?.scene_outfit_ref, profile?.default_outfit_ref].filter(Boolean) as string[];

        // If quick_slots are empty, check if library has assets matching character name or outfit refs
        const fallbackAssets = quickSlots.length === 0
          ? assets.filter(a => {
              const charMatch = (a.subject_name || (a as any).character_name || "").toLowerCase() === charName.toLowerCase();
              const outfitMatch = outfitRefs.includes(a.filename);
              return charMatch || outfitMatch;
            }).slice(0, 4)
          : [];

        const candidateFilenames = quickSlots.length > 0 
          ? quickSlots 
          : (fallbackAssets.length > 0 ? fallbackAssets.map(a => a.filename) : outfitRefs);

        const photoFilenames = candidateFilenames.filter(Boolean).slice(0, 4);
        const hasPhotos = photoFilenames.length > 0;

        if (!hasPhotos) {
          return (
            <div 
              key={charName}
              className="flex items-center justify-between gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-[11px]"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <div className="truncate">
                  <span className="font-semibold">{charName}:</span> No reference photos on Cast Card.
                </div>
              </div>
              {onNavigateToSection && (
                <button
                  type="button"
                  onClick={() => onNavigateToSection("cast")}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 font-semibold text-[10px] transition-colors shrink-0 cursor-pointer"
                  title="Open Cast Hub to assign reference photos"
                >
                  <UserPlus className="w-3 h-3" />
                  <span>Open Cast</span>
                </button>
              )}
            </div>
          );
        }

        return (
          <div 
            key={charName}
            className={`p-2 rounded-lg border text-[11px] transition-colors ${
              isApplied
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200"
                : "bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-200/80 dark:border-indigo-800/60 text-slate-800 dark:text-zinc-200"
            }`}
          >
            <div className="flex items-center justify-between gap-1 mb-1.5 font-medium">
              <div className="flex items-center gap-1.5 min-w-0">
                <Sparkles className="w-3 h-3 text-indigo-500 dark:text-indigo-400 shrink-0" />
                <span className="truncate">
                  {isApplied ? "Staged" : "Bundling"} {charName}'s Cast References ({photoFilenames.length})
                </span>
              </div>
              <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 shrink-0">
                → Slots 0–{photoFilenames.length - 1}
              </span>
            </div>

            {/* Thumbnail Preview Strip */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
              {photoFilenames.map((filename, slotIdx) => {
                const asset = assets.find(a => a.filename === filename);
                const thumbUrl = getAssetMediaUrl(asset || filename, true);
                const fullUrl = getAssetMediaUrl(asset || filename, false);

                return (
                  <div 
                    key={slotIdx}
                    className="relative group shrink-0 w-12 h-12 rounded-md overflow-hidden bg-slate-200 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 shadow-2xs"
                    title={`${charName} - Slot ${slotIdx}: ${filename}`}
                  >
                    <img
                      src={thumbUrl}
                      alt={filename}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (target.src !== fullUrl) {
                          target.src = fullUrl;
                        } else {
                          target.style.display = "none";
                        }
                      }}
                    />
                    <div className="absolute top-0.5 left-0.5 px-1 rounded bg-black/70 text-[9px] font-mono text-white font-bold leading-tight">
                      {slotIdx}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
