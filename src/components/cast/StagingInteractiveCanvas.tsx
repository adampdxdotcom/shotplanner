import React, { useRef, useState, useMemo, useCallback } from "react";
import { getAssetMediaUrl } from "../../utils/assetUrl";
import { StagedActorCanvasItem, StagingInteractiveCanvasProps } from "./canvas/types";
import { useActorTransform } from "./canvas/useActorTransform";
import { useActorMasking } from "./canvas/useActorMasking";
import { CanvasHeaderControls } from "./canvas/CanvasHeaderControls";
import { CanvasEnvironmentBackdrop } from "./canvas/CanvasEnvironmentBackdrop";
import { CanvasMaskingHud } from "./canvas/CanvasMaskingHud";
import { BrushCursorOverlay } from "./canvas/BrushCursorOverlay";
import { StagedActorItem } from "./canvas/StagedActorItem";

export type { StagedActorCanvasItem, StagingInteractiveCanvasProps };

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
  showSafeAreas = true,
  activeMaskingActorId,
  onSetMaskingActorId
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCanvasDragOver, setIsCanvasDragOver] = useState<boolean>(false);

  // Masking & Eraser Hook
  const {
    maskingActorId,
    isMaskingMode,
    maskingActor,
    maskMode,
    setMaskMode,
    brushSize,
    setBrushSize,
    brushCursor,
    setBrushCursor,
    actorImgRefs,
    lastCommittedCutoutRef,
    setActiveMaskCanvas,
    updateBrushCursorPos,
    handleEnterMaskingMode,
    handleExitMaskingMode,
    handleResetMask,
    handleMaskPointerDown,
    handleMaskPointerMove,
    handleMaskPointerUp
  } = useActorMasking({
    containerRef,
    actors,
    activeMaskingActorId,
    onSetMaskingActorId,
    onSelectActor,
    onUpdateActor
  });

  // Actor Drag & Resize Transform Hook
  const {
    handleActorPointerDown,
    handleResizePointerDown,
    handleActorWheel,
    handleToggleFlip,
    handleBringForward,
    handleSendBackward
  } = useActorTransform({
    containerRef,
    actors,
    selectedActorId,
    isMaskingMode,
    onSelectActor,
    onUpdateActor
  });

  // Selected actor memo
  const selectedActor = useMemo(() => {
    return actors.find((a) => a.id === selectedActorId) || null;
  }, [actors, selectedActorId]);

  // Determine effective background image URL
  const backgroundUrl = useMemo(() => {
    if (customBackgroundUrl) return customBackgroundUrl;
    if (activeLocationAsset) return getAssetMediaUrl(activeLocationAsset.filename, true);
    return null;
  }, [customBackgroundUrl, activeLocationAsset]);

  // Canvas Drag & Drop Image Handlers
  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsCanvasDragOver(true);
  }, []);

  const handleCanvasDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsCanvasDragOver(false);
  }, []);

  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsCanvasDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        onUploadCustomBackground(file);
      }
    }
  }, [onUploadCustomBackground]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      onUploadCustomBackground(file);
    }
  }, [onUploadCustomBackground]);

  const triggerFileUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

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

      {/* CANVAS HEADER CONTROLS (Location Selector & Quick Actor Presets) */}
      <CanvasHeaderControls
        activeLocationAsset={activeLocationAsset}
        locationAssets={locationAssets}
        backgroundUrl={backgroundUrl}
        onSelectLocationAsset={onSelectLocationAsset}
        onClearBackground={onClearBackground}
        onTriggerFileUpload={triggerFileUpload}
        selectedActor={selectedActor}
        onUpdateActor={onUpdateActor}
        onToggleFlip={handleToggleFlip}
        onBringForward={handleBringForward}
        onSendBackward={handleSendBackward}
        isMaskingMode={isMaskingMode}
        maskingActorId={maskingActorId}
        onEnterMaskingMode={handleEnterMaskingMode}
        onExitMaskingMode={handleExitMaskingMode}
      />

      {/* MAIN INTERACTIVE 2D CANVAS CONTAINER */}
      <div
        ref={containerRef}
        onPointerDown={() => {
          if (!isMaskingMode) onSelectActor(null);
        }}
        onPointerMove={(e) => {
          if (isMaskingMode) updateBrushCursorPos(e);
        }}
        onPointerLeave={() => {
          if (isMaskingMode) setBrushCursor((prev) => ({ ...prev, visible: false }));
        }}
        onDragOver={handleCanvasDragOver}
        onDragLeave={handleCanvasDragLeave}
        onDrop={handleCanvasDrop}
        className={`relative w-full rounded-2xl overflow-hidden border-2 bg-zinc-950 shadow-2xl transition-all ${
          isMaskingMode ? "cursor-none" : ""
        } ${
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
        {/* Dynamic Circular Brush Cursor Overlay */}
        {isMaskingMode && (
          <BrushCursorOverlay
            visible={brushCursor.visible}
            x={brushCursor.x}
            y={brushCursor.y}
            brushSize={brushSize}
            maskMode={maskMode}
          />
        )}

        {/* Live Floating Masking HUD & Controls */}
        {isMaskingMode && maskingActor && (
          <CanvasMaskingHud
            maskingActor={maskingActor}
            maskMode={maskMode}
            setMaskMode={setMaskMode}
            brushSize={brushSize}
            setBrushSize={setBrushSize}
            onResetMask={handleResetMask}
            onExitMaskingMode={handleExitMaskingMode}
          />
        )}

        {/* Environment Backdrop (Background image, Studio grid, Rule of Thirds, Depth Guidelines) */}
        <CanvasEnvironmentBackdrop
          backgroundUrl={backgroundUrl}
          showGrid={showGrid}
          showSafeAreas={showSafeAreas}
          onUploadClick={triggerFileUpload}
        />

        {/* Layered Actor Cutouts */}
        {actors.map((actor) => (
          <StagedActorItem
            key={actor.id}
            actor={actor}
            isSelected={actor.id === selectedActorId}
            isMaskingMode={isMaskingMode}
            maskingActorId={maskingActorId}
            lastCommittedCutout={lastCommittedCutoutRef.current[actor.id]}
            onSelectActor={(a) => onSelectActor(a.id)}
            onActorPointerDown={handleActorPointerDown}
            onActorWheel={handleActorWheel}
            onResizePointerDown={handleResizePointerDown}
            onToggleFlip={handleToggleFlip}
            onBringForward={handleBringForward}
            onSendBackward={handleSendBackward}
            onRemoveActor={onRemoveActor}
            onEnterMaskingMode={handleEnterMaskingMode}
            onExitMaskingMode={handleExitMaskingMode}
            onResetMask={handleResetMask}
            onMaskPointerDown={handleMaskPointerDown}
            onMaskPointerMove={handleMaskPointerMove}
            onMaskPointerUp={handleMaskPointerUp}
            setActiveMaskCanvas={setActiveMaskCanvas}
            registerImgRef={(id, el) => {
              actorImgRefs.current[id] = el;
            }}
          />
        ))}
      </div>
    </div>
  );
};
