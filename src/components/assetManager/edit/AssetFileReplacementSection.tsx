import React, { useState } from "react";
import { CheckCircle, UploadCloud, Undo2, Trash2 } from "lucide-react";
import { MediaAsset } from "../../../types";

interface AssetFileReplacementSectionProps {
  asset: MediaAsset;
  isReplacingFile: boolean;
  editFile: File | null;
  onStartReplace: () => void;
  onRevertToOriginal: () => void;
  onFileSelected: (file: File | null) => void;
}

export const AssetFileReplacementSection: React.FC<AssetFileReplacementSectionProps> = ({
  asset,
  isReplacingFile,
  editFile,
  onStartReplace,
  onRevertToOriginal,
  onFileSelected
}) => {
  const [dragActive, setDragActive] = useState(false);

  return (
    <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/50">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-400">Media File</label>
        {!isReplacingFile && (
          <button
            type="button"
            onClick={onStartReplace}
            className="text-[10px] bg-zinc-200 hover:bg-zinc-300 text-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 px-2 py-1 rounded transition-colors cursor-pointer"
          >
            Replace File
          </button>
        )}
      </div>

      {!isReplacingFile ? (
        <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-lg">
          <div className="w-8 h-8 bg-zinc-200 dark:bg-zinc-800 rounded flex items-center justify-center shrink-0">
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
          </div>
          <div className="overflow-hidden flex-1">
            <p className="text-xs text-zinc-800 dark:text-zinc-300 truncate font-mono">{asset.filename}</p>
            <p className="text-[10px] text-zinc-500">Original file preserved</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {editFile ? (
            <div className="border border-amber-300 dark:border-amber-600/30 bg-amber-50/60 dark:bg-amber-950/20 rounded-lg overflow-hidden">
              <div className="p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/40 rounded flex items-center justify-center shrink-0">
                    <UploadCloud className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-amber-900 dark:text-amber-200 truncate">{editFile.name}</p>
                    <p className="text-[10px] text-amber-700 dark:text-amber-500/70">{(editFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
              </div>
              <div className="p-2.5 bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={onRevertToOriginal}
                  className="px-2.5 py-1 text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Keep original file</span>
                </button>
                <button
                  type="button"
                  onClick={() => onFileSelected(null)}
                  className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-950/40 dark:hover:bg-red-900/60 dark:text-red-300 border border-red-200 dark:border-red-800/50 rounded-md text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          ) : (
            <div
              onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  onFileSelected(e.dataTransfer.files[0]);
                }
              }}
              className={`relative w-full flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-all ${
                dragActive
                  ? "border-amber-500 bg-amber-50/80 dark:bg-amber-500/10"
                  : "border-zinc-300 hover:border-amber-500 dark:border-zinc-700 dark:hover:border-amber-500/80 bg-zinc-50/70 hover:bg-zinc-100/70 dark:bg-zinc-950/60 dark:hover:bg-zinc-900/60 cursor-pointer"
              }`}
            >
              <label className="w-full flex flex-col items-center justify-center cursor-pointer">
                <UploadCloud className="w-8 h-8 mb-2 text-amber-500 dark:text-amber-400 animate-pulse" />
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 text-center">
                  Select Replacement {asset.media_type ? asset.media_type.toUpperCase() : "MEDIA"} File
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 text-center mt-1">
                  Click to browse files or drag and drop here
                </p>
                <input
                  type="file"
                  accept={asset.media_type === "image" ? "image/*" : asset.media_type === "audio" ? "audio/*" : "video/*"}
                  onChange={(e) => onFileSelected(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={onRevertToOriginal}
                className="mt-3 text-[11px] text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 underline flex items-center gap-1 cursor-pointer"
              >
                <Undo2 className="w-3 h-3" />
                Cancel replacement & keep original
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
