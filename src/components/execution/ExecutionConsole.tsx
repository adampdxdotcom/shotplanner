import React from "react";
import { Terminal, AlertCircle, CheckCircle2, Check, Server, FileCode, HardDrive, ArrowRight, Layers, Sliders, Sparkles, Folder, UploadCloud, Clock, Loader2, FileCheck } from "lucide-react";
import { TransferResult, SceneProjectFile, ShotItem } from "../../types";
import { formatShotNumber } from "../../utils/formatters";
import { useTransfer, ActiveFileProgress, RecentAssetItem } from "../../context/TransferContext";
import { RecentUpdatedAssetsCard } from "./RecentUpdatedAssetsCard";

export interface ExecutionConsoleProps {
  transferState?: "idle" | "progress" | "error" | "success";
  progressStep?: string;
  progressPercent?: number;
  currentFile?: string | null;
  currentFilePercent?: number;
  currentFileBytes?: { transferred: number; total: number } | null;
  fileIndex?: number;
  totalFiles?: number;
  activeFiles?: ActiveFileProgress[];
  transferResult?: TransferResult | null;
  error?: string | null;
  lastAction?: "shot" | "scene" | "execute_shot" | null;
  lastStagedTime?: string | null;
  activeShot?: ShotItem | null | undefined;
  sceneProject: SceneProjectFile;
  sanitizedSceneName: string;
  handleSendShot: () => void;
  handleSendScene: () => void;
  handleDismissError: () => void;
  recentAssets?: RecentAssetItem[];
  onRefreshRecentAssets?: () => void;
  onClearRecentAssets?: () => void;
}

export const ExecutionConsole: React.FC<ExecutionConsoleProps> = (props) => {
  const transferContext = useTransfer();

  // Prefer props if provided, fallback to context
  const transferState = props.transferState ?? transferContext.transferState;
  const progressStep = props.progressStep ?? transferContext.progressStep;
  const progressPercent = props.progressPercent ?? transferContext.progressPercent;
  const currentFile = props.currentFile ?? transferContext.currentFile;
  const currentFilePercent = props.currentFilePercent ?? transferContext.currentFilePercent;
  const currentFileBytes = props.currentFileBytes ?? transferContext.currentFileBytes;
  const fileIndex = props.fileIndex ?? transferContext.fileIndex;
  const totalFiles = props.totalFiles ?? transferContext.totalFiles;
  const activeFiles = props.activeFiles ?? transferContext.activeFiles;
  const transferResult = props.transferResult ?? transferContext.transferResult;
  const error = props.error ?? transferContext.error;
  const lastAction = props.lastAction ?? transferContext.lastAction;
  const lastStagedTime = props.lastStagedTime ?? transferContext.lastStagedTime;
  const recentAssets = props.recentAssets ?? transferContext.recentAssets;
  const onRefreshRecentAssets = props.onRefreshRecentAssets ?? transferContext.fetchRecentAssets;
  const onClearRecentAssets = props.onClearRecentAssets ?? transferContext.clearRecentAssets;

  const {
    activeShot,
    sceneProject,
    sanitizedSceneName,
    handleSendShot,
    handleSendScene,
    handleDismissError
  } = props;

  // Extract workflow filenames & paths robustly
  const stagedWorkflowFilename =
    transferResult?.staged_workflow_filename ||
    (transferResult as any)?.staged_workflow_filenames?.[0] ||
    (activeShot ? `${sanitizedSceneName}_Shot_${formatShotNumber(activeShot.shot_number)}.json` : "Workflow.json");

  const remoteWorkflowPaths =
    transferResult?.remote_workflow_paths?.length
      ? transferResult.remote_workflow_paths
      : transferResult?.remote_workflow_path
      ? [transferResult.remote_workflow_path]
      : [];

  const baseTemplateUsed =
    (transferResult as any)?.base_template_used ||
    activeShot?.workflow_file ||
    sceneProject.workflow_file ||
    "minimax_video_workflow.json";

  const assignedSlotsCount = activeShot?.assigned_slots ? Object.keys(activeShot.assigned_slots).length : 0;
  const steps = activeShot?.generation_params?.steps ?? 30;
  const megapixels = activeShot?.generation_params?.megapixels ?? 0.5;
  const frames = activeShot?.generation_params?.frames ?? 81;
  const durationSec = (frames / 24).toFixed(1);

  const formatBytes = (bytes?: number): string => {
    if (!bytes || bytes <= 0) return "0 KB";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="w-full mt-2 space-y-4">
      {/* 1. In-Progress State with File-by-File Visibility */}
      {transferState === "progress" && (
        <div className="bg-zinc-900 border-2 border-indigo-500/50 rounded-xl overflow-hidden shadow-xl">
          <div className="p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                  <UploadCloud className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                    <span>
                      {lastAction === "execute_shot"
                        ? "Executing on Remote GPU..."
                        : lastAction === "scene"
                        ? "Batch Staging Scene to Remote GPU..."
                        : "Staging Shot to Remote GPU..."}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                      Live SFTP
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400 font-mono mt-0.5">{progressStep}</p>
                </div>
              </div>

              {totalFiles > 0 && (
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-indigo-300">
                    File {Math.min(fileIndex + 1, totalFiles)} of {totalFiles}
                  </span>
                  <span className="text-[10px] text-zinc-500 block">
                    {progressPercent}% total
                  </span>
                </div>
              )}
            </div>

            {/* Overall Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-zinc-400 font-mono">
                <span>Overall Batch Progress</span>
                <span className="font-bold text-indigo-300">{progressPercent}%</span>
              </div>
              <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden p-0.5 border border-zinc-700/50">
                <div
                  className="h-full bg-linear-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-300 ease-out relative"
                  style={{ width: `${progressPercent}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                </div>
              </div>
            </div>

            {/* Currently Active Uploading File Card */}
            {currentFile && (
              <div className="bg-zinc-950/90 border border-indigo-500/30 rounded-lg p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
                    <span className="text-xs font-mono font-bold text-zinc-200 truncate">
                      {currentFile}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-mono font-bold text-indigo-300">
                      {currentFilePercent}%
                    </span>
                    {currentFileBytes && (
                      <span className="text-[10px] text-zinc-400 font-mono block">
                        {formatBytes(currentFileBytes.transferred)} / {formatBytes(currentFileBytes.total)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-150 ease-out"
                    style={{ width: `${currentFilePercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Active Transfer Files Checklist */}
            {activeFiles && activeFiles.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                  Transfer Queue ({activeFiles.length} files)
                </span>
                <div className="bg-zinc-950/80 border border-zinc-800 rounded-lg max-h-40 overflow-y-auto divide-y divide-zinc-800/60 p-1">
                  {activeFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="px-2.5 py-1.5 flex items-center justify-between gap-2 text-xs font-mono"
                    >
                      <div className="flex items-center gap-2 truncate">
                        {file.status === "transferred" ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : file.status === "transferring" ? (
                          <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin shrink-0" />
                        ) : file.status === "failed" ? (
                          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        )}
                        <span
                          className={`truncate ${
                            file.status === "transferred"
                              ? "text-zinc-400"
                              : file.status === "transferring"
                              ? "text-indigo-200 font-bold"
                              : file.status === "failed"
                              ? "text-red-300"
                              : "text-zinc-500"
                          }`}
                        >
                          {file.filename}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {file.size_bytes > 0 && (
                          <span className="text-[10px] text-zinc-500">
                            {formatBytes(file.size_bytes)}
                          </span>
                        )}
                        <span
                          className={`text-[10px] uppercase font-sans font-semibold px-1.5 py-0.2 rounded ${
                            file.status === "transferred"
                              ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/40"
                              : file.status === "transferring"
                              ? "bg-indigo-950 text-indigo-300 border border-indigo-700"
                              : file.status === "failed"
                              ? "bg-red-950 text-red-300 border border-red-800"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {file.status === "transferred"
                            ? "✓ Staged"
                            : file.status === "transferring"
                            ? `${file.percent || 0}%`
                            : file.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Error State */}
      {transferState === "error" && (
        <div className="bg-red-950/20 border border-red-900/50 rounded-xl shadow-lg p-5">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-red-900/30 rounded-lg shrink-0 mt-0.5">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="text-base font-bold text-red-400">
                {lastAction === "execute_shot" ? "Execution Failed" : "Staging Failed"}
              </h3>
              <div className="bg-red-950/40 border border-red-900/30 p-3 rounded-lg">
                <p className="text-sm text-red-300 font-mono break-words">{error}</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={lastAction === "shot" || lastAction === "execute_shot" ? handleSendShot : handleSendScene}
                  className="px-4 py-2 bg-red-900/40 hover:bg-red-900/60 text-red-200 text-sm font-medium rounded-lg transition-colors cursor-pointer"
                >
                  Retry
                </button>
                <button
                  onClick={handleDismissError}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Success State */}
      {transferState === "success" && transferResult && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-md overflow-hidden flex flex-col text-zinc-900 dark:text-zinc-100">
          {/* Light Blue Header */}
          <div className="p-4 border-b border-sky-100 dark:border-sky-900/40 flex items-center justify-between bg-sky-50 dark:bg-sky-950/40">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-sky-500 dark:text-sky-400" />
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-sky-950 dark:text-sky-100">
                  {lastAction === "execute_shot" ? "Executed on Remote GPU" : "Successfully Staged to Remote GPU"}
                </h3>
                {activeShot && lastAction === "execute_shot" && (
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded shadow-xs uppercase tracking-wider ${
                    activeShot.status === "rendered" ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30" :
                    activeShot.status === "rendering" ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 animate-pulse" :
                    activeShot.status === "staged" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30" :
                    "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                  }`}>
                    {activeShot.status === "rendered" ? "✓ Rendered" :
                     activeShot.status === "rendering" ? "⟳ Rendering" :
                     activeShot.status === "staged" ? "✓ Staged" :
                     "Unstaged"}
                  </span>
                )}
              </div>
            </div>
            {lastStagedTime && (
              <span className="text-xs text-sky-700 dark:text-sky-400 font-medium flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                {lastAction === "execute_shot" ? `Executed at ${lastStagedTime}` : `Staged at ${lastStagedTime}`}
              </span>
            )}
          </div>

          {/* Main White/Gray Console Content */}
          <div className="p-5 space-y-5 bg-white dark:bg-zinc-900">
            {/* Synthesized Shot Workflow & Base Template Card */}
            <div className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 rounded-lg p-3.5 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-sky-500 dark:text-sky-400 shrink-0" />
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Synthesized Shot Workflow</span>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-100/70 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 font-mono">
                  <Sparkles className="w-2.5 h-2.5" />
                  Synthesized & Injected
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                <div>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider block">Generated Workflow File</span>
                  <p className="text-zinc-900 dark:text-zinc-100 font-mono font-bold truncate mt-0.5">{stagedWorkflowFilename}</p>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider block">Base Template Used</span>
                  <p className="text-zinc-600 dark:text-zinc-400 font-mono text-[11px] truncate mt-0.5">{baseTemplateUsed}</p>
                </div>
              </div>
            </div>

            {/* Remote SFTP Path & Assets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Remote Workflow Destination */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                  <h4 className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Remote SFTP Path</h4>
                </div>
                <div className="space-y-1.5">
                  {remoteWorkflowPaths.length > 0 ? (
                    remoteWorkflowPaths.map((pathStr, i) => (
                      <div key={i} className="bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 px-3 py-2 rounded text-[11px] text-zinc-800 dark:text-zinc-200 font-mono break-all shadow-2xs" title={pathStr}>
                        {pathStr}
                      </div>
                    ))
                  ) : (
                    <div className="bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 px-3 py-2 rounded text-[11px] text-zinc-600 dark:text-zinc-400 font-mono">
                      {transferResult.remote_dir}/user/default/workflows/{stagedWorkflowFilename}
                    </div>
                  )}
                </div>
              </div>

              {/* Transferred Assets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                    <h4 className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Transferred & Verified Files</h4>
                  </div>
                  {transferResult.verified_files?.length ? (
                    <span className="text-[10px] text-sky-700 dark:text-sky-300 font-mono bg-sky-100/70 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 px-1.5 py-0.5 rounded font-medium">
                      ✓ {transferResult.verified_files.length} verified
                    </span>
                  ) : null}
                </div>
                {transferResult.uploaded_files?.length ? (
                  <div className="bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 rounded p-2.5 max-h-[120px] overflow-y-auto">
                    <ul className="space-y-1">
                      {transferResult.uploaded_files.map((file, i) => (
                        <li key={i} className="text-[11px] text-zinc-700 dark:text-zinc-300 font-mono truncate flex items-center justify-between gap-1.5">
                          <span className="flex items-center gap-1.5 truncate">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                            {file}
                          </span>
                          <span className="text-[9px] text-sky-600 dark:text-sky-400 uppercase font-sans font-semibold shrink-0">Verified</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 italic bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 rounded p-2.5">
                    No new files transferred (assets verified in remote <code className="font-mono">/input</code>).
                  </p>
                )}
              </div>
            </div>

            {/* Injected Specs Summary */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <h4 className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Injected Generation Specs</h4>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded p-2 text-center">
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block uppercase font-sans font-medium">Prompt Node</span>
                  <span className="text-zinc-900 dark:text-zinc-100 font-bold">#{activeShot?.prompt_node_id || "Auto"}</span>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded p-2 text-center">
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block uppercase font-sans font-medium">Steps</span>
                  <span className="text-zinc-900 dark:text-zinc-100 font-bold">{steps} steps</span>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded p-2 text-center">
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block uppercase font-sans font-medium">Resolution</span>
                  <span className="text-zinc-900 dark:text-zinc-100 font-bold">{megapixels} MP</span>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded p-2 text-center">
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block uppercase font-sans font-medium">Duration</span>
                  <span className="text-zinc-900 dark:text-zinc-100 font-bold">{frames}f (~{durationSec}s)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Action Notice */}
          <div className="bg-zinc-50 dark:bg-zinc-950/60 p-4 border-t border-zinc-200 dark:border-zinc-800 flex items-start gap-3">
            <ArrowRight className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {lastAction === "execute_shot" ? "Execution Triggered Successfully" : "Ready for Remote Execution"}
              </h4>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
                {lastAction === "execute_shot" ? (
                  <>Prompt queued in ComfyUI! Prompt ID: <code className="bg-white dark:bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 text-sky-700 dark:text-sky-300 font-mono shadow-2xs font-semibold">{(transferResult as any).prompt_id || "Queued"}</code></>
                ) : (
                  <>Open ComfyUI on your Remote GPU, navigate to <code className="bg-white dark:bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 text-sky-700 dark:text-sky-300 font-mono shadow-2xs font-semibold">Workflows -&gt; {sanitizedSceneName}</code>, load <code className="bg-white dark:bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 text-sky-700 dark:text-sky-300 font-mono shadow-2xs font-semibold">{stagedWorkflowFilename}</code>, and click <strong>Queue Prompt</strong>.</>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. Running List of Most Recently Updated Assets */}
      <RecentUpdatedAssetsCard
        recentAssets={recentAssets}
        onRefresh={onRefreshRecentAssets}
        onClear={onClearRecentAssets}
      />
    </div>
  );
};

