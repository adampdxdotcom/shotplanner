import React, { useState } from "react";
import { Copy, Check, Sparkles, Code2, Image as ImageIcon, Terminal } from "lucide-react";
import { copyToClipboard } from "../../utils/clipboard";

interface PromptCodeBlockProps {
  codeText: string;
  language?: string;
  onShowToast?: (text: string, type?: "success" | "error" | "info") => void;
}

/**
 * Bounds-constrained Code & Image Prompt container with dedicated 1-click copy button,
 * automatic wrapping (never overflows chat bounds), and contextual badge labeling.
 */
export const PromptCodeBlock: React.FC<PromptCodeBlockProps> = ({
  codeText,
  language = "",
  onShowToast
}) => {
  const [copied, setCopied] = useState(false);

  // Normalize language tag and determine if it represents an image or text prompt
  const langLower = (language || "").toLowerCase().trim();
  const isPrompt = 
    langLower === "prompt" || 
    langLower === "image-prompt" || 
    langLower === "still-prompt" || 
    langLower === "image" ||
    langLower === "text" ||
    langLower === "" ||
    /^(a |an |cinematic|close-up|medium shot|wide shot|hyperrealistic|masterpiece|photorealistic|raw photo|portrait)/i.test(codeText.trim());

  const isImagePrompt = 
    langLower === "image-prompt" || 
    langLower === "still-prompt" || 
    langLower === "image" ||
    /cinematic|focal length|lighting|photorealistic|render|aspect ratio|negative prompt|flux|midjourney|sdxl/i.test(codeText);

  // Determine badge title and icon
  let badgeLabel = "PROMPT";
  let BadgeIcon = Sparkles;

  if (isImagePrompt) {
    badgeLabel = "IMAGE PROMPT";
    BadgeIcon = ImageIcon;
  } else if (langLower && !["text", "prompt", "code"].includes(langLower)) {
    badgeLabel = langLower.toUpperCase();
    BadgeIcon = Code2;
  } else if (!isPrompt) {
    badgeLabel = "CODE";
    BadgeIcon = Terminal;
  }

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await copyToClipboard(codeText);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onShowToast?.(
        isPrompt ? "Copied prompt to clipboard." : "Copied snippet to clipboard.",
        "info"
      );
    }
  };

  return (
    <div className="my-2.5 rounded-xl border border-slate-700/80 bg-slate-900 dark:bg-zinc-950 dark:border-zinc-800 shadow-md overflow-hidden min-w-0 max-w-full">
      {/* Header Bar with Badge & Prominent Copy Button */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/90 dark:bg-zinc-900 border-b border-slate-700/60 dark:border-zinc-800 text-slate-300 dark:text-zinc-300 select-none">
        <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold tracking-wide text-indigo-400 dark:text-indigo-300">
          <BadgeIcon className="w-3.5 h-3.5 shrink-0" />
          <span>{badgeLabel}</span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer shadow-2xs ${
            copied
              ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
              : "bg-slate-700/80 dark:bg-zinc-800 hover:bg-slate-700 hover:text-white text-slate-200 border border-slate-600/40 dark:border-zinc-700"
          }`}
          title={isPrompt ? "Copy prompt to clipboard" : "Copy code to clipboard"}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-semibold text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-slate-300" />
              <span>{isPrompt ? "Copy Prompt" : "Copy Code"}</span>
            </>
          )}
        </button>
      </div>

      {/* Prompt Body - Strict wrapping ensures no horizontal overflow */}
      <div className="p-3 font-mono text-xs leading-relaxed text-slate-100 dark:text-zinc-200 whitespace-pre-wrap break-words [overflow-wrap:anywhere] max-w-full overflow-x-hidden selection:bg-indigo-500 selection:text-white select-text">
        {codeText}
      </div>
    </div>
  );
};
