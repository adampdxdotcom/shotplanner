import { useState, useEffect, useCallback } from 'react';
import { WorkflowItem, ParsedWorkflow, GenerationParameters, ParameterNodeMappings } from '../../types';

interface UseWorkflowManagementParams {
  activeSceneName: string;
  onUpdateActiveShotParams?: (updater: (shot: any) => any) => void;
}

export function useWorkflowManagement({
  activeSceneName,
  onUpdateActiveShotParams
}: UseWorkflowManagementParams) {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [selectedWorkflowFile, setSelectedWorkflowFile] = useState<string>("");
  const [parsedWorkflow, setParsedWorkflow] = useState<ParsedWorkflow | null>(null);
  const [selectedPromptNodeId, setSelectedPromptNodeId] = useState<string>("");
  const [nodeMappings, setNodeMappings] = useState<Record<string, string>>({});
  const [bypassMissing, setBypassMissing] = useState<boolean>(true);

  // Dynamic Generation Parameters & Node Overrides
  const [generationParams, setGenerationParams] = useState<GenerationParameters>({
    steps: 30,
    megapixels: 0.5,
    frames: 3.4
  });
  const [parameterNodeMappings, setParameterNodeMappings] = useState<ParameterNodeMappings>({
    steps: "",
    megapixels: "",
    frames: ""
  });

  const handleUpdateParam = useCallback((key: keyof GenerationParameters, value: number) => {
    setGenerationParams(prev => ({ ...prev, [key]: value }));
    if (onUpdateActiveShotParams) {
      onUpdateActiveShotParams(shot => ({
        ...shot,
        generation_params: {
          ...(shot.generation_params || { steps: 30, megapixels: 0.5, frames: 3.4 }),
          [key]: value
        }
      }));
    }
  }, [onUpdateActiveShotParams]);

  const handleUpdateParameterMapping = useCallback((key: keyof ParameterNodeMappings, nodeId: string) => {
    setParameterNodeMappings(prev => ({ ...prev, [key]: nodeId }));
    if (onUpdateActiveShotParams) {
      onUpdateActiveShotParams(shot => ({
        ...shot,
        parameter_node_mappings: {
          ...(shot.parameter_node_mappings || {}),
          [key]: nodeId
        }
      }));
    }
  }, [onUpdateActiveShotParams]);

  const handleUpdateMapping = useCallback((nodeId: string, filename: string) => {
    setNodeMappings(prev => ({ ...prev, [nodeId]: filename }));
    if (onUpdateActiveShotParams) {
      onUpdateActiveShotParams(shot => ({
        ...shot,
        node_mappings: {
          ...(shot.node_mappings || {}),
          [nodeId]: filename
        }
      }));
    }
  }, [onUpdateActiveShotParams]);

  const fetchWorkflows = useCallback(async () => {
    try {
      const activeName = activeSceneName || "Untitled_Scene";
      const res = await fetch(`/api/workflows?scene=${encodeURIComponent(activeName)}`);
      const data = await res.json();
      const rawList: any[] = data.workflow_items || data.workflows || [];
      const normalized: WorkflowItem[] = rawList.map((item: any) => {
        if (typeof item === "string") {
          return {
            filename: item,
            path: `/assets/workflows/${item}`,
            node_count: 0,
            title: item.replace(/\.json$/i, "").replace(/[_-]/g, " ")
          };
        }
        return {
          filename: item.filename || item.name || "",
          path: item.path || `/assets/workflows/${item.filename}`,
          node_count: item.node_count || 0,
          title: item.title || item.filename?.replace(/\.json$/i, "").replace(/[_-]/g, " ") || item.filename || "Workflow"
        };
      });
      setWorkflows(normalized);
      if (normalized.length > 0 && !selectedWorkflowFile) {
        setSelectedWorkflowFile(normalized[0].filename);
      }
    } catch (e) {
      console.error("Failed to load workflows", e);
    }
  }, [activeSceneName, selectedWorkflowFile]);

  // Parse workflow when selection changes
  useEffect(() => {
    if (!selectedWorkflowFile) return;

    const parseSelectedWorkflow = async () => {
      try {
        const activeName = activeSceneName || "Untitled_Scene";
        const res = await fetch("/api/workflows/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: selectedWorkflowFile, scene_name: activeName })
        });
        const data = await res.json();
        if (res.ok && data.nodes_info) {
          const rawPayload = data.raw_json || data.workflow || data.raw_workflow || {};
          setParsedWorkflow({
            ...data,
            raw_json: rawPayload,
            workflow: rawPayload,
            raw_workflow: rawPayload
          });

          // Auto-sync detected parameter nodes while preserving user manual overrides
          const detected = data.detected_nodes || data.nodes_info.detected_nodes;
          if (detected) {
            setParameterNodeMappings(prev => ({
              steps: prev.steps || (detected.steps ? String(detected.steps) : ""),
              megapixels: prev.megapixels || (detected.megapixels ? String(detected.megapixels) : ""),
              frames: prev.frames || (detected.frames ? String(detected.frames) : "")
            }));

            if (onUpdateActiveShotParams) {
              onUpdateActiveShotParams(shot => {
                const currentShotMappings = shot.parameter_node_mappings || {};
                return {
                  ...shot,
                  parameter_node_mappings: {
                    steps: currentShotMappings.steps || (detected.steps ? String(detected.steps) : ""),
                    megapixels: currentShotMappings.megapixels || (detected.megapixels ? String(detected.megapixels) : ""),
                    frames: currentShotMappings.frames || (detected.frames ? String(detected.frames) : "")
                  }
                };
              });
            }
          }

          if (data.detected_values) {
            setGenerationParams(prev => ({
              steps: typeof data.detected_values.steps === "number" ? data.detected_values.steps : prev.steps,
              megapixels: typeof data.detected_values.megapixels === "number" ? data.detected_values.megapixels : prev.megapixels,
              frames: typeof data.detected_values.frames === "number" ? data.detected_values.frames : prev.frames
            }));
          }

          // Preserve selected prompt node ID if valid, otherwise select default
          setSelectedPromptNodeId(prev => {
            if (prev && data.nodes_info.prompt_nodes?.some((p: any) => p.id === prev)) {
              return prev;
            }
            return data.nodes_info.prompt_nodes?.[0]?.id || prev || "";
          });

          // Preserve existing node mappings for the parsed loader nodes
          setNodeMappings(prev => {
            const nextMappings: Record<string, string> = {};
            data.nodes_info.image_loader_nodes?.forEach((n: any) => {
              nextMappings[n.id] = prev[n.id] || "";
            });
            data.nodes_info.video_loader_nodes?.forEach((n: any) => {
              nextMappings[n.id] = prev[n.id] || "";
            });
            data.nodes_info.audio_loader_nodes?.forEach((n: any) => {
              nextMappings[n.id] = prev[n.id] || "";
            });
            return nextMappings;
          });
        }
      } catch (err) {
        console.error("Failed to parse workflow", err);
      }
    };

    parseSelectedWorkflow();
  }, [selectedWorkflowFile, activeSceneName]);

  return {
    workflows,
    setWorkflows,
    selectedWorkflowFile,
    setSelectedWorkflowFile,
    parsedWorkflow,
    setParsedWorkflow,
    selectedPromptNodeId,
    setSelectedPromptNodeId,
    nodeMappings,
    setNodeMappings,
    bypassMissing,
    setBypassMissing,
    generationParams,
    setGenerationParams,
    parameterNodeMappings,
    setParameterNodeMappings,
    handleUpdateParam,
    handleUpdateParameterMapping,
    handleUpdateMapping,
    fetchWorkflows,
    syncRemoteWorkflow: async (remotePath: string, config: any) => {
      try {
        const activeName = activeSceneName || "Untitled_Scene";
        const res = await fetch("/api/workflows/sync-remote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            remote_path: remotePath,
            scene_name: activeName,
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
        if (res.ok && data.success) {
          await fetchWorkflows();
          if (data.filename) {
            setSelectedWorkflowFile(data.filename);
          }
          return { success: true, data };
        }
        return { success: false, error: data.error || "Failed to sync remote workflow" };
      } catch (err: any) {
        return { success: false, error: err.message || "Failed to sync remote workflow" };
      }
    }
  };
}
