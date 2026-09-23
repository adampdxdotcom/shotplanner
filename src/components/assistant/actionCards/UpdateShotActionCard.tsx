import React from "react";
import { Camera, Check, Undo2, Sparkles, ArrowRight, X } from "lucide-react";
import { UpdateShotAction, AssistantAction } from "../../../types/assistantActions";
import { CharacterProfile, MediaAsset, ShotItem } from "../../../types";
import { StagedCastReferencePreview } from "./StagedCastReferencePreview";
import { ShotThumbnailPreview } from "./ShotThumbnailPreview";

interface UpdateShotActionCardProps {
  action: UpdateShotAction;
  isApplied: boolean;
  shots?: ShotItem[];
  characters?: Record<string, CharacterProfile>;
  assets?: MediaAsset[];
  sceneName?: string;
  onNavigateToSection?: (section: string) => void;
  onApply: (action: AssistantAction) => void;
  onDismiss?: (action: AssistantAction) => void;
  onUndo?: (action: AssistantAction) => void;
}

/**
 * Action card rendering proposed updates to an existing shot (framing, lens, cast, lighting, stub, and bundled cast references).
 */
export const UpdateShotActionCard: React.FC<UpdateShotActionCardProps> = ({
  action,
  isApplied,
  shots = [],
  characters: allCharacters = {},
  assets = [],
  sceneName,
  onNavigateToSection,
  onApply,
  onDismiss,
  onUndo
}) => {
  const shotNum = action.shot_number;
  const changes = action.changes || {};
  const targetShot = shots.find(s => s.shot_number === shotNum);

  return (
    <div className={`mt-3 p-3 rounded-xl border transition-all text-xs w-full min-w-0 overflow-hidden ${
      isApplied 
        ? "bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-200" 
        : "bg-slate-50 dark:bg-zinc-900/90 border-indigo-200/80 dark:border-indigo-500/30 shadow-xs"
    }`}>
      <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-200/70 dark:border-zinc-800 min-w-0">
        <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-zinc-100 min-w-0 flex-1">
          <Camera className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span className="shrink-0">Update Shot #{shotNum}</span>
          {action.title && (
            <span className="text-slate-500 dark:text-zinc-400 font-normal truncate min-w-0 flex-1">
              • {action.title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 shrink-0 whitespace-nowrap">
            Shot Update
          </span>
          {!isApplied && onDismiss && (
            <button
              onClick={() => onDismiss(action)}
              className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded transition-colors shrink-0 cursor-pointer"
              title="Dismiss suggestion"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Shot Thumbnail Preview */}
      <ShotThumbnailPreview
        shot={targetShot}
        shotNumber={typeof shotNum === "string" ? parseInt(shotNum, 10) || 1 : shotNum}
        assets={assets}
        sceneName={sceneName}
      />

      {/* Changes summary */}
      <div className="space-y-1 my-2 font-mono text-[11px] text-slate-700 dark:text-zinc-300">
        {changes.shot_name && (
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 dark:text-zinc-500">Name:</span>
            <strong className="text-slate-800 dark:text-zinc-200 font-medium">{changes.shot_name}</strong>
          </div>
        )}
        {changes.shot_type && (
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 dark:text-zinc-500">Framing:</span>
            <strong className="text-slate-800 dark:text-zinc-200 font-medium">{changes.shot_type}</strong>
          </div>
        )}
        {changes.lens_focal_length && (
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 dark:text-zinc-500">Lens:</span>
            <strong className="text-slate-800 dark:text-zinc-200 font-medium">{changes.lens_focal_length}</strong>
          </div>
        )}
        {changes.camera_movement && (
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 dark:text-zinc-500">Movement:</span>
            <strong className="text-slate-800 dark:text-zinc-200 font-medium">{changes.camera_movement}</strong>
          </div>
        )}
        {changes.camera_angle && (
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 dark:text-zinc-500">Angle:</span>
            <strong className="text-slate-800 dark:text-zinc-200 font-medium">{changes.camera_angle}</strong>
          </div>
        )}
        {changes.lighting_setup && (
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 dark:text-zinc-500">Lighting:</span>
            <span className="text-slate-800 dark:text-zinc-200">{changes.lighting_setup}</span>
          </div>
        )}
        {changes.characters && changes.characters.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 dark:text-zinc-500">Cast:</span>
            <div className="flex flex-wrap gap-1">
              {changes.characters.map((c, i) => (
                <span key={i} className="px-1.5 py-0.2 bg-slate-200/80 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded text-[10px] font-sans font-medium">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
        {changes.basic_stub && (
          <div className="mt-1 pt-1 border-t border-slate-200/50 dark:border-zinc-800">
            <span className="text-slate-400 dark:text-zinc-500 block mb-0.5">Prompt Stub:</span>
            <p className="font-sans text-[11px] text-slate-800 dark:text-zinc-200 bg-white dark:bg-zinc-950 p-1.5 rounded border border-slate-200 dark:border-zinc-800">
              {changes.basic_stub}
            </p>
          </div>
        )}

        {/* Workflow Generation Parameters Preview */}
        {changes.generation_params && Object.keys(changes.generation_params).length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-200/50 dark:border-zinc-800">
            <span className="text-slate-400 dark:text-zinc-500">Workflow Params:</span>
            <div className="flex flex-wrap gap-1">
              {changes.generation_params.steps !== undefined && (
                <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 text-[10px] font-sans font-medium">
                  {changes.generation_params.steps} steps
                </span>
              )}
              {changes.generation_params.megapixels !== undefined && (
                <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 text-[10px] font-sans font-medium">
                  {changes.generation_params.megapixels} MP
                </span>
              )}
              {changes.generation_params.frames !== undefined && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-[10px] font-sans font-medium">
                  {changes.generation_params.frames}s duration
                </span>
              )}
            </div>
          </div>
        )}

        {/* Bundled Cast Card References Preview */}
        {changes.characters && changes.characters.length > 0 && (
          <StagedCastReferencePreview
            characters={changes.characters}
            allCharacters={allCharacters}
            assets={assets}
            sceneName={sceneName}
            isApplied={isApplied}
            onNavigateToSection={onNavigateToSection}
          />
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-2.5 pt-1.5 flex items-center justify-between gap-2 border-t border-slate-200/60 dark:border-zinc-800">
        {isApplied ? (
          <div className="flex items-center justify-between w-full flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <Check className="w-3.5 h-3.5" /> Applied to Shot #{shotNum}
              </span>
              {(changes.expanded_prompt || changes.basic_stub) && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 flex items-center gap-1 shadow-2xs">
                  <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                  <span>Added as New Variation</span>
                </span>
              )}
            </div>
            {onUndo && (
              <button
                onClick={() => onUndo(action)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-200/80 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-[10.5px] font-semibold transition-colors cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Undo</span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 w-full">
            <button
              onClick={() => onApply(action)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Apply to Shot #{shotNum}</span>
              <ArrowRight className="w-3 h-3 ml-0.5" />
            </button>
            {onDismiss && (
              <button
                onClick={() => onDismiss(action)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-200/70 hover:bg-slate-300/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 font-medium text-xs transition-colors cursor-pointer"
                title="Dismiss suggestion"
              >
                Dismiss
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
