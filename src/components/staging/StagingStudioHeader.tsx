import React from "react";
import { Layers, Film, Zap, LayoutGrid } from "lucide-react";
import { SceneProjectFile } from "../../types";

export interface StagingStudioHeaderProps {
  sceneProject?: SceneProjectFile;
  activeShotId?: string | null;
  onSelectShot?: (id: string | null) => void;
  activeSubject: string;
  setActiveSubject: (subject: string) => void;
  availableCharacters: string[];
  activeTab: "headshots" | "staging" | "sheets";
  setActiveTab: (tab: "headshots" | "staging" | "sheets") => void;
  saveStatus?: "saved" | "saving" | "unsaved" | "error";
  lastSavedAt?: Date | null;
}

export const StagingStudioHeader: React.FC<StagingStudioHeaderProps> = ({
  sceneProject,
  activeShotId,
  onSelectShot,
  activeSubject,
  setActiveSubject,
  availableCharacters,
  activeTab,
  setActiveTab,
  saveStatus = "saved",
  lastSavedAt
}) => {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 sm:p-5 shadow-sm flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shadow-inner shrink-0">
            <Layers className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Asset Creation
              </h1>
              <span className="text-[10px] font-semibold text-indigo-300 bg-indigo-950/80 border border-indigo-800/60 px-2 py-0.5 rounded-full">
                Director's Workbench
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Stage multi-actor blocking, generate AI character headshots, and assemble multi-panel reference sheets
            </p>
          </div>
        </div>

        {/* ACTIVE SHOT & CHARACTER CONTEXT SELECTORS */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Active Shot Selector */}
          {sceneProject && onSelectShot && (
            <div className="flex items-center gap-1.5 bg-zinc-950/80 border border-zinc-800 rounded-lg px-2.5 py-1.5 shadow-inner">
              <Film className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span className="text-xs text-zinc-400">Target Shot:</span>
              <select
                value={activeShotId || ""}
                onChange={(e) => onSelectShot(e.target.value || null)}
                className="bg-transparent text-xs font-semibold text-indigo-300 outline-none cursor-pointer"
              >
                <option value="" className="bg-zinc-900 text-zinc-400">-- None Selected --</option>
                {sceneProject.shots.map((s, idx) => (
                  <option key={s.id} value={s.id} className="bg-zinc-900 text-zinc-200">
                    Shot {s.shot_number || idx + 1}: {s.shot_name || `Shot ${idx + 1}`} ({s.status || "unstaged"})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Active Character Selector */}
          <div className="flex items-center gap-1.5 bg-zinc-950/80 border border-zinc-800 rounded-lg px-2.5 py-1.5 shadow-inner">
            <span className="text-xs text-zinc-400">Actor:</span>
            <select
              value={activeSubject}
              onChange={(e) => setActiveSubject(e.target.value)}
              className="bg-transparent text-xs font-semibold text-amber-400 outline-none cursor-pointer"
            >
              {availableCharacters.map(char => (
                <option key={char} value={char} className="bg-zinc-900 text-amber-300">
                  {char}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* WORKSPACE SUB-TABS */}
      <div className="border-t border-zinc-800/80 pt-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 bg-zinc-950/60 p-1 rounded-lg border border-zinc-800 w-full">
          <button
            id="tab-staging"
            type="button"
            onClick={() => setActiveTab("staging")}
            className={`w-full justify-center px-3.5 py-2 text-xs font-semibold rounded-md flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "staging"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span>Scene Staging &amp; Blocking</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-black/20 dark:bg-white/10 rounded font-mono shrink-0">
              Stage
            </span>
          </button>

          <button
            id="tab-headshots"
            type="button"
            onClick={() => setActiveTab("headshots")}
            className={`w-full justify-center px-3.5 py-2 text-xs font-semibold rounded-md flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "headshots"
                ? "bg-amber-600 text-white shadow-xs"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
            }`}
          >
            <Zap className="w-3.5 h-3.5 shrink-0" />
            <span>AI Headshots &amp; Variations</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-black/20 dark:bg-white/10 rounded font-mono shrink-0">
              Gemini
            </span>
          </button>

          <button
            id="tab-sheets"
            type="button"
            onClick={() => setActiveTab("sheets")}
            className={`w-full justify-center px-3.5 py-2 text-xs font-semibold rounded-md flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "sheets"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
            <span>Reference Sheets</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-black/20 dark:bg-white/10 rounded font-mono shrink-0">
              Panels
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
