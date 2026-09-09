import React from "react";
import { Layers, Film, Zap, Sparkles, Check } from "lucide-react";
import { SceneProjectFile } from "../../types";

export interface StagingStudioHeaderProps {
  sceneProject?: SceneProjectFile;
  activeShotId?: string | null;
  onSelectShot?: (id: string | null) => void;
  activeSubject: string;
  setActiveSubject: (subject: string) => void;
  availableCharacters: string[];
  activeTab: "headshots" | "staging";
  setActiveTab: (tab: "headshots" | "staging") => void;
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
                Staging Studio
              </h1>
              <span className="text-[10px] font-semibold text-indigo-300 bg-indigo-950/80 border border-indigo-800/60 px-2 py-0.5 rounded-full">
                Director's 2D Stage
              </span>

              {/* Subtle Autosave Status Indicator */}
              {saveStatus && (
                <div 
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                    saveStatus === "saving"
                      ? "bg-amber-500/10 border border-amber-500/30 text-amber-300"
                      : saveStatus === "saved"
                      ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-400"
                      : saveStatus === "error"
                      ? "bg-red-500/10 border border-red-500/25 text-red-400"
                      : "bg-zinc-800/80 border border-zinc-700/60 text-zinc-400"
                  }`}
                  title={lastSavedAt ? `Last autosaved at ${lastSavedAt.toLocaleTimeString()}` : undefined}
                >
                  {saveStatus === "saving" ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                      <span className="tracking-tight">● Saving draft...</span>
                    </>
                  ) : saveStatus === "saved" ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span className="tracking-tight">✓ Saved</span>
                      {lastSavedAt && (
                        <span className="hidden sm:inline text-[9px] text-zinc-500 font-mono">
                          {lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                      )}
                    </>
                  ) : saveStatus === "error" ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                      <span>Save error</span>
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 shrink-0" />
                      <span>Drafting</span>
                    </>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Block character spatial placement, composite multi-actor references, and stage shots
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
      <div className="flex items-center justify-between border-t border-zinc-800/80 pt-3">
        <div className="flex items-center gap-1 bg-zinc-950/60 p-1 rounded-lg border border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveTab("staging")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "staging"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-900/60"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Scene Staging &amp; Blocking</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-black/10 dark:bg-white/10 rounded font-mono">
              Stage
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("headshots")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "headshots"
                ? "bg-amber-600 text-white shadow-xs"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-900/60"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>AI Headshots &amp; Variations</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-black/10 dark:bg-white/10 rounded font-mono">
              Gemini
            </span>
          </button>
        </div>

        <div className="hidden md:flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          {activeTab === "staging" ? (
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              Director's 2D Blocking Stage • Multi-Actor Spatial Layout &amp; Slot Assignment
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              Gemini 3.1 Flash Image • Photorealistic Multi-Angle Headshot Generation
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
