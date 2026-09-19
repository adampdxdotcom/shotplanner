import React from "react";
import { 
  Play, 
  Square, 
  Loader2, 
  Cpu, 
  Clock, 
  Activity, 
  Film,
  Sparkles,
  Workflow,
  CheckCircle2,
  Zap,
  Server
} from "lucide-react";
import { ComfyQueueItem, ComfyDeviceStats, ShotItem } from "../../types";
import { formatShotNumber } from "../../utils/formatters";

interface ShotWorkflowMonitorCardProps {
  activeShot: ShotItem | null | undefined;
  activeWorkflowPath?: string;
  job?: ComfyQueueItem | null;
  isExecuting: boolean;
  currentStep?: number;
  maxSteps?: number;
  activeNodeName?: string | null;
  activeNodeId?: string | null;
  elapsedMs?: number;
  device?: ComfyDeviceStats | null;
  isInterrupting?: boolean;
  isRunningDisabled?: boolean;
  onRunWorkflow: () => void;
  onInterrupt: () => void;
  comfyUrl?: string;
}

export const ShotWorkflowMonitorCard: React.FC<ShotWorkflowMonitorCardProps> = ({
  activeShot,
  activeWorkflowPath,
  job,
  isExecuting,
  currentStep = 0,
  maxSteps = 0,
  activeNodeName,
  activeNodeId,
  elapsedMs = 0,
  device,
  isInterrupting = false,
  isRunningDisabled = false,
  onRunWorkflow,
  onInterrupt,
  comfyUrl
}) => {
  const hasStepProgress = maxSteps > 0 && currentStep >= 0;
  const progressPercent = hasStepProgress ? Math.min(100, Math.round((currentStep / maxSteps) * 100)) : 0;
  
  // Format elapsed time
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formattedTime = minutes > 0 
    ? `${minutes}m ${seconds.toString().padStart(2, "0")}s`
    : `${seconds}s`;

  const displayWorkflowName = activeWorkflowPath 
    ? activeWorkflowPath.split("/").pop() 
    : (activeShot?.workflow_file || "No workflow linked");

  return (
    <div className={`rounded-xl border-2 p-4 transition-all relative overflow-hidden shadow-md ${
      isExecuting 
        ? "bg-gradient-to-br from-cyan-950/40 via-zinc-900 to-zinc-950 border-cyan-500/60" 
        : "bg-white dark:bg-zinc-900/90 border-zinc-200 dark:border-zinc-800"
    }`}>
      {/* Background glow when executing */}
      {isExecuting && (
        <div className="absolute -top-10 -right-10 w-44 h-44 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      )}

      {/* Top Header: Shot Identifier + Status + Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10 border-b border-zinc-200 dark:border-zinc-800/80 pb-3">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg shrink-0 ${
            isExecuting 
              ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40" 
              : "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20"
          }`}>
            <Workflow className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              {activeShot ? (
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                  <Film className="w-3 h-3" />
                  Shot #{formatShotNumber(activeShot.shot_number)}
                </span>
              ) : (
                <span className="text-xs font-bold text-zinc-500">No Shot Selected</span>
              )}

              {isExecuting ? (
                <span className="px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                  </span>
                  Executing on GPU
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Ready
                </span>
              )}

              {activeShot?.shot_name && (
                <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                  {activeShot.shot_name}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 font-mono truncate max-w-sm" title={activeWorkflowPath || displayWorkflowName}>
                {displayWorkflowName}
              </span>
            </div>
          </div>
        </div>

        {/* Execution Control Action Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          {/* Run / Queue Button */}
          <button
            onClick={onRunWorkflow}
            disabled={isRunningDisabled || isExecuting || !activeShot}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
              !activeShot || isExecuting
                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border border-zinc-200 dark:border-zinc-700 cursor-not-allowed opacity-60"
                : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 cursor-pointer active:scale-95"
            }`}
            title="Send active shot & parameters to ComfyUI"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Run Workflow</span>
          </button>

          {/* Stop / Interrupt Button */}
          <button
            onClick={onInterrupt}
            disabled={!isExecuting || isInterrupting}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
              isExecuting
                ? isInterrupting
                  ? "bg-red-950 text-red-400 border border-red-800/60 cursor-not-allowed opacity-80"
                  : "bg-red-600 hover:bg-red-500 text-white border border-red-400 shadow-red-900/30 cursor-pointer active:scale-95"
                : "bg-zinc-100 dark:bg-zinc-800/60 text-zinc-400 dark:text-zinc-600 border border-zinc-200 dark:border-zinc-800 cursor-not-allowed"
            }`}
            title={isExecuting ? "Interrupt active execution on ComfyUI" : "No job actively running"}
          >
            {isInterrupting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Square className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{isInterrupting ? "Stopping..." : "Stop"}</span>
          </button>
        </div>
      </div>

      {/* Middle Execution & Progress Details */}
      {isExecuting ? (
        <div className="mt-3 space-y-2 bg-black/40 border border-zinc-800/80 rounded-lg p-3 relative z-10">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-zinc-300 font-medium truncate">
              <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0 animate-pulse" />
              <span className="truncate">
                {activeNodeName ? (
                  <span>
                    Executing Node: <strong className="text-white font-semibold">{activeNodeName}</strong>
                    {activeNodeId && <span className="text-zinc-500 ml-1 font-mono text-[10px]">(ID #{activeNodeId})</span>}
                  </span>
                ) : (
                  <span className="text-zinc-400 italic">Processing pipeline nodes...</span>
                )}
              </span>
            </div>

            {hasStepProgress && (
              <span className="text-xs font-mono font-bold text-cyan-300 shrink-0 ml-2">
                Step {currentStep} / {maxSteps} ({progressPercent}%)
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="w-full bg-zinc-800/80 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full transition-all duration-150 rounded-full shadow-xs shadow-cyan-400"
              style={{ width: `${hasStepProgress ? progressPercent : 100}%` }}
            />
          </div>

          {job?.prompt_id && (
            <div className="text-[10px] font-mono text-zinc-400 truncate">
              Prompt ID: <span className="text-zinc-300 select-all">{job.prompt_id}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 py-2 px-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800/60 flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-2 truncate">
            <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="truncate">Ready to launch or auto-capture takes from remote ComfyUI.</span>
          </div>
          {comfyUrl && (
            <span className="text-[10px] font-mono text-zinc-400 truncate hidden sm:inline">
              {comfyUrl}
            </span>
          )}
        </div>
      )}

      {/* Footer Metrics Row: Elapsed Time + GPU Telemetry */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400 pt-3 mt-1 relative z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono">
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            <span>Elapsed: <strong className="text-zinc-800 dark:text-zinc-200">{isExecuting ? formattedTime : "0s"}</strong></span>
          </div>

          {activeShot?.takes && activeShot.takes.length > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-zinc-500 font-mono">
              <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />
              <span>{activeShot.takes.length} Take{activeShot.takes.length === 1 ? "" : "s"} logged</span>
            </div>
          )}
        </div>

        {/* VRAM Telemetry Badge */}
        {device ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] font-mono text-zinc-700 dark:text-zinc-300">
            <Cpu className="w-3 h-3 text-indigo-500 dark:text-indigo-400 shrink-0" />
            <span className="text-zinc-500 dark:text-zinc-400">{device.name.replace(/NVIDIA /i, "")}:</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {device.vram_free_gb} GB Free / {device.vram_total_gb} GB
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[11px] text-zinc-400 font-mono">
            <Server className="w-3 h-3 text-zinc-400" />
            <span>GPU Ready</span>
          </div>
        )}
      </div>
    </div>
  );
};
