import React from "react";
import { 
  Sparkles, 
  Check, 
  RotateCcw, 
  Eye, 
  Copy, 
  Clock, 
  Loader2, 
  Square, 
  History 
} from "lucide-react";
import { LLMProvider, PromptDebugInfo } from "../../types";

interface PromptOutputPanelProps {
  displayedPrompt: string;
  isLivePreview: boolean;
  presentedFallbackNotice: string | null;
  generating: boolean;
  elapsedSeconds: number;
  copied: boolean;
  lastDebugInfo: PromptDebugInfo | null;
  effectiveDefaultProvider: LLMProvider;
  onPromptChange: (val: string) => void;
  onCopy: () => void;
  onResetToLivePreview: () => void;
  onInspectExchange: () => void;
  onCancelGeneration: () => void;
}

/**
 * Right-side column presenting the live pre-prompt context preview or compiled LLM prompt,
 * with real-time text editing, copy actions, and generation overlays.
 */
export const PromptOutputPanel: React.FC<PromptOutputPanelProps> = ({
  displayedPrompt,
  isLivePreview,
  presentedFallbackNotice,
  generating,
  elapsedSeconds,
  copied,
  lastDebugInfo,
  effectiveDefaultProvider,
  onPromptChange,
  onCopy,
  onResetToLivePreview,
  onInspectExchange,
  onCancelGeneration
}) => {
  return (
    <div className="bg-zinc-50/70 dark:bg-zinc-950/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700/80 space-y-3 flex flex-col justify-between">
      <div className="space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              Preview / Edit Expanded Prompt
            </label>
            {presentedFallbackNotice ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40 flex items-center gap-1">
                <History className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                Last Generated Prompt
              </span>
            ) : isLivePreview ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse" />
                Live Pre-Prompt Context
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30 flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                Compiled / Custom Prompt
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {lastDebugInfo && (
              <button
                type="button"
                onClick={onInspectExchange}
                className="px-2.5 py-1 text-xs font-medium rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 dark:border-amber-600/40 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 dark:text-amber-300 dark:hover:text-amber-100 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Inspect exact system directives, user payload, and raw model response"
              >
                <Eye className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>Inspect LLM Exchange ({lastDebugInfo.latency_ms}ms)</span>
              </button>
            )}

            {!isLivePreview && (
              <button
                type="button"
                onClick={onResetToLivePreview}
                className="px-2.5 py-1 text-xs font-medium rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-300 dark:hover:text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Clear custom prompt and return to real-time synthesized live context preview"
              >
                <RotateCcw className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />
                <span>Reset to Live Preview</span>
              </button>
            )}

            {copied && (
              <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/90 border border-emerald-300 dark:border-emerald-800/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                <Check className="w-3 h-3" />
                Copied!
              </span>
            )}
            <button
              type="button"
              onClick={onCopy}
              disabled={!displayedPrompt || !displayedPrompt.trim()}
              className={`copy-prompt-btn px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 shadow-xs ${
                copied
                  ? "is-copied bg-emerald-600 border-emerald-500 text-white shadow-emerald-900/30 cursor-default"
                  : displayedPrompt && displayedPrompt.trim()
                  ? "bg-white hover:bg-zinc-50 text-amber-800 border-zinc-300 hover:border-amber-400 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-amber-300 dark:hover:text-amber-200 dark:border-zinc-700 dark:hover:border-amber-500/50 cursor-pointer"
                  : "bg-zinc-100 text-zinc-400 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-600 dark:border-zinc-800 cursor-not-allowed"
              }`}
              title={isLivePreview ? "Copy synthesized live context preview" : "Copy compiled/edited prompt"}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied to Clipboard" : isLivePreview ? "Copy Preview Context" : "Copy Prompt"}</span>
            </button>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-lg">
          <textarea
            rows={18}
            placeholder="The dynamic pre-prompt context or expanded prompt will appear here ready for editing before execution..."
            value={displayedPrompt}
            onChange={(e) => onPromptChange(e.target.value)}
            disabled={generating}
            className={`w-full bg-white dark:bg-zinc-900 border rounded-lg p-3 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none resize-none leading-relaxed font-mono transition-opacity duration-300 shadow-xs ${
              generating ? "opacity-40 cursor-not-allowed select-none" : ""
            } ${
              isLivePreview 
                ? "border-amber-400 dark:border-amber-500/40 focus:border-amber-500" 
                : "border-zinc-300 dark:border-zinc-700 focus:border-amber-500"
            }`}
          />

          {/* Smooth Fade Loading Overlay with Spinner & Abort/Cancel */}
          <div 
            className={`prompt-generating-overlay absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center transition-all duration-300 pointer-events-none rounded-lg ${
              generating 
                ? "opacity-100 backdrop-blur-xs bg-white/80 dark:bg-zinc-950/70 pointer-events-auto" 
                : "opacity-0 pointer-events-none"
            }`}
          >
            {/* Glowing Spinner Centerpiece & Live Counter */}
            <div className="relative mb-3 flex flex-col items-center justify-center">
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 w-12 h-12 rounded-full bg-amber-500/20 blur-md animate-pulse" />
                <Loader2 className="w-9 h-9 text-amber-500 dark:text-amber-400 animate-spin relative z-10" />
              </div>
              {/* Real-time Elapsed Seconds Counter */}
              <div className="mt-3 px-3 py-1 rounded-full bg-white dark:bg-zinc-900/95 border border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-300 font-mono text-xs font-bold flex items-center gap-1.5 shadow-md">
                <Clock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 animate-pulse" />
                <span>{elapsedSeconds}s / 60s</span>
              </div>
            </div>

            {/* Status Badges & Text */}
            <div className="space-y-1 max-w-xs">
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 animate-pulse" />
                <span>Expanding Prompt with {effectiveDefaultProvider === "gemini" ? "Gemini 3.7 Flash" : "LM Studio"}...</span>
              </p>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug">
                {elapsedSeconds >= 30 
                  ? "Local model is evaluating prompt context or generating tokens..." 
                  : "Synthesizing cinematographic details and slot references."}
              </p>
            </div>

            {/* Embedded Cancel Action */}
            <button
              type="button"
              onClick={onCancelGeneration}
              className="mt-4 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-700 hover:text-zinc-900 bg-white hover:bg-zinc-100 border border-zinc-300 dark:text-zinc-300 dark:hover:text-white dark:bg-zinc-800/90 dark:hover:bg-zinc-700/90 dark:border-zinc-600/80 dark:hover:border-zinc-500 shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Square className="w-3 h-3 fill-current text-red-600 dark:text-red-400" />
              <span>Cancel Generation</span>
            </button>
          </div>
        </div>
      </div>

      <div className="text-[11px] text-zinc-600 dark:text-zinc-400 bg-zinc-100/80 dark:bg-zinc-900/60 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between shadow-xs">
        <span>
          Character Count: {displayedPrompt.length}{" "}
          <span className="text-zinc-500 font-normal">
            ({isLivePreview ? "Synthesized Live Context" : "Compiled Prompt"})
          </span>
        </span>
        <span className="text-zinc-500">Target Node: Configured in Step 2</span>
      </div>
    </div>
  );
};
