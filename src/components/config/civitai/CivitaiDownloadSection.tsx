import React from "react";
import { 
  FolderDown, 
  FileCode, 
  Info, 
  Terminal, 
  CheckCircle2, 
  Zap, 
  RefreshCw, 
  AlertCircle 
} from "lucide-react";
import { AppConfig } from "../../../types";
import { DownloadResult } from "./useCivitaiConfig";

export interface CivitaiDownloadSectionProps {
  targetDestination: string;
  setTargetDestination: (val: string) => void;
  targetFilename: string;
  setTargetFilename: (val: string) => void;
  fullDestinationPath: string;
  config: AppConfig;
  copiedCommand: boolean;
  onCopyCommand: () => void;
  downloading: boolean;
  downloadElapsed: number;
  downloadResult: DownloadResult | null;
  onDownloadToRemote: () => void;
}

export const CivitaiDownloadSection: React.FC<CivitaiDownloadSectionProps> = ({
  targetDestination,
  setTargetDestination,
  targetFilename,
  setTargetFilename,
  fullDestinationPath,
  config,
  copiedCommand,
  onCopyCommand,
  downloading,
  downloadElapsed,
  downloadResult,
  onDownloadToRemote
}) => {
  return (
    <div className="space-y-4 pt-3 border-t border-zinc-800/80">
      {/* Destination Configuration Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <FolderDown className="w-3.5 h-3.5 text-cyan-400" />
            <span>Remote ComfyUI Subfolder</span>
            <span className="text-[10px] text-emerald-400 font-normal">(Auto-routed)</span>
          </label>
          <input
            id="input-civitai-standalone-destination"
            type="text"
            value={targetDestination}
            onChange={(e) => setTargetDestination(e.target.value)}
            placeholder="e.g. models/checkpoints/"
            className="w-full bg-zinc-900 border border-zinc-700 focus:border-cyan-500 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 font-mono"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <FileCode className="w-3.5 h-3.5 text-cyan-400" />
            <span>Target Filename</span>
          </label>
          <input
            id="input-civitai-standalone-filename"
            type="text"
            value={targetFilename}
            onChange={(e) => setTargetFilename(e.target.value)}
            placeholder="e.g. model.safetensors"
            className="w-full bg-zinc-900 border border-zinc-700 focus:border-cyan-500 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 font-mono"
          />
        </div>
      </div>

      {/* Full Remote Path Preview */}
      <div className="p-2.5 bg-zinc-900/80 rounded-lg border border-zinc-800 text-[11px] text-zinc-400 flex items-center gap-2">
        <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <div className="truncate">
          <span>Direct Remote GPU Path: </span>
          <code className="text-cyan-300 font-mono font-medium">{fullDestinationPath}</code>
        </div>
      </div>

      {/* Download Execution Button & Copy Download Command */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="text-xs text-zinc-400">
          <span>Target Host: </span>
          <code className="text-zinc-200 font-mono font-semibold">
            {config.ssh_username || "root"}@{config.remote_host || "NO_HOST_SET"}:{config.ssh_port || 22}
          </code>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="btn-copy-civitai-standalone-command"
            type="button"
            onClick={onCopyCommand}
            className="px-4 py-2.5 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 hover:text-white rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            {copiedCommand ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-300 font-bold">Command Copied!</span>
              </>
            ) : (
              <>
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span>Copy Download Command</span>
              </>
            )}
          </button>

          <button
            id="btn-download-civitai-standalone-remote"
            type="button"
            onClick={onDownloadToRemote}
            disabled={downloading || !config.remote_host}
            className="px-5 py-2.5 text-xs font-bold bg-linear-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 active:scale-95"
          >
            <Zap className={`w-4 h-4 ${downloading ? "animate-bounce text-amber-300" : "fill-amber-300 text-amber-300"}`} />
            <span>
              {downloading 
                ? `⚡ Downloading to Remote GPU (${downloadElapsed}s)...` 
                : "⚡ Download to Remote ComfyUI"}
            </span>
          </button>
        </div>
      </div>

      {/* Real-time downloading progress banner */}
      {downloading && (
        <div className="p-3 bg-cyan-950/40 border border-cyan-800/60 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-cyan-300 font-semibold">
            <span className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              <span>Streaming directly to remote GPU disk at datacenter speed...</span>
            </span>
            <span className="font-mono">{downloadElapsed}s</span>
          </div>
          <div className="w-full bg-cyan-950 rounded-full h-1.5 overflow-hidden">
            <div className="bg-cyan-400 h-full w-full animate-pulse" />
          </div>
          <p className="text-[10px] text-cyan-400/80">
            Using high-speed curl stream with automatic redirect following and resume. The model will be placed directly into your ComfyUI models folder.
          </p>
        </div>
      )}

      {/* Download Result Card */}
      {downloadResult && !downloading && (
        <div
          className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
            downloadResult.success
              ? "bg-emerald-950/30 border-emerald-800/50 text-emerald-200"
              : "bg-red-950/30 border-red-800/50 text-red-200"
          }`}
        >
          <div className="flex items-center gap-2 font-bold">
            {downloadResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{downloadResult.success ? "Remote Model Stored Successfully" : "Download Failed"}</span>
            {downloadResult.duration_seconds !== undefined && (
              <span className="text-[10px] font-normal opacity-80">({downloadResult.duration_seconds}s)</span>
            )}
          </div>

          <p className="text-xs opacity-90">{downloadResult.message}</p>

          {downloadResult.destination_path && (
            <div className="pt-1 text-[11px] font-mono text-zinc-300">
              Location: <span className="text-emerald-300">{downloadResult.destination_path}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
