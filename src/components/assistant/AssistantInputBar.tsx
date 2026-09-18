import React from "react";
import { Send } from "lucide-react";

interface AssistantInputBarProps {
  inputRef: React.RefObject<HTMLTextAreaElement>;
  inputQuery: string;
  isLoading: boolean;
  onInputChange: (val: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSendMessage: () => void;
  onResetChat: () => void;
}

/**
 * Bottom query input bar with auto-expanding textarea, send trigger,
 * Shift+Enter helper hint, and clear chat history button.
 */
export const AssistantInputBar: React.FC<AssistantInputBarProps> = ({
  inputRef,
  inputQuery,
  isLoading,
  onInputChange,
  onKeyDown,
  onSendMessage,
  onResetChat
}) => {
  return (
    <div className="p-3 bg-white dark:bg-zinc-900 border-t border-slate-200/90 dark:border-zinc-800 shrink-0">
      <div className="relative flex items-end bg-slate-100 dark:bg-zinc-800 rounded-xl p-1.5 focus-within:ring-2 focus-within:ring-indigo-500/80 border border-slate-200 dark:border-zinc-700">
        <textarea
          ref={inputRef}
          value={inputQuery}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask assistant to update scene, stage assets, or expand prompts..."
          rows={1}
          className="w-full resize-none bg-transparent px-2.5 py-1.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none max-h-28"
          style={{ height: "auto" }}
        />
        <button
          onClick={onSendMessage}
          disabled={!inputQuery.trim() || isLoading}
          className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0 ml-1 shadow-2xs"
          title="Send query"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-slate-400 dark:text-zinc-500">
        <span>Shift + Enter for new line</span>
        <button
          onClick={onResetChat}
          className="hover:text-slate-600 dark:hover:text-zinc-300 transition-colors cursor-pointer"
        >
          Clear History
        </button>
      </div>
    </div>
  );
};
