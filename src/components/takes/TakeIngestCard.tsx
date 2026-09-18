import React, { useRef } from "react";
import { 
  Clapperboard, 
  Upload, 
  Star, 
  Download, 
  ArrowRightLeft, 
  AlertCircle, 
  Sparkles,
  Loader2
} from "lucide-react";
import { ShotItem } from "../../types";

interface TakeIngestCardProps {
  shot: ShotItem;
  sceneName: string;
  takesCount: number;
  hasHeroTake: boolean;
  suggestedFilename: string;
  isUploading: boolean;
  uploadError: string | null;
  isDragActive: boolean;
  autoFormatFilename: boolean;
  customFilename: string;
  isExportingTakes: boolean;
  onSetIsDragActive: (active: boolean) => void;
  onSetAutoFormatFilename: (auto: boolean) => void;
  onSetCustomFilename: (name: string) => void;
  onUploadFile: (file: File) => void;
  onExportTakesZip: () => void;
  onCompareTakes?: () => void;
}

/**
 * Header and video take ingestion card with drag-and-drop dropzone,
 * filename configuration, ZIP export, and comparison triggers.
 */
export const TakeIngestCard: React.FC<TakeIngestCardProps> = ({
  shot,
  takesCount,
  hasHeroTake,
  suggestedFilename,
  isUploading,
  uploadError,
  isDragActive,
  autoFormatFilename,
  customFilename,
  isExportingTakes,
  onSetIsDragActive,
  onSetAutoFormatFilename,
  onSetCustomFilename,
  onUploadFile,
  onExportTakesZip,
  onCompareTakes
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
              Shot {String(shot.shot_number).padStart(2, "0")}
            </span>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              {shot.shot_name ? shot.shot_name : `Shot ${String(shot.shot_number).padStart(2, "0")} Takes`}
            </h2>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Ingest video takes, evaluate with Good / Bad ratings, and attach director review notes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {takesCount >= 2 && onCompareTakes && (
            <button
              type="button"
              onClick={onCompareTakes}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer border border-zinc-300 dark:border-zinc-700"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-500" />
              Compare Takes
            </button>
          )}

          {takesCount > 0 && (
            <button
              type="button"
              onClick={onExportTakesZip}
              disabled={isExportingTakes}
              title="Download all video takes as a separate ZIP archive"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-semibold rounded-lg transition-colors cursor-pointer border border-amber-500/30 disabled:opacity-50"
            >
              {isExportingTakes ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-amber-500" />
                  <span>Takes ZIP</span>
                </>
              )}
            </button>
          )}

          <div className="flex items-center gap-1.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 font-medium">
            <Clapperboard className="w-3.5 h-3.5 text-amber-500" />
            <span>Total: <strong className="text-zinc-900 dark:text-zinc-200">{takesCount}</strong></span>
            {hasHeroTake && (
              <span className="ml-2 pl-2 border-l border-zinc-200 dark:border-zinc-800 flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                Hero Take Selected
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Ingest Dropzone / Uploader */}
      <div className="mt-4 pt-1">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            onSetIsDragActive(true);
          }}
          onDragLeave={() => onSetIsDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            onSetIsDragActive(false);
            const file = e.dataTransfer.files?.[0];
            if (file) onUploadFile(file);
          }}
          className={`border-2 border-dashed rounded-xl p-5 transition-all text-center ${
            isDragActive 
              ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20" 
              : "border-zinc-300 dark:border-zinc-700 hover:border-amber-400 dark:hover:border-amber-500/50 bg-zinc-50/50 dark:bg-zinc-950/40"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUploadFile(file);
              e.target.value = "";
            }}
          />

          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="p-3 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 rounded-full">
              <Upload className={`w-5 h-5 ${isUploading ? "animate-bounce" : ""}`} />
            </div>
            
            <div>
              <button
                type="button"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="text-sm font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
              >
                {isUploading ? "Ingesting video clip..." : "Click to upload a video take"}
              </button>
              <span className="text-xs text-zinc-500 dark:text-zinc-400"> or drag and drop here</span>
            </div>

            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Supports MP4, WebM, MOV (approx. 1.5MB - 50MB)
            </p>
          </div>
        </div>

        {/* Upload Configuration & Comfy Note */}
        <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="auto-format-filename"
              checked={autoFormatFilename}
              onChange={(e) => onSetAutoFormatFilename(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
            />
            <label htmlFor="auto-format-filename" className="text-zinc-700 dark:text-zinc-300 cursor-pointer">
              Auto-format filename: <code className="font-mono text-amber-600 dark:text-amber-400 font-semibold">{suggestedFilename}</code>
            </label>
          </div>

          <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>ComfyUI Bridge: Automated outputs will sync directly to this tab</span>
          </div>
        </div>

        {!autoFormatFilename && (
          <div className="mt-2 flex items-center gap-2">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 shrink-0">
              Custom Target Filename:
            </label>
            <input
              type="text"
              value={customFilename}
              onChange={(e) => onSetCustomFilename(e.target.value)}
              placeholder={suggestedFilename}
              className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 font-mono"
            />
          </div>
        )}

        {uploadError && (
          <div className="mt-3 flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-xl text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}
      </div>
    </div>
  );
};
