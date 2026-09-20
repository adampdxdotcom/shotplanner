import React from "react";
import { Layers, Zap, LayoutGrid, Clapperboard } from "lucide-react";
import { SceneProjectFile } from "../../types";
import { StagingWorkspaceTab } from "../../utils/workspaceSessionStore";

export interface StagingStudioHeaderProps {
  sceneProject?: SceneProjectFile;
  activeShotId?: string | null;
  onSelectShot?: (id: string | null) => void;
  activeSubject?: string;
  setActiveSubject?: (subject: string) => void;
  availableCharacters?: string[];
  activeTab: StagingWorkspaceTab;
  setActiveTab: (tab: StagingWorkspaceTab) => void;
  saveStatus?: "saved" | "saving" | "unsaved" | "error";
  lastSavedAt?: Date | null;
}

export const StagingStudioHeader: React.FC<StagingStudioHeaderProps> = ({
  activeTab,
  setActiveTab,
}) => {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 sm:p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shadow-inner shrink-0">
          <Layers className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            Asset Creation
          </h1>
        </div>
      </div>

      {/* WORKSPACE SUB-TABS */}
      <div className="border-t border-zinc-800/80 pt-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5 bg-zinc-950/60 p-1 rounded-lg border border-zinc-800 w-full">
          <button
            id="tab-staging"
            type="button"
            onClick={() => setActiveTab("staging")}
            className={`w-full justify-center px-3 py-2 text-xs font-semibold rounded-md flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "staging"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Scene Staging &amp; Blocking</span>
          </button>

          <button
            id="tab-first-frame"
            type="button"
            onClick={() => setActiveTab("first_frame")}
            className={`w-full justify-center px-3 py-2 text-xs font-semibold rounded-md flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "first_frame"
                ? "bg-purple-600 text-white shadow-xs"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
            }`}
          >
            <Clapperboard className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">First Frame</span>
          </button>

          <button
            id="tab-headshots"
            type="button"
            onClick={() => setActiveTab("headshots")}
            className={`w-full justify-center px-3 py-2 text-xs font-semibold rounded-md flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "headshots"
                ? "bg-amber-600 text-white shadow-xs"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
            }`}
          >
            <Zap className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">AI Headshots &amp; Variations</span>
          </button>

          <button
            id="tab-sheets"
            type="button"
            onClick={() => setActiveTab("sheets")}
            className={`w-full justify-center px-3 py-2 text-xs font-semibold rounded-md flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "sheets"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Reference Sheets</span>
          </button>
        </div>
      </div>
    </div>
  );
};
