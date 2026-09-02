import React, { useMemo } from "react";
import { UploadCloud, Sparkles, Check, RotateCcw, Layers } from "lucide-react";
import { ShotItem, computePrePromptContext } from "../../types";

interface PromptEngineeringPanelProps {
  activeShot: ShotItem;
  projectShotsLength: number;
  isExpanding: boolean;
  isTransferring: boolean;
  isTransferringScene: boolean;
  onUpdateStub: (stub: string) => void;
  onUpdateExpandedPrompt: (prompt: string) => void;
  onExpandPrompt: () => void;
  onTransferShot: () => void;
  onTransferScene: () => void;
  onOpenStagingStudio?: () => void;
}

export const PromptEngineeringPanel: React.FC<PromptEngineeringPanelProps> = ({
  activeShot,
  projectShotsLength,
  isExpanding,
  isTransferring,
  isTransferringScene,
  onUpdateStub,
  onUpdateExpandedPrompt,
  onExpandPrompt,
  onTransferShot,
  onTransferScene,
  onOpenStagingStudio
}) => {
  const isLivePreview = !activeShot.expanded_prompt || !activeShot.expanded_prompt.trim();

  const livePrePromptContext = useMemo(() => {
    return computePrePromptContext({
      shotNumber: activeShot.shot_number,
      shotType: activeShot.shot_type,
      lensFocalLength: activeShot.lens_focal_length,
      cameraMovement: activeShot.camera_movement,
      aspectRatio: activeShot.aspect_ratio,
      otsAnchorSubject: activeShot.ots_anchor_subject,
      otsFocusSubject: activeShot.ots_focus_subject,
      otsSide: activeShot.ots_side,
      basicStub: activeShot.basic_stub
    });
  }, [
    activeShot.shot_number,
    activeShot.shot_type,
    activeShot.lens_focal_length,
    activeShot.camera_movement,
    activeShot.aspect_ratio,
    activeShot.ots_anchor_subject,
    activeShot.ots_focus_subject,
    activeShot.ots_side,
    activeShot.basic_stub
  ]);

  const displayedPrompt = isLivePreview ? livePrePromptContext : activeShot.expanded_prompt;

  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">Prompt Engineering & Staging</h2>
        {onOpenStagingStudio && (
          <button
            type="button"
            onClick={onOpenStagingStudio}
            className="text-xs font-semibold text-indigo-300 hover:text-white bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-800/60 px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            title="Open AI Reference & Staging Studio"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Staging Studio</span>
          </button>
        )}
      </div>
      
      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-400">Concept Stub</label>
        <textarea 
          value={activeShot.basic_stub}
          onChange={e => onUpdateStub(e.target.value)}
          placeholder="Describe the action and setting..."
          className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-3 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none resize-none h-24"
        />
      </div>
      
      <div className="flex justify-end">
        <button 
          onClick={onExpandPrompt}
          disabled={isExpanding || !activeShot.basic_stub.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer"
        >
          {isExpanding ? "Expanding..." : "Expand Prompt"}
        </button>
      </div>
      
      <div className="flex-1 space-y-2 min-h-0 flex flex-col">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            {isLivePreview ? "Live Pre-Prompt Context Preview" : "Final Expanded Prompt"}
          </label>
          {!isLivePreview && (
            <button
              type="button"
              onClick={() => onUpdateExpandedPrompt("")}
              className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
              title="Reset to live context preview"
            >
              <RotateCcw className="w-3 h-3" />
              Reset to Preview
            </button>
          )}
        </div>
        <textarea 
          value={displayedPrompt}
          onChange={e => onUpdateExpandedPrompt(e.target.value)}
          placeholder="Expanded MiniMax-H3 prompt will appear here..."
          className={`w-full flex-1 bg-zinc-950 border rounded-md px-3 py-3 text-sm text-zinc-300 outline-none resize-none font-mono ${
            isLivePreview ? "border-amber-500/40 focus:border-amber-500" : "border-zinc-800 focus:border-indigo-500"
          }`}
        />
      </div>
      
      <div className="pt-2 border-t border-zinc-800/80 flex flex-col gap-2">
        <button
          onClick={onTransferShot}
          disabled={isTransferring || !activeShot.expanded_prompt}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow cursor-pointer"
        >
          <UploadCloud className="w-5 h-5" />
          {isTransferring ? "Sending Shot..." : "Send Shot"}
        </button>
        <button
          onClick={onTransferScene}
          disabled={isTransferringScene || projectShotsLength === 0}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow cursor-pointer"
        >
          <UploadCloud className="w-5 h-5" />
          {isTransferringScene ? "Sending Scene..." : "Send Scene"}
        </button>
      </div>
    </div>
  );
};
