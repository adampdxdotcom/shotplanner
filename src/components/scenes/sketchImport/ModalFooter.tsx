import React from "react";
import { RefreshCw, Sparkles, Check } from "lucide-react";
import { SketchImportStep } from "./types";

interface ModalFooterProps {
  step: SketchImportStep;
  isParsing: boolean;
  canParse: boolean;
  stagedShotsCount: number;
  onClose: () => void;
  onParse: () => void;
  onBackToInput: () => void;
  onConfirmImport: () => void;
}

export const ModalFooter: React.FC<ModalFooterProps> = ({
  step,
  isParsing,
  canParse,
  stagedShotsCount,
  onClose,
  onParse,
  onBackToInput,
  onConfirmImport
}) => {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-xs">
      {step === 1 ? (
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onParse}
            disabled={isParsing || !canParse}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            {isParsing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Parsing Scene via LLM...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Parse Sketch into Shots
              </>
            )}
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={onBackToInput}
            className="px-4 py-2 text-xs font-semibold rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            ← Back to Input
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onConfirmImport}
              disabled={stagedShotsCount === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              Import {stagedShotsCount} {stagedShotsCount === 1 ? "Shot" : "Shots"} to Scene
            </button>
          </div>
        </>
      )}
    </div>
  );
};
