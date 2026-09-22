import React from "react";
import { Camera, ShieldCheck } from "lucide-react";
import { CINEMATIC_PRESETS } from "./types";

interface DirectorPromptControlsProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  isCheckingSafety: boolean;
  onTranslateSafety: () => void;
  sanitizedPrompt: string | null;
  safetyReplacements: string[];
  useSanitized: boolean;
  onToggleUseSanitized: (value: boolean) => void;
}

export const DirectorPromptControls: React.FC<DirectorPromptControlsProps> = ({
  prompt,
  onPromptChange,
  isCheckingSafety,
  onTranslateSafety,
  sanitizedPrompt,
  safetyReplacements,
  useSanitized,
  onToggleUseSanitized
}) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-purple-400" />
          <span>Director Staging Prompt & Composition</span>
        </label>
        <button
          type="button"
          onClick={onTranslateSafety}
          disabled={isCheckingSafety || !prompt.trim()}
          className="text-[11px] text-purple-300 hover:text-purple-200 flex items-center gap-1 px-2 py-0.5 bg-purple-950/40 border border-purple-800/40 rounded cursor-pointer transition-colors"
          title="Inspect prompt and translate violent/intense film action to Hollywood stunt terminology"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
          <span>{isCheckingSafety ? "Checking Safety..." : "Hollywood Stunt Safety Pre-Flight"}</span>
        </button>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        placeholder="Describe the exact starting keyframe (pose, camera angle, lighting, gaze direction, mood)..."
        rows={3}
        className="w-full bg-zinc-900/90 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500 leading-relaxed resize-y"
      />

      {/* QUICK CINEMATIC PRESET BADGES */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <span className="text-[10px] text-zinc-500 font-medium">Quick Starters:</span>
        {CINEMATIC_PRESETS.map((preset, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onPromptChange(prompt ? `${prompt}, ${preset}` : preset)}
            className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 hover:border-purple-600/50 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            + {preset.split(",")[0]}
          </button>
        ))}
      </div>

      {/* SAFETY RE-PROMPTING TRANSLATION BANNER */}
      {sanitizedPrompt && (
        <div className="p-3 bg-purple-950/30 border border-purple-800/40 rounded-lg flex flex-col gap-2 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              <span>Theatrical Safety Re-Prompting Layer Active</span>
            </div>
            <label className="flex items-center gap-1.5 text-[11px] text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={useSanitized}
                onChange={(e) => onToggleUseSanitized(e.target.checked)}
                className="accent-purple-500 rounded"
              />
              <span>Use Translated Stunt Prompt</span>
            </label>
          </div>
          <p className="text-[11px] text-zinc-300 font-mono bg-zinc-900/80 p-2 rounded border border-purple-900/40">
            {sanitizedPrompt}
          </p>
          {safetyReplacements.length > 0 && (
            <div className="flex flex-wrap gap-1 text-[9px] text-purple-300/80">
              <span className="text-zinc-400">Translations applied:</span>
              {safetyReplacements.map((rep, idx) => (
                <span key={idx} className="bg-purple-900/40 px-1.5 py-0.5 rounded">
                  {rep}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
