import React from "react";
import { Layers, Workflow } from "lucide-react";
import { ShotItem } from "../../types";

interface WorkflowHeaderControlsProps {
  activeShotId: string | null;
  onSelectShot: (id: string | null) => void;
  shots: ShotItem[];
  activeShot: ShotItem | undefined;
}

export const WorkflowHeaderControls: React.FC<WorkflowHeaderControlsProps> = ({
  activeShotId,
  onSelectShot,
  shots,
  activeShot
}) => {
  return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900/60 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Active Shot for Mapping:
          </label>
          <select
            value={activeShotId || ""}
            onChange={(e) => onSelectShot(e.target.value || null)}
            className="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:border-indigo-500 focus:outline-none min-w-[280px] shadow-2xs"
          >
            <option value="">-- Select a Shot to configure --</option>
            {shots.map(shot => (
              <option key={shot.id} value={shot.id}>
                Shot {shot.shot_number}: {shot.shot_name || shot.basic_stub || `Shot #${shot.shot_number}`}
              </option>
            ))}
          </select>
        </div>
        {activeShot && (
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/20 border font-medium">
              Prompt {activeShot.expanded_prompt ? "✅" : "❌"}
            </span>
            {activeShot.workflow_file ? (
              <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20 border font-medium">
                {activeShot.workflow_file}
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 border">
                No Workflow
              </span>
            )}
          </div>
        )}
      </div>
  );
};
