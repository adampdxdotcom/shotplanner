import React from "react";
import { Camera, Terminal, UploadCloud } from "lucide-react";
import { ShotItem } from "../../types";
import { formatShotNumber } from "../../utils/formatters";

export interface SendShotPanelProps {
  activeShot: ShotItem | null | undefined;
  sanitizedSceneName: string;
  activeShotAssets: string[];
  isTransferring: boolean;
  lastAction: "shot" | "scene" | null;
  handleSendShot: () => void;
}

export const SendShotPanel: React.FC<SendShotPanelProps> = ({
  activeShot,
  sanitizedSceneName,
  activeShotAssets,
  isTransferring,
  lastAction,
  handleSendShot
}) => {
  return (
    <div className={`p-5 rounded-xl border-2 flex flex-col justify-between space-y-4 ${
      activeShot 
        ? "bg-zinc-900/80 border-indigo-500/30 shadow-[0_0_15px_-3px_rgba(99,102,241,0.1)]" 
        : "bg-zinc-900/40 border-zinc-800 opacity-70"
    }`}>
      <div className="space-y-4">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-lg ${activeShot ? "bg-indigo-500/20 text-indigo-400" : "bg-zinc-800 text-zinc-500"}`}>
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h2 className={`text-lg font-bold ${activeShot ? "text-indigo-100" : "text-zinc-500"}`}>Send Shot</h2>
            <p className="text-xs text-zinc-400">Stage only the active shot.</p>
          </div>
        </div>

        {!activeShot ? (
          <div className="py-8 text-center border border-dashed border-zinc-800 rounded-lg">
            <p className="text-sm text-zinc-500">Select a shot to stage.</p>
          </div>
        ) : (
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500">Shot Name:</span>
              <span className="text-zinc-300 font-mono">{sanitizedSceneName}_Shot_{formatShotNumber(activeShot.shot_number)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Workflow:</span>
              <span className="text-zinc-300 font-mono truncate max-w-[200px]" title={`${sanitizedSceneName}_Shot_{formatShotNumber(activeShot.shot_number)}.json`}>
                {sanitizedSceneName}_Shot_{formatShotNumber(activeShot.shot_number)}.json
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Active Assets:</span>
              <span className="text-zinc-300">{activeShotAssets.length} files</span>
            </div>
            {activeShotAssets.length > 0 && (
              <div className="pt-2 border-t border-zinc-800/50 text-[10px] text-zinc-500 break-words">
                {activeShotAssets.join(", ")}
              </div>
            )}
          </div>
        )}
      </div>

      <button
        onClick={handleSendShot}
        disabled={!activeShot || isTransferring}
        className={`w-full py-3 rounded-lg flex items-center justify-center gap-2 font-bold transition-all ${
          activeShot && !isTransferring
            ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/20"
            : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
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
            <span>Send Shot</span>
          </>
        )}
      </button>
    </div>
  );
};
