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
  ChevronDown,
  Eraser,
  Paintbrush,
  RotateCcw,
  Sliders,
  X
} from "lucide-react";
import { MediaAsset } from "../../types";
import { getAssetMediaUrl } from "../../utils/assetUrl";

export interface StagedActorCanvasItem {
  id: string;
  characterName: string;
  cutoutDataUrl?: string;
  originalCutoutDataUrl?: string;
  maskDataUrl?: string;
  referenceAssetFilename?: string;
  xPercent: number; // unconstrained (supports negative space & off-canvas framing)
  yPercent: number; // unconstrained (anchor at feet)
  scale: number; // 0.20 to 3.50+
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

  // External Masking Trigger
  activeMaskingActorId?: string | null;
  onSetMaskingActorId?: (id: string | null) => void;
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
  showSafeAreas = true,
  activeMaskingActorId,
  onSetMaskingActorId
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dragging and resizing interaction state
  const [isDraggingActor, setIsDraggingActor] = useState<boolean>(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isResizingActor, setIsResizingActor] = useState<boolean>(false);
  const resizeInitialStateRef = useRef<{ initialY: number; initialScale: number; corner: "top" | "bottom" } | null>(null);

  // In-place Masking & Eraser Brush System State
  const [internalMaskingActorId, setInternalMaskingActorId] = useState<string | null>(null);
  const maskingActorId = activeMaskingActorId !== undefined ? activeMaskingActorId : internalMaskingActorId;
  const setMaskingActorId = useCallback((id: string | null) => {
    if (onSetMaskingActorId) {
      onSetMaskingActorId(id);
    } else {
      setInternalMaskingActorId(id);
    }
  }, [onSetMaskingActorId]);

  const isMaskingMode = !!maskingActorId;
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

  // Helper: Create a stylized silhouette fallback if character has no image asset
  const createSilhouetteImage = useCallback((name: string): HTMLImageElement => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 900;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 0, 900);
      grad.addColorStop(0, "#4f46e5");
      grad.addColorStop(1, "#1e1b4b");
      ctx.fillStyle = grad;

      // Head
      ctx.beginPath();
      ctx.arc(300, 180, 95, 0, Math.PI * 2);
      ctx.fill();

      // Torso & Shoulders
      ctx.beginPath();
      ctx.moveTo(130, 340);
      ctx.quadraticCurveTo(300, 270, 470, 340);
      ctx.lineTo(510, 900);
      ctx.lineTo(90, 900);
      ctx.closePath();
      ctx.fill();

      // Label text
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 34px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(name, 300, 520);
    }
    const img = new Image();
    img.src = canvas.toDataURL("image/png");
    return img;
  }, []);

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
        // Exiting mask mode externally: commit modified mask
        commitMask(prevMaskingActorIdRef.current);
      }
      initializedActorIdRef.current = null;
      prevMaskingActorIdRef.current = null;
      originalImageRef.current = null;
      activeMaskCanvasRef.current = null;
      offscreenMaskCanvasRef.current = null;
      return;
    }

    // Prevent resetting mask or tearing down canvas on every re-render or brush stroke
    if (initializedActorIdRef.current === maskingActorId) {
      return;
    }

    const actor = actors.find((a) => a.id === maskingActorId);
    if (!actor) return;

    initializedActorIdRef.current = maskingActorId;
    prevMaskingActorIdRef.current = maskingActorId;

    let isCancelled = false;

    // Fast synchronous initialization if DOM image is already available and loaded
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

      // Offscreen alpha mask canvas: 1 = visible (white), 0 = erased (transparent)
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
          // Default: fully visible opaque white mask
          maskCtx.fillStyle = "#ffffff";
          maskCtx.fillRect(0, 0, width, height);
        }
      }
      offscreenMaskCanvasRef.current = maskCanvas;

      // Ensure actor has pristine originalCutoutDataUrl stored
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

    // If DOM image is already decoded and mounted, initialize without async flicker
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
  }, [maskingActorId, actors, createSilhouetteImage, onUpdateActor, commitMask]);

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
  }, []);

  // Core Painting Execution with exact on-screen scale mapping
  const paintStroke = useCallback((
    canvas: HTMLCanvasElement,
    x: number,
    y: number,
    prevX: number | null,
    prevY: number | null,
    isFlipped: boolean,
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
      // Subtractive alpha painting
      maskCtx.globalCompositeOperation = "destination-out";
    } else {
      // Additive painting to recover original cutout pixels
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

    // Redraw live display canvas immediately
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

    // If actor does not yet have originalCutoutDataUrl, ensure it is set
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

    paintStroke(canvas, x, y, null, null, actor.isFlipped, maskMode, brushSize);
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

    paintStroke(canvas, x, y, prev?.x ?? null, prev?.y ?? null, actor.isFlipped, maskMode, brushSize);
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
        setBrushSize(prev => Math.max(5, prev - 5));
      } else if (e.key === "]") {
        setBrushSize(prev => Math.min(100, prev + 5));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMaskingMode, handleExitMaskingMode]);

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
  };

  // Handle Corner Resize Handle Pointer Down (Supports all corners)
  const handleResizePointerDown = (
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
  };

  // Mouse Wheel Scaling when hovering selected actor
  const handleActorWheel = (e: React.WheelEvent, actor: StagedActorCanvasItem) => {
    if (isMaskingMode) return;
    e.stopPropagation();
    e.preventDefault();
    const currentScale = actor.scale || 1.0;
    // Scroll up increases scale, scroll down decreases scale
    const delta = -Math.sign(e.deltaY) * 0.05;
    const nextScale = Math.max(0.20, Math.min(4.50, Math.round((currentScale + delta) * 100) / 100));
    onUpdateActor(actor.id, { scale: nextScale });
  };

  // Global Pointer Move and Up Listeners during Drag / Resize
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      if (isDraggingActor && selectedActorId) {
        const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
        const mouseY = ((e.clientY - rect.top) / rect.height) * 100;

        // Decouple translation coordinates: strictly update position offsets (x, y)
        // No boundary clamping, auto-shrink, or fit-to-bounds calculations so actors can be framed partially off-screen
        const newX = mouseX - dragOffset.x;
        const newY = mouseY - dragOffset.y;

        // Derive subtle depth plane classification based on vertical position without affecting scale
        let derivedPlane: "foreground" | "midground" | "background" = "midground";
        if (newY <= 48) derivedPlane = "background";
        else if (newY >= 76) derivedPlane = "foreground";

        onUpdateActor(selectedActorId, {
          xPercent: Math.round(newX * 10) / 10,
          yPercent: Math.round(newY * 10) / 10,
          plane: derivedPlane
          // Scale factor is completely invariant during movement
        });
      } else if (isResizingActor && selectedActorId && resizeInitialStateRef.current) {
        const { initialY, initialScale, corner } = resizeInitialStateRef.current;
        // For top handles, dragging upward increases scale; for bottom handles, dragging downward increases scale
        const deltaY = corner === "bottom" ? (e.clientY - initialY) : (initialY - e.clientY);
        const scaleChange = deltaY / 120;
        // Expand and uncap scale range: 0.20 (20%) up to 4.50 (450%), allowing 350%+ scaling without restriction
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
          <div className="flex items-center gap-1.5 bg-zinc-900/90 border border-indigo-500/40 px-2.5 py-1 rounded-lg">
            <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1">
              <User className="w-3 h-3 text-indigo-400" />
              {selectedActor.characterName}
            </span>
            <span className="text-zinc-600">•</span>
            <span className="text-[11px] text-zinc-300 font-mono font-medium" title="Scale factor (20% to 350%+)">
              {Math.round(selectedActor.scale * 100)}%
            </span>
            <div className="flex items-center border border-zinc-700/60 rounded bg-zinc-950/60 overflow-hidden">
              <button
                type="button"
                onClick={() => onUpdateActor(selectedActor.id, { scale: Math.max(0.20, Math.round((selectedActor.scale - 0.1) * 100) / 100) })}
                className="px-1.5 py-0.5 text-[10px] text-zinc-400 hover:text-white hover:bg-zinc-800"
                title="Scale Down (-10%)"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => onUpdateActor(selectedActor.id, { scale: Math.min(4.50, Math.round((selectedActor.scale + 0.1) * 100) / 100) })}
                className="px-1.5 py-0.5 text-[10px] text-zinc-400 hover:text-white hover:bg-zinc-800"
                title="Scale Up (+10%)"
              >
                +
              </button>
            </div>
            <span className="text-zinc-600">•</span>
            <span className="text-[10px] text-zinc-400 font-mono" title="Unconstrained position offsets">
              ({Math.round(selectedActor.xPercent)}%, {Math.round(selectedActor.yPercent)}%)
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
            <button
              type="button"
              onClick={() => onUpdateActor(selectedActor.id, { xPercent: 50, yPercent: 85, scale: 1.0 })}
              className="px-1.5 py-0.5 text-[10px] text-indigo-300 hover:text-white bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-800/60 rounded transition-colors"
              title="Center on Stage (X: 50%, Y: 85%, Scale: 100%)"
            >
              Center
            </button>
            <span className="text-zinc-600">•</span>
            <button
              type="button"
              onClick={() => {
                if (isMaskingMode && maskingActorId === selectedActor.id) {
                  handleExitMaskingMode();
                } else {
                  handleEnterMaskingMode(selectedActor);
                }
              }}
              className={`px-2 py-0.5 text-[11px] font-medium rounded flex items-center gap-1 transition-colors ${
                isMaskingMode && maskingActorId === selectedActor.id
                  ? "bg-indigo-600 text-white border border-indigo-400 shadow-sm"
                  : "text-indigo-300 hover:text-white bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60"
              }`}
              title="Live in-place Actor Mask / Eraser Brush tool"
            >
              <Eraser className="w-3 h-3 text-indigo-300" />
              <span>{isMaskingMode && maskingActorId === selectedActor.id ? "Done Masking" : "Erase / Mask"}</span>
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
        onPointerDown={() => {
          if (!isMaskingMode) onSelectActor(null);
        }}
        onPointerMove={(e) => {
          if (isMaskingMode) updateBrushCursorPos(e);
        }}
        onPointerLeave={() => {
          if (isMaskingMode) setBrushCursor(prev => ({ ...prev, visible: false }));
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
        {/* DYNAMIC CIRCULAR BRUSH CURSOR OVERLAY */}
        {isMaskingMode && brushCursor.visible && (
          <div
            style={{
              left: `${brushCursor.x}px`,
              top: `${brushCursor.y}px`,
              width: `${brushSize}px`,
              height: `${brushSize}px`,
              transform: "translate(-50%, -50%)",
            }}
            className={`pointer-events-none absolute rounded-full z-[110] flex items-center justify-center transition-[width,height] duration-75 ${
              maskMode === "erase"
                ? "border-2 border-red-400 bg-red-500/20 shadow-[0_0_12px_rgba(239,68,68,0.6)]"
                : "border-2 border-emerald-400 bg-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.6)]"
            }`}
          >
            {/* Center Precision Crosshair Dot */}
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                maskMode === "erase" ? "bg-red-400 ring-1 ring-white/50" : "bg-emerald-400 ring-1 ring-white/50"
              }`}
            />
          </div>
        )}

        {/* LIVE FLOATING MASKING HUD & CONTROLS */}
        {isMaskingMode && maskingActor && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute top-3 left-1/2 -translate-x-1/2 z-[100] bg-zinc-950/95 border border-indigo-500/70 rounded-xl px-3 py-2 shadow-2xl backdrop-blur flex items-center gap-3 text-xs max-w-[95%] sm:max-w-none flex-wrap sm:flex-nowrap justify-center animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Actor Header */}
            <div className="flex items-center gap-1.5 border-r border-zinc-800 pr-2.5">
              <div className="w-5 h-5 rounded bg-indigo-950 border border-indigo-600/60 flex items-center justify-center text-indigo-400">
                <Eraser className="w-3 h-3" />
              </div>
              <div>
                <div className="font-semibold text-white text-[11px] leading-tight">
                  Masking: {maskingActor.characterName}
                </div>
                <div className="text-[9px] text-zinc-400 leading-tight">
                  {maskMode === "erase" ? "Erase pixels to tuck behind furniture" : "Paint over erased areas to restore"}
                </div>
              </div>
            </div>

            {/* Erase vs Restore Toggle */}
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setMaskMode("erase")}
                className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer ${
                  maskMode === "erase"
                    ? "bg-red-950/90 text-red-300 border border-red-600/80 shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
                title="Erase Mode: Subtractive alpha painting (tuck behind foreground objects or erase edges)"
              >
                <Eraser className="w-3 h-3" />
                <span>Erase</span>
              </button>
              <button
                type="button"
                onClick={() => setMaskMode("restore")}
                className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer ${
                  maskMode === "restore"
                    ? "bg-emerald-950/90 text-emerald-300 border border-emerald-600/80 shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
                title="Restore Mode: Additive painting (recover previously erased cutout pixels)"
              >
                <Paintbrush className="w-3 h-3" />
                <span>Restore</span>
              </button>
            </div>

            {/* Brush Size Slider & Presets */}
            <div className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800/80 px-2 py-1 rounded-lg">
              <span className="text-[11px] text-zinc-400 whitespace-nowrap">Size:</span>
              <input
                type="range"
                min="5"
                max="100"
                step="1"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-20 sm:w-24 accent-indigo-500 cursor-pointer"
                title={`Brush diameter: ${brushSize}px`}
              />
              <span className="text-[10px] font-mono text-zinc-300 w-7 text-right">
                {brushSize}px
              </span>
              <div className="hidden md:flex items-center gap-1 border-l border-zinc-800 pl-1.5">
                {[10, 25, 50, 80].map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setBrushSize(sz)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors cursor-pointer ${
                      brushSize === sz
                        ? "bg-indigo-600 text-white font-bold"
                        : "bg-zinc-800 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons: Reset & Done */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleResetMask}
                className="px-2 py-1 text-[11px] text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                title="Clear all mask edits and restore complete un-erased actor"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">Reset Mask</span>
              </button>
              <button
                type="button"
                onClick={handleExitMaskingMode}
                className="px-2.5 py-1 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/50 rounded-lg shadow-md transition-colors flex items-center gap-1 cursor-pointer"
                title="Commit mask and exit to standard actor positioning (Esc)"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Done Masking</span>
              </button>
            </div>
          </div>
        )}
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
          const isCurrentMasking = isMaskingMode && maskingActorId === actor.id;
          const actorScale = actor.scale || 1.0;

          // Height is scaled relative to standard 55% height
          const displayHeightPercent = 55 * actorScale;

          return (
            <div
              key={actor.id}
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
                  handleMaskPointerDown(e, actor);
                } else if (!isMaskingMode) {
                  handleActorPointerDown(e, actor);
                }
              }}
              onPointerMove={(e) => {
                if (isCurrentMasking) {
                  handleMaskPointerMove(e, actor);
                }
              }}
              onPointerUp={(e) => {
                if (isCurrentMasking) {
                  handleMaskPointerUp(e, actor);
                }
              }}
              onPointerCancel={(e) => {
                if (isCurrentMasking) {
                  handleMaskPointerUp(e, actor);
                }
              }}
              onWheel={(e) => {
                if (!isMaskingMode) handleActorWheel(e, actor);
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
                      ref={(el) => {
                        actorImgRefs.current[actor.id] = el;
                      }}
                      src={lastCommittedCutoutRef.current[actor.id] || actor.cutoutDataUrl || actor.originalCutoutDataUrl}
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
                      onPointerDown={(e) => handleMaskPointerDown(e, actor)}
                      onPointerMove={(e) => handleMaskPointerMove(e, actor)}
                      onPointerUp={(e) => handleMaskPointerUp(e, actor)}
                      onPointerCancel={(e) => handleMaskPointerUp(e, actor)}
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
                          onPointerDown={(e) => handleResizePointerDown(e, actor, "top")}
                          className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-sm cursor-nesw-resize shadow-md hover:scale-125 transition-transform z-30"
                          title="Drag corner to scale actor (20% - 350%+)"
                        />

                        {/* Top-Left Corner Resize Handle */}
                        <div
                          onPointerDown={(e) => handleResizePointerDown(e, actor, "top")}
                          className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-sm cursor-nwse-resize shadow-md hover:scale-125 transition-transform z-30"
                          title="Drag corner to scale actor (20% - 350%+)"
                        />

                        {/* Bottom-Right Corner Resize Handle */}
                        <div
                          onPointerDown={(e) => handleResizePointerDown(e, actor, "bottom")}
                          className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-sm cursor-nwse-resize shadow-md hover:scale-125 transition-transform z-30"
                          title="Drag corner to scale actor (20% - 350%+)"
                        />

                        {/* Bottom-Left Corner Resize Handle */}
                        <div
                          onPointerDown={(e) => handleResizePointerDown(e, actor, "bottom")}
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
                              handleResetMask();
                            }}
                            className="px-1.5 py-0.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded text-[10px] flex items-center gap-1 transition-colors"
                            title="Reset mask to original cutout"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reset</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExitMaskingMode();
                            }}
                            className="px-2 py-0.5 text-white bg-indigo-600 hover:bg-indigo-500 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors"
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
                              handleEnterMaskingMode(actor);
                            }}
                            className="p-1 text-indigo-300 hover:text-white hover:bg-indigo-950/80 rounded transition-colors flex items-center gap-1 text-[10px] font-medium"
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
                            className="p-1 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded transition-colors"
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
        })}
      </div>
    </div>
  );
};
