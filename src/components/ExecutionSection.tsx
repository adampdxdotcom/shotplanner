
import React, { useState, useEffect, useRef } from "react";
import { AppConfig, SceneProjectFile, ShotItem, TransferResult, generateSaveVideoPrefix, formatShotNumber } from "../types";
import { ComfyMonitorState } from "../hooks/useComfyMonitor";

import { ExecutionHeader } from "./execution/ExecutionHeader";
import { ExecutionMonitor } from "./execution/ExecutionMonitor";
import { SendShotPanel } from "./execution/SendShotPanel";
import { SendScenePanel } from "./execution/SendScenePanel";
import { ExecutionConsole } from "./execution/ExecutionConsole";

interface ExecutionSectionProps {
  config: AppConfig;
  monitorState?: ComfyMonitorState;
  activeShotId: string | null;
  sceneProject: SceneProjectFile;
  selectedWorkflowFile?: string;
  onSelectShot: (id: string | null) => void;
  onUpdateShot: (updater: (prev: ShotItem) => ShotItem) => void;
  onUpdateSceneProject: (updater: (prev: SceneProjectFile) => SceneProjectFile) => void;
  onShowToast?: (text: string, type: "success" | "error" | "info") => void;
}

export const ExecutionSection: React.FC<ExecutionSectionProps> = ({
  config,
  monitorState,
  activeShotId,
  sceneProject,
  selectedWorkflowFile,
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
      const resolvedWorkflowFilename =
        activeShot.workflow_file ||
        selectedWorkflowFile ||
        sceneProject.workflow_file ||
        (sceneProject as any).selected_workflow ||
        "default.json";

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
          workflow_filename: resolvedWorkflowFilename,
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
      }
    } catch (err: any) {
      clearProgress();
      setError(err.message || "Failed to connect to staging server.");
      setTransferState("error");
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
          workflow_filename: activeShot.workflow_file,
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
      }
    } catch (err: any) {
      clearProgress();
      setError(err.message || "Failed to connect to execution server.");
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
      <ExecutionHeader
        activeSceneName={activeSceneName}
        activeShotId={activeShotId}
        sceneProject={sceneProject}
        onSelectShot={onSelectShot}
      />

      {monitorState && (monitorState.isExecuting || monitorState.queueRemaining > 0) ? (
        <ExecutionMonitor monitorState={monitorState} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <SendShotPanel
            activeShot={activeShot}
            sanitizedSceneName={sanitizedSceneName}
            activeShotAssets={activeShotAssets}
            isTransferring={isTransferring && lastAction === "shot"}
            isExecuting={isTransferring && lastAction === "execute_shot"}
            lastAction={lastAction as "shot" | "scene" | "execute_shot" | null}
            handleSendShot={handleSendShot}
            handleExecuteShot={handleExecuteShot}
          />
          <SendScenePanel
            sceneProject={sceneProject}
            sanitizedSceneName={sanitizedSceneName}
            allSceneAssets={allSceneAssets}
            isTransferring={isTransferring}
            lastAction={lastAction}
            handleSendScene={handleSendScene}
          />
        </div>
      )}

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
  );
};
