import React from "react";
import { PromptVariation } from "../../types";
import { Sparkles, Check, Clock, Trash2 } from "lucide-react";

interface VariationSelectorProps {
  variations: PromptVariation[];
  activeVariationId?: string;
  onSelectVariation: (variation: PromptVariation) => void;
  onDeleteVariation?: (variationId: string) => void;
}

export const VariationSelector: React.FC<VariationSelectorProps> = ({
  variations,
  activeVariationId,
  onSelectVariation,
  onDeleteVariation
}) => {
  if (!variations || variations.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 shrink-0">
        <Sparkles className="w-3.5 h-3.5" />
        <span>Prompt Variations ({variations.length}):</span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {variations.map((v) => {
          const isActive = v.id === activeVariationId;
          const label = v.label || `Variation ${v.variation_number}`;

          return (
            <div
              key={v.id}
              className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono font-medium cursor-pointer transition-all ${
                isActive
                  ? "bg-amber-500/20 border-amber-500/60 text-amber-200 ring-1 ring-amber-500/30 shadow-xs"
                  : "bg-zinc-900 border-zinc-700/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 hover:bg-zinc-800"
              }`}
              onClick={() => onSelectVariation(v)}
              title={`Prompt Variation ${v.variation_number}${v.provider ? ` (${v.provider})` : ""} - Click to inject into prompt editor`}
            >
              {isActive && <Check className="w-3 h-3 text-amber-400 shrink-0" />}
              <span>{label}</span>
              {v.provider && (
                <span className="text-[10px] text-zinc-500 uppercase font-sans">
                  {v.provider === "gemini" ? "Gemini" : "LM"}
                </span>
              )}
              {onDeleteVariation && variations.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteVariation(v.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:text-rose-400 p-0.5 transition-opacity"
                  title="Delete variation"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
