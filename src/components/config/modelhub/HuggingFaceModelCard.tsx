import React from "react";
import { HuggingFaceModelMetadata, HuggingFaceFileOption } from "../../../types";
import { ModelDestinationConfigGrid } from "./ModelDestinationConfigGrid";
import { 
  Lock, 
  FileCode, 
  CheckCircle2, 
  Terminal, 
  RefreshCw, 
  DownloadCloud 
} from "lucide-react";

export interface HuggingFaceModelCardProps {
  hfMetadata: HuggingFaceModelMetadata;
  selectedFileUrl: string;
  onSelectFile: (fileOption: HuggingFaceFileOption) => void;
  categoryPreset: string;
  onCategoryChange: (presetId: string) => void;
  targetDest: string;
  onTargetDestChange: (dest: string) => void;
  targetFilename: string;
  onTargetFilenameChange: (filename: string) => void;
  remoteComfyRoot?: string;
  copiedCmd: boolean;
  onCopyCommand: () => void;
  downloading: boolean;
  downloadElapsed: number;
  remoteHostConfigured: boolean;
  onIngest: () => void;
}

export const HuggingFaceModelCard: React.FC<HuggingFaceModelCardProps> = ({
  hfMetadata,
  selectedFileUrl,
  onSelectFile,
  categoryPreset,
  onCategoryChange,
  targetDest,
  onTargetDestChange,
  targetFilename,
  onTargetFilenameChange,
  remoteComfyRoot,
  copiedCmd,
  onCopyCommand,
  downloading,
  downloadElapsed,
  remoteHostConfigured,
  onIngest
}) => {
  return (
    <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-5 shadow-lg space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-neutral-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-base font-bold text-white">
              {hfMetadata.model_name}
            </h4>
            {hfMetadata.is_gated && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" />
                Gated Model
              </span>
            )}
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-800 text-neutral-300 border border-neutral-700">
              {hfMetadata.detected_category}
            </span>
          </div>
          <p className="text-xs text-neutral-400">
            Repository: <span className="font-mono text-neutral-300">{hfMetadata.repo_id}</span>
            {hfMetadata.author && <span> • by {hfMetadata.author}</span>}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-neutral-950 px-3 py-1.5 rounded-lg border border-neutral-800 text-right">
            <span className="text-[10px] text-neutral-400 block font-medium">Estimated Size</span>
            <span className="text-xs font-mono font-bold text-amber-300">
              {hfMetadata.file_size_formatted || "Stream"}
            </span>
          </div>
        </div>
      </div>

      {/* If repo has multiple available model weights files */}
      {hfMetadata.available_files && hfMetadata.available_files.length > 1 && (
        <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-lg p-3.5 space-y-2">
          <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
            <FileCode className="w-3.5 h-3.5 text-amber-400" />
            Select Specific Model File from Repository
          </label>
          <select
            value={selectedFileUrl}
            onChange={(e) => {
              const sel = hfMetadata.available_files?.find((f) => f.downloadUrl === e.target.value);
              if (sel) onSelectFile(sel);
            }}
            className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 text-xs rounded-lg px-3 py-2 outline-none focus:border-amber-500 font-mono"
          >
            {hfMetadata.available_files.map((file, idx) => (
              <option key={idx} value={file.downloadUrl}>
                {file.filename} {file.isPrimary ? "(Recommended)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Shared Destination Configuration Grid */}
      <ModelDestinationConfigGrid
        categoryPreset={categoryPreset}
        onCategoryChange={onCategoryChange}
        targetDest={targetDest}
        onTargetDestChange={onTargetDestChange}
        targetFilename={targetFilename}
        onTargetFilenameChange={onTargetFilenameChange}
        remoteComfyRoot={remoteComfyRoot}
        accentColor="amber"
      />

      {/* Download CTA & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="text-xs text-neutral-400">
          <span>Method: </span>
          <span className="font-mono text-neutral-300">curl (resumable stream)</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="btn-copy-hf-command"
            type="button"
            onClick={onCopyCommand}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 hover:text-white font-semibold text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            {copiedCmd ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-300 font-bold">Command Copied!</span>
              </>
            ) : (
              <>
                <Terminal className="w-4 h-4 text-amber-400" />
                <span>Copy Download Command</span>
              </>
            )}
          </button>

          <button
            id="btn-download-hf-model"
            type="button"
            onClick={onIngest}
            disabled={downloading || !remoteHostConfigured}
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs disabled:opacity-50 transition-all shadow-md shrink-0 active:scale-95 cursor-pointer"
          >
            {downloading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Ingesting Model ({downloadElapsed}s)...</span>
              </>
            ) : (
              <>
                <DownloadCloud className="w-4 h-4" />
                <span>Ingest to Remote ComfyUI</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
