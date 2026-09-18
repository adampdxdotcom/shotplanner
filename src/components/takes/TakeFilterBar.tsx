import React from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";

interface TakeFilterBarProps {
  filterRating: "all" | "good" | "bad" | "unreviewed";
  onSelectFilter: (filter: "all" | "good" | "bad" | "unreviewed") => void;
  counts: {
    all: number;
    good: number;
    bad: number;
    unreviewed: number;
  };
  filteredCount: number;
  totalCount: number;
}

/**
 * Filter bar with pill buttons for filtering video takes by rating status.
 */
export const TakeFilterBar: React.FC<TakeFilterBarProps> = ({
  filterRating,
  onSelectFilter,
  counts,
  filteredCount,
  totalCount
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mr-1">Filter Takes:</span>
        <button
          type="button"
          onClick={() => onSelectFilter("all")}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer border ${
            filterRating === "all"
              ? "bg-zinc-800 text-white border-zinc-700 dark:bg-zinc-200 dark:text-zinc-900"
              : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
          }`}
        >
          All ({counts.all})
        </button>
        <button
          type="button"
          onClick={() => onSelectFilter("good")}
          className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer border ${
            filterRating === "good"
              ? "bg-emerald-600 text-white border-emerald-500"
              : "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 border-zinc-200 dark:border-zinc-800 hover:border-emerald-300"
          }`}
        >
          <ThumbsUp className="w-3 h-3" />
          Good ({counts.good})
        </button>
        <button
          type="button"
          onClick={() => onSelectFilter("bad")}
          className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer border ${
            filterRating === "bad"
              ? "bg-rose-600 text-white border-rose-500"
              : "bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 border-zinc-200 dark:border-zinc-800 hover:border-rose-300"
          }`}
        >
          <ThumbsDown className="w-3 h-3" />
          Bad ({counts.bad})
        </button>
        <button
          type="button"
          onClick={() => onSelectFilter("unreviewed")}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer border ${
            filterRating === "unreviewed"
              ? "bg-amber-600 text-white border-amber-500"
              : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
          }`}
        >
          Unreviewed ({counts.unreviewed})
        </button>
      </div>

      <div className="text-xs text-zinc-500 dark:text-zinc-400">
        Showing {filteredCount} of {totalCount} take{totalCount === 1 ? "" : "s"}
      </div>
    </div>
  );
};
