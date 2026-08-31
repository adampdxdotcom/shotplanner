import React from "react";
import { Layers, Terminal, UploadCloud } from "lucide-react";
import { SceneProjectFile } from "../../types";

export interface SendScenePanelProps {
  sceneProject: SceneProjectFile;
  sanitizedSceneName: string;
  allSceneAssets: string[];
  isTransferring: boolean;
  lastAction: "shot" | "scene" | null;
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
    <div className="bg-zinc-900/80 border-2 border-amber-500/30 shadow-[0_0_15px_-3px_rgba(245,158,11,0.1)] p-5 rounded-xl flex flex-col justify-between space-y-4">
      <div className="space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-amber-100">Send Scene</h2>
            <p className="text-xs text-zinc-400">Batch stage all shots in the scene.</p>
          </div>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-zinc-500">Total Shots:</span>
            <span className="text-amber-300 font-bold">{sceneProject.shots.length} shot(s)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Total Distinct Assets:</span>
            <span className="text-zinc-300">{allSceneAssets.length} unique image files</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Target Folder:</span>
            <span className="text-zinc-300 font-mono">/workflows/{sanitizedSceneName}/</span>
          </div>
        </div>
      </div>

      <button
        onClick={handleSendScene}
        disabled={sceneProject.shots.length === 0 || isTransferring}
        className={`w-full py-3 rounded-lg flex items-center justify-center gap-2 font-bold transition-all ${
          sceneProject.shots.length > 0 && !isTransferring
            ? "bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/20"
            : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
        }`}
      >
        {isTransferring && lastAction === "scene" ? (
          <>
            <Terminal className="w-4 h-4 animate-pulse" />
            <span>Staging Scene...</span>
          </>
        ) : (
          <>
            <UploadCloud className="w-4 h-4" />
            <span>Send Scene</span>
          </>
        )}
      </button>
    </div>
  );
};
