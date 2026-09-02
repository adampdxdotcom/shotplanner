import React from "react";
import { MapPin, Loader2, Save } from "lucide-react";

interface ShotItem {
  id: string;
  shot_number: number;
}

export interface StagingCompositeSavePanelProps {
  defaultEnvironmentName: string;
  compositeRefName: string;
  setHasUserEditedRefName: (v: boolean) => void;
  setCompositeRefName: (name: string) => void;
  assignToShotSlot: boolean;
  setAssignToShotSlot: (assign: boolean) => void;
  targetSlotIndex: number;
  setTargetSlotIndex: (idx: number) => void;
  activeShot: ShotItem | undefined;
  handleSaveCompositeReference: () => void;
  isExportingComposite: boolean;
}

export const StagingCompositeSavePanel: React.FC<StagingCompositeSavePanelProps> = ({
  defaultEnvironmentName,
  compositeRefName,
  setHasUserEditedRefName,
  setCompositeRefName,
  assignToShotSlot,
  setAssignToShotSlot,
  targetSlotIndex,
  setTargetSlotIndex,
  activeShot,
  handleSaveCompositeReference,
  isExportingComposite
}) => {
  return (
    <div className="bg-gradient-to-br from-zinc-900/90 via-zinc-900/60 to-zinc-950 border border-zinc-800 rounded-xl p-5 space-y-4 shadow-xl">
      {/* Header with contextual location info */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <span>Save Composite Reference to Gallery</span>
            </h4>
            <p className="text-xs text-zinc-400">
              Flattens 2D staging layout & environment into a persistent scene reference asset.
            </p>
          </div>
        </div>

        {/* Active background environment badge */}
        <div className="flex items-center gap-2 text-xs bg-zinc-950/80 border border-zinc-800 px-2.5 py-1 rounded-lg">
          <span className="text-zinc-500">Stage Background:</span>
          <span className="font-semibold text-zinc-200 truncate max-w-[200px]" title={defaultEnvironmentName}>
            {defaultEnvironmentName}
          </span>
        </div>
      </div>

      {/* Form fields: Location/Reference Name */}
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1">
            Location / Reference Name
          </label>
          <input
            type="text"
            value={compositeRefName}
            onChange={(e) => {
              setHasUserEditedRefName(true);
              setCompositeRefName(e.target.value);
            }}
            placeholder="e.g. Couch 3/4 or Living Room"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 transition-colors"
          />
          <span className="block mt-1 text-[11px] text-zinc-500">
            Asset subject identifier for gallery organization (avoids phantom characters)
          </span>
        </div>
      </div>

      {/* Bottom Action Bar: Optional Slot Assignment & Save Action Button */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-zinc-800/60">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none group">
            <input
              type="checkbox"
              checked={assignToShotSlot}
              onChange={(e) => setAssignToShotSlot(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-950 text-amber-500 focus:ring-amber-500/40 cursor-pointer accent-amber-500"
            />
            <span className="text-xs font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors">
              Also assign to active shot input slot
              {activeShot && (
                <span className="ml-1.5 text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                  Shot {activeShot.shot_number.toString().padStart(2, "0")}
                </span>
              )}
            </span>
          </label>

          {assignToShotSlot && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-medium">Slot:</span>
              <select
                value={targetSlotIndex}
                onChange={(e) => setTargetSlotIndex(Number(e.target.value))}
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-amber-400 font-semibold focus:outline-none focus:border-amber-500/60 cursor-pointer"
              >
                <option value={8}>Slot 9 (Location / Staging Ref) - Default</option>
                <option value={0}>Slot 1 (Subject / Primary Ref)</option>
                <option value={1}>Slot 2 (Secondary Ref)</option>
                <option value={2}>Slot 3 (Tertiary Ref)</option>
                <option value={3}>Slot 4 (Shot Composition Ref)</option>
                <option value={4}>Slot 5 (Lighting Ref)</option>
                <option value={5}>Slot 6 (Atmosphere Ref)</option>
                <option value={6}>Slot 7 (Action Ref)</option>
                <option value={7}>Slot 8 (Style Ref)</option>
              </select>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleSaveCompositeReference}
          disabled={isExportingComposite}
          className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-black font-bold px-6 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] shrink-0"
        >
          {isExportingComposite ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-black" />
              <span>Flattening & Uploading Composite...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4 text-black" />
              <span>Save Composite Reference</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
