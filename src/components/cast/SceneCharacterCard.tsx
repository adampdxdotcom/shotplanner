import React, { useState } from "react";
import { MediaAsset, CharacterProfile } from "../../types";
import { 
  Plus, 
  Sparkles, 
  MapPin, 
  User, 
  Pencil, 
  Globe, 
  ChevronRight, 
  Settings, 
  Trash2,
  X,
  GripVertical,
  Layers,
  Image as ImageIcon
} from "lucide-react";
import { getAssetMediaUrl } from "../../utils/assetUrl";
import { isLocationEntity } from "../../utils/locationUtils";

interface SceneCharacterCardProps {
  subject: string;
  characters: Record<string, CharacterProfile>;
  assets: MediaAsset[];
  isInUniverse: boolean;
  isPushingToUniverse: boolean;
  onUpdateCharacter: (profile: CharacterProfile) => void;
  onOpenSyncDiff: (subject: string) => void;
  onOpenBulkUpload: (subject: string, isLoc: boolean) => void;
  onOpenAssetStudio: (subject: string, isLoc: boolean) => void;
  onRequestDeleteCharacter: (subject: string) => void;
  onOpenLightbox: (asset: MediaAsset) => void;
  onOpenEditAsset: (asset: MediaAsset) => void;
  onDeleteAsset: (asset: MediaAsset) => void;
}

export const SceneCharacterCard: React.FC<SceneCharacterCardProps> = ({
  subject,
  characters,
  assets,
  isInUniverse,
  isPushingToUniverse,
  onUpdateCharacter,
  onOpenSyncDiff,
  onOpenBulkUpload,
  onOpenAssetStudio,
  onRequestDeleteCharacter,
  onOpenLightbox,
  onOpenEditAsset,
  onDeleteAsset,
}) => {
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [draggingSource, setDraggingSource] = useState<{ type: "gallery" | "slot"; filename: string; fromSlot?: number } | null>(null);

  const charAssets = assets.filter(
    (a) => (a.subject_name || "").trim().toLowerCase() === subject.trim().toLowerCase()
  );

  const profile = characters[subject] || 
    Object.entries(characters || {}).find(([k]) => k.toLowerCase() === subject.toLowerCase())?.[1] || 
    { name: subject, notes: "", quick_slots: [], scene_outfit_ref: "" };

  const isLoc = isLocationEntity(subject, profile, charAssets);

  // Normalize 4 quick slots from character profile
  const quickSlots = Array.isArray(profile.quick_slots) ? profile.quick_slots : [];
  const normalizedSlots: string[] = [
    quickSlots[0] || "",
    quickSlots[1] || "",
    quickSlots[2] || "",
    quickSlots[3] || ""
  ];

  const profilePic = isLoc
    ? (charAssets.find((a) => a.type === "Scene Reference") ||
       charAssets.find((a) => a.type === "Body Reference") ||
       charAssets.find((a) => a.media_type === "image"))
    : (charAssets.find((a) => a.type === "Headshot") ||
       charAssets.find((a) => a.type === "Body Reference") ||
       charAssets.find((a) => a.media_type === "image"));

  // Helper to save quick slots
  const updateSlots = (newSlots: string[]) => {
    onUpdateCharacter?.({
      ...profile,
      quick_slots: newSlots
    });
  };

  const handleClearSlot = (slotIdx: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = [...normalizedSlots];
    updated[slotIdx] = "";
    updateSlots(updated);
  };

  const handleAssignToFirstAvailableSlot = (filename: string) => {
    const updated = [...normalizedSlots];
    // If already in a slot, do nothing or toast
    if (updated.includes(filename)) return;

    // Find first empty slot
    const firstEmpty = updated.findIndex(f => !f);
    if (firstEmpty !== -1) {
      updated[firstEmpty] = filename;
      updateSlots(updated);
    } else {
      // Overwrite slot 0
      updated[0] = filename;
      updateSlots(updated);
    }
  };

  // Drag handlers
  const handleDragStartFromGallery = (e: React.DragEvent, filename: string) => {
    const payload = { type: "gallery" as const, filename };
    setDraggingSource(payload);
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "copyMove";
  };

  const handleDragStartFromSlot = (e: React.DragEvent, slotIdx: number, filename: string) => {
    const payload = { type: "slot" as const, filename, fromSlot: slotIdx };
    setDraggingSource(payload);
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggingSource(null);
    setDragOverSlot(null);
  };

  const handleDropOnSlot = (e: React.DragEvent, targetSlotIdx: number) => {
    e.preventDefault();
    setDragOverSlot(null);

    let data: { type: "gallery" | "slot"; filename: string; fromSlot?: number } | null = null;
    try {
      const jsonStr = e.dataTransfer.getData("application/json");
      if (jsonStr) {
        data = JSON.parse(jsonStr);
      }
    } catch {
      data = draggingSource;
    }

    if (!data || !data.filename) return;

    const updated = [...normalizedSlots];

    if (data.type === "slot" && typeof data.fromSlot === "number") {
      // Reordering / swapping between slots
      const sourceIdx = data.fromSlot;
      if (sourceIdx !== targetSlotIdx) {
        const temp = updated[targetSlotIdx];
        updated[targetSlotIdx] = updated[sourceIdx];
        updated[sourceIdx] = temp;
        updateSlots(updated);
      }
    } else {
      // Dragged from gallery
      const existingIdx = updated.indexOf(data.filename);
      if (existingIdx !== -1 && existingIdx !== targetSlotIdx) {
        // Swap or move
        const temp = updated[targetSlotIdx];
        updated[targetSlotIdx] = data.filename;
        updated[existingIdx] = temp;
      } else {
        updated[targetSlotIdx] = data.filename;
      }
      updateSlots(updated);
    }
    setDraggingSource(null);
  };

  const filledSlotsCount = normalizedSlots.filter(Boolean).length;

  return (
    <div 
      id={`character-card-${subject.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
      className="cast-entity-card bg-zinc-900/50 border border-zinc-800/80 rounded-2xl overflow-hidden flex flex-col md:flex-row shadow-lg"
    >
      {/* Left Sidebar: Character Profile & Quick Settings */}
      <div className="w-full md:w-72 lg:w-84 bg-zinc-900 p-6 border-b md:border-b-0 md:border-r border-zinc-800 flex flex-col shrink-0">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-14 h-14 rounded-full bg-zinc-950 border-2 overflow-hidden shrink-0 flex items-center justify-center ${
                isLoc ? "border-emerald-500/40 text-emerald-400" : "border-zinc-800 text-zinc-600"
              }`}
            >
              {profilePic ? (
                <img
                  src={getAssetMediaUrl(profilePic.filename, true)}
                  className="w-full h-full object-cover"
                  alt={subject}
                  referrerPolicy="no-referrer"
                />
              ) : isLoc ? (
                <MapPin className="w-6 h-6 text-emerald-400" />
              ) : (
                <span className="text-lg font-bold text-zinc-600">
                  {subject.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-zinc-100 line-clamp-1" title={subject}>
                  {subject}
                </h3>
                <button
                  type="button"
                  onClick={() => onUpdateCharacter?.({ ...profile, is_location: !isLoc })}
                  title={
                    isLoc
                      ? "Classified as Location. Click to toggle to Character."
                      : "Classified as Character. Click to toggle to Location."
                  }
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 transition-colors border ${
                    isLoc
                      ? "bg-emerald-950/70 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/80"
                      : "bg-indigo-950/70 border-indigo-700/60 text-indigo-300 hover:bg-indigo-900/80"
                  }`}
                >
                  {isLoc ? (
                    <>
                      <MapPin className="w-2.5 h-2.5 text-emerald-400" />
                      Location
                    </>
                  ) : (
                    <>
                      <User className="w-2.5 h-2.5 text-indigo-400" />
                      Character
                    </>
                  )}
                </button>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p className={`text-xs font-medium ${isLoc ? "text-emerald-400" : "text-amber-500"}`}>
                  {charAssets.length} reference{charAssets.length === 1 ? "" : "s"}
                </p>
                {isInUniverse && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-950/80 border border-amber-600/40 text-amber-300 inline-flex items-center gap-1">
                    <Globe className="w-2.5 h-2.5" />
                    Universe
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Universe Sync / Push Action */}
            <button
              type="button"
              disabled={isPushingToUniverse}
              onClick={() => onOpenSyncDiff(subject)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-sm border ${
                isInUniverse
                  ? "bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border-amber-700/50"
                  : "bg-zinc-800 hover:bg-amber-600 hover:text-black text-zinc-200 border-zinc-700"
              }`}
              title={
                isInUniverse
                  ? "Open Sync & Diff Inspector for Universe"
                  : "Add this character & references to Global Universe"
              }
            >
              <Globe
                className={`w-3.5 h-3.5 ${
                  isPushingToUniverse ? "animate-spin text-amber-400" : "text-amber-400"
                }`}
              />
              <span>{isPushingToUniverse ? "Syncing..." : isInUniverse ? "Sync / Diff" : "Add to Universe"}</span>
            </button>

            {/* Asset Upload Trigger */}
            <button
              type="button"
              onClick={() => onOpenBulkUpload(subject, isLoc)}
              className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-300 dark:bg-zinc-800/90 dark:hover:bg-zinc-700/90 dark:text-zinc-200 dark:border-zinc-700/80 border px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shrink-0 cursor-pointer shadow-sm"
              title={isLoc ? `Upload references for ${subject}` : `Upload reference photos for ${subject}`}
            >
              <Plus className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
              <span>Asset</span>
            </button>

            {/* AI Generator Trigger */}
            <button
              type="button"
              onClick={() => onOpenAssetStudio(subject, isLoc)}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 dark:text-indigo-300 dark:border-indigo-800/60 border px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shrink-0 cursor-pointer shadow-sm"
              title={isLoc ? "Generate AI Location Reference & Scene Staging" : "Generate AI Assets, Headshots & Scene Staging"}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              <span>AI</span>
            </button>

            {/* Delete Trigger */}
            <button
              type="button"
              onClick={() => onRequestDeleteCharacter(subject)}
              className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:text-zinc-500 dark:hover:text-red-400 dark:hover:bg-red-950/40 rounded-lg transition-colors shrink-0"
              title={`Delete ${subject} from Scene`}
              aria-label={`Delete ${subject} from Scene`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 space-y-4">
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1.5 flex items-center justify-between">
              {isLoc ? "Location Details & Notes" : "Notes"}
              <Settings className="w-3 h-3 text-zinc-600" />
            </label>
            <textarea
              value={profile.notes || ""}
              onChange={(e) => onUpdateCharacter?.({ ...profile, notes: e.target.value })}
              placeholder={isLoc ? "Architectural features, lighting, atmosphere, time of day..." : "Physical traits, lore, etc..."}
              className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-300 resize-none outline-none focus:border-amber-500/50 min-h-[60px]"
            />
          </div>

          {!isLoc && (
            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1.5 block">
                Scene Outfit
              </label>
              <input
                type="text"
                value={profile.scene_outfit_ref || ""}
                onChange={(e) => onUpdateCharacter?.({ ...profile, scene_outfit_ref: e.target.value })}
                placeholder="e.g. Red leather jacket, torn jeans"
                className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-300 outline-none focus:border-amber-500/50"
              />
            </div>
          )}
        </div>
      </div>

      {/* Right Content: 4 Drag-and-Drop Quick Slots + Reference Carousel */}
      <div className="p-4 md:p-6 flex-1 bg-zinc-950/20 flex flex-col gap-5 min-w-0">
        
        {/* Top Section: 4 Pinned Shot Reference Slots (Numbered 1-4) */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-200 tracking-tight flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                Shot Reference Slots (1–4)
              </span>
              <span className="text-[10px] text-zinc-400 bg-zinc-800/80 border border-zinc-700/60 px-2 py-0.5 rounded-full font-medium">
                {filledSlotsCount}/4 Assigned
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 hidden sm:block">
              Drag reference photos into slots 1–4 to set priority for shot import
            </p>
          </div>

          {/* 4 Numbered Slots Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((slotIdx) => {
              const slotNumber = slotIdx + 1;
              const filename = normalizedSlots[slotIdx];
              const isOver = dragOverSlot === slotIdx;
              const matchedAsset = filename
                ? charAssets.find((a) => a.filename === filename) ||
                  assets.find((a) => a.filename === filename)
                : null;
              const previewUrl = matchedAsset
                ? getAssetMediaUrl(matchedAsset.filename, true)
                : filename
                ? getAssetMediaUrl(filename, true)
                : null;

              return (
                <div
                  key={slotIdx}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                    if (dragOverSlot !== slotIdx) setDragOverSlot(slotIdx);
                  }}
                  onDragLeave={() => {
                    if (dragOverSlot === slotIdx) setDragOverSlot(null);
                  }}
                  onDrop={(e) => handleDropOnSlot(e, slotIdx)}
                  className={`relative rounded-xl border-2 transition-all flex flex-col items-center justify-center min-h-[130px] p-2 text-center group select-none ${
                    isOver
                      ? "border-indigo-400 bg-indigo-500/15 ring-2 ring-indigo-400/30 scale-[1.02]"
                      : filename
                      ? "border-zinc-700 bg-zinc-900/90 hover:border-zinc-600"
                      : "border-dashed border-zinc-800 bg-zinc-950/40 hover:border-zinc-700 hover:bg-zinc-900/30"
                  }`}
                >
                  {/* Slot Number Badge */}
                  <div className="absolute top-2 left-2 z-10 w-5 h-5 rounded-md bg-zinc-950/90 border border-zinc-700 text-zinc-200 text-[11px] font-bold flex items-center justify-center shadow-xs">
                    {slotNumber}
                  </div>

                  {filename && previewUrl ? (
                    <div
                      draggable={true}
                      onDragStart={(e) => handleDragStartFromSlot(e, slotIdx, filename)}
                      onDragEnd={handleDragEnd}
                      onClick={() => matchedAsset && onOpenLightbox(matchedAsset)}
                      className="w-full h-full flex flex-col items-center justify-center cursor-grab active:cursor-grabbing"
                      title={`Slot ${slotNumber}: ${filename} (Drag to swap with another slot)`}
                    >
                      <div className="w-full h-24 rounded-lg overflow-hidden bg-zinc-950 mb-1.5 relative border border-zinc-800">
                        <img
                          src={previewUrl}
                          alt={`Slot ${slotNumber}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                          <GripVertical className="w-4 h-4 text-white" />
                        </div>
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={(e) => handleClearSlot(slotIdx, e)}
                        className="absolute top-2 right-2 z-10 p-1 rounded-md bg-black/70 hover:bg-rose-600 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                        title={`Clear Slot ${slotNumber}`}
                      >
                        <X className="w-3 h-3" />
                      </button>

                      <span className="text-[10px] text-zinc-400 font-mono truncate max-w-full px-1">
                        {matchedAsset?.type || `Slot ${slotNumber}`}
                      </span>
                    </div>
                  ) : (
                    /* Empty Slot Drop Target */
                    <div className="flex flex-col items-center justify-center gap-1.5 py-3 text-zinc-600 group-hover:text-zinc-400 transition-colors pointer-events-none">
                      <div className="w-7 h-7 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                        <Plus className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[11px] font-medium text-zinc-500">
                        Drop into {slotNumber}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Section: Full Reference Gallery Strip */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-zinc-400" />
              All Reference Photos ({charAssets.length})
            </span>
            <span className="text-[10px] text-zinc-500">
              Drag photo to any slot above, or click "+ Slot"
            </span>
          </div>

          <div className="overflow-x-auto min-w-0 pb-2">
            <div className="flex items-start gap-4 min-w-max">
              {charAssets.length === 0 && (
                <>
                  {[1, 2, 3].map((i) => (
                    <div 
                      key={`placeholder-${i}`} 
                      className="w-32 h-40 border-2 border-dashed border-zinc-800/30 rounded-xl bg-zinc-900/10 shrink-0"
                    />
                  ))}
                </>
              )}
              
              {charAssets.map((asset) => {
                const isAssigned = normalizedSlots.includes(asset.filename);
                const assignedSlotIndex = normalizedSlots.indexOf(asset.filename);

                return (
                  <div 
                    key={asset.filename || asset.id}
                    draggable={true}
                    onDragStart={(e) => handleDragStartFromGallery(e, asset.filename)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onOpenLightbox(asset)}
                    className="w-32 shrink-0 group cursor-grab active:cursor-grabbing select-none"
                  >
                    <div className={`w-32 h-40 bg-zinc-900 border rounded-xl overflow-hidden mb-2 relative transition-all ${
                      isAssigned 
                        ? "border-indigo-500/60 ring-1 ring-indigo-500/30" 
                        : "border-zinc-800 hover:border-zinc-700"
                    }`}>
                      {asset.media_type === "image" || !asset.media_type || !/\.(mp4|mov|webm|mp3|wav)$/i.test(asset.filename) ? (
                        <img 
                          src={getAssetMediaUrl(asset.filename, true)} 
                          className="w-full h-full object-cover group-hover:opacity-85 transition-opacity" 
                          alt={asset.filename} 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-zinc-950 text-xs text-zinc-600 font-mono p-2 text-center break-all">
                          {asset.filename.split('.').pop()?.toUpperCase()}
                        </div>
                      )}

                      {/* Assigned Slot Indicator Badge */}
                      {isAssigned && (
                        <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-md bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shadow-md">
                          {assignedSlotIndex + 1}
                        </div>
                      )}

                      {/* Quick Action Overlay: Edit Pencil & Delete Trash Can */}
                      <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAssignToFirstAvailableSlot(asset.filename);
                          }}
                          className="p-1.5 bg-black/70 hover:bg-indigo-600 text-white rounded backdrop-blur shadow transition-colors cursor-pointer"
                          title="Assign to next available slot (1-4)"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenEditAsset(asset);
                          }}
                          className="p-1.5 bg-black/70 hover:bg-black text-white rounded backdrop-blur shadow transition-colors cursor-pointer"
                          title="Edit Asset Metadata"
                          aria-label="Edit Asset Metadata"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteAsset(asset);
                          }}
                          className="p-1.5 bg-black/70 hover:bg-red-500 text-white rounded backdrop-blur shadow transition-colors cursor-pointer"
                          title="Delete Asset"
                          aria-label="Delete Asset"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Shared Universe Origin Badge */}
                      {asset.is_universe && (
                        <div className="absolute bottom-6 left-1.5 px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-500/50 text-amber-300 text-[9px] font-bold flex items-center gap-1 shadow pointer-events-none backdrop-blur-sm">
                          <Globe className="w-2.5 h-2.5" />
                          <span>Universe</span>
                        </div>
                      )}

                      {asset.type && (
                        <div className="absolute bottom-0 inset-x-0 bg-black/80 backdrop-blur-sm p-1.5 pointer-events-none">
                          <p className="text-[9px] font-bold text-zinc-300 truncate text-center">{asset.type}</p>
                        </div>
                      )}
                    </div>
                    {asset.description && (
                      <p className="text-[10px] text-zinc-500 line-clamp-2 leading-relaxed" title={asset.description}>
                        {asset.description}
                      </p>
                    )}
                  </div>
                );
              })}
              
              <div 
                onClick={() => onOpenBulkUpload(subject, isLoc)}
                className="w-32 h-40 border-2 border-dashed border-zinc-800 rounded-xl flex flex-col items-center justify-center text-zinc-600 hover:text-amber-400 hover:border-amber-500/50 hover:bg-zinc-900/50 transition-colors cursor-pointer shrink-0"
              >
                <ChevronRight className="w-6 h-6 mb-1" />
                <span className="text-[10px] font-bold">Add Ref</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
