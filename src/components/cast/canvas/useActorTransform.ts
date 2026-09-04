import React, { useState, useRef, useEffect, useCallback } from "react";
import { StagedActorCanvasItem } from "./types";

interface UseActorTransformParams {
  containerRef: React.RefObject<HTMLDivElement | null>;
  actors: StagedActorCanvasItem[];
  selectedActorId: string | null;
  isMaskingMode: boolean;
  onSelectActor: (id: string | null) => void;
  onUpdateActor: (id: string, updates: Partial<StagedActorCanvasItem>) => void;
}

export function useActorTransform({
  containerRef,
  actors,
  selectedActorId,
  isMaskingMode,
  onSelectActor,
  onUpdateActor
}: UseActorTransformParams) {
  const [isDraggingActor, setIsDraggingActor] = useState<boolean>(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isResizingActor, setIsResizingActor] = useState<boolean>(false);
  const resizeInitialStateRef = useRef<{ initialY: number; initialScale: number; corner: "top" | "bottom" } | null>(null);

  // Handle Dragging Actor across Canvas
  const handleActorPointerDown = useCallback((e: React.PointerEvent, actor: StagedActorCanvasItem) => {
    if (isMaskingMode) return;
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
  }, [isMaskingMode, onSelectActor, containerRef]);

  // Handle Corner Resize Handle Pointer Down (Supports all corners)
  const handleResizePointerDown = useCallback((
    e: React.PointerEvent,
    actor: StagedActorCanvasItem,
    corner: "top" | "bottom" = "top"
  ) => {
    if (isMaskingMode) return;
    e.stopPropagation();
    setIsResizingActor(true);
    resizeInitialStateRef.current = {
      initialY: e.clientY,
      initialScale: actor.scale || 1.0,
      corner
    };
  }, [isMaskingMode]);

  // Mouse Wheel Scaling when hovering selected actor
  const handleActorWheel = useCallback((e: React.WheelEvent, actor: StagedActorCanvasItem) => {
    if (isMaskingMode) return;
    e.stopPropagation();
    e.preventDefault();
    const currentScale = actor.scale || 1.0;
    const delta = -Math.sign(e.deltaY) * 0.05;
    const nextScale = Math.max(0.20, Math.min(4.50, Math.round((currentScale + delta) * 100) / 100));
    onUpdateActor(actor.id, { scale: nextScale });
  }, [isMaskingMode, onUpdateActor]);

  // Flip Actor Horizontally
  const handleToggleFlip = useCallback((actor: StagedActorCanvasItem) => {
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
  }, [onUpdateActor]);

  // Layer Stacking (Bring Forward / Send Backward)
  const handleBringForward = useCallback((actor: StagedActorCanvasItem) => {
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
  }, [actors, onUpdateActor]);

  const handleSendBackward = useCallback((actor: StagedActorCanvasItem) => {
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
  }, [actors, onUpdateActor]);

  // Global Pointer Move and Up Listeners during Drag / Resize
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      if (isDraggingActor && selectedActorId) {
        const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
        const mouseY = ((e.clientY - rect.top) / rect.height) * 100;

        const newX = mouseX - dragOffset.x;
        const newY = mouseY - dragOffset.y;

        let derivedPlane: "foreground" | "midground" | "background" = "midground";
        if (newY <= 48) derivedPlane = "background";
        else if (newY >= 76) derivedPlane = "foreground";

        onUpdateActor(selectedActorId, {
          xPercent: Math.round(newX * 10) / 10,
          yPercent: Math.round(newY * 10) / 10,
          plane: derivedPlane
        });
      } else if (isResizingActor && selectedActorId && resizeInitialStateRef.current) {
        const { initialY, initialScale, corner } = resizeInitialStateRef.current;
        const deltaY = corner === "bottom" ? (e.clientY - initialY) : (initialY - e.clientY);
        const scaleChange = deltaY / 120;
        const nextScale = Math.max(0.20, Math.min(4.50, Math.round((initialScale + scaleChange) * 100) / 100));

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
  }, [isDraggingActor, isResizingActor, selectedActorId, dragOffset, onUpdateActor, containerRef]);

  return {
    isDraggingActor,
    isResizingActor,
    handleActorPointerDown,
    handleResizePointerDown,
    handleActorWheel,
    handleToggleFlip,
    handleBringForward,
    handleSendBackward
  };
}
