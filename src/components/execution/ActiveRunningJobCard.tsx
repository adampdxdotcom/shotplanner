import React from "react";
import { 
  Square, 
  Loader2, 
  Cpu, 
  Clock, 
  Layers, 
  Activity, 
  CheckCircle2, 
  Film,
  Sparkles
} from "lucide-react";
import { ComfyQueueItem, ComfyDeviceStats } from "../../types";
import { formatShotNumber } from "../../utils/formatters";

interface ActiveRunningJobCardProps {
  job: ComfyQueueItem;
  currentStep?: number;
  maxSteps?: number;
  activeNodeName?: string | null;
  activeNodeId?: string | null;
  elapsedMs?: number;
  device?: ComfyDeviceStats | null;
  isInterrupting?: boolean;
  onInterrupt: () => void;
}

export const ActiveRunningJobCard: React.FC<ActiveRunningJobCardProps> = ({
  job,
  currentStep = 0,
  maxSteps = 0,
  activeNodeName,
  activeNodeId,
  elapsedMs = 0,
  device,
  isInterrupting = false,
  onInterrupt
}) => {
  const hasStepProgress = maxSteps > 0 && currentStep >= 0;
  const progressPercent = hasStepProgress ? Math.min(100, Math.round((currentStep / maxSteps) * 100)) : 0;
  
  // Format elapsed time in mm:ss or seconds
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formattedTime = minutes > 0 
    ? `${minutes}m ${seconds.toString().padStart(2, "0")}s`
    : `${seconds}s`;

  return (
    <div className="bg-gradient-to-br from-cyan-950/40 via-zinc-900 to-zinc-950 border-2 border-cyan-500/50 rounded-xl p-4 shadow-lg space-y-3.5 relative overflow-hidden">
      {/* Subtle background glow effect */}
      <div className="absolute -top-10 -right-10 w-36 h-36 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header Row: Live Status + Action */}
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500 shadow-sm shadow-cyan-500/50"></span>
          </span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                Active Execution
              </span>
              {job.shot_number !== undefined && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                  <Film className="w-2.5 h-2.5" />
                  Shot #{formatShotNumber(Number(job.shot_number))}
                </span>
              )}
              {job.scene_name && (
                <span className="text-[11px] text-zinc-400 font-medium truncate max-w-[120px]" title={job.scene_name}>
                  {job.scene_name}
                </span>
              )}
            </div>
            <div className="text-[10px] font-mono text-zinc-400 mt-0.5 truncate max-w-xs sm:max-w-md" title={job.prompt_id}>
              Prompt ID: <span className="text-zinc-300 select-all">{job.prompt_id}</span>
            </div>
          </div>
        </div>

        {/* Interrupt / Stop Button */}
        <button
          onClick={onInterrupt}
          disabled={isInterrupting}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shrink-0 cursor-pointer active:scale-95 ${
            isInterrupting
              ? "bg-red-950 text-red-400 border border-red-800/60 cursor-not-allowed opacity-80"
              : "bg-red-600 hover:bg-red-500 text-white border border-red-400 shadow-red-900/30"
          }`}
          title="Interrupt current generation on ComfyUI"
        >
          {isInterrupting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Square className="w-3.5 h-3.5 fill-current" />
          )}
          <span>{isInterrupting ? "Stopping..." : "Stop Job"}</span>
        </button>
      </div>

      {/* Node Execution & Step Progress */}
      <div className="space-y-1.5 bg-black/40 border border-zinc-800/80 rounded-lg p-3 relative z-10">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-zinc-300 font-medium truncate">
            <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0 animate-pulse" />
            <span className="truncate">
              {activeNodeName ? (
                <span>
                  Executing: <strong className="text-white font-semibold">{activeNodeName}</strong>
                  {activeNodeId && <span className="text-zinc-500 ml-1 font-mono text-[10px]">(Node #{activeNodeId})</span>}
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
        <div className="w-full bg-zinc-800/80 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full transition-all duration-150 rounded-full shadow-xs shadow-cyan-400"
            style={{ width: `${hasStepProgress ? progressPercent : 100}%` }}
          />
        </div>
      </div>

      {/* Metrics Row: Elapsed Time + VRAM telemetry */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400 pt-0.5 relative z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono">
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            <span>Elapsed: <strong className="text-zinc-200">{formattedTime}</strong></span>
          </div>

          {job.output_prefix && (
            <div className="hidden sm:flex items-center gap-1 text-[11px] text-zinc-400 font-mono truncate max-w-[200px]" title={job.output_prefix}>
              <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="truncate">{job.output_prefix}</span>
            </div>
          )}
        </div>

        {/* VRAM Telemetry Badge */}
        {device && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-300">
            <Cpu className="w-3 h-3 text-indigo-400 shrink-0" />
            <span className="text-zinc-400">{device.name.replace(/NVIDIA /i, "")}:</span>
            <span className="font-semibold text-emerald-400">{device.vram_used_gb} / {device.vram_total_gb} GB VRAM</span>
            <span className="text-zinc-500">({device.vram_usage_percent}%)</span>
          </div>
        )}
      </div>
    </div>
  );
};
