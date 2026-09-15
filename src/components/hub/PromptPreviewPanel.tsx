import React, { useState, useMemo } from "react";
import { Copy, Check, Sparkles, Terminal, FileText } from "lucide-react";
import { ShotItem, computePrePromptContext, PromptVariation } from "../../types";

interface PromptPreviewPanelProps {
  activeShot: ShotItem;
  onSelectVariation?: (variation: PromptVariation) => void;
  addToast?: (msg: string, type?: "success" | "error" | "info") => void;
}

export const PromptPreviewPanel: React.FC<PromptPreviewPanelProps> = ({
  activeShot,
  onSelectVariation,
  addToast
}) => {
  const [copied, setCopied] = useState(false);
  // Default to showing "stub" prompt view as requested
  const [promptViewMode, setPromptViewMode] = useState<"stub" | "expanded">("stub");

  const hasExpanded = Boolean(activeShot.expanded_prompt && activeShot.expanded_prompt.trim());
  const variations = activeShot.prompt_variations || [];
  const activeVar = variations.find(v => v.id === activeShot.active_variation_id);

  const computedPrePrompt = useMemo(() => {
    return computePrePromptContext({
      shotNumber: activeShot.shot_number,
      shotType: activeShot.shot_type,
      lensFocalLength: activeShot.lens_focal_length,
      cameraMovement: activeShot.camera_movement,
      aspectRatio: activeShot.aspect_ratio,
      otsAnchorSubject: activeShot.ots_anchor_subject,
      otsFocusSubject: activeShot.ots_focus_subject,
      otsSide: activeShot.ots_side,
      basicStub: activeShot.basic_stub
    });
  }, [
    activeShot.shot_number,
    activeShot.shot_type,
    activeShot.lens_focal_length,
    activeShot.camera_movement,
    activeShot.aspect_ratio,
    activeShot.ots_anchor_subject,
    activeShot.ots_focus_subject,
    activeShot.ots_side,
    activeShot.basic_stub
  ]);

  const displayedPrompt = useMemo(() => {
    if (promptViewMode === "stub") {
      return activeShot.basic_stub?.trim() 
        ? activeShot.basic_stub 
        : (computedPrePrompt || activeShot.expanded_prompt || "No basic prompt stub set for this shot.");
    }
    return activeShot.expanded_prompt?.trim() 
      ? activeShot.expanded_prompt 
      : (computedPrePrompt || activeShot.basic_stub || "No expanded prompt generated yet for this shot.");
  }, [promptViewMode, activeShot.basic_stub, activeShot.expanded_prompt, computedPrePrompt]);

  const handleCopy = async () => {
    if (!displayedPrompt) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(displayedPrompt);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = displayedPrompt;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopied(true);
      if (addToast) {
        addToast(`${promptViewMode === "stub" ? "Basic stub" : "Expanded prompt"} copied to clipboard`, "success");
      }
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy prompt:", err);
      if (addToast) {
        addToast("Failed to copy to clipboard", "error");
      }
    }
  };

  const charCount = displayedPrompt.length;
  const wordCount = displayedPrompt.trim() ? displayedPrompt.trim().split(/\s+/).length : 0;

  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4 h-full min-h-[420px] shadow-sm">
      {/* HEADER */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-zinc-800/80 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-indigo-950/60 border border-indigo-800/60 text-indigo-400 rounded-lg shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-white">Prompt Preview</h2>
              
              {/* Active Variation Indicator */}
              {activeVar && (
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  {activeVar.label || `Variation ${activeVar.variation_number}`}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400">
              {promptViewMode === "stub"
                ? "Showing core action & character stub (default)"
                : "Showing fully generated prompt expansion"}
            </p>
          </div>
        </div>

        {/* CONTROLS: Toggle Stub/Expanded + Copy Button */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Toggle Switch */}
          <div className="inline-flex p-0.5 bg-zinc-950 border border-zinc-800 rounded-lg shadow-inner">
            <button
              type="button"
              onClick={() => setPromptViewMode("stub")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                promptViewMode === "stub"
                  ? "bg-zinc-800 text-amber-300 shadow-xs font-semibold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="View Basic Stub (Default)"
            >
              Stub
            </button>
            <button
              type="button"
              onClick={() => setPromptViewMode("expanded")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                promptViewMode === "expanded"
                  ? "bg-zinc-800 text-emerald-300 shadow-xs font-semibold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="View Expanded Generation Prompt"
            >
              Expanded
            </button>
          </div>

          {/* COPY ACTION BUTTON */}
          <button
            type="button"
            onClick={handleCopy}
            className={`copy-prompt-btn px-3 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
              copied
                ? "is-copied bg-emerald-600 text-white border-emerald-500 shadow-emerald-900/40"
                : "bg-zinc-800/90 hover:bg-zinc-700/90 text-zinc-200 hover:text-white border-zinc-700"
            }`}
            title="Copy current prompt view to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-zinc-300" />
                <span>Copy Prompt</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* VARIATION SELECTOR BAR (if multiple variations exist) */}
      {variations.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] font-medium text-zinc-500 shrink-0">Variations:</span>
          {variations.map((v) => {
            const isSelected = v.id === activeShot.active_variation_id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onSelectVariation && onSelectVariation(v)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all cursor-pointer shrink-0 ${
                  isSelected
                    ? "bg-amber-500/20 text-amber-200 border border-amber-500/40 font-semibold"
                    : "bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-zinc-200 hover:border-zinc-700"
                }`}
                title={`Select Variation ${v.variation_number}`}
              >
                Var {v.variation_number}
              </button>
            );
          })}
        </div>
      )}

      {/* PROMPT CONTENT - EXPANDS FULL REMAINING HEIGHT OF THE PANEL */}
      <div className="flex-1 flex flex-col min-h-0 relative group">
        <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-1.5 px-1 font-mono">
          <span className="flex items-center gap-1">
            <Terminal className="w-3 h-3 text-zinc-500" />
            Shot {activeShot.shot_number.toString().padStart(2, "0")} {promptViewMode === "stub" ? "Stub" : "Expanded"}
          </span>
          <span>
            {wordCount} words • {charCount} chars
          </span>
        </div>

        {/* READ-ONLY DISPLAY BOX */}
        <div className="flex-1 min-h-0 bg-zinc-950/80 border border-zinc-800/90 rounded-lg p-4 overflow-y-auto select-text cursor-text focus:outline-none focus:ring-1 focus:ring-indigo-500/50 shadow-inner">
          <p className="text-xs sm:text-sm text-zinc-200 font-mono whitespace-pre-wrap leading-relaxed select-text">
            {displayedPrompt}
          </p>
        </div>
      </div>
    </div>
  );
};
