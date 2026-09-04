import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { StagedActorCanvasItem } from "./types";
import { getAssetMediaUrl } from "../../../utils/assetUrl";
import { createSilhouetteImage } from "./silhouetteUtils";

interface UseActorMaskingParams {
  containerRef: React.RefObject<HTMLDivElement | null>;
  actors: StagedActorCanvasItem[];
  activeMaskingActorId?: string | null;
  onSetMaskingActorId?: (id: string | null) => void;
  onSelectActor: (id: string | null) => void;
  onUpdateActor: (id: string, updates: Partial<StagedActorCanvasItem>) => void;
}

export function useActorMasking({
  containerRef,
  actors,
  activeMaskingActorId,
  onSetMaskingActorId,
  onSelectActor,
  onUpdateActor
}: UseActorMaskingParams) {
  const [internalMaskingActorId, setInternalMaskingActorId] = useState<string | null>(null);
  const maskingActorId = activeMaskingActorId !== undefined ? activeMaskingActorId : internalMaskingActorId;

  const setMaskingActorId = useCallback((id: string | null) => {
    if (onSetMaskingActorId) {
      onSetMaskingActorId(id);
    } else {
      setInternalMaskingActorId(id);
    }
  }, [onSetMaskingActorId]);

  const isMaskingMode = Boolean(maskingActorId);
  const maskingActor = useMemo(() => actors.find((a) => a.id === maskingActorId) || null, [actors, maskingActorId]);

  const [maskMode, setMaskMode] = useState<"erase" | "restore">("erase");
  const [brushSize, setBrushSize] = useState<number>(30); // 5px to 100px
  const [brushCursor, setBrushCursor] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });
  const [isPainting, setIsPainting] = useState<boolean>(false);

  // Canvas painting references
  const activeMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Actor DOM Image, token refs and instant-commit cache to eliminate visual flickers
  const actorImgRefs = useRef<Record<string, HTMLImageElement | null>>({});
  const lastCommittedCutoutRef = useRef<Record<string, string>>({});
  const initializedActorIdRef = useRef<string | null>(null);
  const prevMaskingActorIdRef = useRef<string | null>(null);

  // Commit current mask buffer to actor state and cache to prevent any visual shift/flicker
  const commitMask = useCallback((targetActorId: string) => {
    const canvas = activeMaskCanvasRef.current;
    const maskCanvas = offscreenMaskCanvasRef.current;
    const origImg = originalImageRef.current;

    let updatedCutout: string | null = null;
    let updatedMask: string | null = null;

    if (canvas && maskCanvas) {
      try {
        updatedCutout = canvas.toDataURL("image/png");
        updatedMask = maskCanvas.toDataURL("image/png");
      } catch (err) {
        console.warn("Could not export live canvas directly, falling back to offscreen composite:", err);
      }
    }

    if ((!updatedCutout || !updatedMask) && maskCanvas && origImg) {
      try {
        const commitCanvas = document.createElement("canvas");
        commitCanvas.width = maskCanvas.width;
        commitCanvas.height = maskCanvas.height;
        const cCtx = commitCanvas.getContext("2d");
        if (cCtx) {
          cCtx.drawImage(origImg, 0, 0);
          cCtx.globalCompositeOperation = "destination-in";
          cCtx.drawImage(maskCanvas, 0, 0);
          updatedCutout = commitCanvas.toDataURL("image/png");
          updatedMask = maskCanvas.toDataURL("image/png");
        }
      } catch (err) {
        console.warn("Failed to compose offscreen mask commit:", err);
      }
    }

    if (updatedCutout && updatedMask) {
      lastCommittedCutoutRef.current[targetActorId] = updatedCutout;
      onUpdateActor(targetActorId, {
        cutoutDataUrl: updatedCutout,
        maskDataUrl: updatedMask
      });
    }
  }, [onUpdateActor]);

  // Initialize and synchronize display & offscreen mask canvases when entering masking mode
  useEffect(() => {
    if (!maskingActorId) {
      if (prevMaskingActorIdRef.current) {
        commitMask(prevMaskingActorIdRef.current);
      }
      initializedActorIdRef.current = null;
      prevMaskingActorIdRef.current = null;
      originalImageRef.current = null;
      activeMaskCanvasRef.current = null;
      offscreenMaskCanvasRef.current = null;
      return;
    }

    if (initializedActorIdRef.current === maskingActorId) {
      return;
    }

    const actor = actors.find((a) => a.id === maskingActorId);
    if (!actor) return;

    initializedActorIdRef.current = maskingActorId;
    prevMaskingActorIdRef.current = maskingActorId;

    let isCancelled = false;
    const domImg = actorImgRefs.current[actor.id];
    const rawSrc =
      actor.originalCutoutDataUrl ||
      actor.cutoutDataUrl ||
      (actor.referenceAssetFilename ? getAssetMediaUrl(actor.referenceAssetFilename, true) : null);

    const initCanvasWithImage = (img: HTMLImageElement) => {
      if (isCancelled) return;
      originalImageRef.current = img;

      const width = img.naturalWidth || 600;
      const height = img.naturalHeight || 900;

      const maskCanvas = document.createElement("canvas");
      maskCanvas.width = width;
      maskCanvas.height = height;
      const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
      if (maskCtx) {
        if (actor.maskDataUrl) {
          const mImg = new Image();
          mImg.onload = () => {
            if (isCancelled) return;
            maskCtx.drawImage(mImg, 0, 0, width, height);
            renderDisplayCanvas();
          };
          mImg.src = actor.maskDataUrl;
        } else {
          maskCtx.fillStyle = "#ffffff";
          maskCtx.fillRect(0, 0, width, height);
        }
      }
      offscreenMaskCanvasRef.current = maskCanvas;

      if (!actor.originalCutoutDataUrl) {
        const offCanvas = document.createElement("canvas");
        offCanvas.width = width;
        offCanvas.height = height;
        const offCtx = offCanvas.getContext("2d");
        if (offCtx) {
          offCtx.drawImage(img, 0, 0, width, height);
          const origDataUrl = offCanvas.toDataURL("image/png");
          onUpdateActor(actor.id, {
            originalCutoutDataUrl: origDataUrl,
            cutoutDataUrl: actor.cutoutDataUrl || origDataUrl
          });
        }
      }

      renderDisplayCanvas();
    };

    const renderDisplayCanvas = () => {
      const displayCanvas = activeMaskCanvasRef.current;
      const origImg = originalImageRef.current;
      const maskCanvas = offscreenMaskCanvasRef.current;
      if (!displayCanvas || !origImg || !maskCanvas) return;

      displayCanvas.width = maskCanvas.width;
      displayCanvas.height = maskCanvas.height;
      const displayCtx = displayCanvas.getContext("2d");
      if (!displayCtx) return;

      displayCtx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
      displayCtx.globalCompositeOperation = "source-over";
      displayCtx.drawImage(origImg, 0, 0, displayCanvas.width, displayCanvas.height);
      displayCtx.globalCompositeOperation = "destination-in";
      displayCtx.drawImage(maskCanvas, 0, 0, displayCanvas.width, displayCanvas.height);
      displayCtx.globalCompositeOperation = "source-over";
    };

    if (domImg && domImg.complete && domImg.naturalWidth > 0 && !actor.originalCutoutDataUrl) {
      initCanvasWithImage(domImg);
    } else if (rawSrc) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => initCanvasWithImage(img);
      img.onerror = () => {
        const fallbackImg = createSilhouetteImage(actor.characterName);
        fallbackImg.onload = () => initCanvasWithImage(fallbackImg);
      };
      img.src = rawSrc;
    } else {
      const fallbackImg = createSilhouetteImage(actor.characterName);
      fallbackImg.onload = () => initCanvasWithImage(fallbackImg);
    }

    return () => {
      isCancelled = true;
    };
  }, [maskingActorId, actors, onUpdateActor, commitMask]);

  // Callback ref for active mask display canvas in DOM
  const setActiveMaskCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    activeMaskCanvasRef.current = canvas;
    if (canvas && originalImageRef.current && offscreenMaskCanvasRef.current) {
      canvas.width = offscreenMaskCanvasRef.current.width;
      canvas.height = offscreenMaskCanvasRef.current.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(originalImageRef.current, 0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = "destination-in";
        ctx.drawImage(offscreenMaskCanvasRef.current, 0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = "source-over";
      }
    }
  }, []);

  // Update cursor position for dynamic circular indicator
  const updateBrushCursorPos = useCallback((e: React.PointerEvent | PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setBrushCursor({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      visible: true
    });
  }, [containerRef]);

  // Core Painting Execution with exact on-screen scale mapping
  const paintStroke = useCallback((
    canvas: HTMLCanvasElement,
    x: number,
    y: number,
    prevX: number | null,
    prevY: number | null,
    mode: "erase" | "restore",
    size: number
  ) => {
    const maskCanvas = offscreenMaskCanvasRef.current;
    const origImg = originalImageRef.current;
    if (!maskCanvas || !origImg) return;

    const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
    const displayCtx = canvas.getContext("2d");
    if (!maskCtx || !displayCtx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleRatio = canvas.width / Math.max(rect.width, 1);
    const radius = (size / 2) * scaleRatio;

    maskCtx.save();
    if (mode === "erase") {
      maskCtx.globalCompositeOperation = "destination-out";
    } else {
      maskCtx.globalCompositeOperation = "source-over";
      maskCtx.fillStyle = "#ffffff";
      maskCtx.strokeStyle = "#ffffff";
    }

    if (prevX !== null && prevY !== null) {
      maskCtx.lineWidth = radius * 2;
      maskCtx.lineCap = "round";
      maskCtx.lineJoin = "round";
      maskCtx.beginPath();
      maskCtx.moveTo(prevX, prevY);
      maskCtx.lineTo(x, y);
      maskCtx.stroke();
    } else {
      maskCtx.beginPath();
      maskCtx.arc(x, y, radius, 0, Math.PI * 2);
      maskCtx.fill();
    }
    maskCtx.restore();

    displayCtx.save();
    displayCtx.clearRect(0, 0, canvas.width, canvas.height);
    displayCtx.globalCompositeOperation = "source-over";
    displayCtx.drawImage(origImg, 0, 0, canvas.width, canvas.height);
    displayCtx.globalCompositeOperation = "destination-in";
    displayCtx.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);
    displayCtx.restore();
  }, []);

  // Strict pixel-accurate mapping from scaled & flipped viewport coordinates to local buffer
  const getCanvasCoords = useCallback((clientX: number, clientY: number, canvas: HTMLCanvasElement, isFlipped: boolean) => {
    const rect = canvas.getBoundingClientRect();
    const screenX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const screenY = Math.max(0, Math.min(rect.height, clientY - rect.top));

    let normX = screenX / Math.max(rect.width, 1);
    if (isFlipped) {
      normX = 1 - normX;
    }
    const normY = screenY / Math.max(rect.height, 1);

    const x = normX * canvas.width;
    const y = normY * canvas.height;
    return { x, y };
  }, []);

  // Enter Masking Mode
  const handleEnterMaskingMode = useCallback((actor: StagedActorCanvasItem) => {
    onSelectActor(actor.id);
    setMaskingActorId(actor.id);

    const origUrl = actor.originalCutoutDataUrl || actor.cutoutDataUrl || (actor.referenceAssetFilename ? getAssetMediaUrl(actor.referenceAssetFilename, true) : undefined);
    if (origUrl && !actor.originalCutoutDataUrl) {
      onUpdateActor(actor.id, { originalCutoutDataUrl: origUrl });
    }
  }, [onSelectActor, setMaskingActorId, onUpdateActor]);

  // Exit / Done Masking Action with atomic commit
  const handleExitMaskingMode = useCallback(() => {
    if (maskingActorId) {
      commitMask(maskingActorId);
    }
    setMaskingActorId(null);
    setIsPainting(false);
    lastPointRef.current = null;
  }, [maskingActorId, commitMask, setMaskingActorId]);

  // 1-Click Reset Mask Action
  const handleResetMask = useCallback(() => {
    if (!maskingActor) return;
    const origImg = originalImageRef.current;
    const canvas = activeMaskCanvasRef.current;
    const maskCanvas = offscreenMaskCanvasRef.current;

    if (maskCanvas && canvas) {
      const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
      if (maskCtx) {
        maskCtx.save();
        maskCtx.globalCompositeOperation = "source-over";
        maskCtx.fillStyle = "#ffffff";
        maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
        maskCtx.restore();
      }

      const displayCtx = canvas.getContext("2d");
      if (displayCtx && origImg) {
        displayCtx.clearRect(0, 0, canvas.width, canvas.height);
        displayCtx.drawImage(origImg, 0, 0, canvas.width, canvas.height);
      }
    }

    const origUrl = maskingActor.originalCutoutDataUrl || maskingActor.cutoutDataUrl;
    if (origUrl) {
      lastCommittedCutoutRef.current[maskingActor.id] = origUrl;
    }
    onUpdateActor(maskingActor.id, {
      cutoutDataUrl: origUrl,
      maskDataUrl: undefined
    });
  }, [maskingActor, onUpdateActor]);

  // Mask Pointer Handlers
  const handleMaskPointerDown = useCallback((e: React.PointerEvent, actor: StagedActorCanvasItem) => {
    e.stopPropagation();
    e.preventDefault();
    const canvas = activeMaskCanvasRef.current;
    if (!canvas) return;

    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    setIsPainting(true);
    const { x, y } = getCanvasCoords(e.clientX, e.clientY, canvas, actor.isFlipped);
    lastPointRef.current = { x, y };

    paintStroke(canvas, x, y, null, null, maskMode, brushSize);
  }, [getCanvasCoords, paintStroke, maskMode, brushSize]);

  const handleMaskPointerMove = useCallback((e: React.PointerEvent, actor: StagedActorCanvasItem) => {
    updateBrushCursorPos(e);
    if (!isPainting) return;

    e.stopPropagation();
    e.preventDefault();
    const canvas = activeMaskCanvasRef.current;
    if (!canvas) return;

    const { x, y } = getCanvasCoords(e.clientX, e.clientY, canvas, actor.isFlipped);
    const prev = lastPointRef.current;

    paintStroke(canvas, x, y, prev?.x ?? null, prev?.y ?? null, maskMode, brushSize);
    lastPointRef.current = { x, y };
  }, [updateBrushCursorPos, isPainting, getCanvasCoords, paintStroke, maskMode, brushSize]);

  const handleMaskPointerUp = useCallback((e: React.PointerEvent, actor: StagedActorCanvasItem) => {
    if (!isPainting) return;
    e.stopPropagation();
    e.preventDefault();
    setIsPainting(false);
    lastPointRef.current = null;

    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    const canvas = activeMaskCanvasRef.current;
    const maskCanvas = offscreenMaskCanvasRef.current;
    if (canvas && maskCanvas) {
      try {
        const updatedCutout = canvas.toDataURL("image/png");
        const updatedMask = maskCanvas.toDataURL("image/png");
        lastCommittedCutoutRef.current[actor.id] = updatedCutout;
        onUpdateActor(actor.id, {
          cutoutDataUrl: updatedCutout,
          maskDataUrl: updatedMask
        });
      } catch (err) {
        console.warn("Failed to capture stroke mask:", err);
      }
    }
  }, [isPainting, onUpdateActor]);

  // Keyboard shortcut listener during masking
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isMaskingMode) return;
      if (e.key === "Escape") {
        handleExitMaskingMode();
      } else if (e.key === "e" || e.key === "E") {
        setMaskMode("erase");
      } else if (e.key === "r" || e.key === "R") {
        setMaskMode("restore");
      } else if (e.key === "[") {
        setBrushSize((prev) => Math.max(5, prev - 5));
      } else if (e.key === "]") {
        setBrushSize((prev) => Math.min(100, prev + 5));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMaskingMode, handleExitMaskingMode]);

  return {
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
  };
}
