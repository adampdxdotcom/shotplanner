import React from "react";
import { Loader2 } from "lucide-react";

interface SectionLoadingFallbackProps {
  label?: string;
}

export const SectionLoadingFallback: React.FC<SectionLoadingFallbackProps> = ({ label = "Loading module..." }) => {
  return (
    <div className="w-full min-h-[360px] flex flex-col items-center justify-center gap-3 rounded-xl border border-zinc-200/60 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/30 p-8 animate-pulse">
      <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 tracking-wide">{label}</span>
    </div>
  );
};
