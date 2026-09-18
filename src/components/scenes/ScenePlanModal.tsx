import React, { useState, useEffect, useRef } from "react";
import { Compass, X, Check, Target } from "lucide-react";
import { ScenePlanningDetails } from "../../types";

export interface ScenePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  sceneName?: string;
  scenePlanning?: ScenePlanningDetails;
  onSave: (overarchingGoal: string) => void;
}

/**
 * Modal dialog allowing the director to define and refine the overarching goal
 * for the active scene.
 */
export const ScenePlanModal: React.FC<ScenePlanModalProps> = ({
  isOpen,
  onClose,
  sceneName = "Untitled Scene",
  scenePlanning,
  onSave
}) => {
  const [goalText, setGoalText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync state when modal opens or scenePlanning changes
  useEffect(() => {
    if (isOpen) {
      setGoalText(scenePlanning?.overarching_goal || "");
      // Focus textarea on modal reveal
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, scenePlanning]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(goalText.trim());
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="scene-plan-title"
        className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh] transition-all"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 id="scene-plan-title" className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Scene Plan
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Scene: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{sceneName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label 
                htmlFor="scene-overarching-goal-input"
                className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5"
              >
                <Target className="w-3.5 h-3.5 text-amber-500" />
                Overarching Goal & Dramatic Objective
              </label>
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">
                {goalText.length} characters
              </span>
            </div>
            <textarea
              id="scene-overarching-goal-input"
              ref={textareaRef}
              value={goalText}
              onChange={(e) => setGoalText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={8}
              placeholder="What is the overarching goal for this scene? Describe the core narrative beat, conflict, or dramatic objective..."
              className="w-full px-3.5 py-3 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all font-sans leading-relaxed resize-y"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="text-[11px] text-zinc-400 dark:text-zinc-500 hidden sm:block">
            Press <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-zinc-200 dark:bg-zinc-800 rounded border border-zinc-300 dark:border-zinc-700">Cmd+Enter</kbd> to save
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Scene Plan</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
