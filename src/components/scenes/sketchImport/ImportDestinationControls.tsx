import React from "react";
import { SketchImportMode } from "./types";

interface ImportDestinationControlsProps {
  importMode: SketchImportMode;
  onImportModeChange: (mode: SketchImportMode) => void;
  existingShotsCount: number;
  stagedShotsCount: number;
}

export const ImportDestinationControls: React.FC<ImportDestinationControlsProps> = ({
  importMode,
  onImportModeChange,
  existingShotsCount,
  stagedShotsCount
}) => {
  return (
    <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 space-y-3">
      <label className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 block">
        Import Destination Mode
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label 
          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
            importMode === "append"
              ? "bg-white dark:bg-zinc-900 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs"
              : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40"
          }`}
        >
          <input
            type="radio"
            name="importMode"
            value="append"
            checked={importMode === "append"}
            onChange={() => onImportModeChange("append")}
            className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
          />
          <div>
            <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
              Append to Existing Scene ({existingShotsCount} Existing)
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              New shots will start at #{existingShotsCount + 1} through #{existingShotsCount + stagedShotsCount}.
            </div>
          </div>
        </label>

        <label 
          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
            importMode === "replace"
              ? "bg-white dark:bg-zinc-900 border-red-500 ring-2 ring-red-500/20 shadow-xs"
              : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40"
          }`}
        >
          <input
            type="radio"
            name="importMode"
            value="replace"
            checked={importMode === "replace"}
            onChange={() => onImportModeChange("replace")}
            className="mt-0.5 text-red-600 focus:ring-red-500"
          />
          <div>
            <div className="text-xs font-bold text-red-700 dark:text-red-400">
              Replace All Existing Shots in Scene
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              Replaces the current shot list with these {stagedShotsCount} parsed shots.
            </div>
          </div>
        </label>
      </div>
    </div>
  );
};
