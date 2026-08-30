import React, { useState, useEffect, useRef } from "react";
import { AppConfig, SceneProjectFile, ShotItem, TransferResult, generateSaveVideoPrefix, formatShotNumber } from "../types";
import { 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  Terminal, 
  Check, 
  ArrowRight,
  Layers,
  Sparkles,
  UploadCloud,
  Film,
  Camera,
  Server,
  FileCode,
  HardDrive
} from "lucide-react";

interface ExecutionSectionProps {
  config: AppConfig;
  activeShotId: string | null;
  sceneProject: SceneProjectFile;
  onSelectShot: (id: string | null) => void;
  onUpdateShot: (updater: (prev: ShotItem) => ShotItem) => void;
  onUpdateSceneProject: (updater: (prev: SceneProjectFile) => SceneProjectFile) => void;
  onShowToast?: (text: string, type: "success" | "error" | "info") => void;
}

export const ExecutionSection: React.FC<ExecutionSectionProps> = ({
  config,
  activeShotId,
  sceneProject,
  onSelectShot,
  onUpdateShot,
  onUpdateSceneProject,
  onShowToast
}) => {
  const [transferState, setTransferState] = useState<"idle" | "progress" | "error" | "success">("idle");
  const [progressStep, setProgressStep] = useState<string>("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [transferResult, setTransferResult] = useState<TransferResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<"shot" | "scene" | null>(null);
  const [lastStagedTime, setLastStagedTime] = useState<string | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const activeShot = activeShotId ? sceneProject.shots.find(s => s.id === activeShotId) : null;
  const activeSceneName = sceneProject.scene_name || "Untitled_Scene";
  const sanitizedSceneName = activeSceneName.replace(/[^a-zA-Z0-9_-]/g, "_");
  
  const getShotAssets = (shot: ShotItem) => {
    return Object.values(shot.assigned_slots).filter(Boolean) as string[];
  };

  const activeShotAssets = activeShot ? getShotAssets(activeShot) : [];

  const simulateProgress = () => {
    setProgressPercent(0);
    setProgressStep("[1/3] Compiling workflow JSON(s)...");
    
    let currentPercent = 0;
    timerRef.current = setInterval(() => {
      currentPercent += Math.floor(Math.random() * 15) + 5;
      if (currentPercent > 90) currentPercent = 90;
      setProgressPercent(currentPercent);
      
      if (currentPercent > 20 && currentPercent <= 50) {
        setProgressStep(`[2/3] Connecting to Remote GPU via SSH (${config.remote_host}:${config.ssh_port})...`);
      } else if (currentPercent > 50 && currentPercent <= 80) {
        setProgressStep("[3/3] Transferring assets and workflows...");
      } else if (currentPercent > 80) {
        setProgressStep("Finalizing: Writing to /workflows/...");
      }
    }, 400);
  };

  const clearProgress = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  useEffect(() => {
    return () => clearProgress();
  }, []);

  const handleSendShot = async () => {
    if (!activeShot) return;
    
    setTransferState("progress");
    setLastAction("shot");
    setError(null);
    setTransferResult(null);
    simulateProgress();
    
    try {
      const res = await fetch("/api/assets/sync_remote", {
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
          workflow_filename: activeShot.workflow_file,
          output_workflow_filename: `${sanitizedSceneName}_Shot_${formatShotNumber(activeShot.shot_number)}.json`,
          prompt_node_id: activeShot.prompt_node_id,
          expanded_prompt: activeShot.expanded_prompt,
          scene_name: sanitizedSceneName,
          shot_number: activeShot.shot_number,
          shot_type: activeShot.shot_type,
          camera_movement: activeShot.camera_movement,
          node_mappings: activeShot.assigned_slots,
          generation_parameters: activeShot.generation_params,
          parameter_node_mappings: activeShot.parameter_node_mappings,
        })
      });
      
      const resText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(resText);
      } catch {
        data = { detail: resText || `Server returned HTTP status ${res.status} (${res.statusText})` };
      }
      clearProgress();
      setProgressPercent(100);
      
      if (res.ok) {
        setTransferResult(data);
        setTransferState("success");
        setLastStagedTime(new Date().toLocaleTimeString());
        onUpdateShot(prev => ({ ...prev, staged: true }));
        onShowToast?.("Shot staged successfully!", "success");
      } else {
        const errorMsg = data.detail || data.error || data.message || (typeof data === "string" ? data : `Failed to stage shot (HTTP ${res.status}).`);
        setError(errorMsg);
        setTransferState("error");
      }
    } catch (err: any) {
      clearProgress();
      setError(err.message || "Failed to connect to staging server.");
      setTransferState("error");
    }
  };

  const handleSendScene = async () => {
    setTransferState("progress");
    setLastAction("scene");
    setError(null);
    setTransferResult(null);
    simulateProgress();
    
    try {
      const res = await fetch("/api/workflow/stage-scene", {
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
          scene_name: sanitizedSceneName,
          shots: sceneProject.shots.map(s => ({
            shot_number: s.shot_number,
            shot_type: s.shot_type,
            camera_movement: s.camera_movement,
            expanded_prompt: s.expanded_prompt,
            prompt_node_id: s.prompt_node_id,
            node_mappings: s.assigned_slots,
            workflow_filename: s.workflow_file,
          }))
        })
      });
      
      const resText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(resText);
      } catch {
        data = { detail: resText || `Server returned HTTP status ${res.status} (${res.statusText})` };
      }
      clearProgress();
      setProgressPercent(100);
      
      if (res.ok) {
        setTransferResult(data);
        setTransferState("success");
        setLastStagedTime(new Date().toLocaleTimeString());
        onUpdateSceneProject(prev => ({
          ...prev,
          shots: prev.shots.map(s => ({ ...s, staged: true }))
        }));
        onShowToast?.("Scene staged successfully!", "success");
      } else {
        const errorMsg = data.detail || data.error || data.message || (typeof data === "string" ? data : `Failed to stage scene (HTTP ${res.status}).`);
        setError(errorMsg);
        setTransferState("error");
      }
    } catch (err: any) {
      clearProgress();
      setError(err.message || "Failed to connect to staging server.");
      setTransferState("error");
    }
  };

  const handleDismissError = () => {
    setTransferState("idle");
    setError(null);
  };

  const allSceneAssets = Array.from(new Set(
    sceneProject.shots.flatMap(s => getShotAssets(s))
  ));

  const isTransferring = transferState === "progress";

  return (
    <div id="execution-section" className="space-y-5 flex flex-col min-h-0">
      {/* Header Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3">
          <Film className="w-5 h-5 text-zinc-400" />
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Loaded Scene</span>
            <span className="text-sm font-medium text-zinc-200">{activeSceneName}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-zinc-300">Shot Context:</label>
          <select 
            value={activeShotId || ""}
            onChange={(e) => onSelectShot(e.target.value || null)}
            className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none min-w-[250px]"
          >
            <option key="empty" value="">-- Select a Shot to Stage --</option>
            {sceneProject.shots.map(s => (
              <option key={s.id} value={s.id}>
                Shot {s.shot_number.toString().padStart(2, '0')} - {s.shot_type}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Panel A: Send Shot */}
        <div className={`p-5 rounded-xl border-2 flex flex-col justify-between space-y-4 ${
          activeShot 
            ? "bg-zinc-900/80 border-indigo-500/30 shadow-[0_0_15px_-3px_rgba(99,102,241,0.1)]" 
            : "bg-zinc-900/40 border-zinc-800 opacity-70"
        }`}>
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-lg ${activeShot ? "bg-indigo-500/20 text-indigo-400" : "bg-zinc-800 text-zinc-500"}`}>
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h2 className={`text-lg font-bold ${activeShot ? "text-indigo-100" : "text-zinc-500"}`}>Send Shot</h2>
                <p className="text-xs text-zinc-400">Stage only the active shot.</p>
              </div>
            </div>

            {!activeShot ? (
              <div className="py-8 text-center border border-dashed border-zinc-800 rounded-lg">
                <p className="text-sm text-zinc-500">Select a shot to stage.</p>
              </div>
            ) : (
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Shot Name:</span>
                  <span className="text-zinc-300 font-mono">{sanitizedSceneName}_Shot_{formatShotNumber(activeShot.shot_number)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Workflow:</span>
                  <span className="text-zinc-300 font-mono truncate max-w-[200px]" title={`${sanitizedSceneName}_Shot_{formatShotNumber(activeShot.shot_number)}.json`}>
                    {sanitizedSceneName}_Shot_{formatShotNumber(activeShot.shot_number)}.json
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Active Assets:</span>
                  <span className="text-zinc-300">{activeShotAssets.length} files</span>
                </div>
                {activeShotAssets.length > 0 && (
                  <div className="pt-2 border-t border-zinc-800/50 text-[10px] text-zinc-500 break-words">
                    {activeShotAssets.join(", ")}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={handleSendShot}
            disabled={!activeShot || isTransferring}
            className={`w-full py-3 rounded-lg flex items-center justify-center gap-2 font-bold transition-all ${
              activeShot && !isTransferring
                ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/20"
                : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            }`}
          >
            {isTransferring && lastAction === "shot" ? (
              <>
                <Terminal className="w-4 h-4 animate-pulse" />
                <span>Staging Shot...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                <span>Send Shot</span>
              </>
            )}
          </button>
        </div>

        {/* Panel B: Send Scene */}
        <div className="bg-zinc-900/80 border-2 border-amber-500/30 shadow-[0_0_15px_-3px_rgba(245,158,11,0.1)] p-5 rounded-xl flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-amber-100">Send Scene</h2>
                <p className="text-xs text-zinc-400">Batch stage all shots in the scene.</p>
              </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Total Shots:</span>
                <span className="text-amber-300 font-bold">{sceneProject.shots.length} shot(s)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Total Distinct Assets:</span>
                <span className="text-zinc-300">{allSceneAssets.length} unique image files</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Target Folder:</span>
                <span className="text-zinc-300 font-mono">/workflows/{sanitizedSceneName}/</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleSendScene}
            disabled={sceneProject.shots.length === 0 || isTransferring}
            className={`w-full py-3 rounded-lg flex items-center justify-center gap-2 font-bold transition-all ${
              sceneProject.shots.length > 0 && !isTransferring
                ? "bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/20"
                : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            }`}
          >
            {isTransferring && lastAction === "scene" ? (
              <>
                <Terminal className="w-4 h-4 animate-pulse" />
                <span>Staging Scene...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                <span>Send Scene</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Staging Progress Console & Persistent Summary Card */}
      {transferState !== "idle" && (
        <div className="w-full mt-2">
          {/* In-Progress State */}
          {transferState === "progress" && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
              <div className="p-5 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <Terminal className="w-5 h-5 text-indigo-400 animate-pulse" />
                  <h3 className="text-sm font-bold text-zinc-200">Staging in Progress...</h3>
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
                  <h3 className="text-base font-bold text-red-400">Staging Failed</h3>
                  <div className="bg-red-950/40 border border-red-900/30 p-3 rounded-lg">
                    <p className="text-sm text-red-300 font-mono break-words">{error}</p>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button 
                      onClick={lastAction === "shot" ? handleSendShot : handleSendScene}
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
                  <h3 className="text-sm font-bold text-emerald-300">Successfully Staged to Remote GPU</h3>
                </div>
                {lastStagedTime && (
                  <span className="text-xs text-emerald-500/70 font-medium flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    Staged at {lastStagedTime}
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
                        {lastAction === "shot" ? `Single Shot (Shot ${activeShot ? formatShotNumber(activeShot.shot_number) : ''})` : `Full Scene (${sceneProject.shots.length} Shots)`}
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
                  <h4 className="text-sm font-bold text-emerald-300">Ready to Render</h4>
                  <p className="text-xs text-emerald-200/70 mt-1">
                    Open ComfyUI on your Remote GPU, navigate to <code className="bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-900/50 text-emerald-300 font-mono">Workflows -&gt; {sanitizedSceneName}</code>, load your shot workflow, and click <strong>Queue Prompt</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
