import React, { useState, useMemo } from "react";
import { ShotItem, MediaAsset, SceneProjectFile, CharacterProfile } from "../../types";
import { getAssetMediaUrl } from "../../utils/assetUrl";
import { isLocationEntity } from "../../utils/locationUtils";
import { 
  X, 
  UserPlus, 
  Users, 
  User, 
  Layers, 
  AlertTriangle, 
  Check, 
  ArrowRight,
  Sparkles,
  Search
} from "lucide-react";

interface AddCharacterToShotModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeShot: ShotItem;
  sceneProject: SceneProjectFile;
  assets: MediaAsset[];
  onConfirmAdd: (
    characterName: string, 
    slotsToAssign: Record<number, string>
  ) => void;
  addToast?: (text: string, type?: "success" | "error" | "info") => void;
}

export const AddCharacterToShotModal: React.FC<AddCharacterToShotModalProps> = ({
  isOpen,
  onClose,
  activeShot,
  sceneProject,
  assets,
  onConfirmAdd,
  addToast
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCharacterName, setSelectedCharacterName] = useState<string | null>(null);
  const [partialFitState, setPartialFitState] = useState<{
    characterName: string;
    charImages: string[];
    availableSlots: number[];
  } | null>(null);

  const allSceneCharacters = sceneProject.characters || {};

  // Compute all scene subjects excluding location entities
  const sceneCharacterList = useMemo(() => {
    const fromChars = Object.keys(allSceneCharacters);
    const fromProjSubjects = sceneProject.subjects || [];
    const fromAssets = assets.map(a => a.subject_name).filter(Boolean) as string[];
    const combined = Array.from(new Set([...fromChars, ...fromProjSubjects, ...fromAssets]));

    return combined
      .filter(sub => {
        const charProfile = allSceneCharacters[sub] || 
          Object.entries(allSceneCharacters).find(([k]) => k.toLowerCase() === sub.toLowerCase())?.[1];
        const charAssets = assets.filter(a => (a.subject_name || "").toLowerCase() === sub.toLowerCase());
        return !isLocationEntity(sub, charProfile, charAssets);
      })
      .map(charName => {
        const profile = allSceneCharacters[charName] || 
          Object.entries(allSceneCharacters).find(([k]) => k.toLowerCase() === charName.toLowerCase())?.[1] || 
          {
            id: `char_${charName.toLowerCase().replace(/\s+/g, "_")}`,
            name: charName,
            notes: "",
            quick_slots: [],
            scene_outfit_ref: ""
          };

        const charAssets = assets.filter(
          a => (a.subject_name || "").trim().toLowerCase() === charName.trim().toLowerCase()
        );

        // Extract configured quick slots (1-4) or fallback to top 4 assets
        const rawQuickSlots = Array.isArray(profile.quick_slots) ? profile.quick_slots.filter(Boolean) : [];
        let configuredImages: string[] = [];

        if (rawQuickSlots.length > 0) {
          configuredImages = rawQuickSlots;
        } else {
          // Fallback to top headshots/body references
          const prioritized = [
            ...charAssets.filter(a => a.type === "Headshot"),
            ...charAssets.filter(a => a.type === "Body Reference"),
            ...charAssets.filter(a => a.type !== "Headshot" && a.type !== "Body Reference")
          ].map(a => a.filename);
          configuredImages = Array.from(new Set(prioritized)).slice(0, 4);
        }

        const headshotAsset = 
          charAssets.find(a => a.type === "Headshot") ||
          charAssets.find(a => a.type === "Body Reference") ||
          charAssets[0];

        const headshotUrl = headshotAsset ? getAssetMediaUrl(headshotAsset.filename, true) : null;

        // Check if character is currently already in active shot
        const isAlreadyInShot = Boolean(
          (activeShot.characters || []).some(c => c.toLowerCase() === charName.toLowerCase()) ||
          activeShot.ots_focus_subject?.toLowerCase() === charName.toLowerCase() ||
          activeShot.ots_anchor_subject?.toLowerCase() === charName.toLowerCase()
        );

        return {
          name: profile.name || charName,
          profile,
          headshotUrl,
          configuredImages,
          isAlreadyInShot,
          charAssetsCount: charAssets.length
        };
      });
  }, [allSceneCharacters, sceneProject.subjects, assets, activeShot]);

  // Filter by search query
  const filteredCharacters = useMemo(() => {
    if (!searchQuery.trim()) return sceneCharacterList;
    const q = searchQuery.toLowerCase();
    return sceneCharacterList.filter(c => c.name.toLowerCase().includes(q));
  }, [sceneCharacterList, searchQuery]);

  // Compute available open slots in active shot's Asset Matrix (indices 0..7)
  const availableMatrixSlots = useMemo(() => {
    const currentSlots = activeShot.assigned_slots || {};
    const open: number[] = [];
    for (let i = 0; i < 8; i++) {
      if (!currentSlots[i]) {
        open.push(i);
      }
    }
    return open;
  }, [activeShot.assigned_slots]);

  const totalOccupiedCount = 8 - availableMatrixSlots.length;

  // Handler when user selects a character
  const handleSelectCharacter = (charItem: typeof sceneCharacterList[0]) => {
    setSelectedCharacterName(charItem.name);
    const { configuredImages, name } = charItem;

    // Case 1: No open slots available in Matrix (0 free)
    if (availableMatrixSlots.length === 0 && configuredImages.length > 0) {
      addToast?.("Asset Matrix is full (8/8 slots occupied). Please clear slots first.", "error");
      return;
    }

    // Case 2: Partial Fit (more images than available slots)
    if (configuredImages.length > availableMatrixSlots.length) {
      setPartialFitState({
        characterName: name,
        charImages: configuredImages,
        availableSlots: availableMatrixSlots
      });
      return;
    }

    // Case 3: All fit (or 0 configured images)
    executeImport(name, configuredImages, availableMatrixSlots);
  };

  // Execution function to assign slots and complete addition
  const executeImport = (
    characterName: string, 
    imagesToImport: string[], 
    targetSlots: number[]
  ) => {
    const newAssignedSlots = { ...(activeShot.assigned_slots || {}) };
    
    // Fill consecutive open slots with images
    imagesToImport.forEach((filename, idx) => {
      if (idx < targetSlots.length) {
        const slotIdx = targetSlots[idx];
        newAssignedSlots[slotIdx] = filename;
      }
    });

    onConfirmAdd(characterName, newAssignedSlots);
    addToast?.(
      imagesToImport.length > 0
        ? `Added ${characterName} and imported ${Math.min(imagesToImport.length, targetSlots.length)} reference(s) to Shot ${activeShot.shot_number}`
        : `Added ${characterName} to Shot ${activeShot.shot_number}`,
      "success"
    );

    // Reset and close
    setPartialFitState(null);
    setSelectedCharacterName(null);
    onClose();
  };

  const handleConfirmPartialFit = () => {
    if (!partialFitState) return;
    const { characterName, charImages, availableSlots } = partialFitState;
    const subset = charImages.slice(0, availableSlots.length);
    executeImport(characterName, subset, availableSlots);
  };

  if (!isOpen) return null;

  const shotNumberDisplay = activeShot.shot_number.toString().padStart(2, "0");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Add Character to Shot {shotNumberDisplay}
              </h3>
              <p className="text-xs text-zinc-400">
                Select a character to tag in this shot and import their reference images
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Matrix Slot Status Banner */}
        <div className="px-6 py-3 bg-zinc-900/40 border-b border-zinc-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-zinc-400" />
            <span className="text-zinc-300 font-medium">Asset Matrix Capacity:</span>
            <span className="font-mono text-zinc-200">
              {availableMatrixSlots.length} of 8 slots available
            </span>
          </div>
          {availableMatrixSlots.length === 0 && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded">
              <AlertTriangle className="w-3 h-3" />
              Matrix Full
            </span>
          )}
        </div>

        {/* Modal Body: Partial Fit Confirmation View OR Character Picker View */}
        {partialFitState ? (
          /* Partial Fit Confirmation Screen */
          <div className="p-6 flex flex-col gap-5 overflow-y-auto">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3.5 text-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-amber-300">
                  Not enough open slots in Asset Matrix
                </h4>
                <p className="text-xs text-amber-200/90 leading-relaxed">
                  <strong>{partialFitState.characterName}</strong> has{" "}
                  <strong>{partialFitState.charImages.length}</strong> configured reference images, but only{" "}
                  <strong>{partialFitState.availableSlots.length}</strong> open slots remain in Shot {shotNumberDisplay}'s matrix.
                </p>
              </div>
            </div>

            {/* Preview of which images will be imported vs omitted */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Priority Ingestion Preview
              </span>
              <div className="grid grid-cols-4 gap-2.5">
                {partialFitState.charImages.map((filename, idx) => {
                  const willFit = idx < partialFitState.availableSlots.length;
                  const previewUrl = getAssetMediaUrl(filename, true);

                  return (
                    <div
                      key={idx}
                      className={`relative rounded-xl border overflow-hidden p-1.5 flex flex-col items-center justify-center aspect-[3/4] ${
                        willFit
                          ? "border-emerald-500/50 bg-emerald-950/20"
                          : "border-zinc-800 bg-zinc-950 opacity-40 grayscale"
                      }`}
                    >
                      <div className="w-full h-full rounded-lg overflow-hidden bg-zinc-900 relative">
                        <img
                          src={previewUrl}
                          alt={`Ref ${idx + 1}`}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          willFit ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-400"
                        }`}>
                          {idx + 1}
                        </div>
                      </div>
                      <span className={`text-[10px] font-semibold mt-1 truncate ${
                        willFit ? "text-emerald-400" : "text-zinc-500"
                      }`}>
                        {willFit ? `Import (Slot ${partialFitState.availableSlots[idx]})` : "Omitted"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setPartialFitState(null)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-semibold border border-zinc-700 transition-colors cursor-pointer"
              >
                Back to Cast List
              </button>
              <button
                type="button"
                onClick={handleConfirmPartialFit}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow flex items-center gap-1.5"
              >
                <span>Import First {partialFitState.availableSlots.length} References</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          /* Character Picker View */
          <div className="flex flex-col flex-1 min-h-0">
            {/* Search Input */}
            <div className="p-4 border-b border-zinc-800">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search scene cast members..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            {/* Character List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {filteredCharacters.length > 0 ? (
                filteredCharacters.map((charItem) => {
                  const { name, headshotUrl, configuredImages, isAlreadyInShot } = charItem;
                  const refCount = configuredImages.length;

                  return (
                    <div
                      key={name}
                      onClick={() => handleSelectCharacter(charItem)}
                      className="w-full text-left bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-700 rounded-xl p-3 flex items-center justify-between gap-3 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar */}
                        <div className="w-12 h-12 rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
                          {headshotUrl ? (
                            <img
                              src={headshotUrl}
                              alt={name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <User className="w-5 h-5 text-zinc-600" />
                          )}
                        </div>

                        {/* Name & Reference Info */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white truncate">
                              {name}
                            </h4>
                            {isAlreadyInShot && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                                In Shot
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center gap-1 text-xs text-indigo-400 font-medium bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                              <Sparkles className="w-3 h-3 text-indigo-400" />
                              {refCount === 1 ? "1 reference" : `${refCount} references`}
                            </span>
                            {charItem.profile.scene_outfit_ref && (
                              <span className="text-[11px] text-zinc-400 truncate max-w-[180px]">
                                {charItem.profile.scene_outfit_ref}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Arrow */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          className="px-3 py-1.5 bg-indigo-600 group-hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          <span>Add to Shot</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-zinc-500 text-xs">
                  {searchQuery ? "No characters match your search" : "No characters registered in this scene"}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
