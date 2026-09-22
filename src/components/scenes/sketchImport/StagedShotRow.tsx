import React from "react";
import { Trash2, Camera, Film, Aperture, Users, User, Globe } from "lucide-react";
import { ParsedSceneSketchShot } from "../../../types";
import { ResolvedShotCharacters } from "../../../utils/sceneSketchResolver";
import { 
  SHOT_TYPES, 
  CAMERA_MOVEMENTS, 
  LENS_PRESETS 
} from "../../ScenePlanningHeader";

interface StagedShotRowProps {
  index: number;
  shot: ParsedSceneSketchShot;
  shotRes?: ResolvedShotCharacters;
  onUpdateField: (field: keyof ParsedSceneSketchShot, value: any) => void;
  onDelete: () => void;
  onRemoveCharacter: (charName: string) => void;
}

export const StagedShotRow: React.FC<StagedShotRowProps> = ({
  index,
  shot,
  shotRes,
  onUpdateField,
  onDelete,
  onRemoveCharacter
}) => {
  return (
    <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-900/90 shadow-xs space-y-3 transition-colors">
      {/* Shot Row Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <span className="px-2 py-0.5 text-xs font-bold font-mono rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            Shot {shot.shot_number}
          </span>
          <input
            type="text"
            value={shot.shot_name}
            onChange={(e) => onUpdateField("shot_name", e.target.value)}
            placeholder="Shot descriptor"
            className="flex-1 max-w-xs px-2.5 py-1 text-xs font-semibold rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          title="Delete shot"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Basic Stub Text */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block mb-1">
          Prompt Action Stub
        </label>
        <textarea
          value={shot.basic_stub}
          onChange={(e) => onUpdateField("basic_stub", e.target.value)}
          rows={2}
          className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 leading-relaxed font-sans"
        />
      </div>

      {/* Cinematography Parameters Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
        {/* Framing / Shot Type */}
        <div>
          <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mb-1">
            <Camera className="w-3 h-3 text-zinc-400" />
            Framing
          </label>
          <select
            value={shot.shot_type}
            onChange={(e) => onUpdateField("shot_type", e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            {SHOT_TYPES.map((st) => (
              <option key={st.value} value={st.value}>
                {st.label}
              </option>
            ))}
          </select>
        </div>

        {/* Camera Movement */}
        <div>
          <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mb-1">
            <Film className="w-3 h-3 text-zinc-400" />
            Movement
          </label>
          <select
            value={shot.camera_movement}
            onChange={(e) => onUpdateField("camera_movement", e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            {CAMERA_MOVEMENTS.map((cm) => (
              <option key={cm.value} value={cm.value}>
                {cm.label}
              </option>
            ))}
          </select>
        </div>

        {/* Lens Preset */}
        <div>
          <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mb-1">
            <Aperture className="w-3 h-3 text-zinc-400" />
            Lens
          </label>
          <select
            value={shot.lens_focal_length}
            onChange={(e) => onUpdateField("lens_focal_length", e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            {LENS_PRESETS.map((lp) => (
              <option key={lp.value} value={lp.value}>
                {lp.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Detected Character Badges */}
      <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 mr-1 flex items-center gap-1">
          <Users className="w-3 h-3" /> Cast:
        </span>

        {(!shotRes || shotRes.characters.length === 0) ? (
          <span className="text-[11px] text-zinc-400 italic">No specific characters detected</span>
        ) : (
          shotRes.characters.map((charItem, charIdx) => {
            if (charItem.status === "in_scene") {
              return (
                <span
                  key={charIdx}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[10px] font-semibold"
                >
                  <User className="w-2.5 h-2.5" />
                  {charItem.cleanName}
                  <span className="text-[8px] opacity-75 font-normal">(In Scene)</span>
                  <button
                    type="button"
                    onClick={() => onRemoveCharacter(charItem.rawName)}
                    className="ml-0.5 hover:text-red-500 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              );
            }

            if (charItem.status === "in_universe") {
              return (
                <span
                  key={charIdx}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-300 text-[10px] font-semibold"
                  title="Exists in Universe. Will be imported into this scene upon submit."
                >
                  <Globe className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                  {charItem.cleanName}
                  <span className="text-[8px] font-bold text-amber-700 dark:text-amber-400">(Universe)</span>
                  <button
                    type="button"
                    onClick={() => onRemoveCharacter(charItem.rawName)}
                    className="ml-0.5 hover:text-red-500 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              );
            }

            return (
              <span
                key={charIdx}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] font-medium"
              >
                {charItem.cleanName}
                <span className="text-[8px] text-zinc-400">(Unassigned)</span>
                <button
                  type="button"
                  onClick={() => onRemoveCharacter(charItem.rawName)}
                  className="ml-0.5 hover:text-red-500 cursor-pointer"
                >
                  ×
                </button>
              </span>
            );
          })
        )}
      </div>
    </div>
  );
};
