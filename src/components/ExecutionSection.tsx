
import React, { useState, useEffect, useRef } from "react";
import { AppConfig, SceneProjectFile, ShotItem, TransferResult, MediaAsset, generateSaveVideoPrefix, formatShotNumber } from "../types";
import { ComfyMonitorState } from "../hooks/useComfyMonitor";
import { Send, Activity } from "lucide-react";

import { ShotDossierCard } from "./ShotDossierCard";
import { ExecutionMonitor } from "./execution/ExecutionMonitor";
import { SendShotPanel } from "./execution/SendShotPanel";
import { SendScenePanel } from "./execution/SendScenePanel";
import { ExecutionConsole } from "./execution/ExecutionConsole";
import { RemoteWorkflowMonitorPanel } from "./execution/RemoteWorkflowMonitorPanel";
import { RunpodQuickSyncBar } from "./execution/RunpodQuickSyncBar";

interface ExecutionSectionProps {
  config: AppConfig;
  monitorState?: ComfyMonitorState;
  activeShotId: string | null;
  sceneProject: SceneProjectFile;
  selectedWorkflowFile?: string;
  assets?: MediaAsset[];
  onSelectShot: (id: string | null) => void;
  onUpdateShot: (updater: (prev: ShotItem) => ShotItem) => void;
  onUpdateSceneProject: (updater: (prev: SceneProjectFile) => SceneProjectFile) => void;
  onShowToast?: (text: string, type: "success" | "error" | "info") => void;
  onUpdateConfig?: (newConfig: AppConfig) => void;
}

export const ExecutionSection: React.FC<ExecutionSectionProps> = ({
  config,
  monitorState,
  activeShotId,
  sceneProject,
  selectedWorkflowFile,
  assets = [],
  onSelectShot,
  onUpdateShot,
  onUpdateSceneProject,
  onShowToast,
  onUpdateConfig
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"stage" | "monitor">("stage");
  const [transferState, setTransferState] = useState<"idle" | "progress" | "error" | "success">("idle");
  const [progressStep, setProgressStep] = useState<string>("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [transferResult, setTransferResult] = useState<TransferResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<"shot" | "scene" | "execute_shot" | null>(null);
  const [lastStagedTime, setLastStagedTime] = useState<string | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hasAutoConnectedRef = useRef(false);

  // Phase 2: Auto-connect to active pod on startup if enabled
  useEffect(() => {
    if (
      config.runpod_auto_connect &&
      config.runpod_api_key?.trim() &&
      !hasAutoConnectedRef.current
    ) {
      hasAutoConnectedRef.current = true;
      fetch("/api/runpod/pods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runpod_api_key: config.runpod_api_key.trim() })
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.pods && data.pods.length === 1) {
            const pod = data.pods[0];
            if (
              pod.ip &&
              (pod.ip !== config.remote_host ||
                pod.sshPort !== config.ssh_port ||
                pod.comfyUrl !== config.comfyui_api_url)
            ) {
              const updatedConfig: AppConfig = {
                ...config,
                remote_host: pod.ip || config.remote_host,
                ssh_port: pod.sshPort || config.ssh_port,
                comfyui_api_url: pod.comfyUrl || config.comfyui_api_url
              };
              onUpdateConfig?.(updatedConfig);
              onShowToast?.(
                `Auto-connected to RunPod '${pod.name}' (${pod.ip}:${pod.sshPort})`,
                "success"
              );
            }
          }
        })
        .catch((err) => {
          console.warn("[RunPod Auto-Connect Error]", err);
        });
    }
  }, [config.runpod_auto_connect, config.runpod_api_key, onUpdateConfig, onShowToast]);

  const activeShot = activeShotId ? sceneProject.shots.find(s => s.id === activeShotId) : null;
  const activeSceneName = sceneProject.scene_name || "Untitled_Scene";
  const sanitizedSceneName = activeSceneName.replace(/[^a-zA-Z0-9_-]/g, "_");
  
  const getShotAssets = (shot: ShotItem) => {
    return Object.values(shot.assigned_slots).filter(Boolean) as string[];
  };

  const activeShotAssets = activeShot ? getShotAssets(activeShot) : [];

  const handleAddBlankShot = () => {
    const newId = "shot_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
    onUpdateSceneProject(prev => {
      const newShot: ShotItem = {
        id: newId,
        shot_number: prev.shots.length + 1,
        shot_type: "Medium Shot",
        camera_movement: "Locked Off",
        lens_focal_length: "50mm Standard Prime",
        aspect_ratio: "16:9 Widescreen",
        basic_stub: "",
        expanded_prompt: "",
        assigned_slots: {},
        status: "unstaged",
        takes: [],
        updated_at: new Date().toISOString()
      };
      return { ...prev, shots: [...prev.shots, newShot] };
    });
    onSelectShot(newId);
  };

  const handleDuplicateShot = () => {
    if (!activeShot) return;
    const newId = "shot_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
    onUpdateSceneProject(prev => {
      const duplicatedShot: ShotItem = {
        ...activeShot,
        id: newId,
        shot_number: prev.shots.length + 1,
        shot_name: activeShot.shot_name ? `${activeShot.shot_name} (Copy)` : undefined,
        status: "unstaged",
        takes: [],
        hero_take_id: undefined,
        assigned_slots: { ...(activeShot.assigned_slots || {}) },
        characters: activeShot.characters ? [...activeShot.characters] : [],
        updated_at: new Date().toISOString()
      };
      return { ...prev, shots: [...prev.shots, duplicatedShot] };
    });
    onSelectShot(newId);
  };

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
      const resolvedWorkflowFilename =
        activeShot.workflow_file ||
        selectedWorkflowFile ||
        sceneProject.workflow_file ||
        (sceneProject as any).selected_workflow ||
        "default.json";

      const shotNumFormatted = formatShotNumber(activeShot.shot_number);
      const synthesizedFilename = `${sanitizedSceneName}_Shot_${shotNumFormatted}.json`;

      const formattedShot = {
        ...activeShot,
        shot_number: activeShot.shot_number,
        shot_type: activeShot.shot_type,
        camera_movement: activeShot.camera_movement,
        expanded_prompt: activeShot.expanded_prompt,
        prompt_node_id: activeShot.prompt_node_id,
        assigned_slots: activeShot.assigned_slots || {},
        node_mappings: activeShot.assigned_slots || {},
        generation_params: activeShot.generation_params,
        generation_parameters: activeShot.generation_params,
        parameter_node_mappings: activeShot.parameter_node_mappings,
        workflow_file: resolvedWorkflowFilename,
        workflow_filename: resolvedWorkflowFilename,
        output_workflow_filename: synthesizedFilename
      };

      const res = await fetch("/api/workflow/stage-shot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          remote_host: config.remote_host,
          runpod_ip: config.remote_host,
          ssh_port: config.ssh_port,
          ssh_username: config.ssh_username,
          ssh_password: config.ssh_password,
          ssh_key_path: config.ssh_key_path,
          ssh_private_key: config.ssh_private_key,
          remote_comfyui_root: config.remote_comfyui_root || "/workspace/runpod-slim/ComfyUI",
          scene_name: sanitizedSceneName,
          shot_number: activeShot.shot_number,
          workflow_filename: resolvedWorkflowFilename,
          output_workflow_filename: synthesizedFilename,
          assigned_slots: activeShot.assigned_slots || {},
          generation_parameters: activeShot.generation_params,
          parameter_node_mappings: activeShot.parameter_node_mappings,
          shots: [formattedShot],
          project_data: sceneProject
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
        onUpdateShot(prev => ({ ...prev, status: "staged" as const }));
        onShowToast?.("Shot staged successfully!", "success");
      } else {
        const errorMsg = data.detail || data.error || data.message || (typeof data === "string" ? data : `Failed to stage shot (HTTP ${res.status}).`);
        setError(errorMsg);
        setTransferState("error");
        onShowToast?.(errorMsg, "error");
      }
    } catch (err: any) {
      clearProgress();
      const errorMsg = err.message || "Failed to connect to staging server.";
      setError(errorMsg);
      setTransferState("error");
      onShowToast?.(errorMsg, "error");
    }
  };

  const handleExecuteShot = async () => {
    if (!activeShot) return;
    
    setTransferState("progress");
    setLastAction("execute_shot");
    setError(null);
    setTransferResult(null);
    simulateProgress();
    
    try {
      const baseWorkflow = activeShot.workflow_file || activeShot.monitored_workflow || sceneProject.workflow_file || "default.json";
      const shotNumFormatted = formatShotNumber(activeShot.shot_number);
      const synthesizedFilename = `${sanitizedSceneName}_Shot_${shotNumFormatted}.json`;

      const res = await fetch("/api/execute", {
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
          remote_api_token: config.remote_api_token,
          workflow_filename: baseWorkflow,
          output_workflow_filename: synthesizedFilename,
          monitored_workflow: activeShot.monitored_workflow,
          workflow_file: baseWorkflow,
          prompt_node_id: activeShot.prompt_node_id,
          expanded_prompt: activeShot.expanded_prompt,
          scene_name: sanitizedSceneName,
          shot_number: activeShot.shot_number,
          shot_type: activeShot.shot_type,
          camera_movement: activeShot.camera_movement,
          node_mappings: activeShot.assigned_slots,
          generation_parameters: activeShot.generation_params,
          parameter_node_mappings: activeShot.parameter_node_mappings,
          client_id: monitorState?.clientId || (typeof window !== "undefined" ? (window as any).__comfyMonitorClientId : undefined) || "comfyui-bridge-session",
          stage_assets_first: true
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
        onUpdateShot(prev => ({ 
          ...prev, 
          status: "rendering",
          latest_prompt_id: data.prompt_id 
        }));
        onShowToast?.(`Sent to ComfyUI! Prompt ID: ${data.prompt_id || 'Unknown'}`, "success");
      } else {
        const errorMsg = data.detail || data.error || data.message || (typeof data === "string" ? data : `Failed to execute shot (HTTP ${res.status}).`);
        setError(errorMsg);
        setTransferState("error");
        onShowToast?.(errorMsg, "error");
      }
    } catch (err: any) {
      clearProgress();
      const errorMsg = err.message || "Failed to connect to execution server.";
      setError(errorMsg);
      setTransferState("error");
      onShowToast?.(errorMsg, "error");
    }
  };

  const handleSendScene = async () => {
    setTransferState("progress");
    setLastAction("scene");
    setError(null);
    setTransferResult(null);
    simulateProgress();
    
    try {
      const sceneWorkflowFilename =
        selectedWorkflowFile ||
        sceneProject.workflow_file ||
        (sceneProject as any).selected_workflow ||
        "default.json";

      const res = await fetch("/api/workflow/stage-scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          remote_host: config.remote_host,
          runpod_ip: config.remote_host,
          ssh_port: config.ssh_port,
          ssh_username: config.ssh_username,
          ssh_password: config.ssh_password,
          ssh_key_path: config.ssh_key_path,
          ssh_private_key: config.ssh_private_key,
          remote_comfyui_root: config.remote_comfyui_root || "/workspace/runpod-slim/ComfyUI",
          scene_name: sanitizedSceneName,
          workflow_filename: sceneWorkflowFilename,
          shots: sceneProject.shots.map(s => {
            const shotWf =
              s.workflow_file ||
              sceneWorkflowFilename;
            return {
              ...s,
              shot_number: s.shot_number,
              shot_type: s.shot_type,
              camera_movement: s.camera_movement,
              expanded_prompt: s.expanded_prompt,
              prompt_node_id: s.prompt_node_id,
              assigned_slots: s.assigned_slots || {},
              node_mappings: s.assigned_slots || {},
              generation_params: s.generation_params,
              generation_parameters: s.generation_params,
              parameter_node_mappings: s.parameter_node_mappings,
              workflow_file: shotWf,
              workflow_filename: shotWf,
            };
          }),
          project_data: sceneProject
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
          shots: prev.shots.map(s => ({ ...s, status: "staged" as const }))
        }));
        onShowToast?.("Scene staged successfully!", "success");
      } else {
        const errorMsg = data.detail || data.error || data.message || (typeof data === "string" ? data : `Failed to stage scene (HTTP ${res.status}).`);
        setError(errorMsg);
        setTransferState("error");
        onShowToast?.(errorMsg, "error");
      }
    } catch (err: any) {
      clearProgress();
      const errorMsg = err.message || "Failed to connect to staging server.";
      setError(errorMsg);
      setTransferState("error");
      onShowToast?.(errorMsg, "error");
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
    <div id="execution-section" className="w-full space-y-5 flex flex-col min-h-0">
      {/* Unified Shot Dossier Card */}
      <ShotDossierCard
        shots={sceneProject.shots}
        activeShotId={activeShotId}
        onSelectShot={onSelectShot}
        assets={assets}
        sceneName={activeSceneName}
        onNewShot={handleAddBlankShot}
        onDuplicateShot={activeShot ? handleDuplicateShot : undefined}
      />

      {/* Quick RunPod Sync & Status Bar */}
      <RunpodQuickSyncBar
        config={config}
        onUpdateConfig={onUpdateConfig}
        onShowToast={onShowToast}
      />

      {/* Segmented Sub-Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-100 dark:bg-zinc-900/90 p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xs">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => setActiveSubTab("stage")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeSubTab === "stage"
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs border border-zinc-200 dark:border-zinc-700"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/40"
            }`}
          >
            <Send className="w-3.5 h-3.5 text-indigo-500" />
            <span>Send Shot / Send Scene</span>
          </button>

          <button
            onClick={() => setActiveSubTab("monitor")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer relative ${
              activeSubTab === "monitor"
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs border border-zinc-200 dark:border-zinc-700"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/40"
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
            <span>ComfyUI Monitor</span>
            {monitorState?.isExecuting && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
            )}
          </button>
        </div>

        <div className="hidden md:flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 px-2 font-medium">
          {activeSubTab === "stage" ? "Stage and dispatch workflows and assets over SSH" : "Live remote execution queue, active jobs & system telemetry"}
        </div>
      </div>

      {/* SUB-TAB 1: Stage & Dispatch */}
      {activeSubTab === "stage" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <SendShotPanel
              activeShot={activeShot}
              sanitizedSceneName={sanitizedSceneName}
              activeShotAssets={activeShotAssets}
              isTransferring={isTransferring && lastAction === "shot"}
              isExecuting={isTransferring && lastAction === "execute_shot"}
              lastAction={lastAction as "shot" | "scene" | "execute_shot" | null}
              transferState={transferState}
              errorMessage={error}
              handleSendShot={handleSendShot}
              handleExecuteShot={handleExecuteShot}
              handleDismissError={handleDismissError}
            />
            <SendScenePanel
              sceneProject={sceneProject}
              sanitizedSceneName={sanitizedSceneName}
              allSceneAssets={allSceneAssets}
              isTransferring={isTransferring}
              lastAction={lastAction}
              transferState={transferState}
              errorMessage={error}
              handleSendScene={handleSendScene}
              handleDismissError={handleDismissError}
            />
          </div>

          <ExecutionConsole
            transferState={transferState}
            progressStep={progressStep}
            progressPercent={progressPercent}
            transferResult={transferResult}
            error={error}
            lastAction={lastAction}
            lastStagedTime={lastStagedTime}
            activeShot={activeShot}
            sceneProject={sceneProject}
            sanitizedSceneName={sanitizedSceneName}
            handleSendShot={handleSendShot}
            handleSendScene={handleSendScene}
            handleDismissError={handleDismissError}
          />
        </div>
      )}

      {/* SUB-TAB 2: Live Monitor & Queue */}
      {activeSubTab === "monitor" && (
        <div className="space-y-5">
          {monitorState && (
            <ExecutionMonitor monitorState={monitorState} />
          )}

          <RemoteWorkflowMonitorPanel
            config={config}
            monitorState={monitorState}
            activeShot={activeShot}
            sceneProject={sceneProject}
            onUpdateShot={onUpdateShot}
            onUpdateProject={onUpdateSceneProject}
            onExecuteShot={handleExecuteShot}
            onShowToast={onShowToast}
          />
        </div>
      )}
    </div>
  );
};
