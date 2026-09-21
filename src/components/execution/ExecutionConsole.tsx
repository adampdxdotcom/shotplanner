import React from "react";
import { Terminal, AlertCircle, CheckCircle2, Check, Server, FileCode, HardDrive, ArrowRight, Layers, Sliders, Sparkles, Folder } from "lucide-react";
import { TransferResult, SceneProjectFile, ShotItem } from "../../types";
import { formatShotNumber } from "../../utils/formatters";

export interface ExecutionConsoleProps {
  transferState: "idle" | "progress" | "error" | "success";
  progressStep: string;
  progressPercent: number;
  transferResult: TransferResult | null;
  error: string | null;
  lastAction: "shot" | "scene" | "execute_shot" | null;
  lastStagedTime: string | null;
  activeShot: ShotItem | null | undefined;
  sceneProject: SceneProjectFile;
  sanitizedSceneName: string;
  handleSendShot: () => void;
  handleSendScene: () => void;
  handleDismissError: () => void;
}

export const ExecutionConsole: React.FC<ExecutionConsoleProps> = ({
  transferState,
  progressStep,
  progressPercent,
  transferResult,
  error,
  lastAction,
  lastStagedTime,
  activeShot,
  sceneProject,
  sanitizedSceneName,
  handleSendShot,
  handleSendScene,
  handleDismissError
}) => {
  if (transferState === "idle") return null;

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

  return (
    <div className="w-full mt-2">
      {/* In-Progress State */}
      {transferState === "progress" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
          <div className="p-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Terminal className="w-5 h-5 text-indigo-400 animate-pulse" />
              <h3 className="text-sm font-bold text-zinc-200">
                {lastAction === "execute_shot" ? "Executing on Remote GPU..." : "Staging in Progress..."}
              </h3>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-zinc-400">
                <span className="font-mono">{progressStep}</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 rounded-full transition-all duration-300 ease-out relative"
                  style={{ width: `${progressPercent}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
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

      {/* Success State */}
      {transferState === "success" && transferResult && (
        <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-xl shadow-lg overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-emerald-900/30 flex items-center justify-between bg-emerald-900/10">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-emerald-300">
                  {lastAction === "execute_shot" ? "Executed on Remote GPU" : "Successfully Staged to Remote GPU"}
                </h3>
                {activeShot && lastAction === "execute_shot" && (
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded shadow uppercase tracking-wider ${
                    activeShot.status === "rendered" ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" :
                    activeShot.status === "rendering" ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 animate-pulse" :
                    activeShot.status === "staged" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                    "bg-orange-500/20 text-orange-400 border border-orange-500/30"
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
              <span className="text-xs text-emerald-500/70 font-medium flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                {lastAction === "execute_shot" ? `Executed at ${lastStagedTime}` : `Staged at ${lastStagedTime}`}
              </span>
            )}
          </div>
          
          {/* Main Console Content */}
          <div className="p-5 space-y-5">
            {/* 1. Synthesized Shot Workflow & Base Template Card */}
            <div className="bg-emerald-950/40 border border-emerald-900/30 rounded-lg p-3.5 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs font-bold text-emerald-200">Synthesized Shot Workflow</span>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                  <Sparkles className="w-2.5 h-2.5" />
                  Synthesized & Injected
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                <div>
                  <span className="text-[10px] text-emerald-500/80 font-medium uppercase tracking-wider block">Generated Workflow File</span>
                  <p className="text-emerald-100 font-mono font-bold truncate mt-0.5">{stagedWorkflowFilename}</p>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-500/80 font-medium uppercase tracking-wider block">Base Template Used</span>
                  <p className="text-emerald-300/80 font-mono text-[11px] truncate mt-0.5">{baseTemplateUsed}</p>
                </div>
              </div>
            </div>

            {/* 2. Remote SFTP Path & Assets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Remote Workflow Destination */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-emerald-500/80 shrink-0" />
                  <h4 className="text-xs font-semibold text-emerald-500/80 uppercase tracking-wider">Remote SFTP Path</h4>
                </div>
                <div className="space-y-1.5">
                  {remoteWorkflowPaths.length > 0 ? (
                    remoteWorkflowPaths.map((pathStr, i) => (
                      <div key={i} className="bg-zinc-950/80 border border-emerald-900/40 px-3 py-2 rounded text-[11px] text-emerald-300 font-mono break-all" title={pathStr}>
                        {pathStr}
                      </div>
                    ))
                  ) : (
                    <div className="bg-zinc-950/80 border border-emerald-900/40 px-3 py-2 rounded text-[11px] text-zinc-400 font-mono">
                      {transferResult.remote_dir}/user/default/workflows/{stagedWorkflowFilename}
                    </div>
                  )}
                </div>
              </div>

              {/* Transferred Assets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-emerald-500/80 shrink-0" />
                    <h4 className="text-xs font-semibold text-emerald-500/80 uppercase tracking-wider">Transferred & Verified Files</h4>
                  </div>
                  {transferResult.verified_files?.length ? (
                    <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-800/50 px-1.5 py-0.5 rounded">
                      ✓ {transferResult.verified_files.length} verified
                    </span>
                  ) : null}
                </div>
                {transferResult.uploaded_files?.length ? (
                  <div className="bg-zinc-950/80 border border-emerald-900/40 rounded p-2.5 max-h-[100px] overflow-y-auto">
                    <ul className="space-y-1">
                      {transferResult.uploaded_files.map((file, i) => (
                        <li key={i} className="text-[11px] text-emerald-200/90 font-mono truncate flex items-center justify-between gap-1.5">
                          <span className="flex items-center gap-1.5 truncate">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 shrink-0" />
                            {file}
                          </span>
                          <span className="text-[9px] text-emerald-400/80 uppercase font-sans shrink-0">Verified</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-xs text-emerald-300/60 italic bg-zinc-950/40 border border-emerald-900/20 rounded p-2.5">
                    No new files transferred (assets verified in remote <code className="font-mono">/input</code>).
                  </p>
                )}
              </div>
            </div>

            {/* 3. Injected Specs Summary */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-500/80 shrink-0" />
                <h4 className="text-xs font-semibold text-emerald-500/80 uppercase tracking-wider">Injected Generation Specs</h4>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div className="bg-emerald-950/30 border border-emerald-900/30 rounded p-2 text-center">
                  <span className="text-[10px] text-emerald-400/70 block uppercase font-sans">Prompt Node</span>
                  <span className="text-emerald-200 font-bold">#{activeShot?.prompt_node_id || "Auto"}</span>
                </div>
                <div className="bg-emerald-950/30 border border-emerald-900/30 rounded p-2 text-center">
                  <span className="text-[10px] text-emerald-400/70 block uppercase font-sans">Steps</span>
                  <span className="text-indigo-300 font-bold">{steps} steps</span>
                </div>
                <div className="bg-emerald-950/30 border border-emerald-900/30 rounded p-2 text-center">
                  <span className="text-[10px] text-emerald-400/70 block uppercase font-sans">Resolution</span>
                  <span className="text-amber-300 font-bold">{megapixels} MP</span>
                </div>
                <div className="bg-emerald-950/30 border border-emerald-900/30 rounded p-2 text-center">
                  <span className="text-[10px] text-emerald-400/70 block uppercase font-sans">Duration</span>
                  <span className="text-emerald-300 font-bold">{frames}f (~{durationSec}s)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Action Notice */}
          <div className="bg-emerald-900/20 p-4 border-t border-emerald-900/30 flex items-start gap-3">
            <ArrowRight className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-emerald-300">
                {lastAction === "execute_shot" ? "Execution Triggered Successfully" : "Ready for Remote Execution"}
              </h4>
              <p className="text-xs text-emerald-200/70 mt-1">
                {lastAction === "execute_shot" ? (
                  <>Prompt queued in ComfyUI! Prompt ID: <code className="bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-900/50 text-emerald-300 font-mono">{(transferResult as any).prompt_id || "Queued"}</code></>
                ) : (
                  <>Open ComfyUI on your Remote GPU, navigate to <code className="bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-900/50 text-emerald-300 font-mono">Workflows -&gt; {sanitizedSceneName}</code>, load <code className="bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-900/50 text-emerald-300 font-mono">{stagedWorkflowFilename}</code>, and click <strong>Queue Prompt</strong>.</>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
