import React from "react";
import { Layers, Terminal, UploadCloud } from "lucide-react";
import { SceneProjectFile } from "../../types";

export interface SendScenePanelProps {
  sceneProject: SceneProjectFile;
  sanitizedSceneName: string;
  allSceneAssets: string[];
  isTransferring: boolean;
  lastAction: "shot" | "scene" | "execute_shot" | null;
  handleSendScene: () => void;
}

export const SendScenePanel: React.FC<SendScenePanelProps> = ({
  sceneProject,
  sanitizedSceneName,
  allSceneAssets,
  isTransferring,
  lastAction,
  handleSendScene
}) => {
  return (
    <div className="send-scene-box bg-white dark:bg-zinc-900/80 border-2 border-amber-400/60 dark:border-amber-500/30 shadow-sm dark:shadow-[0_0_15px_-3px_rgba(245,158,11,0.1)] p-5 rounded-xl flex flex-col justify-between space-y-4 transition-all">
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
