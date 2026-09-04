import React from "react";
import { 
  User, 
  FlipHorizontal, 
  ArrowUp, 
  ArrowDown, 
  RotateCcw, 
  Check, 
  Eraser, 
  Trash2 
} from "lucide-react";
import { StagedActorCanvasItem } from "./types";

export interface StagedActorItemProps {
  actor: StagedActorCanvasItem;
  isSelected: boolean;
  isMaskingMode: boolean;
  maskingActorId: string | null;
  lastCommittedCutout?: string;
  onSelectActor: (actor: StagedActorCanvasItem) => void;
  onActorPointerDown: (e: React.PointerEvent, actor: StagedActorCanvasItem) => void;
  onActorWheel: (e: React.WheelEvent, actor: StagedActorCanvasItem) => void;
  onResizePointerDown: (e: React.PointerEvent, actor: StagedActorCanvasItem, corner: "top" | "bottom") => void;
  onToggleFlip: (actor: StagedActorCanvasItem) => void;
  onBringForward: (actor: StagedActorCanvasItem) => void;
  onSendBackward: (actor: StagedActorCanvasItem) => void;
  onRemoveActor: (id: string) => void;
  onEnterMaskingMode: (actor: StagedActorCanvasItem) => void;
  onExitMaskingMode: () => void;
  onResetMask: () => void;
  onMaskPointerDown: (e: React.PointerEvent, actor: StagedActorCanvasItem) => void;
  onMaskPointerMove: (e: React.PointerEvent, actor: StagedActorCanvasItem) => void;
  onMaskPointerUp: (e: React.PointerEvent, actor: StagedActorCanvasItem) => void;
  setActiveMaskCanvas: (canvas: HTMLCanvasElement | null) => void;
  registerImgRef: (id: string, el: HTMLImageElement | null) => void;
}

export const StagedActorItem: React.FC<StagedActorItemProps> = ({
  actor,
  isSelected,
  isMaskingMode,
  maskingActorId,
  lastCommittedCutout,
  onSelectActor,
  onActorPointerDown,
  onActorWheel,
  onResizePointerDown,
  onToggleFlip,
  onBringForward,
  onSendBackward,
  onRemoveActor,
  onEnterMaskingMode,
  onExitMaskingMode,
  onResetMask,
  onMaskPointerDown,
  onMaskPointerMove,
  onMaskPointerUp,
  setActiveMaskCanvas,
  registerImgRef
}) => {
  const isCurrentMasking = isMaskingMode && maskingActorId === actor.id;
  const actorScale = actor.scale || 1.0;
  const displayHeightPercent = 55 * actorScale;

  return (
    <div
      style={{
        left: `${actor.xPercent}%`,
        top: `${actor.yPercent}%`,
        zIndex: isCurrentMasking ? 40 : isSelected ? 30 : 20 + (actor.zIndex || 1),
        transform: "translate(-50%, -100%)",
        height: `${displayHeightPercent}%`,
        maxWidth: "none",
        width: "max-content",
        whiteSpace: "nowrap"
      }}
      className={`absolute flex flex-col items-center justify-end max-w-none shrink-0 ${
        isCurrentMasking
          ? "cursor-crosshair pointer-events-auto"
          : isSelected
          ? "cursor-move pointer-events-auto"
          : "cursor-move pointer-events-auto hover:opacity-95"
      }`}
      onPointerDown={(e) => {
        if (isCurrentMasking) {
          onMaskPointerDown(e, actor);
        } else if (!isMaskingMode) {
          onActorPointerDown(e, actor);
        }
      }}
      onPointerMove={(e) => {
        if (isCurrentMasking) {
          onMaskPointerMove(e, actor);
        }
      }}
      onPointerUp={(e) => {
        if (isCurrentMasking) {
          onMaskPointerUp(e, actor);
        }
      }}
      onPointerCancel={(e) => {
        if (isCurrentMasking) {
          onMaskPointerUp(e, actor);
        }
      }}
      onWheel={(e) => {
        if (!isMaskingMode) onActorWheel(e, actor);
      }}
    >
      {/* Soft Elliptical Ground Contact Shadow */}
      <div
        style={{
          width: "70%",
          height: "12px",
          bottom: "-6px"
        }}
        className="absolute bg-black/60 rounded-[100%] blur-sm pointer-events-none"
      />

      {/* Actor Cutout Image Container with Bounding Box */}
      <div
        className={`relative h-full flex flex-col items-center justify-end max-w-none shrink-0 transition-shadow ${
          isCurrentMasking
            ? "ring-2 ring-indigo-400 ring-offset-2 ring-offset-zinc-950 rounded-lg shadow-2xl"
            : isSelected
            ? "ring-2 ring-indigo-400 ring-offset-2 ring-offset-zinc-950 rounded-lg shadow-2xl"
            : "hover:ring-1 hover:ring-white/40 rounded-lg"
        }`}
      >
        {/* Non-shifting dashed outline overlay during masking */}
        {isCurrentMasking && (
          <div className="pointer-events-none absolute inset-0 rounded-lg border-2 border-dashed border-indigo-400/90 z-20 shadow-[0_0_15px_rgba(99,102,241,0.3)]" />
        )}

        {/* Figure wrapper strictly maintaining scale, aspect ratio, and horizontal flip */}
        <div
          className="relative h-full w-auto flex items-end justify-center select-none max-w-none shrink-0"
          style={{
            transform: actor.isFlipped ? "scaleX(-1)" : "none",
            transformOrigin: "bottom center"
          }}
        >
          {/* Cutout Image or Silhouette Fallback: ALWAYS in the DOM to anchor layout dimensions */}
          {actor.cutoutDataUrl || actor.originalCutoutDataUrl ? (
            <img
              ref={(el) => registerImgRef(actor.id, el)}
              src={lastCommittedCutout || actor.cutoutDataUrl || actor.originalCutoutDataUrl}
              alt={actor.characterName}
              draggable={false}
              style={{
                opacity: isCurrentMasking ? 0 : 1
              }}
              className="h-full w-auto max-w-none shrink-0 object-contain select-none filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.7)] pointer-events-none"
            />
          ) : (
            // Fallback Avatar Token
            <div
              style={{
                height: "100%",
                aspectRatio: "2/3",
                opacity: isCurrentMasking ? 0 : 1
              }}
              className="bg-gradient-to-t from-indigo-950 to-zinc-900 border-2 border-indigo-500/60 rounded-t-full flex flex-col items-center justify-center p-2 text-center shadow-lg pointer-events-none max-w-none shrink-0"
            >
              <User className="w-8 h-8 text-indigo-300 mb-1" />
              <span className="text-[11px] font-bold text-white truncate max-w-full">
                {actor.characterName}
              </span>
              <span className="text-[9px] text-zinc-400 font-mono">
                {actor.posture || "Posed"}
              </span>
            </div>
          )}

          {/* Masking Layer Canvas: Pixel-locked absolute overlay directly matching figure dimensions */}
          {isCurrentMasking && (
            <canvas
              ref={setActiveMaskCanvas}
              className="absolute inset-0 w-full h-full max-w-none shrink-0 object-contain select-none filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.7)] cursor-crosshair z-10"
              style={{
                touchAction: "none"
              }}
              onPointerDown={(e) => onMaskPointerDown(e, actor)}
              onPointerMove={(e) => onMaskPointerMove(e, actor)}
              onPointerUp={(e) => onMaskPointerUp(e, actor)}
              onPointerCancel={(e) => onMaskPointerUp(e, actor)}
            />
          )}
        </div>

        {/* ACTIVE BOUNDING BOX & CORNER RESIZE HANDLES (Shown When Selected) */}
        {isSelected && (
          <>
            {/* Floating Actor Name & Depth Badge */}
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-zinc-950/90 text-white border border-indigo-500 px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap shadow flex items-center gap-1 z-30 pointer-events-none">
              <span className="text-indigo-400">{actor.characterName}</span>
              <span className="text-zinc-500">•</span>
              <span className="text-zinc-300">{Math.round(actor.scale * 100)}%</span>
              {isCurrentMasking && (
                <span className="text-indigo-300 font-bold text-[9px] bg-indigo-950/80 px-1 rounded border border-indigo-600/50">
                  MASKING
                </span>
              )}
              {(actor.xPercent < 0 || actor.xPercent > 100 || actor.yPercent > 100) && (
                <span className="text-amber-400 text-[9px]">(Off-Stage)</span>
              )}
            </div>

            {/* Corner handles hidden during active masking mode to avoid obstructing brush painting */}
            {!isMaskingMode && (
              <>
                {/* Top-Right Corner Resize Handle */}
                <div
                  onPointerDown={(e) => onResizePointerDown(e, actor, "top")}
                  className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-sm cursor-nesw-resize shadow-md hover:scale-125 transition-transform z-30"
                  title="Drag corner to scale actor (20% - 350%+)"
                />

                {/* Top-Left Corner Resize Handle */}
                <div
                  onPointerDown={(e) => onResizePointerDown(e, actor, "top")}
                  className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-sm cursor-nwse-resize shadow-md hover:scale-125 transition-transform z-30"
                  title="Drag corner to scale actor (20% - 350%+)"
                />

                {/* Bottom-Right Corner Resize Handle */}
                <div
                  onPointerDown={(e) => onResizePointerDown(e, actor, "bottom")}
                  className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-sm cursor-nwse-resize shadow-md hover:scale-125 transition-transform z-30"
                  title="Drag corner to scale actor (20% - 350%+)"
                />

                {/* Bottom-Left Corner Resize Handle */}
                <div
                  onPointerDown={(e) => onResizePointerDown(e, actor, "bottom")}
                  className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-sm cursor-nesw-resize shadow-md hover:scale-125 transition-transform z-30"
                  title="Drag corner to scale actor (20% - 350%+)"
                />
              </>
            )}

            {/* Bottom Floating Mini Toolbar */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-zinc-900/95 border border-zinc-700/80 rounded-lg p-0.5 flex items-center gap-0.5 shadow-xl backdrop-blur z-30">
              {isCurrentMasking ? (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onResetMask();
                    }}
                    className="px-1.5 py-0.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                    title="Reset mask to original cutout"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onExitMaskingMode();
                    }}
                    className="px-2 py-0.5 text-white bg-indigo-600 hover:bg-indigo-500 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    title="Done Masking"
                  >
                    <Check className="w-3 h-3" />
                    <span>Done</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFlip(actor);
                    }}
                    className="p-1 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded transition-colors cursor-pointer"
                    title="Flip Facing (⇄)"
                  >
                    <FlipHorizontal className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onBringForward(actor);
                    }}
                    className="p-1 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded transition-colors cursor-pointer"
                    title="Bring Forward (↑)"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSendBackward(actor);
                    }}
                    className="p-1 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded transition-colors cursor-pointer"
                    title="Send Backward (↓)"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEnterMaskingMode(actor);
                    }}
                    className="p-1 text-indigo-300 hover:text-white hover:bg-indigo-950/80 rounded transition-colors flex items-center gap-1 text-[10px] font-medium cursor-pointer"
                    title="Erase / Mask Actor (Tuck behind furniture, trim edges)"
                  >
                    <Eraser className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="hidden sm:inline">Mask</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveActor(actor.id);
                    }}
                    className="p-1 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded transition-colors cursor-pointer"
                    title="Remove Actor from Stage"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
