import React from "react";
import { Camera, Terminal, UploadCloud, Zap } from "lucide-react";
import { ShotItem } from "../../types";
import { formatShotNumber } from "../../utils/formatters";

export interface SendShotPanelProps {
  activeShot: ShotItem | null | undefined;
  sanitizedSceneName: string;
  activeShotAssets: string[];
  isTransferring: boolean;
  isExecuting?: boolean;
  lastAction: "shot" | "scene" | "execute_shot" | null;
  handleSendShot: () => void;
  handleExecuteShot?: () => void;
}

export const SendShotPanel: React.FC<SendShotPanelProps> = ({
  activeShot,
  sanitizedSceneName,
  activeShotAssets,
  isTransferring,
  isExecuting = false,
  lastAction,
  handleSendShot,
  handleExecuteShot
}) => {
  return (
    <div className={`send-shot-box p-5 rounded-xl border-2 flex flex-col justify-between space-y-4 transition-all ${
      activeShot 
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
            {activeShotAssets.length > 0 && (
              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/50 text-[10px] text-zinc-600 dark:text-zinc-400 break-words font-mono">
                {activeShotAssets.join(", ")}
              </div>
            )}
          </div>
        )}
      </div>

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
