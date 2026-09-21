import React from "react";
import { Layers, Terminal, UploadCloud, AlertCircle, RefreshCw, X } from "lucide-react";
import { SceneProjectFile } from "../../types";

export interface SendScenePanelProps {
  sceneProject: SceneProjectFile;
  sanitizedSceneName: string;
  allSceneAssets: string[];
  isTransferring: boolean;
  lastAction: "shot" | "scene" | "execute_shot" | null;
  transferState?: "idle" | "progress" | "error" | "success";
  errorMessage?: string | null;
  handleSendScene: () => void;
  handleDismissError?: () => void;
}

export const SendScenePanel: React.FC<SendScenePanelProps> = ({
  sceneProject,
  sanitizedSceneName,
  allSceneAssets,
  isTransferring,
  lastAction,
  transferState = "idle",
  errorMessage = null,
  handleSendScene,
  handleDismissError
}) => {
  const isFailed = transferState === "error" && lastAction === "scene";

  return (
    <div className={`send-scene-box border-2 shadow-sm p-5 rounded-xl flex flex-col justify-between space-y-4 transition-all ${
      isFailed
        ? "bg-red-50/40 dark:bg-red-950/20 border-red-500/60 dark:border-red-500/40"
        : "bg-white dark:bg-zinc-900/80 border-amber-400/60 dark:border-amber-500/30 dark:shadow-[0_0_15px_-3px_rgba(245,158,11,0.1)]"
    }`}>
      <div className="space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-amber-50 text-amber-600 border border-amber-200/80 dark:bg-amber-500/20 dark:text-amber-400 dark:border-transparent">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-amber-100">Send Scene</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Batch stage all shots in the scene.</p>
          </div>
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3.5 space-y-2 text-xs shadow-xs">
          <div className="flex justify-between">
            <span className="text-zinc-500">Total Shots:</span>
            <span className="text-amber-600 dark:text-amber-300 font-bold">{sceneProject.shots.length} shot(s)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Total Distinct Assets:</span>
            <span className="text-zinc-800 dark:text-zinc-200 font-medium">{allSceneAssets.length} unique image files</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Target Folder:</span>
            <span className="text-zinc-800 dark:text-zinc-200 font-mono font-medium truncate max-w-[240px]" title={`/workflows/${sanitizedSceneName}/`}>
              /workflows/{sanitizedSceneName}/
            </span>
          </div>
        </div>
      </div>

      {isFailed && errorMessage && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800/60 rounded-lg space-y-2 text-xs">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-800 dark:text-red-200">Scene Staging Failed</p>
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
              onClick={handleSendScene}
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

      <div className="pt-2">
        <button
          onClick={handleSendScene}
          disabled={sceneProject.shots.length === 0 || isTransferring}
          className={`w-full py-3 rounded-lg flex items-center justify-center gap-2 font-bold transition-all shadow-md ${
            sceneProject.shots.length > 0 && !isTransferring
              ? "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20 cursor-pointer"
              : "bg-zinc-200 text-zinc-400 cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-500 shadow-none"
          }`}
        >
          {isTransferring && lastAction === "scene" ? (
            <>
              <Terminal className="w-4 h-4 animate-pulse text-white" />
              <span className="text-white">Staging Scene...</span>
            </>
          ) : (
            <>
              <UploadCloud className="w-4 h-4 text-white" />
              <span className="text-white">Send Scene</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
