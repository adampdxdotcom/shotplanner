import React from "react";
import { QUICK_KEY_COLORS } from "./types";
import { Sparkles, Feather } from "lucide-react";

interface KeyingParameterControlsProps {
  keyColor: string;
  setKeyColor: (color: string) => void;
  tolerance: number;
  setTolerance: (val: number) => void;
  softness: number;
  setSoftness: (val: number) => void;
  despill: boolean;
  setDespill: (val: boolean) => void;
  keyingMode: "standard" | "ycbcr";
  setKeyingMode: (mode: "standard" | "ycbcr") => void;
  edgeDetail: number;
  setEdgeDetail: (val: number) => void;
}

export const KeyingParameterControls: React.FC<KeyingParameterControlsProps> = ({
  keyColor,
  setKeyColor,
  tolerance,
  setTolerance,
  softness,
  setSoftness,
  despill,
  setDespill,
  keyingMode,
  setKeyingMode,
  edgeDetail,
  setEdgeDetail
}) => {
  return (
    <div className="space-y-4 pt-2 border-t border-zinc-200 dark:border-zinc-800/80">
      {/* Algorithm Mode Selection Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-300">Keying Engine:</span>
          <div className="inline-flex rounded-md p-0.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/80 text-[11px] shadow-2xs">
            <button
              type="button"
              id="btn-keying-mode-standard"
              onClick={() => setKeyingMode("standard")}
              className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                keyingMode === "standard"
                  ? "bg-indigo-600 text-white shadow-xs font-semibold"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
              title="Standard RGB 3D Euclidean distance keying"
            >
              Standard RGB
            </button>
            <button
              type="button"
              id="btn-keying-mode-ycbcr"
              onClick={() => setKeyingMode("ycbcr")}
              className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                keyingMode === "ycbcr"
                  ? "bg-amber-500 text-black shadow-xs font-bold"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
              title="Luma / Chroma (YCbCr) color difference separation - preserves fine hair & transparent fabric"
            >
              <Sparkles className="w-3 h-3" />
              <span>YCbCr (Fine Hair & Fabrics)</span>
            </button>
          </div>
        </div>

        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono hidden sm:inline">
          {keyingMode === "ycbcr" 
            ? "Decouples brightness from screen chroma to preserve wispy strands" 
            : "Standard color Euclidean distance"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Key Color Picker & Quick Palette */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-800 dark:text-zinc-300">
            <span>Target Key Color</span>
            <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">{keyColor}</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="color"
              value={keyColor}
              onChange={(e) => setKeyColor(e.target.value.toUpperCase())}
              className="w-8 h-8 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent cursor-pointer p-0 shrink-0"
            />
            <input
              type="text"
              value={keyColor}
              onChange={(e) => setKeyColor(e.target.value)}
              placeholder="#00FF00"
              className="w-24 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1 text-xs font-mono uppercase text-zinc-900 dark:text-zinc-200 outline-none shadow-2xs"
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

        {/* Tolerance Slider & Fine Detail Slider */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-medium text-zinc-800 dark:text-zinc-300">
              <span title="Controls color range sensitivity to remove background">
                Tolerance / Threshold
              </span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{tolerance}%</span>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              value={tolerance}
              onChange={(e) => setTolerance(Number(e.target.value))}
              className="w-full accent-indigo-600 dark:accent-indigo-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
              <span>Strict (1%)</span>
              <span>Balanced (35%)</span>
              <span>Aggressive (100%)</span>
            </div>
          </div>

          {/* Fine Hair & Edge Retention Slider */}
          <div className="space-y-1 pt-1 border-t border-zinc-200 dark:border-zinc-800/60">
            <div className="flex items-center justify-between text-xs font-medium text-zinc-800 dark:text-zinc-300">
              <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300/90 font-semibold" title="Fine edge detail recovery for hair strands and sheer fabrics">
                <Feather className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                Fine Edge Detail (Hair)
              </span>
              <span className="font-mono text-amber-700 dark:text-amber-400 font-bold">{edgeDetail}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={edgeDetail}
              onChange={(e) => setEdgeDetail(Number(e.target.value))}
              className="w-full accent-amber-600 dark:accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
              <span>Standard (0%)</span>
              <span>Hair Strands (50%)</span>
              <span>Delicate (100%)</span>
            </div>
          </div>
        </div>

        {/* Edge Softness & Despill */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-800 dark:text-zinc-300">
            <span title="Feathers transparent edges to eliminate harsh halos">
              Edge Softness (Feather)
            </span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{softness}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={softness}
            onChange={(e) => setSoftness(Number(e.target.value))}
            className="w-full accent-emerald-600 dark:accent-emerald-500 cursor-pointer"
          />
          
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={despill}
                onChange={(e) => setDespill(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-0 cursor-pointer"
              />
              <span className="font-medium text-zinc-800 dark:text-zinc-300">Edge Despill Suppression</span>
            </label>

            <span className="text-[10px] text-emerald-700 dark:text-emerald-400/80 font-mono">
              Neutralizes fringe
            </span>
          </div>

          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed pt-1">
            {keyingMode === "ycbcr"
              ? "YCbCr calculates color differences in separate luma/chroma planes to protect wispy edges and tinted glass."
              : "Despill replaces residual green or blue fringing with neutral luminance on semi-transparent transition boundaries."}
          </p>
        </div>
      </div>
    </div>
  );
};
