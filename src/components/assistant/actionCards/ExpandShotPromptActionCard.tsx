import React from "react";
import { Wand2, CheckCircle2, AlertCircle, Loader2, ArrowRight, X, Sparkles } from "lucide-react";
import { ExpandShotPromptAction, AssistantAction } from "../../../types/assistantActions";

interface ExpandShotPromptActionCardProps {
  action: ExpandShotPromptAction;
  isApplied: boolean;
  onApply: (action: AssistantAction) => void;
  onDismiss?: (action: AssistantAction) => void;
  expandingProgress?: {
    status: "idle" | "expanding" | "success" | "error";
    message?: string;
  };
}

/**
 * Action card rendering LLM prompt expansion pipeline synthesis status and trigger.
 */
export const ExpandShotPromptActionCard: React.FC<ExpandShotPromptActionCardProps> = ({
  action,
  isApplied,
  onApply,
  onDismiss,
  expandingProgress
}) => {
  const shotNum = action.shot_number;
  const isExpanding = expandingProgress?.status === "expanding";
  const isSuccess = isApplied || expandingProgress?.status === "success";
  const isError = expandingProgress?.status === "error";

  return (
    <div className={`mt-3 p-3 rounded-xl border transition-all text-xs w-full min-w-0 overflow-hidden ${
      isSuccess
        ? "bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-200"
        : isError
        ? "bg-rose-50/90 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800/80 text-rose-900 dark:text-rose-200"
        : "bg-slate-50 dark:bg-zinc-900/90 border-blue-200/80 dark:border-blue-500/30 shadow-xs"
    }`}>
      <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-200/70 dark:border-zinc-800 min-w-0">
        <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-zinc-100 min-w-0 flex-1">
          <Wand2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span className="shrink-0">Prompt Expansion Dispatcher</span>
          {action.title && (
            <span className="text-slate-500 dark:text-zinc-400 font-normal truncate min-w-0 flex-1">
              • {action.title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 shrink-0 whitespace-nowrap">
            Prompt Expansion
          </span>
          {!isSuccess && !isExpanding && onDismiss && (
            <button
              onClick={() => onDismiss(action)}
              className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded transition-colors shrink-0 cursor-pointer"
              title="Dismiss suggestion"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Action description */}
      <div className="my-2 space-y-1">
        <p className="text-slate-700 dark:text-zinc-300">
          Dispatch LLM prompt expansion pipeline for <strong>Shot #{shotNum}</strong> to synthesize rich visual descriptors and populate take prompt.
        </p>
        {action.guidance && (
          <div className="font-sans text-[11px] p-2 bg-slate-100 dark:bg-zinc-950 text-slate-800 dark:text-zinc-300 rounded border border-slate-200/80 dark:border-zinc-800 italic">
            "{action.guidance}"
          </div>
        )}
      </div>

      {/* Error message */}
      {isError && expandingProgress?.message && (
        <div className="my-1.5 p-1.5 rounded bg-rose-100/80 dark:bg-rose-950 text-rose-700 dark:text-rose-300 flex items-center gap-1.5 text-[11px]">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{expandingProgress.message}</span>
        </div>
      )}

      {/* Action button */}
      <div className="mt-2.5 pt-1.5 border-t border-slate-200/60 dark:border-zinc-800">
        {isSuccess ? (
          <div className="flex items-center justify-between gap-2 w-full flex-wrap">
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Prompt Expanded & Populated for Shot #{shotNum}
            </span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 flex items-center gap-1 shadow-2xs">
              <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
              <span>Added as New Variation</span>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 w-full">
            <button
              onClick={() => onApply(action)}
              disabled={isExpanding}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
            >
              {isExpanding ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Expanding Prompt...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Expand Shot #{shotNum} Prompt</span>
                  <ArrowRight className="w-3 h-3 ml-0.5" />
                </>
              )}
            </button>
            {onDismiss && !isExpanding && (
              <button
                onClick={() => onDismiss(action)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-200/70 hover:bg-slate-300/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 font-medium text-xs transition-colors cursor-pointer"
              >
                Dismiss
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
