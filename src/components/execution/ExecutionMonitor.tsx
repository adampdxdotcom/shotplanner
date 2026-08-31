import React from "react";
import { Play } from "lucide-react";
import { ComfyMonitorState } from "../../hooks/useComfyMonitor";

export interface ExecutionMonitorProps {
  monitorState: ComfyMonitorState;
}

export const ExecutionMonitor: React.FC<ExecutionMonitorProps> = ({ monitorState }) => {
  return (
    <div className="bg-zinc-900 border-2 border-indigo-500/50 rounded-xl p-6 shadow-[0_0_20px_-5px_rgba(99,102,241,0.3)] flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
            <Play className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-indigo-100">Active Execution Monitor</h2>
            <p className="text-sm text-zinc-400">
              {monitorState.isExecuting ? "ComfyUI is currently processing..." : "Job queued..."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex flex-col items-end">
            <span className="text-zinc-500">Queue</span>
            <span className="text-amber-400 text-sm">#{monitorState.queueRemaining}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-zinc-500">Elapsed</span>
            <span className="text-zinc-200 text-sm">{(monitorState.elapsedMs / 1000).toFixed(1)}s</span>
          </div>
        </div>
      </div>

      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 space-y-4">
        <div className="flex justify-between items-end">
          <div>
            <span className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Active Node</span>
            <span className="text-lg font-bold text-zinc-200">
              {monitorState.activeNodeId ? `Node ${monitorState.activeNodeId}` : "Waiting..."}
            </span>
          </div>
          <div className="text-right">
            <span className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Steps</span>
            <span className="text-lg font-bold text-indigo-400">
              {monitorState.currentStep} / {monitorState.maxSteps || "?"}
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-zinc-500">
            <span>Progress</span>
            <span>{monitorState.maxSteps > 0 ? Math.round((monitorState.currentStep / monitorState.maxSteps) * 100) : 0}%</span>
          </div>
          <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full transition-all duration-300 ease-out relative"
              style={{ width: `${monitorState.maxSteps > 0 ? Math.round((monitorState.currentStep / monitorState.maxSteps) * 100) : 0}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
