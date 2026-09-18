import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { LLMProvider } from "../../types";

interface AssistantConnectionBannerProps {
  effectiveDefault: LLMProvider;
  isCheckingConnection: boolean;
  onRetryConnection: () => void;
  onNavigateToSettings: () => void;
}

/**
 * Amber warning banner displayed when the active LLM provider is offline or unreachable.
 */
export const AssistantConnectionBanner: React.FC<AssistantConnectionBannerProps> = ({
  effectiveDefault,
  isCheckingConnection,
  onRetryConnection,
  onNavigateToSettings
}) => {
  return (
    <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/60 px-3.5 py-2 flex items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200 shrink-0">
      <div className="flex items-center gap-1.5 truncate">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="truncate">
          LLM provider ({effectiveDefault}) seems offline or unreachable.
        </span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onRetryConnection}
          disabled={isCheckingConnection}
          className="px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 dark:bg-amber-900 dark:hover:bg-amber-800 text-amber-800 dark:text-amber-200 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
          title="Retry connection"
        >
          <RefreshCw className={`w-3 h-3 ${isCheckingConnection ? "animate-spin" : ""}`} />
        </button>
        <button
          onClick={onNavigateToSettings}
          className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-medium transition-colors cursor-pointer"
        >
          Settings
        </button>
      </div>
    </div>
  );
};
