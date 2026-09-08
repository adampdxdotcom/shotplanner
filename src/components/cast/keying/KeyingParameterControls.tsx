import React from "react";
import { QUICK_KEY_COLORS } from "./types";

interface KeyingParameterControlsProps {
  keyColor: string;
  setKeyColor: (color: string) => void;
  tolerance: number;
  setTolerance: (val: number) => void;
  softness: number;
  setSoftness: (val: number) => void;
  despill: boolean;
  setDespill: (val: boolean) => void;
}

export const KeyingParameterControls: React.FC<KeyingParameterControlsProps> = ({
  keyColor,
  setKeyColor,
  tolerance,
  setTolerance,
  softness,
  setSoftness,
  despill,
  setDespill
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-zinc-800/80">
      {/* Key Color Picker & Quick Palette */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-medium text-zinc-300">
          <span>Target Key Color</span>
          <span className="font-mono text-amber-400 font-bold">{keyColor}</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="color"
            value={keyColor}
            onChange={(e) => setKeyColor(e.target.value.toUpperCase())}
            className="w-8 h-8 rounded border border-zinc-700 bg-transparent cursor-pointer p-0 shrink-0"
          />
          <input
            type="text"
            value={keyColor}
            onChange={(e) => setKeyColor(e.target.value)}
            placeholder="#00FF00"
            className="w-24 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs font-mono uppercase text-zinc-200 outline-none"
          />
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap gap-1 pt-1">
          {QUICK_KEY_COLORS.map(c => (
            <button
              key={c.hex}
              type="button"
              onClick={() => setKeyColor(c.hex)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-transform active:scale-95 cursor-pointer ${c.bgClass}`}
              title={c.label}
            >
              {c.label.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Tolerance Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-medium text-zinc-300">
          <span title="Controls color range sensitivity to remove background">
            Tolerance / Threshold
          </span>
          <span className="font-mono text-indigo-400 font-bold">{tolerance}%</span>
        </div>
        <input
          type="range"
          min="1"
          max="100"
          value={tolerance}
          onChange={(e) => setTolerance(Number(e.target.value))}
          className="w-full accent-indigo-500 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
          <span>Strict (1%)</span>
          <span>Balanced (35%)</span>
          <span>Aggressive (100%)</span>
        </div>
      </div>

      {/* Edge Softness & Despill */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-medium text-zinc-300">
          <span title="Feathers transparent edges to eliminate harsh halos">
            Edge Softness (Feather)
          </span>
          <span className="font-mono text-emerald-400 font-bold">{softness}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={softness}
          onChange={(e) => setSoftness(Number(e.target.value))}
          className="w-full accent-emerald-500 cursor-pointer"
        />
        
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={despill}
              onChange={(e) => setDespill(e.target.checked)}
              className="rounded border-zinc-700 text-indigo-600 focus:ring-0"
            />
            <span>Despill Edge Fringing</span>
          </label>

          <span className="text-[10px] text-zinc-500 font-mono">
            Removes green halos
          </span>
        </div>
      </div>
    </div>
  );
};
