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
    frames: 81
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
          ...(shot.generation_params || { steps: 30, megapixels: 0.5, frames: 81 }),
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
          ...(shot.parameter_node_mappings || { steps: "", megapixels: "", frames: "" }),
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
      const res = await fetch("/api/workflows");
      const data = await res.json();
      if (data.workflows) {
        setWorkflows(data.workflows);
        if (data.workflows.length > 0 && !selectedWorkflowFile) {
          setSelectedWorkflowFile(data.workflows[0].filename);
        }
      }
    } catch (e) {
      console.error("Failed to load workflows", e);
    }
  }, [selectedWorkflowFile]);

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
              steps: prev.steps || detected.steps || "",
              megapixels: prev.megapixels || detected.megapixels || "",
              frames: prev.frames || detected.frames || ""
            }));
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
    fetchWorkflows
  };
}
