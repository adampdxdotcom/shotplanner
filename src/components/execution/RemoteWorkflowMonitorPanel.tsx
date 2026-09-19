import React from "react";
import { 
  AppConfig, 
  ShotItem, 
  SceneProjectFile 
} from "../../types";
import { ComfyMonitorState } from "../../hooks/useComfyMonitor";
import { useComfyQueue } from "../../hooks/useComfyQueue";
import { useAutoWorkflowSync } from "../../hooks/useAutoWorkflowSync";
import { ShotWorkflowMonitorCard } from "./ShotWorkflowMonitorCard";
import { PendingQueueJobCard } from "./PendingQueueJobCard";
import { 
  Radio, 
  RefreshCw, 
  Activity,
  Layers,
  Trash2
} from "lucide-react";

interface RemoteWorkflowMonitorPanelProps {
  config: AppConfig;
  monitorState?: ComfyMonitorState;
  activeShot: ShotItem | null | undefined;
  sceneProject: SceneProjectFile;
  onUpdateShot: (updater: (prev: ShotItem) => ShotItem) => void;
  onUpdateProject?: (updater: (prev: SceneProjectFile) => SceneProjectFile) => void;
  onExecuteShot?: () => void;
  onShowToast?: (msg: string, type: "success" | "error" | "info") => void;
}

export const RemoteWorkflowMonitorPanel: React.FC<RemoteWorkflowMonitorPanelProps> = ({
  config,
  monitorState,
  activeShot,
  sceneProject,
  onUpdateShot,
  onUpdateProject,
  onExecuteShot,
  onShowToast
}) => {
  // Automated background workflow discovery & shot matching (scans every 8 seconds)
  useAutoWorkflowSync({
    config,
    sceneProject,
    enabled: true,
    pollIntervalMs: 8000,
    onUpdateProject,
    onShowToast
  });

  // ComfyUI Queue and System Telemetry Hook (polling ComfyUI queue)
  const {
    queueStatus,
    systemStats,
    isLoading: isQueueLoading,
    isInterrupting,
    deletingPromptId,
    isClearingQueue,
    refreshQueue,
    interruptExecution,
    deleteJob,
    clearPendingQueue
  } = useComfyQueue({
    apiUrl: config.comfyui_api_url,
    authToken: config.remote_api_token,
    sceneName: sceneProject.scene_name,
    enabled: true,
    onShowToast
  });

  const activeMonitoredWorkflow = activeShot?.monitored_workflow;
  const primaryDevice = systemStats?.devices?.[0] || null;

  // Derive execution state seamlessly: True if queue poller has a running job OR websocket is active
  const isExecuting = queueStatus.is_executing || Boolean(monitorState?.isExecuting);
  const activeRunningJob = queueStatus.running[0] || (isExecuting ? {
    index: 0,
    prompt_id: monitorState?.activePromptId || (activeShot?.latest_prompt_id || "active-job"),
    status: "running" as const,
    scene_name: sceneProject.scene_name,
    shot_number: activeShot?.shot_number,
    timestamp: Date.now()
  } : null);

  return (
    <div className="bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-5 shadow-xs">
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800/80 pb-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/20 shrink-0">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Remote ComfyUI Live Monitor
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-cyan-100 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800">
                Live Telemetry
              </span>
              <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Auto-Sync Active (8s)
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Unified queue poller &amp; workflow executor. Automatically links shot workflows and monitors live generation.
            </p>
          </div>
        </div>

        {/* Action Header Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => refreshQueue()}
            disabled={isQueueLoading}
            className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-cyan-500 border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer"
            title="Refresh ComfyUI Queue"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isQueueLoading ? "animate-spin text-cyan-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* SECTION 1: PERMANENT SHOT WORKFLOW & EXECUTION CARD */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
              Shot Execution &amp; Live Monitor
            </h3>
            {queueStatus.queue_remaining > 0 ? (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20">
                {queueStatus.queue_remaining} Job{queueStatus.queue_remaining === 1 ? "" : "s"} in Queue
              </span>
            ) : (
              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                ● Server Ready
              </span>
            )}
          </div>

          {/* Clear All Queue Button */}
          {queueStatus.pending.length > 0 && (
            <button
              onClick={clearPendingQueue}
              disabled={isClearingQueue}
              className="text-xs text-zinc-400 hover:text-red-400 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Clear all pending jobs in queue"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isClearingQueue ? "Clearing..." : "Clear Pending Queue"}</span>
            </button>
          )}
        </div>

        {/* Permanent Interactive Card: Shows Workflow, Run Button, Stop Button, Stats & Live Steps */}
        <ShotWorkflowMonitorCard
          activeShot={activeShot}
          activeWorkflowPath={activeMonitoredWorkflow}
          job={activeRunningJob}
          isExecuting={isExecuting}
          currentStep={monitorState?.currentStep || 0}
          maxSteps={monitorState?.maxSteps || 0}
          activeNodeName={monitorState?.activeNodeName || (isExecuting ? "Processing Nodes" : null)}
          activeNodeId={monitorState?.activeNodeId || null}
          elapsedMs={monitorState?.elapsedMs || 0}
          device={primaryDevice}
          isInterrupting={isInterrupting}
          isRunningDisabled={!onExecuteShot || !activeShot}
          onRunWorkflow={() => onExecuteShot?.()}
          onInterrupt={interruptExecution}
          comfyUrl={config.comfyui_api_url}
        />

        {/* Pending Queue List (if any jobs are queued behind active) */}
        {queueStatus.pending.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-300">
              <Layers className="w-3.5 h-3.5 text-amber-500" />
              <span>Pending Queue ({queueStatus.pending.length})</span>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {queueStatus.pending.map((pendingJob, idx) => (
                <PendingQueueJobCard
                  key={pendingJob.prompt_id || idx}
                  job={pendingJob}
                  rank={idx + 1}
                  isDeleting={deletingPromptId === pendingJob.prompt_id}
                  onDelete={deleteJob}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
