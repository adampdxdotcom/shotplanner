import React, { useRef, useState, useEffect } from "react";
import { Pipette } from "lucide-react";
import { KeyingCutoutResult } from "./types";
import { samplePixelColor } from "../../../utils/chromaKey";

interface KeyingDualPreviewProps {
  activeImageSource: string | null;
  cutoutResult: KeyingCutoutResult | null;
  onSampleColor: (hex: string) => void;
  addToast?: (msg: string, type?: "success" | "error" | "info") => void;
}

export const KeyingDualPreview: React.FC<KeyingDualPreviewProps> = ({
  activeImageSource,
  cutoutResult,
  onSampleColor,
  addToast
}) => {
  const [isEyedropperActive, setIsEyedropperActive] = useState<boolean>(false);
  const [hoveredColor, setHoveredColor] = useState<string | null>(null);
  const sourceImageRef = useRef<HTMLImageElement>(null);
  const rafIdRef = useRef<number | null>(null);

  const handleSourceImageClick = async (e: React.MouseEvent<HTMLImageElement>) => {
    if (!sourceImageRef.current) return;
    const rect = sourceImageRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const scaleX = sourceImageRef.current.naturalWidth / rect.width;
    const scaleY = sourceImageRef.current.naturalHeight / rect.height;
    const pixelX = clickX * scaleX;
    const pixelY = clickY * scaleY;

    try {
      const sampled = await samplePixelColor(sourceImageRef.current, pixelX, pixelY);
      onSampleColor(sampled.hex);
      if (isEyedropperActive) {
        setIsEyedropperActive(false);
      }
      if (addToast) {
        addToast(`Key color sampled: ${sampled.hex}`, "info");
      }
    } catch (err) {
      console.warn("Could not sample pixel color:", err);
    }
  };

  const handleSourceImageMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!isEyedropperActive || !sourceImageRef.current) return;
    const rect = sourceImageRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const scaleX = sourceImageRef.current.naturalWidth / rect.width;
    const scaleY = sourceImageRef.current.naturalHeight / rect.height;
    const pixelX = clickX * scaleX;
    const pixelY = clickY * scaleY;

    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(async () => {
      if (!sourceImageRef.current) return;
      try {
        const sampled = await samplePixelColor(sourceImageRef.current, pixelX, pixelY);
        setHoveredColor(sampled.hex);
      } catch {
        // ignore
      }
    });
  };

  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* LEFT: SOURCE IMAGE WITH EYEDROPPER */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
            <span>Source Image</span>
            <span className="text-[10px] font-normal text-zinc-500">(Click to sample key color)</span>
          </label>

          <button
            type="button"
            onClick={() => setIsEyedropperActive(!isEyedropperActive)}
            className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
              isEyedropperActive
                ? "bg-amber-500 text-black font-bold"
                : "bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700"
            }`}
          >
            <Pipette className="w-3 h-3" />
            <span>{isEyedropperActive ? "Sampling Active" : "Eyedropper"}</span>
          </button>
        </div>

        <div className="relative aspect-square max-h-80 w-full rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 flex items-center justify-center">
          {activeImageSource ? (
            <>
              <img
                ref={sourceImageRef}
                src={activeImageSource}
                alt="Source"
                onClick={handleSourceImageClick}
                onMouseMove={handleSourceImageMouseMove}
                className={`max-h-full max-w-full object-contain ${
                  isEyedropperActive ? "cursor-crosshair" : "cursor-pointer"
                }`}
                crossOrigin="anonymous"
              />
              {/* Floating Eyedropper Magnifier Badge */}
              {isEyedropperActive && hoveredColor && (
                <div className="absolute top-2 left-2 pointer-events-none bg-black/85 backdrop-blur border border-zinc-700 px-2 py-1 rounded-md text-[10px] font-mono flex items-center gap-2 shadow-lg">
                  <div
                    className="w-3.5 h-3.5 rounded-full border border-white/40 shadow-inner"
                    style={{ backgroundColor: hoveredColor }}
                  />
                  <span>{hoveredColor}</span>
                </div>
              )}
            </>
          ) : (
            <div className="text-xs text-zinc-500">No image selected</div>
          )}
        </div>
      </div>

      {/* RIGHT: TRANSPARENT CUTOUT OVER CHECKERBOARD */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
            <span>Transparent Cutout</span>
            <span className="text-[10px] font-normal text-emerald-400">
              {cutoutResult ? `${cutoutResult.transparentPercentage}% removed` : ""}
            </span>
          </label>

          <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400">
            <span>PNG Alpha</span>
          </div>
        </div>

        {/* HIGH CONTRAST CHECKERBOARD TRANSPARENCY CONTAINER */}
        <div 
          className="relative aspect-square max-h-80 w-full rounded-xl overflow-hidden border border-zinc-800 flex items-center justify-center shadow-inner"
          style={{
            backgroundImage: `conic-gradient(#27272a 90deg, #18181b 90deg 180deg, #27272a 180deg 270deg, #18181b 270deg)`,
            backgroundSize: "16px 16px"
          }}
        >
          {cutoutResult ? (
            <img
              src={cutoutResult.dataUrl}
              alt="Keyed Cutout"
              className="max-h-full max-w-full object-contain filter drop-shadow-md"
            />
          ) : (
            <div className="text-xs text-zinc-500 font-mono">Awaiting keying...</div>
          )}

          {/* Status overlay badge */}
          {cutoutResult && (
            <div className="absolute bottom-2 right-2 pointer-events-none bg-black/80 backdrop-blur border border-zinc-800 px-2 py-0.5 rounded text-[9px] font-mono text-zinc-300">
              {cutoutResult.width} × {cutoutResult.height} • Clean Cutout
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
