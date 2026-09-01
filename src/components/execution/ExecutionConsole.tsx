import React from "react";
import { Terminal, AlertCircle, CheckCircle2, Check, Server, FileCode, HardDrive, ArrowRight } from "lucide-react";
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

  return (
    <div className="w-full mt-2">
      {/* In-Progress State */}
      {transferState === "progress" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
          <div className="p-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Terminal className="w-5 h-5 text-indigo-400 animate-pulse" />
              <h3 className="text-sm font-bold text-zinc-200">{lastAction === "execute_shot" ? "Executing on Remote GPU..." : "Staging in Progress..."}</h3>
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
              <h3 className="text-base font-bold text-red-400">{lastAction === "execute_shot" ? "Execution Failed" : "Staging Failed"}</h3>
              <div className="bg-red-950/40 border border-red-900/30 p-3 rounded-lg">
                <p className="text-sm text-red-300 font-mono break-words">{error}</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={lastAction === "shot" || lastAction === "execute_shot" ? handleSendShot : handleSendScene}
                  className="px-4 py-2 bg-red-900/40 hover:bg-red-900/60 text-red-200 text-sm font-medium rounded-lg transition-colors"
                >
                  Retry
                </button>
                <button 
                  onClick={handleDismissError}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg transition-colors"
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
          <div className="p-4 border-b border-emerald-900/30 flex items-center justify-between bg-emerald-900/10">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-emerald-300">{lastAction === "execute_shot" ? "Executed on Remote GPU" : "Successfully Staged to Remote GPU"}</h3>
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
          
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Server className="w-4 h-4 text-emerald-500/70 mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-xs font-semibold text-emerald-500/80 uppercase tracking-wider mb-1">Scope</h4>
                  <p className="text-sm text-emerald-100 font-medium">
                    {lastAction === "shot" || lastAction === "execute_shot" ? `Single Shot (Shot ${activeShot ? formatShotNumber(activeShot.shot_number) : ''})` : `Full Scene (${sceneProject.shots.length} Shots)`}
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <FileCode className="w-4 h-4 text-emerald-500/70 mt-0.5 shrink-0" />
                <div className="w-full min-w-0">
                  <h4 className="text-xs font-semibold text-emerald-500/80 uppercase tracking-wider mb-1">Workflows Created</h4>
                  <div className="space-y-1.5">
                    {transferResult.remote_workflow_paths?.length > 0 ? (
                      transferResult.remote_workflow_paths.map((path, i) => (
                        <div key={i} className="bg-emerald-950/40 border border-emerald-900/30 px-2.5 py-1.5 rounded truncate text-xs text-emerald-200/90 font-mono" title={path}>
                          {path}
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-zinc-500 italic">No workflows generated</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <HardDrive className="w-4 h-4 text-emerald-500/70 mt-0.5 shrink-0" />
                <div className="w-full min-w-0">
                  <h4 className="text-xs font-semibold text-emerald-500/80 uppercase tracking-wider mb-1">Transferred Assets</h4>
                  {transferResult.uploaded_files?.length > 0 ? (
                    <div className="bg-emerald-950/40 border border-emerald-900/30 rounded p-2 max-h-[120px] overflow-y-auto">
                      <ul className="space-y-1">
                        {transferResult.uploaded_files.map((file, i) => (
                          <li key={i} className="text-xs text-emerald-200/90 font-mono truncate flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-emerald-500/50 shrink-0"></span>
                            {file}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500 italic">No assets transferred (already cached or none mapped).</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-emerald-900/20 p-4 border-t border-emerald-900/30 flex items-start gap-3">
            <ArrowRight className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-emerald-300">
                {lastAction === "execute_shot" ? "Execution Started" : "Ready to Render"}
              </h4>
              <p className="text-xs text-emerald-200/70 mt-1">
                {lastAction === "execute_shot" ? (
                  <>Prompt has been queued on the Remote GPU. Prompt ID: <code className="bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-900/50 text-emerald-300 font-mono">{(transferResult as any).prompt_id || "Unknown"}</code></>
                ) : (
                  <>Open ComfyUI on your Remote GPU, navigate to <code className="bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-900/50 text-emerald-300 font-mono">Workflows -&gt; {sanitizedSceneName}</code>, load your shot workflow, and click <strong>Queue Prompt</strong>.</>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
