import React from "react";
import { Film, Plus, Layers, Sparkles } from "lucide-react";
import { ParsedSceneSketchShot } from "../../../types";
import { ResolvedShotCharacters } from "../../../utils/sceneSketchResolver";
import { StagedShotRow } from "./StagedShotRow";

interface StagedShotsListProps {
  stagedSceneTitle: string;
  onSceneTitleChange: (title: string) => void;
  cleanImport: boolean;
  providerUsed: string;
  stagedShots: ParsedSceneSketchShot[];
  resolvedShots: ResolvedShotCharacters[];
  onAddShot: () => void;
  onUpdateShotField: (index: number, field: keyof ParsedSceneSketchShot, value: any) => void;
  onDeleteShot: (index: number) => void;
  onRemoveCharacterFromShot: (shotIdx: number, charName: string) => void;
}

export const StagedShotsList: React.FC<StagedShotsListProps> = ({
  stagedSceneTitle,
  onSceneTitleChange,
  cleanImport,
  providerUsed,
  stagedShots,
  resolvedShots,
  onAddShot,
  onUpdateShotField,
  onDeleteShot,
  onRemoveCharacterFromShot
}) => {
  return (
    <div className="space-y-6">
      {/* Scene Title Bar & Summary */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
        <div className="flex-1 min-w-[240px]">
          <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block mb-1">
            Scene Title
          </label>
          <input
            type="text"
            value={stagedSceneTitle}
            onChange={(e) => onSceneTitleChange(e.target.value)}
            placeholder="e.g. Observation Deck Confrontation"
            className="w-full px-3 py-1.5 text-sm font-semibold rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap">
          <span className="px-2.5 py-1 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 font-medium flex items-center gap-1.5">
            {cleanImport ? (
              <>
                <Layers className="w-3.5 h-3.5 text-zinc-400" />
                <span>Clean Import (Neutral)</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-amber-500 font-semibold">Artistic Director</span>
              </>
            )}
          </span>
          <span className="px-2.5 py-1 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 font-medium">
            Parsed via: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{providerUsed}</span>
          </span>
        </div>
      </div>

      {/* Shots Staging List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
            <Film className="w-3.5 h-3.5 text-indigo-500" />
            Parsed Shots ({stagedShots.length})
          </h3>

          <button
            type="button"
            onClick={onAddShot}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Shot
          </button>
        </div>

        {stagedShots.map((shot, idx) => (
          <StagedShotRow
            key={idx}
            index={idx}
            shot={shot}
            shotRes={resolvedShots[idx]}
            onUpdateField={(field, val) => onUpdateShotField(idx, field, val)}
            onDelete={() => onDeleteShot(idx)}
            onRemoveCharacter={(charName) => onRemoveCharacterFromShot(idx, charName)}
          />
        ))}
      </div>
    </div>
  );
};
