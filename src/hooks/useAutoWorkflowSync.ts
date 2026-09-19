import { useState, useEffect, useRef, useCallback } from "react";
import { AppConfig, ShotItem, SceneProjectFile, RemoteWorkflowItem } from "../types";
import { filterRemoteWorkflows } from "../utils/remoteWorkflowFilter";

interface UseAutoWorkflowSyncOptions {
  config: AppConfig;
  sceneProject: SceneProjectFile;
  enabled?: boolean;
  pollIntervalMs?: number; // default 8000ms
  onUpdateShot?: (updater: (prev: ShotItem) => ShotItem) => void;
  onUpdateProject?: (updater: (prev: SceneProjectFile) => SceneProjectFile) => void;
  onShowToast?: (msg: string, type: "success" | "error" | "info") => void;
}

/**
 * Normalizes strings to match shot patterns like "shot_01", "shot01", "shot_1"
 */
function extractShotNumberFromFilename(filename: string): number | null {
  const clean = filename.toLowerCase();
  const match = clean.match(/shot[_\-\s]*0*(\d+)/i);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return null;
}

export function useAutoWorkflowSync({
  config,
  sceneProject,
  enabled = true,
  pollIntervalMs = 8000,
  onUpdateProject,
  onShowToast
}: UseAutoWorkflowSyncOptions) {
  const [remoteWorkflows, setRemoteWorkflows] = useState<RemoteWorkflowItem[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [lastAutoScannedAt, setLastAutoScannedAt] = useState<number | null>(null);
  const [autoMatchedCount, setAutoMatchedCount] = useState<number>(0);
  
  const isScanningRef = useRef(false);
  const prevWfSignatureRef = useRef<string>("");

  const scanAndAutoBind = useCallback(async (isManual: boolean = false) => {
    // Need at least SSH host or ComfyUI API url
    if (!config.remote_host && !config.comfyui_api_url) return;
    if (isScanningRef.current) return;

    isScanningRef.current = true;
    if (isManual) setIsScanning(true);

    try {
      const sceneName = sceneProject.scene_name || "";
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
          remote_api_token: config.remote_api_token,
          project_name: sceneName
        })
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.workflows)) {
        const cleaned = filterRemoteWorkflows(data.workflows);
        setRemoteWorkflows(cleaned);
        setLastAutoScannedAt(Date.now());

        const wfSignature = cleaned.map(w => w.path).sort().join("|");
        
        // Auto-match discovered workflows to scene shots
        if (onUpdateProject && cleaned.length > 0) {
          let matched = 0;
          const cleanSceneName = sceneName.toLowerCase().replace(/[^a-z0-9]/g, "");

          onUpdateProject((prev) => {
            let hasChanges = false;
            const updatedShots = prev.shots.map((shot) => {
              // 1. Check if shot already has an active monitored workflow that still exists
              const existingMatch = cleaned.find(w => w.path === shot.monitored_workflow);
              if (existingMatch) {
                return shot;
              }

              // 2. Try to find a workflow matching scene name + shot number (e.g. nina_doll_Shot_01.json)
              const shotNum = shot.shot_number;
              const matchingWf = cleaned.find((w) => {
                const fnameLower = w.filename.toLowerCase();
                const parsedShotNum = extractShotNumberFromFilename(fnameLower);
                if (parsedShotNum !== shotNum) return false;

                // Also check if scene name matches if scene is named
                if (cleanSceneName && cleanSceneName !== "untitledscene" && cleanSceneName !== "scene") {
                  const cleanedWfName = fnameLower.replace(/[^a-z0-9]/g, "");
                  if (cleanedWfName.includes(cleanSceneName) || (w.folder && w.folder.toLowerCase().includes(cleanSceneName))) {
                    return true;
                  }
                }
                return true; // Match on shot number if in user workflows
              });

              if (matchingWf && matchingWf.path !== shot.monitored_workflow) {
                matched++;
                hasChanges = true;
                return {
                  ...shot,
                  monitored_workflow: matchingWf.path
                };
              }
              return shot;
            });

            if (hasChanges) {
              return { ...prev, shots: updatedShots };
            }
            return prev;
          });

          if (matched > 0 && wfSignature !== prevWfSignatureRef.current) {
            setAutoMatchedCount(matched);
            onShowToast?.(`Auto-linked ${matched} remote workflow(s) to scene shots.`, "success");
          }
        }

        prevWfSignatureRef.current = wfSignature;
        if (isManual) {
          onShowToast?.(`Discovered ${cleaned.length} remote workflow(s).`, "success");
        }
      }
    } catch {
      // Soft fail during background polling
    } finally {
      isScanningRef.current = false;
      setIsScanning(false);
    }
  }, [config, sceneProject.scene_name, onUpdateProject, onShowToast]);

  // Periodic background auto-scan every 8-10 seconds
  useEffect(() => {
    if (!enabled) return;

    // Initial immediate scan
    scanAndAutoBind(false);

    const interval = setInterval(() => {
      scanAndAutoBind(false);
    }, pollIntervalMs);

    return () => clearInterval(interval);
  }, [enabled, pollIntervalMs, scanAndAutoBind]);

  return {
    remoteWorkflows,
    isScanning,
    lastAutoScannedAt,
    autoMatchedCount,
    scanNow: () => scanAndAutoBind(true)
  };
}
