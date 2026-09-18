import React from "react";
import { UploadCloud, CheckCircle2, AlertCircle, Loader2, ArrowRight, X } from "lucide-react";
import { StageShotAssetsAction, AssistantAction } from "../../../types/assistantActions";

interface StageShotAssetsActionCardProps {
  action: StageShotAssetsAction;
  isApplied: boolean;
  onApply: (action: AssistantAction) => void;
  onDismiss?: (action: AssistantAction) => void;
  stagingProgress?: {
    status: "idle" | "staging" | "success" | "error";
    progress: number;
    message?: string;
  };
}

/**
 * Action card rendering SFTP ComfyUI asset staging status and real-time progress indicator.
 */
export const StageShotAssetsActionCard: React.FC<StageShotAssetsActionCardProps> = ({
  action,
  isApplied,
  onApply,
  onDismiss,
  stagingProgress
}) => {
  const shotNum = action.shot_number;
  const destPath = action.destination_path || "/workspace/ComfyUI/input/scene_...";
  const isStaging = stagingProgress?.status === "staging";
  const isSuccess = isApplied || stagingProgress?.status === "success";
  const isError = stagingProgress?.status === "error";

  return (
    <div className={`mt-3 p-3 rounded-xl border transition-all text-xs w-full min-w-0 overflow-hidden ${
      isSuccess
        ? "bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-200"
        : isError
        ? "bg-rose-50/90 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800/80 text-rose-900 dark:text-rose-200"
        : "bg-slate-50 dark:bg-zinc-900/90 border-cyan-200/80 dark:border-cyan-500/30 shadow-xs"
    }`}>
      <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-200/70 dark:border-zinc-800 min-w-0">
        <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-zinc-100 min-w-0 flex-1">
          <UploadCloud className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
          <span className="shrink-0">Remote ComfyUI Staging</span>
          {action.title && (
            <span className="text-slate-500 dark:text-zinc-400 font-normal truncate min-w-0 flex-1">
              • {action.title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 shrink-0 whitespace-nowrap">
            Remote Staging
          </span>
          {!isSuccess && !isStaging && onDismiss && (
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
      <div className="my-2 space-y-1.5">
        <p className="text-slate-700 dark:text-zinc-300">
          Ready to stage <strong>Shot #{shotNum}</strong> assets to remote host:
        </p>
        <div className="font-mono text-[10.5px] p-2 bg-slate-100 dark:bg-zinc-950 text-slate-800 dark:text-zinc-300 rounded border border-slate-200/80 dark:border-zinc-800 break-all">
          {destPath}
        </div>
      </div>

      {/* Real-time progress bar if staging */}
      {isStaging && (
        <div className="my-2 space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400 font-medium">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>{stagingProgress?.message || "Transferring assets via SFTP..."}</span>
            </span>
            <span className="font-mono text-slate-500 dark:text-zinc-400">
              {Math.round(stagingProgress?.progress || 0)}%
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-cyan-500 h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.max(5, stagingProgress?.progress || 0)}%` }}
            />
          </div>
        </div>
      )}

      {/* Error message */}
      {isError && stagingProgress?.message && (
        <div className="my-1.5 p-1.5 rounded bg-rose-100/80 dark:bg-rose-950 text-rose-700 dark:text-rose-300 flex items-center gap-1.5 text-[11px]">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{stagingProgress.message}</span>
        </div>
      )}

      {/* Action button */}
      <div className="mt-2.5 pt-1.5 border-t border-slate-200/60 dark:border-zinc-800">
        {isSuccess ? (
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" /> Staged Shot #{shotNum} to Remote ComfyUI
          </span>
        ) : (
          <div className="flex items-center gap-2 w-full">
            <button
              onClick={() => onApply(action)}
              disabled={isStaging}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 active:bg-cyan-800 disabled:opacity-50 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
            >
              {isStaging ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Staging Assets...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Stage Assets</span>
                  <ArrowRight className="w-3 h-3 ml-0.5" />
                </>
              )}
            </button>
            {onDismiss && !isStaging && (
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
