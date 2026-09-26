import React, { useState } from "react";
import { Copy, Check, Quote } from "lucide-react";
import { copyToClipboard } from "../../utils/clipboard";

interface MarkdownQuoteBlockProps {
  children?: React.ReactNode;
  onShowToast?: (text: string, type?: "success" | "error" | "info") => void;
}

/**
 * Bounds-constrained Blockquote container with subtle hover copy button
 * and strict word wrapping.
 */
export const MarkdownQuoteBlock: React.FC<MarkdownQuoteBlockProps> = ({
  children,
  onShowToast
}) => {
  const [copied, setCopied] = useState(false);

  // Extract raw text for copying
  const extractText = (node: any): string => {
    if (!node) return "";
    if (typeof node === "string") return node;
    if (Array.isArray(node)) return node.map(extractText).join("");
    if (node.props && node.props.children) return extractText(node.props.children);
    return "";
  };

  const quoteText = extractText(children).trim();

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!quoteText) return;
    const success = await copyToClipboard(quoteText);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onShowToast?.("Copied quote to clipboard.", "info");
    }
  };

  return (
    <div className="relative group/quote my-2.5 rounded-r-xl border-l-4 border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/30 p-3 text-slate-700 dark:text-zinc-300 min-w-0 max-w-full overflow-hidden">
      {quoteText && (
        <button
          type="button"
          onClick={handleCopy}
          className="absolute top-2 right-2 opacity-0 group-hover/quote:opacity-100 transition-opacity p-1 rounded-md bg-white/80 dark:bg-zinc-800/80 hover:bg-white dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 shadow-2xs text-[10px] flex items-center gap-1 cursor-pointer"
          title="Copy block"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      )}
      <div className="break-words [overflow-wrap:anywhere] leading-relaxed italic text-xs sm:text-sm">
        {children}
      </div>
    </div>
  );
};
