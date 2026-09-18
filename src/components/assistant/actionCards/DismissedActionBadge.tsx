import React from "react";
import { X } from "lucide-react";
import { AssistantAction } from "../../../types/assistantActions";

interface DismissedActionBadgeProps {
  action: AssistantAction;
  onApply?: (action: AssistantAction) => void;
}

/**
 * Compact pill badge rendered when an action has been dismissed by the user,
 * with a quick 'Restore & Apply' option.
 */
export const DismissedActionBadge: React.FC<DismissedActionBadgeProps> = ({
  action,
  onApply
}) => {
  return (
    <div className="mt-2.5 p-2 rounded-lg border border-slate-200/60 dark:border-zinc-800 bg-slate-100/50 dark:bg-zinc-900/50 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-500">
      <span className="flex items-center gap-1.5 italic text-[11px]">
        <X className="w-3.5 h-3.5 opacity-60" />
        Dismissed suggestion {action.title ? `(${action.title})` : ""}
      </span>
      {onApply && (
        <button
          onClick={() => onApply(action)}
          className="text-[10.5px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
        >
          Restore & Apply
        </button>
      )}
    </div>
  );
};
