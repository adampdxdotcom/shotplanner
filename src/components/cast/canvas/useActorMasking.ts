import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { StagedActorCanvasItem } from "./types";
import { getAssetMediaUrl } from "../../../utils/assetUrl";
import { rgbToYCbCr, getYCbCrDistance } from "../../../utils/chromaKey";

interface UseActorMaskingParams {
  containerRef: React.RefObject<HTMLDivElement | null>;
  actors: StagedActorCanvasItem[];
  activeMaskingActorId?: string | null;
  onSetMaskingActorId?: (id: string | null) => void;
  onSelectActor: (id: string | null) => void;
  onUpdateActor: (id: string, updates: Partial<StagedActorCanvasItem>) => void;
  onRecordCheckpoint?: () => void;
}

export function useActorMasking({
  containerRef,
  actors,
  activeMaskingActorId,
  onSetMaskingActorId,
  onSelectActor,
  onUpdateActor,
  onRecordCheckpoint
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

  const [maskMode, setMaskMode] = useState<"erase" | "restore" | "refine">("erase");
  const [brushSize, setBrushSize] = useState<number>(30); // 5px to 100px
  const [brushCursor, setBrushCursor] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });
  const [isPainting, setIsPainting] = useState<boolean>(false);

  // Canvas painting references
  const activeMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const reusableScratchCanvasRef = useRef<HTMLCanvasElement | null>(null);
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
        if (!reusableScratchCanvasRef.current) {
          reusableScratchCanvasRef.current = document.createElement("canvas");
        }
        const commitCanvas = reusableScratchCanvasRef.current;
        if (commitCanvas.width !== maskCanvas.width || commitCanvas.height !== maskCanvas.height) {
          commitCanvas.width = maskCanvas.width;
          commitCanvas.height = maskCanvas.height;
        }
        const cCtx = commitCanvas.getContext("2d");
        if (cCtx) {
          cCtx.clearRect(0, 0, commitCanvas.width, commitCanvas.height);
          cCtx.globalCompositeOperation = "source-over";
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
    const canonicalPhotoUrl = actor.referenceAssetFilename
      ? getAssetMediaUrl(actor.referenceAssetFilename, false)
      : undefined;
    const rawSrc =
      actor.originalCutoutDataUrl ||
      actor.cutoutDataUrl ||
      canonicalPhotoUrl ||
      null;

    const initCanvasWithImage = (img: HTMLImageElement) => {
      if (isCancelled) return;
      originalImageRef.current = img;

      const width = img.naturalWidth || img.width || 600;
      const height = img.naturalHeight || img.height || 900;

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

      if (!actor.originalCutoutDataUrl && (canonicalPhotoUrl || actor.cutoutDataUrl)) {
        onUpdateActor(actor.id, {
          originalCutoutDataUrl: canonicalPhotoUrl || actor.cutoutDataUrl,
          cutoutDataUrl: actor.cutoutDataUrl || canonicalPhotoUrl
        });
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

    if (domImg && domImg.complete && domImg.naturalWidth > 0) {
      initCanvasWithImage(domImg);
    } else if (rawSrc) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => initCanvasWithImage(img);
      img.onerror = () => {
        // If anonymous crossOrigin request encounters an issue, fallback to domImg or direct src
        if (domImg && domImg.complete && domImg.naturalWidth > 0) {
          initCanvasWithImage(domImg);
        } else {
          console.warn("Could not load actor image into masking canvas:", rawSrc);
        }
      };
      img.src = rawSrc;
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
    mode: "erase" | "restore" | "refine",
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

    if (mode === "refine") {
      // Fine Edge Refinement Brush:
      // Reads the original image pixels under the brush stroke.
      // Analyzes color difference vs chroma screen in YCbCr color space.
      // If the pixel is dark hair / foreground (lower luma, or lower chroma saturation than pure screen),
      // restores alpha on the mask without restoring the green/blue backdrop.
      const brushMinX = Math.max(0, Math.floor(x - radius));
      const brushMinY = Math.max(0, Math.floor(y - radius));
      const brushW = Math.min(maskCanvas.width - brushMinX, Math.ceil(radius * 2));
      const brushH = Math.min(maskCanvas.height - brushMinY, Math.ceil(radius * 2));

      if (brushW > 0 && brushH > 0) {
        if (!reusableScratchCanvasRef.current) {
          reusableScratchCanvasRef.current = document.createElement("canvas");
        }
        const scratch = reusableScratchCanvasRef.current;
        if (scratch.width !== maskCanvas.width || scratch.height !== maskCanvas.height) {
          scratch.width = maskCanvas.width;
          scratch.height = maskCanvas.height;
        }
        const sCtx = scratch.getContext("2d", { willReadFrequently: true });
        if (sCtx) {
          sCtx.clearRect(brushMinX, brushMinY, brushW, brushH);
          sCtx.drawImage(origImg, brushMinX, brushMinY, brushW, brushH, brushMinX, brushMinY, brushW, brushH);
          const origPixels = sCtx.getImageData(brushMinX, brushMinY, brushW, brushH);
          const maskPixels = maskCtx.getImageData(brushMinX, brushMinY, brushW, brushH);

          const oData = origPixels.data;
          const mData = maskPixels.data;
          const rSq = radius * radius;

          for (let py = 0; py < brushH; py++) {
            const worldY = brushMinY + py;
            const dy = worldY - y;
            for (let px = 0; px < brushW; px++) {
              const worldX = brushMinX + px;
              const dx = worldX - x;
              const distSq = dx * dx + dy * dy;
              if (distSq <= rSq) {
                const pIdx = (py * brushW + px) * 4;
                const r = oData[pIdx];
                const g = oData[pIdx + 1];
                const b = oData[pIdx + 2];

                // Detect if pixel is pure green/blue screen
                const isGreenScreen = g > r * 1.25 && g > b * 1.25 && g > 70;
                const isBlueScreen = b > r * 1.25 && b > g * 1.25 && b > 70;

                if (!isGreenScreen && !isBlueScreen) {
                  // Falloff factor from center of brush
                  const falloff = 1.0 - Math.sqrt(distSq) / radius;
                  // Compute luminance: darker strands or non-chroma details get restored
                  const ycbcr = rgbToYCbCr(r, g, b);
                  const hairStrength = Math.min(1.0, (180 - Math.min(180, ycbcr.y * 0.5)) / 120 + 0.3);
                  const currentAlpha = mData[pIdx + 3];
                  const targetAlpha = Math.min(255, currentAlpha + Math.round(255 * falloff * hairStrength * 0.45));
                  mData[pIdx] = 255;
                  mData[pIdx + 1] = 255;
                  mData[pIdx + 2] = 255;
                  mData[pIdx + 3] = targetAlpha;
                }
              }
            }
          }
          maskCtx.putImageData(maskPixels, brushMinX, brushMinY);
        }
      }
    } else {
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
    }

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

    const origUrl = (actor.referenceAssetFilename ? getAssetMediaUrl(actor.referenceAssetFilename, false) : undefined)
      || actor.originalCutoutDataUrl
      || actor.cutoutDataUrl;
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

    const cleanOrigUrl = (maskingActor.referenceAssetFilename ? getAssetMediaUrl(maskingActor.referenceAssetFilename, false) : undefined)
      || maskingActor.originalCutoutDataUrl
      || maskingActor.cutoutDataUrl;

    if (cleanOrigUrl) {
      lastCommittedCutoutRef.current[maskingActor.id] = cleanOrigUrl;
    }
    onUpdateActor(maskingActor.id, {
      cutoutDataUrl: cleanOrigUrl,
      maskDataUrl: undefined
    });
    if (onRecordCheckpoint) {
      setTimeout(() => onRecordCheckpoint(), 15);
    }
  }, [maskingActor, onUpdateActor, onRecordCheckpoint]);

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
        if (onRecordCheckpoint) {
          setTimeout(() => onRecordCheckpoint(), 20);
        }
      } catch (err) {
        console.warn("Failed to capture stroke mask:", err);
      }
    }
  }, [isPainting, onUpdateActor, onRecordCheckpoint]);

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
      } else if (e.key === "f" || e.key === "F") {
        setMaskMode("refine");
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
