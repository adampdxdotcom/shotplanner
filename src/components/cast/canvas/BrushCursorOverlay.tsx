import React from "react";

export interface BrushCursorOverlayProps {
  visible: boolean;
  x: number;
  y: number;
  brushSize: number;
  maskMode: "erase" | "restore";
}

export const BrushCursorOverlay: React.FC<BrushCursorOverlayProps> = ({
  visible,
  x,
  y,
  brushSize,
  maskMode
}) => {
  if (!visible) return null;

  return (
    <div
      style={{
        left: `${x}px`,
        top: `${y}px`,
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
  );
};
