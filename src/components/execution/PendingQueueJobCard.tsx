import React from "react";
import { Trash2, Film, Clock, Loader2, Layers, AlertCircle } from "lucide-react";
import { ComfyQueueItem } from "../../types";
import { formatShotNumber } from "../../utils/formatters";

interface PendingQueueJobCardProps {
  job: ComfyQueueItem;
  rank: number;
  isDeleting?: boolean;
  onDelete: (promptId: string) => void;
}

export const PendingQueueJobCard: React.FC<PendingQueueJobCardProps> = ({
  job,
  rank,
  isDeleting = false,
  onDelete
}) => {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        {/* Rank indicator badge */}
        <div className="w-6 h-6 rounded-md bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center text-xs font-bold font-mono shrink-0">
          #{rank}
        </div>

        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            {job.shot_number !== undefined ? (
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
                <Film className="w-3 h-3 text-cyan-500" />
                Shot #{formatShotNumber(Number(job.shot_number))}
              </span>
            ) : (
              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                Queued Prompt
              </span>
            )}

            {job.scene_name && (
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate max-w-[120px]">
                ({job.scene_name})
              </span>
            )}

            {job.output_prefix && (
              <span className="text-[10px] text-zinc-400 font-mono bg-zinc-200 dark:bg-zinc-800/80 px-1.5 py-0.5 rounded truncate max-w-[150px]" title={job.output_prefix}>
                {job.output_prefix}
              </span>
            )}
          </div>

          <div className="text-[10px] font-mono text-zinc-400 truncate max-w-xs sm:max-w-md">
            ID: <span className="text-zinc-400 select-all">{job.prompt_id}</span>
            {job.nodes_count && <span className="ml-2 text-zinc-500">({job.nodes_count} nodes)</span>}
          </div>
        </div>
      </div>

      {/* Cancel Job Action */}
      <button
        onClick={() => onDelete(job.prompt_id)}
        disabled={isDeleting}
        className="p-1.5 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0 cursor-pointer disabled:opacity-50"
        title="Cancel and remove from queue"
      >
        {isDeleting ? (
          <Loader2 className="w-4 h-4 animate-spin text-red-500" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
      </button>
    </div>
  );
};
