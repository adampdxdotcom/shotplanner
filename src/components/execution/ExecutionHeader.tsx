import React from "react";
import { Film } from "lucide-react";
import { SceneProjectFile } from "../../types";

export interface ExecutionHeaderProps {
  activeSceneName: string;
  activeShotId: string | null;
  sceneProject: SceneProjectFile;
  onSelectShot: (id: string | null) => void;
}

export const ExecutionHeader: React.FC<ExecutionHeaderProps> = ({
  activeSceneName,
  activeShotId,
  sceneProject,
  onSelectShot
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800 shadow-sm">
      <div className="flex items-center gap-3">
        <Film className="w-5 h-5 text-zinc-400" />
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Loaded Scene</span>
          <span className="text-sm font-medium text-zinc-200">{activeSceneName}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-zinc-300">Shot Context:</label>
        <select 
          value={activeShotId || ""}
          onChange={(e) => onSelectShot(e.target.value || null)}
          className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none min-w-[250px]"
        >
          <option key="empty" value="">-- Select a Shot to Stage --</option>
          {sceneProject.shots.map(s => (
            <option key={s.id} value={s.id}>
              Shot {s.shot_number.toString().padStart(2, '0')} - {s.shot_type}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
