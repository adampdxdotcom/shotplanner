import React from "react";
import { Bot, Minimize2, Maximize2, X, RotateCcw } from "lucide-react";
import { LLMProvider } from "../../types";

interface AssistantChatHeaderProps {
  sceneName?: string;
  effectiveDefault: LLMProvider;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onClose: () => void;
  onResetChat?: () => void;
}

/**
 * Top title bar of the floating chat modal displaying assistant branding,
 * active LLM badge, scene context label, reset chat button, expand toggle, and close trigger.
 */
export const AssistantChatHeader: React.FC<AssistantChatHeaderProps> = ({
  sceneName,
  effectiveDefault,
  isExpanded,
  onToggleExpand,
  onClose,
  onResetChat
}) => {
  return (
    <div className="px-4 py-3 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 shrink-0 select-none">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs shrink-0">
          <Bot className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm tracking-tight text-slate-900 dark:text-zinc-100">
              AI Production Assistant
            </h3>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800/60 font-semibold">
              {effectiveDefault === "gemini" ? "Gemini" : "LM Studio"}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate max-w-[180px] sm:max-w-[240px]">
            Context: <strong className="text-slate-800 dark:text-zinc-200 font-medium">{sceneName || "Untitled Scene"}</strong>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {onResetChat && (
          <button
            onClick={onResetChat}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Reset conversation for this scene"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onToggleExpand}
          className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          title={isExpanded ? "Collapse" : "Expand"}
        >
          {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          title="Close Assistant"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
