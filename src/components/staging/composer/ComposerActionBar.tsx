import React from "react";
import { Sparkles, RefreshCw, AlertTriangle, Tv } from "lucide-react";

interface ComposerActionBarProps {
  aspectRatio: string;
  onAspectRatioChange: (ratio: string) => void;
  candidateCount: number;
  onCandidateCountChange: (count: number) => void;
  isGenerating: boolean;
  canGenerate: boolean;
  onGenerate: () => void;
  generationError: string | null;
  wasBlockedByFilter: boolean;
  isSendingToComfy: boolean;
  onSendToLocalComfy: () => void;
}

export const ComposerActionBar: React.FC<ComposerActionBarProps> = ({
  aspectRatio,
  onAspectRatioChange,
  candidateCount,
  onCandidateCountChange,
  isGenerating,
  canGenerate,
  onGenerate,
  generationError,
  wasBlockedByFilter,
  isSendingToComfy,
  onSendToLocalComfy
}) => {
  return (
    <div className="flex flex-col gap-3">
      {/* 1. RATIO, CANDIDATES, & GENERATE BUTTON */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-800/80">
        <div className="flex flex-wrap items-center gap-3">
          {/* ASPECT RATIO */}
          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5">
            <span className="text-[10px] text-zinc-400">Ratio:</span>
            <select
              value={aspectRatio}
              onChange={(e) => onAspectRatioChange(e.target.value)}
              className="bg-transparent text-xs font-semibold text-purple-300 outline-none cursor-pointer"
            >
              <option value="16:9" className="bg-zinc-900 text-zinc-200">16:9 (Cinema Wide)</option>
              <option value="9:16" className="bg-zinc-900 text-zinc-200">9:16 (Vertical)</option>
              <option value="1:1" className="bg-zinc-900 text-zinc-200">1:1 (Square)</option>
              <option value="4:3" className="bg-zinc-900 text-zinc-200">4:3 (Classic TV)</option>
              <option value="21:9" className="bg-zinc-900 text-zinc-200">21:9 (Anamorphic)</option>
            </select>
          </div>

          {/* CANDIDATE COUNT */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
            <span className="text-[10px] text-zinc-400 px-1.5">Candidates:</span>
            {[1, 2, 3, 4].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => onCandidateCountChange(num)}
                className={`w-6 h-6 rounded text-xs font-bold transition-colors cursor-pointer ${
                  candidateCount === num
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* GENERATE ACTION BUTTON */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onGenerate}
            disabled={isGenerating || !canGenerate}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer ${
              isGenerating || !canGenerate
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white hover:shadow-purple-500/20"
            }`}
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Synthesizing Frame 0...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate Frame 0 Candidates</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. ERROR & SAFETY BLOCK NOTIFICATION / LOCAL COMFYUI FALLBACK */}
      {generationError && (
        <div className="p-3.5 bg-red-950/30 border border-red-800/50 rounded-lg flex flex-col gap-2">
          <div className="flex items-start gap-2 text-red-300 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <div>
              <span className="font-bold">{wasBlockedByFilter ? "Commercial API Safety Filter Triggered" : "Generation Error"}</span>
              <p className="text-zinc-400 text-[11px] mt-0.5">{generationError}</p>
            </div>
          </div>

          {/* SEND TO LOCAL COMFYUI FALLBACK BUTTON */}
          <div className="flex items-center justify-between pt-1 border-t border-red-900/40">
            <span className="text-[11px] text-zinc-400">
              Prefer local rendering without API content filtering?
            </span>
            <button
              type="button"
              onClick={onSendToLocalComfy}
              disabled={isSendingToComfy}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-purple-300 hover:text-white border border-purple-800/40 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Tv className="w-3.5 h-3.5 text-purple-400" />
              <span>{isSendingToComfy ? "Staging..." : "Send to Local ComfyUI"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
