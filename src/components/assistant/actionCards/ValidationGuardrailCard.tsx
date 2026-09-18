import React from "react";
import { AlertTriangle } from "lucide-react";
import { AssistantAction } from "../../../types/assistantActions";

interface ValidationGuardrailCardProps {
  action: AssistantAction;
  validationError: string;
  onDismiss?: (action: AssistantAction) => void;
}

/**
 * Safety guardrail card displayed when an action references a target that doesn't exist
 * (such as a shot number deleted or out of range).
 */
export const ValidationGuardrailCard: React.FC<ValidationGuardrailCardProps> = ({
  action,
  validationError,
  onDismiss
}) => {
  return (
    <div className="mt-3 p-3 rounded-xl border border-amber-300 dark:border-amber-800/80 bg-amber-50/80 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-xs w-full min-w-0 overflow-hidden">
      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-amber-200 dark:border-amber-900 min-w-0">
        <div className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-100 min-w-0 flex-1">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="shrink-0">Target Not Found</span>
          {action.title && (
            <span className="text-amber-700 dark:text-amber-300 font-normal truncate min-w-0 flex-1">
              • {action.title}
            </span>
          )}
        </div>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200 shrink-0 whitespace-nowrap">
          Guardrail
        </span>
      </div>
      <p className="my-2 text-[11px] text-amber-800 dark:text-amber-300 break-words">
        {validationError}
      </p>
      {onDismiss && (
        <div className="mt-2 pt-1 border-t border-amber-200/80 dark:border-amber-900 flex justify-end">
          <button
            onClick={() => onDismiss(action)}
            className="px-2 py-1 rounded bg-amber-200/80 hover:bg-amber-300 dark:bg-amber-900 dark:hover:bg-amber-800 text-amber-900 dark:text-amber-100 text-[10.5px] font-medium transition-colors cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};
