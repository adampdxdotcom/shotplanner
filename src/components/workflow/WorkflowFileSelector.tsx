import React from "react";
import { WorkflowItem } from "../../types";
import { Workflow, RefreshCw, Code, AlertTriangle, Upload } from "lucide-react";

interface WorkflowFileSelectorProps {
  activeShotId: string | null;
  parsedWorkflow: any;
  workflows: WorkflowItem[];
  selectedWorkflowFile: string;
  onSelectWorkflow: (file: string) => void;
  onRefreshWorkflows: () => void;
  handleFileUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploading?: boolean;
  uploadError?: string | null;
  bypassMissing?: boolean;
  onToggleBypass?: () => void;
  showRawJson: boolean;
  setShowRawJson: (show: boolean) => void;
}

export const WorkflowFileSelector: React.FC<WorkflowFileSelectorProps> = ({
  activeShotId,
  parsedWorkflow,
  workflows,
  selectedWorkflowFile,
  onSelectWorkflow,
  onRefreshWorkflows,
  handleFileUpload,
  uploading,
  uploadError,
  bypassMissing = true,
  onToggleBypass,
  showRawJson,
  setShowRawJson
}) => {
  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 border">
            <Workflow className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Workflow &amp; Dynamic Node Mapping</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Select standard visual canvas workflow JSON, inspect all loader nodes (active &amp; bypassed), and map uploaded media assets to Node IDs.</p>
          </div>
        </div>
      </div>

      {uploadError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2 text-red-600 dark:text-red-400">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="text-sm">{uploadError}</div>
        </div>
      )}

      {/* Target Base Workflow Selector & Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
        {/* Element 1: Active Workflow Graph Selector */}
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Active Workflow Graph</label>
            {parsedWorkflow && (
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                · {parsedWorkflow.nodes_info?.total_nodes || parsedWorkflow.detected_nodes?.length || 0} nodes
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedWorkflowFile}
              onChange={(e) => onSelectWorkflow(e.target.value)}
              className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 focus:border-amber-500 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none shadow-2xs"
            >
              <option value="">-- No Workflow Selected --</option>
              {workflows.map((wf: any, i) => {
                const filename = typeof wf === "string" ? wf : (wf.filename || "");
                const title = typeof wf === "string" 
                  ? wf.replace(/\.json$/i, "").replace(/[_-]/g, " ") 
                  : (wf.title || wf.filename?.replace(/\.json$/i, "").replace(/[_-]/g, " ") || filename || "Untitled Workflow");
                return (
                  <option key={`wf-${filename || i}-${i}`} value={filename}>
                    {title}
                  </option>
                );
              })}
              {selectedWorkflowFile && !workflows.some((w: any) => (typeof w === "string" ? w : w.filename) === selectedWorkflowFile) && (
                <option value={selectedWorkflowFile}>
                  {selectedWorkflowFile.replace(/\.json$/i, "").replace(/[_-]/g, " ")}
                </option>
              )}
            </select>
            <button
              onClick={onRefreshWorkflows}
              className="p-2 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg transition-colors cursor-pointer shadow-2xs shrink-0"
              title="Refresh workflows list"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            {handleFileUpload && (
              <label
                className={`px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 border border-amber-300 dark:border-amber-500/30 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 shadow-2xs ${
                  uploading ? "opacity-50 pointer-events-none" : ""
                }`}
                title="Upload custom ComfyUI workflow JSON"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{uploading ? "Uploading..." : "Upload JSON"}</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
            )}
          </div>
        </div>

        {/* Element 2: Show JSON Button */}
        {parsedWorkflow && (
          <div className="flex items-center justify-end shrink-0">
            <button
              type="button"
              onClick={() => setShowRawJson(!showRawJson)}
              className="min-h-[38px] px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs whitespace-nowrap"
              title="Inspect Live Injected Workflow JSON"
            >
              <Code className="w-4 h-4" />
              <span>{showRawJson ? "Hide JSON" : "Show JSON"}</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
};
