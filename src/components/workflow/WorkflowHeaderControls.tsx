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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm font-medium text-zinc-300 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-indigo-400" />
            Active Shot for Mapping:
          </label>
          <select
            value={activeShotId || ""}
            onChange={(e) => onSelectShot(e.target.value || null)}
            className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none min-w-[280px]"
          >
            <option value="">-- Select a Shot to configure --</option>
            {shots.map(shot => (
              <option key={shot.id} value={shot.id}>
                Shot {shot.shot_number}: {shot.scene_name}
              </option>
            ))}
          </select>
        </div>
        {activeShot && (
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-medium">
              Prompt {activeShot.expanded_prompt ? "✅" : "❌"}
            </span>
            {activeShot.workflow_file ? (
              <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                {activeShot.workflow_file}
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                No Workflow
              </span>
            )}
          </div>
        )}
      </div>
  );
};
