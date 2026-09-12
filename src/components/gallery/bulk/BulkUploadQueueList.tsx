import React from "react";
import { X, Loader2, Check, FileText, Music, Image as ImageIcon } from "lucide-react";
import { formatSize } from "../../../utils/formatters";
import { BulkQueueItem } from "./types";

interface BulkUploadQueueListProps {
  queue: BulkQueueItem[];
  onRemoveItem: (index: number) => void;
  disabled?: boolean;
}

export const BulkUploadQueueList: React.FC<BulkUploadQueueListProps> = ({
  queue,
  onRemoveItem,
  disabled = false
}) => {
  if (queue.length === 0) return null;

  const successCount = queue.filter((i) => i.status === "success").length;

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center justify-between text-xs font-semibold text-zinc-600 dark:text-zinc-400 px-1">
        <span>General Batch Queue ({queue.length} files)</span>
        {successCount > 0 && (
          <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold">
            {successCount} Done
          </span>
        )}
      </div>

      <div className="divide-y divide-zinc-200 dark:divide-zinc-850 max-h-[160px] overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 shadow-sm">
        {queue.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between p-2.5 text-xs">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {item.file.type.startsWith("image/") ? (
                <ImageIcon className="w-4 h-4 text-amber-500 shrink-0" />
              ) : item.file.type.startsWith("audio/") ? (
                <Music className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
              ) : (
                <FileText className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
              )}
              <div className="truncate min-w-0">
                <p className="font-medium text-zinc-800 dark:text-zinc-300 truncate">{item.file.name}</p>
                <p className="text-[10px] text-zinc-500">{formatSize(item.file.size)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 ml-3">
              {item.status === "pending" && (
                <button
                  onClick={() => onRemoveItem(idx)}
                  disabled={disabled}
                  className="text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300 p-1 cursor-pointer"
                  title="Remove from queue"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              {item.status === "uploading" && (
                <div className="flex items-center gap-1.5 text-amber-500 dark:text-amber-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="text-[10px] font-semibold">{item.progress}%</span>
                </div>
              )}
              {item.status === "success" && (
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/80 font-semibold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Done
                </span>
              )}
              {item.status === "error" && (
                <span
                  className="text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/80 px-2 py-0.5 rounded border border-red-200 dark:border-red-800/80 font-semibold max-w-[140px] truncate"
                  title={item.error}
                >
                  Error
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
