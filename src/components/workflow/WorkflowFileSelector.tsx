import React from "react";
import { WorkflowItem } from "../../types";
import { Upload, Workflow, RefreshCw, Code, AlertTriangle } from "lucide-react";

interface WorkflowFileSelectorProps {
  activeShotId: string | null;
  parsedWorkflow: any;
  workflows: WorkflowItem[];
  selectedWorkflowFile: string;
  onSelectWorkflow: (file: string) => void;
  onRefreshWorkflows: () => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploading: boolean;
  uploadError: string | null;
  bypassMissing: boolean;
  onToggleBypass: () => void;
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
  bypassMissing,
  onToggleBypass,
  showRawJson,
  setShowRawJson
}) => {
  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Workflow className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Workflow &amp; Dynamic Node Mapping</h2>
            <p className="text-xs text-zinc-400">Select standard visual canvas workflow JSON, inspect all loader nodes (active &amp; bypassed), and map uploaded media assets to Node IDs.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Upload Button */}
          <label className={`cursor-pointer px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs ${!activeShotId || uploading ? "opacity-50 cursor-not-allowed" : ""}`}>
            <Upload className="w-3.5 h-3.5 text-amber-400" />
            <span>{uploading ? "Uploading..." : "Upload Visual Workflow JSON"}</span>
            <input 
              type="file" 
              accept=".json" 
              onChange={handleFileUpload} 
              className="hidden" 
              disabled={!activeShotId || uploading}
            />
          </label>

          {parsedWorkflow && (
            <button
              onClick={() => setShowRawJson(!showRawJson)}
              className="px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-950 border-2 border-zinc-700 rounded-lg transition-colors flex items-center gap-1"
              title="Inspect flat dictionary JSON"
            >
              <Code className="w-3.5 h-3.5" />
              <span>{showRawJson ? "Hide JSON" : "Show JSON"}</span>
            </button>
          )}
        </div>
      </div>

      {uploadError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2 text-red-400">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="text-sm">{uploadError}</div>
        </div>
      )}

      {/* Target Base Workflow Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
        <div className="md:col-span-2 space-y-1">
          <label className="text-xs font-medium text-zinc-300">Active Workflow Graph</label>
          <div className="flex items-center gap-2">
            <select
              value={selectedWorkflowFile}
              onChange={(e) => onSelectWorkflow(e.target.value)}
              className="flex-1 bg-zinc-900 border-2 border-zinc-700 focus:border-amber-500 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none"
            >
              <option value="">-- No Workflow Selected --</option>
              {workflows.map((wf, i) => (
                <option key={`wf-${wf.filename}-${i}`} value={wf.filename}>
                  {wf.title} ({wf.filename} • {wf.node_count} nodes)
                </option>
              ))}
            </select>
            <button
              onClick={onRefreshWorkflows}
              className="p-2 text-zinc-400 hover:text-zinc-200 bg-zinc-950 border-2 border-zinc-700 rounded-lg transition-colors"
              title="Refresh workflows list"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Missing Asset Bypass Toggle */}
        <div className="bg-zinc-950/50 p-2.5 rounded-lg border-2 border-zinc-700/80 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-300">Missing Asset Bypass</span>
            <input
              type="checkbox"
              id="bypass-toggle"
              checked={bypassMissing}
              onChange={onToggleBypass}
              className="hidden"
            />
            <label htmlFor="bypass-toggle" className={`w-9 h-5 flex items-center rounded-full p-1 cursor-pointer transition-colors ${bypassMissing ? 'bg-amber-500' : 'bg-zinc-700'}`}>
              <div className={`bg-white w-3 h-3 rounded-full shadow-md transform transition-transform ${bypassMissing ? 'translate-x-4' : ''}`}></div>
            </label>
          </div>
          <p className="text-[10px] text-zinc-500 leading-tight">
            If an assigned file is missing, mute the target node (re-routes execution to bypass node).
          </p>
        </div>
      </div>
    </>
  );
};
