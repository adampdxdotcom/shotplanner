import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { 
  Maximize2, 
  Trash2, 
  FlipHorizontal, 
  ArrowUp, 
  ArrowDown, 
  Upload, 
  Image as ImageIcon, 
  Grid, 
  Compass, 
  User, 
  Check, 
  Layers,
  ChevronDown
} from "lucide-react";
import { MediaAsset } from "../../types";
import { getAssetMediaUrl } from "../../utils/assetUrl";

export interface StagedActorCanvasItem {
  id: string;
  characterName: string;
  cutoutDataUrl?: string;
  referenceAssetFilename?: string;
  xPercent: number; // 5 to 95
  yPercent: number; // 15 to 98 (feet anchor)
  scale: number; // 0.25 to 2.5 (default ~1.0)
  isFlipped: boolean;
  zIndex: number;
  plane?: "foreground" | "midground" | "background";
  posture?: string;
  facing?: "facing_camera" | "turn_left" | "turn_right" | "profile_left" | "profile_right" | "back_camera";
}

interface StagingInteractiveCanvasProps {
  actors: StagedActorCanvasItem[];
  selectedActorId: string | null;
  onSelectActor: (id: string | null) => void;
  onUpdateActor: (id: string, updates: Partial<StagedActorCanvasItem>) => void;
  onRemoveActor: (id: string) => void;
  onReorderActors: (actors: StagedActorCanvasItem[]) => void;
  
  // Environment / Background
  activeLocationAsset?: MediaAsset;
  locationAssets: MediaAsset[];
  customBackgroundUrl?: string;
  onSelectLocationAsset: (assetFilename: string) => void;
  onUploadCustomBackground: (file: File) => void;
  onClearBackground: () => void;

  // Viewport Settings
  aspectRatio: string; // "16:9" | "2.39:1" | "4:3" | "9:16"
  showGrid?: boolean;
  showSafeAreas?: boolean;
}

export const StagingInteractiveCanvas: React.FC<StagingInteractiveCanvasProps> = ({
  actors,
  selectedActorId,
  onSelectActor,
  onUpdateActor,
  onRemoveActor,
  onReorderActors,
  activeLocationAsset,
  locationAssets,
  customBackgroundUrl,
  onSelectLocationAsset,
  onUploadCustomBackground,
  onClearBackground,
  aspectRatio,
  showGrid = true,
  showSafeAreas = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dragging and resizing interaction state
  const [isDraggingActor, setIsDraggingActor] = useState<boolean>(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isResizingActor, setIsResizingActor] = useState<boolean>(false);
  const resizeInitialStateRef = useRef<{ initialY: number; initialScale: number } | null>(null);

  // Location selector dropdown state
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState<boolean>(false);
  const [isCanvasDragOver, setIsCanvasDragOver] = useState<boolean>(false);

  const selectedActor = useMemo(() => {
    return actors.find((a) => a.id === selectedActorId);
  }, [actors, selectedActorId]);

  // Determine effective background image URL
  const backgroundUrl = useMemo(() => {
    if (customBackgroundUrl) return customBackgroundUrl;
    if (activeLocationAsset) return getAssetMediaUrl(activeLocationAsset.filename, true);
    return null;
  }, [customBackgroundUrl, activeLocationAsset]);

  // Handle Dragging Actor across Canvas
  const handleActorPointerDown = (e: React.PointerEvent, actor: StagedActorCanvasItem) => {
    e.stopPropagation();
    onSelectActor(actor.id);

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    setDragOffset({
      x: clickX - actor.xPercent,
      y: clickY - actor.yPercent
    });
    setIsDraggingActor(true);
  };

  // Handle Corner Resize Handle Pointer Down
  const handleResizePointerDown = (e: React.PointerEvent, actor: StagedActorCanvasItem) => {
    e.stopPropagation();
    setIsResizingActor(true);
    resizeInitialStateRef.current = {
      initialY: e.clientY,
      initialScale: actor.scale || 1.0
    };
  };

  // Global Pointer Move and Up Listeners during Drag / Resize
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      if (isDraggingActor && selectedActorId) {
        const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
        const mouseY = ((e.clientY - rect.top) / rect.height) * 100;

        const newX = Math.max(5, Math.min(95, mouseX - dragOffset.x));
        const newY = Math.max(15, Math.min(98, mouseY - dragOffset.y));

        // Derive subtle plane based on Y position (Background: <45%, Midground: 45-75%, Foreground: >75%)
        let derivedPlane: "foreground" | "midground" | "background" = "midground";
        if (newY <= 48) derivedPlane = "background";
        else if (newY >= 76) derivedPlane = "foreground";

        onUpdateActor(selectedActorId, {
          xPercent: Math.round(newX * 10) / 10,
          yPercent: Math.round(newY * 10) / 10,
          plane: derivedPlane
        });
      } else if (isResizingActor && selectedActorId && resizeInitialStateRef.current) {
        const { initialY, initialScale } = resizeInitialStateRef.current;
        // Dragging upward increases size; downward decreases
        const deltaY = initialY - e.clientY;
        const scaleChange = deltaY / 140;
        const nextScale = Math.max(0.25, Math.min(2.5, Math.round((initialScale + scaleChange) * 100) / 100));

        onUpdateActor(selectedActorId, { scale: nextScale });
      }
    };

    const handlePointerUp = () => {
      if (isDraggingActor) setIsDraggingActor(false);
      if (isResizingActor) {
        setIsResizingActor(false);
        resizeInitialStateRef.current = null;
      }
    };

    if (isDraggingActor || isResizingActor) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    }

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDraggingActor, isResizingActor, selectedActorId, dragOffset, onUpdateActor]);

  // Flip Actor Horizontally
  const handleToggleFlip = (actor: StagedActorCanvasItem) => {
    const nextFlipped = !actor.isFlipped;
    let nextFacing = actor.facing;
    if (nextFacing === "profile_left") nextFacing = "profile_right";
    else if (nextFacing === "profile_right") nextFacing = "profile_left";
    else if (nextFacing === "turn_left") nextFacing = "turn_right";
    else if (nextFacing === "turn_right") nextFacing = "turn_left";

    onUpdateActor(actor.id, {
      isFlipped: nextFlipped,
      facing: nextFacing
    });
  };

  // Layer Stacking (Bring Forward / Send Backward)
  const handleBringForward = (actor: StagedActorCanvasItem) => {
    const sorted = [...actors].sort((a, b) => a.zIndex - b.zIndex);
    const currIdx = sorted.findIndex((a) => a.id === actor.id);
    if (currIdx < sorted.length - 1) {
      const nextActor = sorted[currIdx + 1];
      const tempZ = actor.zIndex;
      onUpdateActor(actor.id, { zIndex: nextActor.zIndex });
      onUpdateActor(nextActor.id, { zIndex: tempZ });
    } else {
      onUpdateActor(actor.id, { zIndex: actor.zIndex + 1 });
    }
  };

  const handleSendBackward = (actor: StagedActorCanvasItem) => {
    const sorted = [...actors].sort((a, b) => a.zIndex - b.zIndex);
    const currIdx = sorted.findIndex((a) => a.id === actor.id);
    if (currIdx > 0) {
      const prevActor = sorted[currIdx - 1];
      const tempZ = actor.zIndex;
      onUpdateActor(actor.id, { zIndex: prevActor.zIndex });
      onUpdateActor(prevActor.id, { zIndex: tempZ });
    } else if (actor.zIndex > 1) {
      onUpdateActor(actor.id, { zIndex: Math.max(1, actor.zIndex - 1) });
    }
  };

  // Canvas Drag & Drop Image Handler
  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsCanvasDragOver(true);
  };

  const handleCanvasDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsCanvasDragOver(false);
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsCanvasDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        onUploadCustomBackground(file);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      onUploadCustomBackground(file);
    }
  };

  return (
    <div className="flex flex-col gap-2.5 select-none">
      {/* Hidden File Input for Custom Background Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* CANVAS HEADER CONTROLS (Location Selector & Quick Presets) */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
        <div className="flex items-center gap-2">
          {/* Location Selector Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsLocationPickerOpen(!isLocationPickerOpen)}
              className="bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/80 px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors shadow-sm"
              title="Select Scene Location"
            >
              <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
              <span className="max-w-[140px] truncate">
                {activeLocationAsset?.description || activeLocationAsset?.filename || "Select Location"}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 ml-0.5" />
            </button>

            {/* Location Selector Flyout */}
            {isLocationPickerOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsLocationPickerOpen(false)}
                />
                <div className="absolute top-full left-0 mt-1.5 w-72 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-3 z-40 space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <span className="text-xs font-semibold text-zinc-200">Scene Locations</span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium cursor-pointer"
                    >
                      <Upload className="w-3 h-3" />
                      Upload Photo
                    </button>
                  </div>

                  {/* Gallery of Location Assets */}
                  <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                    {locationAssets.length > 0 ? (
                      locationAssets.map((asset) => {
                        const isSelected = activeLocationAsset?.filename === asset.filename;
                        return (
                          <button
                            key={asset.filename}
                            type="button"
                            onClick={() => {
                              onSelectLocationAsset(asset.filename);
                              setIsLocationPickerOpen(false);
                            }}
                            className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg text-left transition-colors ${
                              isSelected
                                ? "bg-amber-500/20 border border-amber-500/50 text-amber-300"
                                : "hover:bg-zinc-800/80 text-zinc-300"
                            }`}
                          >
                            <img
                              src={getAssetMediaUrl(asset.filename, true)}
                              alt=""
                              className="w-10 h-7 object-cover rounded bg-zinc-950 border border-zinc-800 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{asset.description || asset.filename}</p>
                              <span className="text-[10px] text-zinc-500 font-mono">Location Reference</span>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                          </button>
                        );
                      })
                    ) : (
                      <div className="py-4 text-center text-zinc-500 text-xs">
                        No location references found in gallery.
                      </div>
                    )}
                  </div>

                  {/* Clear Background Option */}
                  {backgroundUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        onClearBackground();
                        setIsLocationPickerOpen(false);
                      }}
                      className="w-full text-center py-1 text-xs text-zinc-400 hover:text-red-400 hover:bg-zinc-800/60 rounded transition-colors"
                    >
                      Clear Background (Use Studio Grid)
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/60 px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Drop or upload a room photo"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Drop/Upload Room</span>
          </button>
        </div>

        {/* Selected Actor Quick Status / Controls */}
        {selectedActor ? (
          <div className="flex items-center gap-2 bg-zinc-900/90 border border-indigo-500/40 px-2.5 py-1 rounded-lg">
            <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1">
              <User className="w-3 h-3 text-indigo-400" />
              {selectedActor.characterName}
            </span>
            <span className="text-zinc-600">•</span>
            <span className="text-[11px] text-zinc-400 font-mono">
              Scale: {Math.round(selectedActor.scale * 100)}%
            </span>
            <span className="text-zinc-600">•</span>
            <button
              type="button"
              onClick={() => handleToggleFlip(selectedActor)}
              className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200"
              title="Flip Horizontally"
            >
              <FlipHorizontal className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => handleBringForward(selectedActor)}
              className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200"
              title="Bring Forward"
            >
              <ArrowUp className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => handleSendBackward(selectedActor)}
              className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200"
              title="Send Backward"
            >
              <ArrowDown className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <span className="text-[11px] text-zinc-500 italic hidden sm:inline">
            Click an actor on canvas to reposition, scale, or flip
          </span>
        )}
      </div>

      {/* MAIN INTERACTIVE 2D CANVAS CONTAINER */}
      <div
        ref={containerRef}
        onPointerDown={() => onSelectActor(null)}
        onDragOver={handleCanvasDragOver}
        onDragLeave={handleCanvasDragLeave}
        onDrop={handleCanvasDrop}
        className={`relative w-full rounded-2xl overflow-hidden border-2 bg-zinc-950 shadow-2xl transition-all ${
          isCanvasDragOver
            ? "border-dashed border-indigo-400 ring-4 ring-indigo-500/20"
            : "border-zinc-800"
        } ${
          aspectRatio === "16:9"
            ? "aspect-video"
            : aspectRatio === "2.39:1"
            ? "aspect-[2.39/1]"
            : aspectRatio === "4:3"
            ? "aspect-[4/3]"
            : "aspect-[9/16] max-w-sm mx-auto"
        }`}
      >
        {/* BASE LAYER: Locked Environment Photo or Studio Grid */}
        {backgroundUrl ? (
          <div className="absolute inset-0 pointer-events-none z-0">
            <img
              src={backgroundUrl}
              alt="Environment Background"
              className="w-full h-full object-cover select-none"
              referrerPolicy="no-referrer"
            />
            {/* Subtle cinematic floor shadow vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30" />
          </div>
        ) : (
          <div className="absolute inset-0 z-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:24px_24px] flex flex-col items-center justify-center pointer-events-none">
            <div className="text-center p-6 bg-zinc-900/60 backdrop-blur rounded-xl border border-zinc-800 max-w-xs pointer-events-auto">
              <ImageIcon className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
              <p className="text-xs font-semibold text-zinc-300 mb-1">Locked Environment Layer</p>
              <p className="text-[11px] text-zinc-500 mb-3">
                Drop room photo directly here, or select from gallery
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer shadow"
              >
                Upload Room Photo
              </button>
            </div>
          </div>
        )}

        {/* Rule of Thirds Cinematic Grid */}
        {showGrid && (
          <div className="absolute inset-0 pointer-events-none z-10 grid grid-cols-3 grid-rows-3">
            <div className="border-r border-b border-white/10" />
            <div className="border-r border-b border-white/10" />
            <div className="border-b border-white/10" />
            <div className="border-r border-b border-white/10" />
            <div className="border-r border-b border-white/10" />
            <div className="border-b border-white/10" />
            <div className="border-r border-white/10" />
            <div className="border-r border-white/10" />
            <div />
          </div>
        )}

        {/* Depth Planes Safe Area Guidelines */}
        {showSafeAreas && (
          <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between">
            <div className="h-[40%] border-b border-dashed border-indigo-500/25 px-3 py-1 flex items-start justify-between text-[9px] font-mono text-indigo-400/60 uppercase">
              <span>Background Zone</span>
              <span>Far</span>
            </div>
            <div className="h-[35%] border-b border-dashed border-indigo-500/25 px-3 py-1 flex items-start justify-between text-[9px] font-mono text-indigo-400/60 uppercase">
              <span>Midground Zone</span>
              <span>Action Depth</span>
            </div>
            <div className="h-[25%] px-3 py-1 flex items-start justify-between text-[9px] font-mono text-indigo-400/60 uppercase">
              <span>Foreground Zone</span>
              <span>Close Focus</span>
            </div>
          </div>
        )}

        {/* LAYERED ACTOR CUTOUTS */}
        {actors.map((actor) => {
          const isSelected = actor.id === selectedActorId;
          const actorScale = actor.scale || 1.0;

          // Height is scaled relative to standard 55% height
          const displayHeightPercent = Math.round(55 * actorScale);

          return (
            <div
              key={actor.id}
              style={{
                left: `${actor.xPercent}%`,
                top: `${actor.yPercent}%`,
                zIndex: isSelected ? 40 : 20 + (actor.zIndex || 1),
                transform: "translate(-50%, -100%)",
                height: `${displayHeightPercent}%`
              }}
              className={`absolute flex flex-col items-center justify-end cursor-move ${
                isSelected ? "pointer-events-auto" : "pointer-events-auto hover:opacity-95"
              }`}
              onPointerDown={(e) => handleActorPointerDown(e, actor)}
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
                className={`relative h-full flex flex-col items-center justify-end transition-shadow ${
                  isSelected
                    ? "ring-2 ring-indigo-400 ring-offset-2 ring-offset-zinc-950 rounded-lg shadow-2xl"
                    : "hover:ring-1 hover:ring-white/40 rounded-lg"
                }`}
              >
                {actor.cutoutDataUrl ? (
                  <img
                    src={actor.cutoutDataUrl}
                    alt={actor.characterName}
                    draggable={false}
                    style={{
                      transform: actor.isFlipped ? "scaleX(-1)" : "none"
                    }}
                    className="h-full w-auto object-contain select-none filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.7)]"
                  />
                ) : (
                  // Fallback Avatar Token
                  <div
                    style={{
                      transform: actor.isFlipped ? "scaleX(-1)" : "none"
                    }}
                    className="w-20 h-28 sm:w-24 sm:h-36 bg-gradient-to-t from-indigo-950 to-zinc-900 border-2 border-indigo-500/60 rounded-t-full flex flex-col items-center justify-center p-2 text-center shadow-lg"
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

                {/* ACTIVE BOUNDING BOX & CORNER RESIZE HANDLES (Shown When Selected) */}
                {isSelected && (
                  <>
                    {/* Floating Actor Name & Depth Badge */}
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-zinc-950/90 text-white border border-indigo-500 px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap shadow flex items-center gap-1 z-30">
                      <span className="text-indigo-400">{actor.characterName}</span>
                      <span className="text-zinc-500">•</span>
                      <span className="text-zinc-300">{Math.round(actor.scale * 100)}%</span>
                    </div>

                    {/* Top-Right Corner Resize Handle */}
                    <div
                      onPointerDown={(e) => handleResizePointerDown(e, actor)}
                      className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-sm cursor-nesw-resize shadow-md hover:scale-125 transition-transform z-30"
                      title="Drag corner to scale actor"
                    />

                    {/* Top-Left Corner Resize Handle */}
                    <div
                      onPointerDown={(e) => handleResizePointerDown(e, actor)}
                      className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-sm cursor-nwse-resize shadow-md hover:scale-125 transition-transform z-30"
                      title="Drag corner to scale actor"
                    />

                    {/* Bottom Floating Mini Toolbar */}
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-zinc-900/95 border border-zinc-700/80 rounded-lg p-0.5 flex items-center gap-0.5 shadow-xl backdrop-blur z-30">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFlip(actor);
                        }}
                        className="p-1 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                        title="Flip Facing (⇄)"
                      >
                        <FlipHorizontal className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBringForward(actor);
                        }}
                        className="p-1 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                        title="Bring Forward (↑)"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSendBackward(actor);
                        }}
                        className="p-1 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                        title="Send Backward (↓)"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveActor(actor.id);
                        }}
                        className="p-1 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded transition-colors"
                        title="Remove Actor from Stage"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
