import React, { useState } from "react";
import { 
  AppConfig, 
  ShotItem, 
  SceneProjectFile, 
  RemoteWorkflowItem 
} from "../../types";
import { formatShotNumber } from "../../utils/formatters";
import { ComfyMonitorState } from "../../hooks/useComfyMonitor";
import { useComfyQueue } from "../../hooks/useComfyQueue";
import { filterRemoteWorkflows } from "../../utils/remoteWorkflowFilter";
import { ActiveRunningJobCard } from "./ActiveRunningJobCard";
import { PendingQueueJobCard } from "./PendingQueueJobCard";
import { 
  Radio, 
  RefreshCw, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Workflow, 
  Folder, 
  Cpu, 
  XCircle,
  Activity,
  Layers,
  Trash2,
  Check
} from "lucide-react";

interface RemoteWorkflowMonitorPanelProps {
  config: AppConfig;
  monitorState?: ComfyMonitorState;
  activeShot: ShotItem | null | undefined;
  sceneProject: SceneProjectFile;
  onUpdateShot: (updater: (prev: ShotItem) => ShotItem) => void;
  onShowToast?: (msg: string, type: "success" | "error" | "info") => void;
}

export const RemoteWorkflowMonitorPanel: React.FC<RemoteWorkflowMonitorPanelProps> = ({
  config,
  monitorState,
  activeShot,
  sceneProject,
  onUpdateShot,
  onShowToast
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [remoteWorkflows, setRemoteWorkflows] = useState<RemoteWorkflowItem[]>([]);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<"idle" | "success" | "error">("idle");
  const [lastScannedAt, setLastScannedAt] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWorkflowForAssign, setSelectedWorkflowForAssign] = useState<string>("");

  // ComfyUI Queue and System Telemetry Hook
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
    enabled: true,
    onShowToast
  });

  // Scan remote ComfyUI installation for workflows via SSH and ComfyUI API
  const handleScanRemote = async () => {
    setIsScanning(true);
    setScanStatus("idle");
    setScanMessage(null);

    try {
      const res = await fetch("/api/workflow/remote-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          remote_host: config.remote_host,
          ssh_port: config.ssh_port,
          ssh_username: config.ssh_username,
          ssh_password: config.ssh_password,
          ssh_key_path: config.ssh_key_path,
          ssh_private_key: config.ssh_private_key,
          remote_comfyui_root: config.remote_comfyui_root || "/workspace/runpod-slim/ComfyUI",
          comfyui_api_url: config.comfyui_api_url,
          remote_api_token: config.remote_api_token
        })
      });

      const data = await res.json();

      if (data.success && Array.isArray(data.workflows)) {
        const cleaned = filterRemoteWorkflows(data.workflows);
        setRemoteWorkflows(cleaned);
        setScanStatus("success");
        setScanMessage(data.message || `Found ${cleaned.length} workflows.`);
        setLastScannedAt(new Date().toLocaleTimeString());
        onShowToast?.(`Discovered ${cleaned.length} remote workflow(s)`, "success");
      } else {
        setScanStatus("error");
        setScanMessage(data.message || data.error || "Failed to scan remote ComfyUI.");
        onShowToast?.(data.message || "Remote scan returned no workflows.", "info");
      }
    } catch (err: any) {
      setScanStatus("error");
      setScanMessage(err.message || "Failed to connect to remote host.");
      onShowToast?.("Error scanning remote ComfyUI", "error");
    } finally {
      setIsScanning(false);
    }
  };

  // Assign a remote workflow to the active shot for passive monitoring
  const handleAssignWorkflow = (workflowPath: string) => {
    if (!activeShot) return;
    onUpdateShot(prev => ({
      ...prev,
      monitored_workflow: workflowPath
    }));
    onShowToast?.(`Assigned '${workflowPath.split("/").pop()}' to Shot ${formatShotNumber(activeShot.shot_number)} for monitoring.`, "success");
  };

  // Clear monitoring assignment from active shot
  const handleClearAssignment = () => {
    if (!activeShot) return;
    onUpdateShot(prev => ({
      ...prev,
      monitored_workflow: undefined
    }));
    onShowToast?.(`Removed monitored workflow from Shot ${formatShotNumber(activeShot.shot_number)}.`, "info");
  };

  // Helper to find which shot is currently monitoring a given workflow
  const getMonitoringShotForWorkflow = (wfPath: string): ShotItem | undefined => {
    return sceneProject.shots.find(s => s.monitored_workflow === wfPath || s.monitored_workflow === wfPath.split("/").pop());
  };

  // Filter workflows by search query and remove cache/temp workflows
  const filteredWorkflows = filterRemoteWorkflows(remoteWorkflows).filter(wf => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return wf.filename.toLowerCase().includes(q) || (wf.folder || "").toLowerCase().includes(q) || wf.path.toLowerCase().includes(q);
  });

  const activeMonitoredWorkflow = activeShot?.monitored_workflow;
  const primaryDevice = systemStats?.devices?.[0] || null;

  // Active running job info (from queue endpoint or synthesized from active monitor state)
  const isExecuting = queueStatus.is_executing || Boolean(monitorState?.isExecuting);
  const activeRunningJob = queueStatus.running[0] || (isExecuting ? {
    index: 0,
    prompt_id: monitorState?.activePromptId || "active-job",
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
                Remote ComfyUI Live Monitor &amp; Workflows
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-cyan-100 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800">
                Live Telemetry
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Live ComfyUI queue monitoring, execution controls, and remote workflow association.
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

          <button
            onClick={handleScanRemote}
            disabled={isScanning}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all shadow-xs ${
              isScanning
                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
                : "bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer active:scale-95"
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? "animate-spin text-cyan-400" : ""}`} />
            <span>{isScanning ? "Scanning Workflows..." : "Scan Remote ComfyUI"}</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: LIVE JOB & QUEUE MONITOR */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
              Live Queue &amp; Hardware Status
            </h3>
            {queueStatus.queue_remaining > 0 ? (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20">
                {queueStatus.queue_remaining} Job{queueStatus.queue_remaining === 1 ? "" : "s"} in Queue
              </span>
            ) : (
              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                ● Server Idle
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

        {/* Active Running Job Card */}
        {activeRunningJob ? (
          <ActiveRunningJobCard
            job={activeRunningJob}
            currentStep={monitorState?.currentStep || 0}
            maxSteps={monitorState?.maxSteps || 0}
            activeNodeName={monitorState?.activeNodeName || null}
            activeNodeId={monitorState?.activeNodeId || null}
            elapsedMs={monitorState?.elapsedMs || 0}
            device={primaryDevice}
            isInterrupting={isInterrupting}
            onInterrupt={interruptExecution}
          />
        ) : (
          /* Server Idle State Card */
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
                <Check className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    ComfyUI Server Idle &amp; Ready
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    ({config.comfyui_api_url || "http://127.0.0.1:8188"})
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  No active executions in pipeline. Ready to receive shot prompts and recipes.
                </p>
              </div>
            </div>

            {primaryDevice && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-mono self-start sm:self-auto">
                <Cpu className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="text-zinc-500 dark:text-zinc-400">{primaryDevice.name.replace(/NVIDIA /i, "")}:</span>
                <span className="font-semibold text-emerald-500 dark:text-emerald-400">
                  {primaryDevice.vram_free_gb} GB Free / {primaryDevice.vram_total_gb} GB Total
                </span>
              </div>
            )}
          </div>
        )}

        {/* Pending Queue List */}
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

      {/* Host Status Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950/60 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800/60">
        <div className="flex items-center gap-2 truncate">
          <Cpu className="w-4 h-4 text-zinc-400 shrink-0" />
          <span>Remote Target:</span>
          <span className="font-mono font-medium text-zinc-700 dark:text-zinc-300 truncate">
            {config.remote_host ? `${config.ssh_username || "root"}@${config.remote_host}:${config.ssh_port || 22}` : "No SSH host set (Configure in Settings)"}
          </span>
        </div>

        {lastScannedAt && (
          <span className="text-[11px] text-zinc-400">
            Last scan: {lastScannedAt} ({remoteWorkflows.length} workflows)
          </span>
        )}
      </div>

      {scanMessage && (
        <div className={`text-xs p-3 rounded-lg border flex items-start gap-2 ${
          scanStatus === "success" 
            ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50" 
            : scanStatus === "error"
            ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50"
            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700"
        }`}>
          {scanStatus === "success" ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" />
          ) : (
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
          )}
          <div className="flex-1">{scanMessage}</div>
        </div>
      )}

      {/* SECTION 2: Active Shot Association Card */}
      <div className="p-4 rounded-xl border-2 border-cyan-500/30 bg-cyan-50/20 dark:bg-cyan-950/10 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
              Active Shot Association
            </span>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {activeShot ? `Shot ${formatShotNumber(activeShot.shot_number)}: ${activeShot.shot_name || "Untitled Shot"}` : "No Shot Selected"}
            </h3>
          </div>

          {activeMonitoredWorkflow && (
            <button
              onClick={handleClearAssignment}
              className="text-xs text-red-600 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer"
              title="Remove monitored workflow assignment"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Unassign Workflow</span>
            </button>
          )}
        </div>

        {activeShot ? (
          activeMonitoredWorkflow ? (
            <div className="bg-white dark:bg-zinc-950 border border-cyan-500/40 rounded-lg p-3.5 space-y-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
                </span>
                <span className="text-xs font-bold text-cyan-700 dark:text-cyan-300 font-mono">
                  {activeMonitoredWorkflow}
                </span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                <strong>Passive Monitoring Active:</strong> ShotPlanner is bound to monitor this workflow in remote ComfyUI. Any generated renders from this workflow will be captured as takes for this shot.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                No remote workflow currently assigned for monitoring. Select a discovered workflow below to bind this shot:
              </p>

              {remoteWorkflows.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <select
                    value={selectedWorkflowForAssign}
                    onChange={(e) => setSelectedWorkflowForAssign(e.target.value)}
                    className="flex-1 w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-800 dark:text-zinc-200 outline-none focus:border-cyan-500"
                  >
                    <option value="">-- Choose Discovered Workflow --</option>
                    {remoteWorkflows.map((wf, idx) => (
                      <option key={`${wf.path}-${idx}`} value={wf.path}>
                        {wf.folder && wf.folder !== "root" ? `[${wf.folder}] ` : ""}{wf.filename} {wf.node_count ? `(${wf.node_count} nodes)` : ""}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => {
                      if (selectedWorkflowForAssign) {
                        handleAssignWorkflow(selectedWorkflowForAssign);
                        setSelectedWorkflowForAssign("");
                      }
                    }}
                    disabled={!selectedWorkflowForAssign}
                    className={`w-full sm:w-auto px-4 py-2 text-xs font-semibold rounded-lg shrink-0 transition-all ${
                      selectedWorkflowForAssign
                        ? "bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer"
                        : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
                    }`}
                  >
                    Assign to Shot {formatShotNumber(activeShot.shot_number)}
                  </button>
                </div>
              )}
            </div>
          )
        ) : (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
            Select a shot from the carousel to assign a workflow.
          </p>
        )}
      </div>

      {/* SECTION 3: Discovered Remote Workflows Browser */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Workflow className="w-4 h-4 text-zinc-400" />
            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
              Discovered Remote Workflows ({filteredWorkflows.length})
            </span>
          </div>

          {/* Search Filter */}
          {remoteWorkflows.length > 0 && (
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search workflows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 outline-none focus:border-cyan-500"
              />
            </div>
          )}
        </div>

        {remoteWorkflows.length === 0 ? (
          <div className="text-center py-8 px-4 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 space-y-2">
            <Radio className="w-8 h-8 text-zinc-400 dark:text-zinc-600 mx-auto" />
            <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              No Remote Workflows Scanned Yet
            </h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
              Click &ldquo;Scan Remote ComfyUI&rdquo; above to query your remote ComfyUI machine for workflows in user folders or workflows directory.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
            {filteredWorkflows.map((wf, idx) => {
              const monitoringShot = getMonitoringShotForWorkflow(wf.path);
              const isAssignedToActive = activeShot && (activeShot.monitored_workflow === wf.path || activeShot.monitored_workflow === wf.filename);

              return (
                <div
                  key={`${wf.path}-${idx}`}
                  className={`p-3.5 rounded-lg border transition-all flex flex-col justify-between gap-3 ${
                    isAssignedToActive
                      ? "bg-cyan-500/10 border-cyan-500/60 shadow-xs"
                      : "bg-zinc-50 dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-400 dark:hover:border-zinc-700"
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 font-mono truncate block" title={wf.filename}>
                          {wf.filename}
                        </span>
                        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                          <Folder className="w-3 h-3 shrink-0" />
                          <span className="truncate">{wf.folder || "workflows"}</span>
                        </div>
                      </div>

                      {wf.node_count !== undefined && wf.node_count > 0 && (
                        <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 shrink-0">
                          {wf.node_count} nodes
                        </span>
                      )}
                    </div>

                    {monitoringShot && (
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-cyan-600 dark:text-cyan-400">
                        <Radio className="w-3 h-3 shrink-0 animate-pulse" />
                        <span>
                          {isAssignedToActive ? "Assigned to this Shot" : `Assigned to Shot ${formatShotNumber(monitoringShot.shot_number)}`}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800/60">
                    <span className="text-[10px] text-zinc-400 font-mono truncate">
                      {wf.path}
                    </span>

                    {activeShot && (
                      <button
                        onClick={() => {
                          if (isAssignedToActive) {
                            handleClearAssignment();
                          } else {
                            handleAssignWorkflow(wf.path);
                          }
                        }}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors shrink-0 cursor-pointer ${
                          isAssignedToActive
                            ? "bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30"
                            : "bg-cyan-600 hover:bg-cyan-500 text-white"
                        }`}
                      >
                        {isAssignedToActive ? "Unassign" : `Assign to Shot ${formatShotNumber(activeShot.shot_number)}`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
