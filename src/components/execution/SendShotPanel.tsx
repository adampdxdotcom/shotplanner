import React from "react";
import { Camera, Terminal, UploadCloud, Zap, Radio, AlertCircle, RefreshCw, X } from "lucide-react";
import { ShotItem } from "../../types";
import { formatShotNumber } from "../../utils/formatters";

export interface SendShotPanelProps {
  activeShot: ShotItem | null | undefined;
  sanitizedSceneName: string;
  activeShotAssets: string[];
  isTransferring: boolean;
  isExecuting?: boolean;
  lastAction: "shot" | "scene" | "execute_shot" | null;
  transferState?: "idle" | "progress" | "error" | "success";
  errorMessage?: string | null;
  handleSendShot: () => void;
  handleExecuteShot?: () => void;
  handleDismissError?: () => void;
}

export const SendShotPanel: React.FC<SendShotPanelProps> = ({
  activeShot,
  sanitizedSceneName,
  activeShotAssets,
  isTransferring,
  isExecuting = false,
  lastAction,
  transferState = "idle",
  errorMessage = null,
  handleSendShot,
  handleExecuteShot,
  handleDismissError
}) => {
  const isFailed = transferState === "error" && (lastAction === "shot" || lastAction === "execute_shot");

  return (
    <div className={`send-shot-box p-5 rounded-xl border-2 flex flex-col justify-between space-y-4 transition-all ${
      isFailed
        ? "bg-red-50/40 dark:bg-red-950/20 border-red-500/60 dark:border-red-500/40 shadow-sm"
        : activeShot 
        ? "bg-white dark:bg-zinc-900/80 border-indigo-400/60 dark:border-indigo-500/30 shadow-sm dark:shadow-[0_0_15px_-3px_rgba(99,102,241,0.1)]" 
        : "bg-zinc-50/60 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 opacity-75"
    }`}>
      <div className="space-y-4">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-lg ${
            activeShot 
              ? "bg-indigo-50 text-indigo-600 border border-indigo-200/80 dark:bg-indigo-500/20 dark:text-indigo-400 dark:border-transparent" 
              : "bg-zinc-100 text-zinc-400 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-500 dark:border-transparent"
          }`}>
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h2 className={`text-lg font-bold ${activeShot ? "text-zinc-900 dark:text-indigo-100" : "text-zinc-400 dark:text-zinc-500"}`}>Send Shot</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Stage or execute the active shot.</p>
          </div>
        </div>

        {!activeShot ? (
          <div className="py-8 text-center border border-dashed border-zinc-300 dark:border-zinc-800 rounded-lg">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Select a shot to stage.</p>
          </div>
        ) : (
          <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3.5 space-y-2 text-xs shadow-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500">Shot Name:</span>
              <span className="text-zinc-800 dark:text-zinc-200 font-mono font-medium">{sanitizedSceneName}_Shot_{formatShotNumber(activeShot.shot_number)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Workflow:</span>
              <span className="text-zinc-800 dark:text-zinc-200 font-mono font-medium truncate max-w-[200px]" title={`${sanitizedSceneName}_Shot_{formatShotNumber(activeShot.shot_number)}.json`}>
                {sanitizedSceneName}_Shot_{formatShotNumber(activeShot.shot_number)}.json
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Active Assets:</span>
              <span className="text-zinc-800 dark:text-zinc-200 font-medium">{activeShotAssets.length} files</span>
            </div>
            {activeShot.monitored_workflow && (
              <div className="flex justify-between items-center bg-cyan-500/10 dark:bg-cyan-950/40 px-2 py-1 rounded border border-cyan-500/30">
                <span className="text-cyan-700 dark:text-cyan-300 font-medium flex items-center gap-1 text-[11px]">
                  <Radio className="w-3 h-3 text-cyan-500 shrink-0" /> Monitored WF:
                </span>
                <span className="text-cyan-800 dark:text-cyan-200 font-mono font-semibold truncate max-w-[160px] text-[11px]" title={activeShot.monitored_workflow}>
                  {activeShot.monitored_workflow.split("/").pop()}
                </span>
              </div>
            )}
            {activeShotAssets.length > 0 && (
              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/50 text-[10px] text-zinc-600 dark:text-zinc-400 break-words font-mono">
                {activeShotAssets.join(", ")}
              </div>
            )}
          </div>
        )}
      </div>

      {isFailed && errorMessage && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800/60 rounded-lg space-y-2 text-xs">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-800 dark:text-red-200">
                  {lastAction === "execute_shot" ? "Execution Failed" : "Staging Failed"}
                </p>
                <p className="text-[11px] font-mono break-words text-red-600 dark:text-red-300/90 mt-0.5">
                  {errorMessage}
                </p>
              </div>
            </div>
            {handleDismissError && (
              <button
                onClick={handleDismissError}
                className="text-red-400 hover:text-red-600 dark:hover:text-red-200 shrink-0 p-0.5 cursor-pointer"
                title="Dismiss error"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex gap-2 pt-1 border-t border-red-200 dark:border-red-900/40">
            <button
              onClick={lastAction === "execute_shot" ? handleExecuteShot : handleSendShot}
              className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
            {handleDismissError && (
              <button
                onClick={handleDismissError}
                className="px-2.5 py-1 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded text-[11px] font-medium cursor-pointer transition-colors"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2 pt-2">
        <button
          onClick={handleSendShot}
          disabled={!activeShot || isTransferring || isExecuting}
          className={`w-full py-2.5 rounded-lg flex items-center justify-center gap-2 font-semibold transition-all ${
            activeShot && !isTransferring && !isExecuting
              ? "bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-300 shadow-xs cursor-pointer dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 dark:border-zinc-700"
              : "bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-not-allowed dark:bg-zinc-800/50 dark:text-zinc-500 dark:border-transparent"
          }`}
        >
          {isTransferring && lastAction === "shot" ? (
            <>
              <Terminal className="w-4 h-4 animate-pulse" />
              <span>Staging Shot...</span>
            </>
          ) : (
            <>
              <UploadCloud className="w-4 h-4" />
              <span>Stage Shot</span>
            </>
          )}
        </button>

        <button
          onClick={handleExecuteShot}
          disabled={!activeShot || isTransferring || isExecuting}
          className={`w-full py-3 rounded-lg flex items-center justify-center gap-2 font-bold transition-all shadow-md ${
            activeShot && !isTransferring && !isExecuting
              ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 cursor-pointer"
              : "bg-zinc-200 text-zinc-400 cursor-not-allowed dark:bg-zinc-800/80 dark:text-zinc-500 shadow-none"
          }`}
        >
          {isExecuting && lastAction === "execute_shot" ? (
            <>
              <Terminal className="w-4 h-4 animate-pulse text-white" />
              <span className="text-white">Executing...</span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 text-amber-300" />
              <span className="text-white">Send to ComfyUI</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
