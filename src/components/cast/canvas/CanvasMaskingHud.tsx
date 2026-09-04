import React from "react";
import { Eraser, Paintbrush, RotateCcw, Check } from "lucide-react";
import { StagedActorCanvasItem } from "./types";

export interface CanvasMaskingHudProps {
  maskingActor: StagedActorCanvasItem;
  maskMode: "erase" | "restore";
  setMaskMode: (mode: "erase" | "restore") => void;
  brushSize: number;
  setBrushSize: (size: number | ((prev: number) => number)) => void;
  onResetMask: () => void;
  onExitMaskingMode: () => void;
}

export const CanvasMaskingHud: React.FC<CanvasMaskingHudProps> = ({
  maskingActor,
  maskMode,
  setMaskMode,
  brushSize,
  setBrushSize,
  onResetMask,
  onExitMaskingMode
}) => {
  return (
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
          onClick={onResetMask}
          className="px-2 py-1 text-[11px] text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
          title="Clear all mask edits and restore complete un-erased actor"
        >
          <RotateCcw className="w-3 h-3" />
          <span className="hidden sm:inline">Reset Mask</span>
        </button>
        <button
          type="button"
          onClick={onExitMaskingMode}
          className="px-2.5 py-1 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/50 rounded-lg shadow-md transition-colors flex items-center gap-1 cursor-pointer"
          title="Commit mask and exit to standard actor positioning (Esc)"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Done Masking</span>
        </button>
      </div>
    </div>
  );
};
