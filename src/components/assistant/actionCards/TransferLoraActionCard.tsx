import React from "react";
import { DownloadCloud, CheckCircle2, AlertCircle, Loader2, ArrowRight, X, Layers, Sparkles } from "lucide-react";
import { TransferLoraToRemoteAction, AssistantAction } from "../../../types/assistantActions";

interface TransferLoraActionCardProps {
  action: TransferLoraToRemoteAction;
  isApplied: boolean;
  onApply: (action: AssistantAction) => void;
  onDismiss?: (action: AssistantAction) => void;
  transferProgress?: {
    status: "idle" | "transferring" | "success" | "error";
    message?: string;
  };
}

/**
 * Action card rendering direct remote LoRA download/transfer to ComfyUI GPU host.
 */
export const TransferLoraActionCard: React.FC<TransferLoraActionCardProps> = ({
  action,
  isApplied,
  onApply,
  onDismiss,
  transferProgress
}) => {
  const loraName = action.lora_name || action.filename;
  const filename = action.filename;
  const destPath = `${action.destination_folder || "models/loras/"}${filename}`;
  const isTransferring = transferProgress?.status === "transferring";
  const isSuccess = isApplied || transferProgress?.status === "success";
  const isError = transferProgress?.status === "error";

  return (
    <div className={`mt-3 p-3 rounded-xl border transition-all text-xs w-full min-w-0 overflow-hidden ${
      isSuccess
        ? "bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-200"
        : isError
        ? "bg-rose-50/90 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800/80 text-rose-900 dark:text-rose-200"
        : "bg-slate-50 dark:bg-zinc-900/90 border-purple-200/80 dark:border-purple-500/30 shadow-xs"
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-200/70 dark:border-zinc-800 min-w-0">
        <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-zinc-100 min-w-0 flex-1">
          <Layers className="w-3.5 h-3.5 text-purple-500 shrink-0" />
          <span className="shrink-0">LoRA Transfer</span>
          {action.title && (
            <span className="text-slate-500 dark:text-zinc-400 font-normal truncate min-w-0 flex-1">
              • {action.title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 shrink-0 whitespace-nowrap">
            Remote GPU
          </span>
          {!isSuccess && !isTransferring && onDismiss && (
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

      {/* Description */}
      <div className="my-2 space-y-1.5">
        <p className="text-slate-700 dark:text-zinc-300">
          Download &amp; stage system LoRA <strong>"{loraName}"</strong> to remote ComfyUI GPU:
        </p>
        <div className="font-mono text-[10.5px] p-2 bg-slate-100 dark:bg-zinc-950 text-slate-800 dark:text-zinc-300 rounded border border-slate-200/80 dark:border-zinc-800 break-all flex items-center justify-between">
          <span>{destPath}</span>
        </div>
      </div>

      {/* Progress */}
      {isTransferring && (
        <div className="my-2 space-y-1">
          <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-medium text-[11px]">
            <Loader2 className="w-3 h-3 animate-spin shrink-0" />
            <span>{transferProgress?.message || "Downloading LoRA directly to remote GPU..."}</span>
          </div>
        </div>
      )}

      {/* Error */}
      {isError && transferProgress?.message && (
        <div className="my-1.5 p-1.5 rounded bg-rose-100/80 dark:bg-rose-950 text-rose-700 dark:text-rose-300 flex items-center gap-1.5 text-[11px]">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{transferProgress.message}</span>
        </div>
      )}

      {/* Action button */}
      <div className="mt-2.5 flex items-center justify-end gap-2">
        {isSuccess ? (
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-xs py-1">
            <CheckCircle2 className="w-4 h-4" />
            LoRA Transferred to GPU
          </span>
        ) : (
          <button
            onClick={() => onApply(action)}
            disabled={isTransferring}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg font-medium transition-all shadow-xs cursor-pointer text-xs"
          >
            {isTransferring ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Transferring...
              </>
            ) : (
              <>
                <DownloadCloud className="w-3.5 h-3.5" />
                Transfer to Remote GPU
                <ArrowRight className="w-3 h-3 ml-0.5" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
