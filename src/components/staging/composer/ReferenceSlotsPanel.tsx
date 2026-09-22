import React from "react";
import { User, Shirt, MapPin, Layers, FolderOpen, Upload } from "lucide-react";
import { getAssetMediaUrl } from "../../../utils/assetUrl";
import { ComposerSlotType, ReferenceSlotState } from "./types";

interface ReferenceSlotsPanelProps {
  actorSlot: ReferenceSlotState;
  wardrobeSlot: ReferenceSlotState;
  locationSlot: ReferenceSlotState;
  onClearSlot: (slot: ComposerSlotType) => void;
  onOpenPicker: (slot: ComposerSlotType) => void;
  onTriggerUpload: (slot: ComposerSlotType) => void;
}

export const ReferenceSlotsPanel: React.FC<ReferenceSlotsPanelProps> = ({
  actorSlot,
  wardrobeSlot,
  locationSlot,
  onClearSlot,
  onOpenPicker,
  onTriggerUpload
}) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-purple-400" />
          <span>Multi-Reference Ingestion Composer</span>
        </span>
        <span className="text-[11px] text-zinc-500">Auto-bound from Scene Staging & Character profiles</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* SLOT 1: ACTOR / HEADSHOT */}
        <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-purple-400" />
              Actor Likeness Slot
            </span>
            {actorSlot.filename && (
              <button
                type="button"
                onClick={() => onClearSlot("actor")}
                className="text-[10px] text-zinc-500 hover:text-red-400 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <div className="aspect-video bg-black/50 rounded-md border border-zinc-800/80 relative overflow-hidden flex items-center justify-center">
            {actorSlot.previewUrl || actorSlot.filename ? (
              <img
                src={actorSlot.previewUrl || getAssetMediaUrl(actorSlot.filename!)}
                alt="Actor Reference"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-zinc-600 text-[10px] p-2 text-center">
                <User className="w-5 h-5 mb-1 opacity-40" />
                <span>No actor attached</span>
              </div>
            )}
            {actorSlot.label && (
              <span className="absolute bottom-1 left-1 bg-black/80 backdrop-blur-xs text-zinc-300 text-[9px] px-1.5 py-0.5 rounded font-medium truncate max-w-[90%]">
                {actorSlot.label}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onOpenPicker("actor")}
              className="flex-1 py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <FolderOpen className="w-3 h-3 text-purple-400" />
              <span>Choose</span>
            </button>
            <button
              type="button"
              onClick={() => onTriggerUpload("actor")}
              className="py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
              title="Upload headshot"
            >
              <Upload className="w-3 h-3 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* SLOT 2: WARDROBE / OUTFIT */}
        <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5">
              <Shirt className="w-3.5 h-3.5 text-indigo-400" />
              Wardrobe Reference Slot
            </span>
            {wardrobeSlot.filename && (
              <button
                type="button"
                onClick={() => onClearSlot("wardrobe")}
                className="text-[10px] text-zinc-500 hover:text-red-400 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <div className="aspect-video bg-black/50 rounded-md border border-zinc-800/80 relative overflow-hidden flex items-center justify-center">
            {wardrobeSlot.previewUrl || wardrobeSlot.filename ? (
              <img
                src={wardrobeSlot.previewUrl || getAssetMediaUrl(wardrobeSlot.filename!)}
                alt="Wardrobe Reference"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-zinc-600 text-[10px] p-2 text-center">
                <Shirt className="w-5 h-5 mb-1 opacity-40" />
                <span>Optional wardrobe</span>
              </div>
            )}
            {wardrobeSlot.label && (
              <span className="absolute bottom-1 left-1 bg-black/80 backdrop-blur-xs text-zinc-300 text-[9px] px-1.5 py-0.5 rounded font-medium truncate max-w-[90%]">
                {wardrobeSlot.label}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onOpenPicker("wardrobe")}
              className="flex-1 py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <FolderOpen className="w-3 h-3 text-indigo-400" />
              <span>Choose</span>
            </button>
            <button
              type="button"
              onClick={() => onTriggerUpload("wardrobe")}
              className="py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
              title="Upload wardrobe ref"
            >
              <Upload className="w-3 h-3 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* SLOT 3: LOCATION / SCENE */}
        <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              Location Backdrop Slot
            </span>
            {locationSlot.filename && (
              <button
                type="button"
                onClick={() => onClearSlot("location")}
                className="text-[10px] text-zinc-500 hover:text-red-400 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <div className="aspect-video bg-black/50 rounded-md border border-zinc-800/80 relative overflow-hidden flex items-center justify-center">
            {locationSlot.previewUrl || locationSlot.filename ? (
              <img
                src={locationSlot.previewUrl || getAssetMediaUrl(locationSlot.filename!)}
                alt="Location Reference"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-zinc-600 text-[10px] p-2 text-center">
                <MapPin className="w-5 h-5 mb-1 opacity-40" />
                <span>Optional location</span>
              </div>
            )}
            {locationSlot.label && (
              <span className="absolute bottom-1 left-1 bg-black/80 backdrop-blur-xs text-zinc-300 text-[9px] px-1.5 py-0.5 rounded font-medium truncate max-w-[90%]">
                {locationSlot.label}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onOpenPicker("location")}
              className="flex-1 py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <FolderOpen className="w-3 h-3 text-amber-400" />
              <span>Choose</span>
            </button>
            <button
              type="button"
              onClick={() => onTriggerUpload("location")}
              className="py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
              title="Upload location ref"
            >
              <Upload className="w-3 h-3 text-zinc-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
