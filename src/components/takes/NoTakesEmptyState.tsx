import React from "react";
import { FileVideo } from "lucide-react";

interface NoTakesEmptyStateProps {
  totalTakes: number;
  filterRating: "all" | "good" | "bad" | "unreviewed";
}

/**
 * Empty state rendered when no takes have been ingested or no takes match the active rating filter.
 */
export const NoTakesEmptyState: React.FC<NoTakesEmptyStateProps> = ({
  totalTakes,
  filterRating
}) => {
  return (
    <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-10 text-center shadow-xs">
      <FileVideo className="w-10 h-10 mx-auto text-zinc-400 dark:text-zinc-600 mb-2" />
      <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
        {totalTakes === 0 
          ? "No takes ingested yet" 
          : `No takes matching "${filterRating}" rating`}
      </h3>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
        {totalTakes === 0
          ? "Drag and drop an MP4 clip into the box above to add Take 01 for this shot."
          : "Switch filter to view other takes or upload another take."}
      </p>
    </div>
  );
};
