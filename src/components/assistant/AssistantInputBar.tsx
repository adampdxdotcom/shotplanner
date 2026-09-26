import React from "react";
import { Send, Eye, X, CheckCircle2, Sparkles, Image as ImageIcon } from "lucide-react";
import { MediaAsset } from "../../types";
import { getAssetMediaUrl } from "../../utils/assetUrl";

interface AssistantInputBarProps {
  inputRef: React.RefObject<HTMLTextAreaElement>;
  inputQuery: string;
  isLoading: boolean;
  stagedAsset?: MediaAsset | null;
  isAssetScanned?: boolean;
  activeShotNumber?: number;
  onInputChange: (val: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSendMessage: () => void;
  onResetChat: () => void;
  onOpenMediaBrowser: () => void;
  onClearStagedAsset?: () => void;
  onGenerateImagePrompt?: () => void;
}

/**
 * Bottom query input bar with Skill Pills, Staged Attachment Strip,
 * auto-expanding textarea, send trigger, and clear history.
 */
export const AssistantInputBar: React.FC<AssistantInputBarProps> = ({
  inputRef,
  inputQuery,
  isLoading,
  stagedAsset,
  isAssetScanned,
  activeShotNumber,
  onInputChange,
  onKeyDown,
  onSendMessage,
  onResetChat,
  onOpenMediaBrowser,
  onClearStagedAsset,
  onGenerateImagePrompt
}) => {
  const isSendDisabled = (!inputQuery.trim() && !stagedAsset) || isLoading;

  return (
    <div className="p-3 bg-white dark:bg-zinc-900 border-t border-slate-200/90 dark:border-zinc-800 shrink-0 flex flex-col gap-2">
      
      {/* Skill Pills Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
        <span className="text-[10px] font-semibold tracking-wider text-slate-400 dark:text-zinc-500 uppercase mr-1">
          Skills:
        </span>
        
        {/* Vision Skill Pill */}
        <button
          onClick={onOpenMediaBrowser}
          type="button"
          className={`px-2.5 py-1 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
            stagedAsset
              ? "bg-indigo-600 text-white border-indigo-500 shadow-2xs"
              : "bg-slate-100 dark:bg-zinc-800/90 hover:bg-slate-200 dark:hover:bg-zinc-700/80 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700"
          }`}
          title="Select an image from project library for vision analysis"
        >
          <Eye className="w-3.5 h-3.5 text-indigo-400 dark:text-indigo-300" />
          <span>Vision</span>
          {stagedAsset && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
          )}
        </button>

        {/* Image Prompt Skill Pill */}
        <button
          onClick={onGenerateImagePrompt}
          type="button"
          className="px-2.5 py-1 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer bg-slate-100 dark:bg-zinc-800/90 hover:bg-slate-200 dark:hover:bg-zinc-700/80 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:border-amber-400/60 dark:hover:border-amber-500/60 hover:text-amber-700 dark:hover:text-amber-300"
          title={activeShotNumber ? `Generate a standalone still image prompt from Shot #${activeShotNumber} stub` : "Generate a standalone still image prompt from active shot stub"}
        >
          <ImageIcon className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
          <span>Image Prompt</span>
        </button>
      </div>

      {/* Staged Attachment Chip */}
      {stagedAsset && (
        <div className="flex items-center justify-between gap-2 p-2 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 rounded-xl animate-fadeIn">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-900 shrink-0 border border-indigo-300/60 dark:border-indigo-700/60 relative">
              <img
                src={getAssetMediaUrl(stagedAsset, true)}
                alt={stagedAsset.filename}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0 flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {stagedAsset.subject_name || stagedAsset.filename}
                </span>
                {isAssetScanned ? (
                  <span className="px-1.5 py-0.2 text-[9px] font-medium rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-0.5 shrink-0">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    <span>Scanned</span>
                  </span>
                ) : (
                  <span className="px-1.5 py-0.2 text-[9px] font-medium rounded bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 flex items-center gap-0.5 shrink-0">
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>New Scan</span>
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                {stagedAsset.filename}
              </span>
            </div>
          </div>

          <button
            onClick={onClearStagedAsset}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
            title="Remove attached image"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Query Input Box */}
      <div className="relative flex items-end bg-slate-100 dark:bg-zinc-800 rounded-xl p-1.5 focus-within:ring-2 focus-within:ring-indigo-500/80 border border-slate-200 dark:border-zinc-700">
        <textarea
          ref={inputRef}
          value={inputQuery}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            stagedAsset
              ? "Ask about this image, or leave blank for full visual analysis..."
              : "Ask assistant to update scene, stage assets, or expand prompts..."
          }
          rows={4}
          className="w-full resize-none bg-transparent px-2.5 py-1.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none min-h-[5.5rem] max-h-48 overflow-y-auto leading-relaxed"
        />
        <button
          onClick={onSendMessage}
          disabled={isSendDisabled}
          className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0 ml-1 mb-0.5 shadow-2xs"
          title="Send query"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center justify-between px-1 text-[11px] text-slate-400 dark:text-zinc-500">
        <span>Shift + Enter for new line</span>
        <button
          onClick={onResetChat}
          className="hover:text-slate-600 dark:hover:text-zinc-300 transition-colors cursor-pointer"
        >
          Clear History
        </button>
      </div>
    </div>
  );
};

