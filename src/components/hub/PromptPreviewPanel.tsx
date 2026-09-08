import React, { useState, useMemo } from "react";
import { Copy, Check, Sparkles, FileText, Terminal } from "lucide-react";
import { ShotItem, computePrePromptContext } from "../../types";

interface PromptPreviewPanelProps {
  activeShot: ShotItem;
  addToast?: (msg: string, type?: "success" | "error" | "info") => void;
}

export const PromptPreviewPanel: React.FC<PromptPreviewPanelProps> = ({
  activeShot,
  addToast
}) => {
  const [copied, setCopied] = useState(false);

  const isExpanded = Boolean(activeShot.expanded_prompt && activeShot.expanded_prompt.trim());

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

  const displayedPrompt = isExpanded 
    ? activeShot.expanded_prompt 
    : (computedPrePrompt || activeShot.basic_stub || "No prompt available for this shot.");

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
        addToast("Prompt copied to clipboard", "success");
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
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-indigo-950/60 border border-indigo-800/60 text-indigo-400 rounded-lg shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white">Prompt Preview</h2>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                isExpanded 
                  ? "bg-emerald-950/80 text-emerald-300 border-emerald-800/60" 
                  : "bg-amber-950/80 text-amber-300 border-amber-800/60"
              }`}>
                {isExpanded ? "Expanded Prompt" : "Pre-Prompt Context"}
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              {isExpanded 
                ? "Full prompt generated for this shot" 
                : "Active camera & scene framing prompt context"}
            </p>
          </div>
        </div>

        {/* COPY ACTION BUTTON */}
        <button
          type="button"
          onClick={handleCopy}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
            copied
              ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-900/40"
              : "bg-zinc-800/90 hover:bg-zinc-700/90 text-zinc-200 hover:text-white border-zinc-700"
          }`}
          title="Copy prompt to clipboard"
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

      {/* PROMPT CONTENT - EXPANDS FULL REMAINING HEIGHT OF THE PANEL */}
      <div className="flex-1 flex flex-col min-h-0 relative group">
        <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-1.5 px-1 font-mono">
          <span className="flex items-center gap-1">
            <Terminal className="w-3 h-3 text-zinc-500" />
            Shot {activeShot.shot_number.toString().padStart(2, "0")} Prompt
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
