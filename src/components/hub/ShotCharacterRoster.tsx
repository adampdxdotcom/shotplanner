import React, { useMemo } from "react";
import { ShotItem, MediaAsset, SceneProjectFile } from "../../types";
import { getAssetMediaUrl } from "../../utils/assetUrl";
import { isLocationEntity } from "../../utils/locationUtils";
import { 
  Users, 
  User, 
  Shirt, 
  FileText, 
  Film, 
  ArrowUpRight
} from "lucide-react";

interface ShotCharacterRosterProps {
  activeShot: ShotItem;
  sceneProject: SceneProjectFile;
  assets: MediaAsset[];
  onNavigateToCast?: (characterName?: string) => void;
  onSelectShot?: (shotId: string) => void;
}

export const ShotCharacterRoster: React.FC<ShotCharacterRosterProps> = ({
  activeShot,
  sceneProject,
  assets,
  onNavigateToCast,
  onSelectShot,
}) => {
  const allSceneCharacters = sceneProject.characters || {};
  const allShots = useMemo(() => sceneProject.shots || [], [sceneProject.shots]);

  // All known subject names in scene (excluding location entities)
  const allCharacterNames = useMemo(() => {
    const fromChars = Object.keys(allSceneCharacters);
    const fromProjSubjects = sceneProject.subjects || [];
    const fromAssets = assets.map(a => a.subject_name).filter(Boolean) as string[];
    const combined = Array.from(new Set([...fromChars, ...fromProjSubjects, ...fromAssets]));
    
    return combined.filter(sub => {
      const charProfile = allSceneCharacters[sub] || 
        Object.entries(allSceneCharacters).find(([k]) => k.toLowerCase() === sub.toLowerCase())?.[1];
      const charAssets = assets.filter(a => (a.subject_name || "").toLowerCase() === sub.toLowerCase());
      return !isLocationEntity(sub, charProfile, charAssets);
    });
  }, [allSceneCharacters, sceneProject.subjects, assets]);

  // Helper to check if a specific shot contains a character
  const isCharacterInShot = (charName: string, shot: ShotItem): boolean => {
    const lowerName = charName.trim().toLowerCase();

    // 1. Explicit shot character assignment
    if (shot.characters && Array.isArray(shot.characters)) {
      if (shot.characters.some(c => typeof c === "string" && c.trim().toLowerCase() === lowerName)) {
        return true;
      }
    }

    // 2. Camera focus or anchor
    if (shot.ots_focus_subject && shot.ots_focus_subject.trim().toLowerCase() === lowerName) return true;
    if (shot.ots_anchor_subject && shot.ots_anchor_subject.trim().toLowerCase() === lowerName) return true;

    // 3. Staging recipe actors
    if (shot.staging_recipe?.actors?.some(a => a.characterName?.trim().toLowerCase() === lowerName)) {
      return true;
    }

    // 4. Assigned matrix slot assets
    if (shot.assigned_slots) {
      const charAssetFilenames = new Set(
        assets
          .filter(a => (a.subject_name || "").trim().toLowerCase() === lowerName)
          .map(a => a.filename)
      );
      const isAssigned = Object.values(shot.assigned_slots).some(
        f => typeof f === "string" && charAssetFilenames.has(f)
      );
      if (isAssigned) return true;
    }

    // 5. Mentioned in prompt or basic stub text
    const textToSearch = `${shot.basic_stub || ""} ${shot.expanded_prompt || ""}`.toLowerCase();
    const regex = new RegExp(`\\b${lowerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return regex.test(textToSearch);
  };

  // Find all characters present in the currently selected active shot
  const charactersInActiveShot = useMemo(() => {
    return allCharacterNames
      .filter(charName => isCharacterInShot(charName, activeShot))
      .map(charName => {
        // Character profile
        const profile = allSceneCharacters[charName] || 
          Object.entries(allSceneCharacters).find(([k]) => k.toLowerCase() === charName.toLowerCase())?.[1] || 
          {
            id: `char_${charName.toLowerCase().replace(/\s+/g, "_")}`,
            name: charName,
            notes: "",
            quick_slots: [],
            scene_outfit_ref: ""
          };

        // Character assets for headshot image
        const charAssets = assets.filter(
          a => (a.subject_name || "").trim().toLowerCase() === charName.trim().toLowerCase()
        );

        // Find all shots across the scene project that contain this character
        const shotsWithChar = allShots
          .filter(shot => isCharacterInShot(charName, shot))
          .map(shot => ({
            id: shot.id,
            shotNumber: shot.shot_number,
            display: `Shot ${shot.shot_number.toString().padStart(2, "0")}`,
            isCurrent: shot.id === activeShot.id || shot.shot_number === activeShot.shot_number
          }))
          .sort((a, b) => a.shotNumber - b.shotNumber);

        const headshotAsset = 
          charAssets.find(a => a.type === "Headshot") ||
          charAssets.find(a => a.type === "Body Reference") ||
          charAssets.find(a => a.media_type === "image" || !a.media_type) ||
          charAssets[0];

        const headshotUrl = headshotAsset ? getAssetMediaUrl(headshotAsset.filename, true) : null;
        const outfitDescription = profile.scene_outfit_ref || profile.default_outfit_ref || "";
        const notes = profile.notes || "";

        return {
          name: profile.name || charName,
          profile,
          headshotUrl,
          outfitDescription,
          notes,
          shotsWithChar
        };
      });
  }, [allCharacterNames, activeShot, allSceneCharacters, assets, allShots]);

  const shotNumberDisplay = activeShot.shot_number.toString().padStart(2, "0");

  const handleNavigateToCastCard = (charName: string) => {
    if (onNavigateToCast) {
      onNavigateToCast(charName);
    }
    // Scroll to the character card on the Cast page after transition
    setTimeout(() => {
      const sanitizedId = `character-card-${charName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
      const elem = document.getElementById(sanitizedId);
      if (elem) {
        elem.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 150);
  };

  return (
    <div id="shot-character-roster-panel" className="bg-zinc-900/60 border border-zinc-800/90 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-tight">
                Character Roster
              </h3>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                {charactersInActiveShot.length} in Shot {shotNumberDisplay}
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Cast member details, wardrobe descriptions, and scene appearances for this shot
            </p>
          </div>
        </div>
      </div>

      {/* Two-Column Character Cards Grid */}
      {charactersInActiveShot.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {charactersInActiveShot.map(({ name, headshotUrl, outfitDescription, notes, shotsWithChar }) => {
            return (
              <div
                key={name}
                id={`roster-char-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between gap-3.5 shadow-sm"
              >
                {/* Top Section: Avatar, Name & Link to Cast */}
                <div className="flex items-start justify-between gap-3.5">
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Headshot */}
                    <div className="relative w-14 h-14 rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden shrink-0 flex items-center justify-center shadow-xs">
                      {headshotUrl ? (
                        <img
                          src={headshotUrl}
                          alt={name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-zinc-600">
                          <User className="w-6 h-6" />
                        </div>
                      )}
                    </div>

                    {/* Character Name */}
                    <div className="min-w-0">
                      <h4 className="text-base font-bold text-white truncate" title={name}>
                        {name}
                      </h4>
                      <p className="text-xs text-zinc-400">
                        In {shotsWithChar.length} {shotsWithChar.length === 1 ? "shot" : "shots"} this scene
                      </p>
                    </div>
                  </div>

                  {/* Link to Cast Tab -> Character Card */}
                  {onNavigateToCast && (
                    <button
                      type="button"
                      onClick={() => handleNavigateToCastCard(name)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-indigo-400 hover:text-indigo-300 rounded-lg text-xs font-semibold border border-zinc-800 hover:border-indigo-500/30 transition-all cursor-pointer shrink-0"
                      title={`Open ${name} character card on the Cast page`}
                    >
                      <span>Cast Card</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Information Area: Scene Outfit & Character Notes */}
                <div className="space-y-2 text-xs">
                  {/* Scene Outfit Description */}
                  <div className="bg-zinc-900/70 border border-zinc-800/60 rounded-lg p-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                      <Shirt className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>Scene Outfit</span>
                    </div>
                    <p className="text-zinc-200 text-xs leading-relaxed">
                      {outfitDescription ? outfitDescription : (
                        <span className="text-zinc-500 italic">No scene outfit specified on Cast card</span>
                      )}
                    </p>
                  </div>

                  {/* Character Notes */}
                  <div className="bg-zinc-900/70 border border-zinc-800/60 rounded-lg p-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                      <FileText className="w-3 h-3 text-indigo-400 shrink-0" />
                      <span>Character Notes</span>
                    </div>
                    <p className="text-zinc-200 text-xs leading-relaxed line-clamp-3">
                      {notes ? notes : (
                        <span className="text-zinc-500 italic">No notes added on Cast card</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Bottom Area: List of Shots the Character is in (Pills) */}
                <div className="pt-2 border-t border-zinc-800/70 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    <Film className="w-3 h-3 text-zinc-500 shrink-0" />
                    <span>Scene Appearances</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {shotsWithChar.length > 0 ? (
                      shotsWithChar.map((shotItem) => (
                        <button
                          key={shotItem.id}
                          type="button"
                          onClick={onSelectShot ? () => onSelectShot(shotItem.id) : undefined}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors ${
                            shotItem.isCurrent
                              ? "bg-indigo-600/20 text-indigo-300 border-indigo-500/40"
                              : onSelectShot
                              ? "bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800 hover:border-zinc-700 cursor-pointer"
                              : "bg-zinc-900 text-zinc-300 border-zinc-800"
                          }`}
                          title={onSelectShot ? `Switch to ${shotItem.display}` : undefined}
                        >
                          {shotItem.display}
                        </button>
                      ))
                    ) : (
                      <span className="text-xs text-zinc-500 italic">No shots assigned</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-zinc-950/60 border border-dashed border-zinc-800 rounded-xl p-6 flex flex-col items-center justify-center text-center gap-2">
          <div className="p-2.5 bg-zinc-900 text-zinc-500 rounded-full">
            <Users className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-zinc-300">
            No characters detected in Shot {shotNumberDisplay}
          </p>
          <p className="text-xs text-zinc-500 max-w-sm">
            Characters mentioned in this shot's description or assigned in the Cast tab will appear here.
          </p>
        </div>
      )}
    </div>
  );
};
