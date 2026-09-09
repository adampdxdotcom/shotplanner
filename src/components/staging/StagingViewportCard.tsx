import React from "react";
import { Clapperboard, UserPlus } from "lucide-react";
import { MediaAsset } from "../../types";
import { StagedActor } from "./types";
import { StagingInteractiveCanvas, StagedActorCanvasItem } from "../cast/StagingInteractiveCanvas";

export interface StagingViewportCardProps {
  viewportRatio: string;
  onOpenPoseKeying: () => void;
  stagedActors: StagedActor[];
  selectedActorId: string | null;
  onSelectActor: (id: string | null) => void;
  onUpdateActor: (id: string, updates: Partial<StagedActor>) => void;
  onRemoveActor: (id: string) => void;
  onReorderActors: (reordered: StagedActorCanvasItem[]) => void;
  onApplyActors?: (actors: StagedActorCanvasItem[]) => void;
  activeLocationAsset?: MediaAsset;
  locationAssets: MediaAsset[];
  customBackgroundUrl?: string;
  onSelectLocationAsset: (filename: string) => void;
  onUploadCustomBackground: (file: File) => void;
  onClearBackground: () => void;
  showGrid: boolean;
  showSafeAreas: boolean;
  activeMaskingActorId: string | null;
  onSetMaskingActorId: (id: string | null) => void;
}

export const StagingViewportCard: React.FC<StagingViewportCardProps> = ({
  viewportRatio,
  onOpenPoseKeying,
  stagedActors,
  selectedActorId,
  onSelectActor,
  onUpdateActor,
  onRemoveActor,
  onReorderActors,
  onApplyActors,
  activeLocationAsset,
  locationAssets,
  customBackgroundUrl,
  onSelectLocationAsset,
  onUploadCustomBackground,
  onClearBackground,
  showGrid,
  showSafeAreas,
  activeMaskingActorId,
  onSetMaskingActorId
}) => {
  return (
    <div className="w-full flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <Clapperboard className="w-3.5 h-3.5 text-indigo-400" />
            Director's 2D Stage Viewport ({viewportRatio})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenPoseKeying}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Actor Pose</span>
          </button>
        </div>
      </div>

      {/* Interactive 2D Staging Canvas */}
      <StagingInteractiveCanvas
        actors={stagedActors}
        selectedActorId={selectedActorId}
        onSelectActor={onSelectActor}
        onUpdateActor={onUpdateActor}
        onRemoveActor={onRemoveActor}
        onReorderActors={onReorderActors}
        onApplyActors={onApplyActors}
        activeLocationAsset={activeLocationAsset}
        locationAssets={locationAssets}
        customBackgroundUrl={customBackgroundUrl}
        onSelectLocationAsset={onSelectLocationAsset}
        onUploadCustomBackground={onUploadCustomBackground}
        onClearBackground={onClearBackground}
        aspectRatio={viewportRatio}
        showGrid={showGrid}
        showSafeAreas={showSafeAreas}
        activeMaskingActorId={activeMaskingActorId}
        onSetMaskingActorId={onSetMaskingActorId}
      />
    </div>
  );
};
