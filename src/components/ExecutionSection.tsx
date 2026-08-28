import React, { useState } from "react";
import { AppConfig, ExecutionResult, ExecutionStepLog } from "../types";
import { 
  Play, 
  Eye, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Terminal, 
  FileCode, 
  Copy, 
  Check, 
  Clock, 
  ArrowRight,
  Server,
  Layers,
  Sparkles,
  ShieldAlert
} from "lucide-react";

interface ExecutionSectionProps {
  config: AppConfig;
  workflowFilename: string;
  promptNodeId: string;
  expandedPrompt: string;
  nodeMappings: Record<string, string>;
  bypassMissing: boolean;
}

export const ExecutionSection: React.FC<ExecutionSectionProps> = ({
  config,
  workflowFilename,
  promptNodeId,
  expandedPrompt,
  nodeMappings,
  bypassMissing
}) => {
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeStepTab, setActiveStepTab] = useState<"steps" | "json">("steps");
  const [copied, setCopied] = useState(false);

  const handleRun = async (dryRun: boolean = false) => {
    if (!workflowFilename) {
      setError("Please select a workflow file in Step 2.");
      return;
    }

    setExecuting(true);
    setError(null);

    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runpod_ip: config.runpod_ip,
          ssh_port: config.ssh_port,
          ssh_username: config.ssh_username,
          ssh_password: config.ssh_password,
          ssh_key_path: config.ssh_key_path,
          comfyui_api_url: config.comfyui_api_url,
          runpod_api_token: config.runpod_api_token,
          workflow_filename: workflowFilename,
          prompt_node_id: promptNodeId,
          expanded_prompt: expandedPrompt,
          node_mappings: nodeMappings,
          bypass_missing: bypassMissing,
          safe_placeholder: "empty.png",
          dry_run_only: dryRun
        })
      });

      const data = await res.json();
      if (res.ok) {
        setExecutionResult(data);
      } else {
        setError(data.error || "Execution failed");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setExecuting(false);
    }
  };

  const handleCopyJson = () => {
    if (!executionResult?.modified_workflow) return;
    navigator.clipboard.writeText(JSON.stringify(executionResult.modified_workflow, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="execute-section" className="bg-zinc-900/60 border-2 border-zinc-700 rounded-xl p-5 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Play className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">4. Pipeline Execution &amp; Server Dispatch</h2>
            <p className="text-xs text-zinc-400">
              SSH asset sync → Payload injection → ComfyUI <code className="text-zinc-300">/prompt</code> dispatch.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Dry Run Button */}
          <button
            onClick={() => handleRun(true)}
            disabled={executing || !workflowFilename}
            className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 border border-zinc-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Inspect injected JSON without running remote SSH/API"
          >
            <Eye className="w-3.5 h-3.5 text-zinc-400" />
            <span>Dry Run (Inspect JSON)</span>
          </button>

          {/* Master Execute Button */}
          <button
            onClick={() => handleRun(false)}
            disabled={executing || !workflowFilename}
            className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Play className={`w-3.5 h-3.5 ${executing ? "animate-spin" : ""}`} />
            <span>{executing ? "Dispatching..." : "Send to Server (Execute)"}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-red-950/30 border border-red-800/40 text-xs text-red-300 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Execution Stoppage</p>
            <p className="opacity-90">{error}</p>
          </div>
        </div>
      )}

      {/* Execution Visualizer / Step Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Step A */}
        <div className="bg-zinc-950/50 p-3 rounded-lg border-2 border-zinc-700 space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-200">
            <span className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-zinc-400" />
              Step A: SSH / SCP Sync
            </span>
          </div>
          <p className="text-[11px] text-zinc-400">
            Pushes renamed assets to <code className="text-zinc-300 bg-zinc-800 px-1 py-0.5 rounded">/workspace/ComfyUI/input/</code>
          </p>
        </div>

        {/* Step B */}
        <div className="bg-zinc-950/50 p-3 rounded-lg border-2 border-zinc-700 space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-200">
            <span className="flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5 text-amber-400" />
              Step B: Load Workflow
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 truncate">
            Loads <span className="text-zinc-300 font-mono">{workflowFilename || "workflow.json"}</span>
          </p>
        </div>

        {/* Step C */}
        <div className="bg-zinc-950/50 p-3 rounded-lg border-2 border-zinc-700 space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-200">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Step C: Inject Payload
            </span>
          </div>
          <p className="text-[11px] text-zinc-400">
            Prompt → Node #{promptNodeId || 'Auto'} + Mapped Filenames + Bypass
          </p>
        </div>

        {/* Step D */}
        <div className="bg-zinc-950/50 p-3 rounded-lg border-2 border-zinc-700 space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-200">
            <span className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-emerald-400" />
              Step D: HTTP /prompt
            </span>
          </div>
          <p className="text-[11px] text-zinc-400">
            POST JSON to ComfyUI endpoint with proxy headers
          </p>
        </div>
      </div>

      {/* Execution Results View */}
      {executionResult && (
        <div className="bg-zinc-950 p-4 rounded-xl border-2 border-zinc-700 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${executionResult.success ? "bg-emerald-400 animate-ping" : "bg-amber-400"}`} />
              <span className="text-xs font-bold text-zinc-100">
                {executionResult.dry_run ? "Dry Run Complete (Graph Validated)" : "Execution Pipeline Output"}
              </span>
              {executionResult.prompt_id && (
                <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 font-mono text-[10px] border border-indigo-800">
                  ID: {executionResult.prompt_id}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-zinc-900 p-0.5 rounded-lg border-2 border-zinc-700 text-xs">
                <button
                  onClick={() => setActiveStepTab("steps")}
                  className={`px-2.5 py-1 rounded-md transition-colors ${activeStepTab === "steps" ? "bg-zinc-800 text-zinc-100" : "text-zinc-400"}`}
                >
                  Step Logs ({executionResult.steps.length})
                </button>
                <button
                  onClick={() => setActiveStepTab("json")}
                  className={`px-2.5 py-1 rounded-md transition-colors ${activeStepTab === "json" ? "bg-zinc-800 text-zinc-100" : "text-zinc-400"}`}
                >
                  Modified JSON Graph
                </button>
              </div>

              {activeStepTab === "json" && (
                <button
                  onClick={handleCopyJson}
                  className="px-2 py-1 text-xs text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-700 rounded flex items-center gap-1"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Tab 1: Step Logs */}
          {activeStepTab === "steps" && (
            <div className="space-y-2.5">
              {executionResult.steps.map((s, idx) => (
                <div key={idx} className="bg-zinc-900/60 p-3 rounded-lg border-2 border-zinc-700/80 flex items-start gap-3">
                  <div className={`p-1.5 rounded-md mt-0.5 shrink-0 ${
                    s.status === "success" 
                      ? "bg-emerald-950 text-emerald-400 border border-emerald-800/50" 
                      : s.status === "warning" 
                      ? "bg-amber-950 text-amber-400 border border-amber-800/50"
                      : "bg-zinc-800 text-zinc-400"
                  }`}>
                    {s.status === "success" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  </div>

                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-zinc-200">
                        Step {s.step}: {s.title}
                      </p>
                      <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">{s.status}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400">{s.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab 2: Modified Graph JSON Inspector */}
          {activeStepTab === "json" && (
            <div className="space-y-2">
              <p className="text-[11px] text-zinc-400">
                This exact flat dictionary payload is formatted and submitted to ComfyUI's <code className="text-zinc-200 bg-zinc-800 px-1 py-0.5 rounded">/prompt</code> endpoint.
              </p>
              <pre className="max-h-72 overflow-auto font-mono text-[11px] text-emerald-300 bg-zinc-900 p-3 rounded-lg border-2 border-zinc-700/80">
                {JSON.stringify(executionResult.modified_workflow, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
