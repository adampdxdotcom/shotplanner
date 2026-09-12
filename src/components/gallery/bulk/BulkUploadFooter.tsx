import React from "react";
import { Loader2, UploadCloud } from "lucide-react";
import { UploadSummary } from "./types";

interface BulkUploadFooterProps {
  uploadSummary: UploadSummary | null;
  populatedPackSlotsCount: number;
  bulkQueueCount: number;
  totalPendingCount: number;
  isBulkUploading: boolean;
  onClose: () => void;
  onUpload: () => void;
}

export const BulkUploadFooter: React.FC<BulkUploadFooterProps> = ({
  uploadSummary,
  populatedPackSlotsCount,
  bulkQueueCount,
  totalPendingCount,
  isBulkUploading,
  onClose,
  onUpload
}) => {
  return (
    <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/70 flex items-center justify-between gap-3 shrink-0">
      <div className="text-[11px] text-zinc-600 dark:text-zinc-400">
        {uploadSummary && uploadSummary.completed > 0 && (
          <span className="text-emerald-700 dark:text-emerald-400 font-medium">
            Successfully uploaded {uploadSummary.completed} asset{uploadSummary.completed > 1 ? "s" : ""}!
          </span>
        )}
        {uploadSummary && uploadSummary.errors > 0 && (
          <span className="text-red-600 dark:text-red-400 font-medium ml-2">
            ({uploadSummary.errors} failed)
          </span>
        )}
        {!uploadSummary && (
          <span>
            {populatedPackSlotsCount} pack slot{populatedPackSlotsCount === 1 ? "" : "s"} &bull; {bulkQueueCount} batch file{bulkQueueCount === 1 ? "" : "s"} ready
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
          disabled={isBulkUploading}
        >
          Cancel
        </button>
        <button
          onClick={onUpload}
          disabled={isBulkUploading || totalPendingCount === 0}
          className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:hover:bg-amber-500 text-zinc-950 text-xs font-bold rounded-lg shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
        >
          {isBulkUploading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Uploading Assets...
            </>
          ) : (
            <>
              <UploadCloud className="w-3.5 h-3.5" />
              Upload All ({totalPendingCount} item{totalPendingCount === 1 ? "" : "s"})
            </>
          )}
        </button>
      </div>
    </div>
  );
};
