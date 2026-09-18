import React from "react";
import { User, Check, Undo2, Sparkles, ArrowRight, X } from "lucide-react";
import { UpdateCharacterAction, AssistantAction } from "../../../types/assistantActions";

interface UpdateCharacterActionCardProps {
  action: UpdateCharacterAction;
  isApplied: boolean;
  onApply: (action: AssistantAction) => void;
  onDismiss?: (action: AssistantAction) => void;
  onUndo?: (action: AssistantAction) => void;
}

/**
 * Action card rendering proposed updates to a character profile (wardrobe, references, bio notes).
 */
export const UpdateCharacterActionCard: React.FC<UpdateCharacterActionCardProps> = ({
  action,
  isApplied,
  onApply,
  onDismiss,
  onUndo
}) => {
  const charName = action.character_name || (action as any).name || "Character";
  const changes = action.changes || {};

  return (
    <div className={`mt-3 p-3 rounded-xl border transition-all text-xs w-full min-w-0 overflow-hidden ${
      isApplied 
        ? "bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-200" 
        : "bg-slate-50 dark:bg-zinc-900/90 border-purple-200/80 dark:border-purple-500/30 shadow-xs"
    }`}>
      <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-200/70 dark:border-zinc-800 min-w-0">
        <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-zinc-100 min-w-0 flex-1">
          <User className="w-3.5 h-3.5 text-purple-500 shrink-0" />
          <span className="shrink-0 truncate max-w-[140px]">Character: "{charName}"</span>
          {action.title && (
            <span className="text-slate-500 dark:text-zinc-400 font-normal truncate min-w-0 flex-1">
              • {action.title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 shrink-0 whitespace-nowrap">
            Cast & Wardrobe
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

      {/* Character changes summary */}
      <div className="space-y-1 my-2 font-mono text-[11px] text-slate-700 dark:text-zinc-300">
        {changes.scene_outfit_ref && (
          <div className="flex items-start gap-1.5">
            <span className="text-slate-400 dark:text-zinc-500 shrink-0">Outfit / Wardrobe:</span>
            <span className="text-slate-800 dark:text-zinc-200 font-medium">{changes.scene_outfit_ref}</span>
          </div>
        )}
        {changes.notes && (
          <div className="flex items-start gap-1.5">
            <span className="text-slate-400 dark:text-zinc-500 shrink-0">Character Notes:</span>
            <p className="font-sans text-[11px] text-slate-800 dark:text-zinc-200 bg-white dark:bg-zinc-950 p-1.5 rounded border border-slate-200 dark:border-zinc-800 w-full">
              {changes.notes}
            </p>
          </div>
        )}
      </div>

      {/* Action button */}
      <div className="mt-2.5 pt-1.5 flex items-center justify-between gap-2 border-t border-slate-200/60 dark:border-zinc-800">
        {isApplied ? (
          <div className="flex items-center justify-between w-full">
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <Check className="w-3.5 h-3.5" /> Updated "{charName}"
            </span>
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
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-200" />
              <span>Update Character Profile</span>
              <ArrowRight className="w-3 h-3 ml-0.5" />
            </button>
            {onDismiss && (
              <button
                onClick={() => onDismiss(action)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-200/70 hover:bg-slate-300/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 font-medium text-xs transition-colors cursor-pointer"
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
