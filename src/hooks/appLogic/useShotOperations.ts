import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  SceneProjectFile, 
  ScenePlanning, 
  ShotItem, 
  MediaAsset, 
  AppConfig, 
  ParsedWorkflow, 
  GenerationParameters, 
  ParameterNodeMappings, 
  LLMProvider 
} from '../../types';
import { generatePromptPrefix } from '../../components/ScenePlanningHeader';
import { useComfyMonitor } from '../useComfyMonitor';
import { getDefaultLlmProvider } from './useAppConfig';

interface UseShotOperationsParams {
  sceneProject: SceneProjectFile;
  setSceneProject: React.Dispatch<React.SetStateAction<SceneProjectFile>>;
  config: AppConfig;
  assets: MediaAsset[];
  parsedWorkflow: ParsedWorkflow | null;
  selectedWorkflowFile: string;
  selectedPromptNodeId: string;
  bypassMissing: boolean;
  generationParams: GenerationParameters;
  parameterNodeMappings: ParameterNodeMappings;
  setSelectedWorkflowFile: (file: string) => void;
  setSelectedPromptNodeId: (nodeId: string) => void;
  setNodeMappings: (mappings: Record<string, string>) => void;
  setGenerationParams: (params: GenerationParameters) => void;
  setParameterNodeMappings: (mappings: ParameterNodeMappings) => void;
  addToast: (text: string, type?: "success" | "error" | "info") => void;
}

export function useShotOperations({
  sceneProject,
  setSceneProject,
  config,
  assets,
  parsedWorkflow,
  selectedWorkflowFile,
  selectedPromptNodeId,
  bypassMissing,
  generationParams,
  parameterNodeMappings,
  setSelectedWorkflowFile,
  setSelectedPromptNodeId,
  setNodeMappings,
  setGenerationParams,
  setParameterNodeMappings,
  addToast
}: UseShotOperationsParams) {
  const [scenePlanning, setScenePlanning] = useState<ScenePlanning>({
    scene_name: "",
    shot_number: "01",
    shot_type: "Medium Shot (MS)",
    camera_movement: "Locked Off (Static)",
    lens_focal_length: "50mm Standard Prime",
    aspect_ratio: "16:9 Widescreen"
  });

  const promptPrefix = useMemo(() => generatePromptPrefix(scenePlanning), [scenePlanning]);
  const [basicStub, setBasicStub] = useState<string>("");
  const [expandedPrompt, setExpandedPrompt] = useState<string>("");
  const [llmProvider, setLlmProvider] = useState<LLMProvider>(getDefaultLlmProvider);

  // UI Navigation
  const [activeSection, setActiveSection] = useState<string>("scene");
  const [activeShotId, setActiveShotId] = useState<string | null>(null);

  const scrollToSection = useCallback((sectionId: string) => {
    setActiveSection(sectionId);
  }, []);

  const updateShot = useCallback((shotId: string, updater: (prev: ShotItem) => ShotItem) => {
    setSceneProject(prev => {
      const shots = [...prev.shots];
      const idx = shots.findIndex(s => s.id === shotId);
      if (idx !== -1) {
        const previousShot = shots[idx];
        let nextShot = updater(previousShot);
        
        // Auto-revert to "unstaged" if specific fields changed
        const fieldsToCheck: (keyof ShotItem)[] = [
          "basic_stub", "expanded_prompt", "camera_movement", 
          "lens_focal_length", "aspect_ratio", "assigned_slots", "generation_params"
        ];
        
        const hasChanged = fieldsToCheck.some(field => 
          JSON.stringify(previousShot[field]) !== JSON.stringify(nextShot[field])
        );

        if (hasChanged && nextShot.status !== "unstaged") {
          nextShot = { ...nextShot, status: "unstaged" };
        }
        
        shots[idx] = nextShot;
      }
      return { ...prev, shots };
    });
  }, [setSceneProject]);

  const updateActiveShot = useCallback((updater: (prev: ShotItem) => ShotItem) => {
    if (activeShotId) {
      updateShot(activeShotId, updater);
    }
  }, [activeShotId, updateShot]);

  // Sync shot data when activeShotId changes
  useEffect(() => {
    if (activeShotId) {
      const shot = sceneProject.shots.find(s => s.id === activeShotId);
      if (shot) {
        if (shot.workflow_file !== undefined) setSelectedWorkflowFile(shot.workflow_file);
        if (shot.prompt_node_id !== undefined) setSelectedPromptNodeId(shot.prompt_node_id);
        setNodeMappings(shot.node_mappings || {});
        if (shot.generation_params) {
          setGenerationParams(shot.generation_params);
        }
        if (shot.parameter_node_mappings) {
          setParameterNodeMappings(shot.parameter_node_mappings);
        }
        setBasicStub(shot.basic_stub || "");
        setExpandedPrompt(shot.expanded_prompt || "");
      }
    }
  }, [activeShotId, sceneProject.shots, setSelectedWorkflowFile, setSelectedPromptNodeId, setNodeMappings, setGenerationParams, setParameterNodeMappings]);

  const handleOutputPulled = useCallback((filename: string) => {
    setSceneProject(prev => {
      const match = filename.match(/_Shot_(\d+)/i);
      if (!match) return prev;
      
      const shotNumber = parseInt(match[1], 10);
      const shots = [...prev.shots];
      const shotIdx = shots.findIndex(s => s.shot_number === shotNumber);
      
      if (shotIdx !== -1) {
        const shot = shots[shotIdx];
        const newTakeId = Math.random().toString(36).substring(2, 9);
        const takeNumMatch = filename.match(/_Take_(\d+)/i);
        const takeNum = takeNumMatch ? parseInt(takeNumMatch[1], 10) : (shot.takes?.length || 0) + 1;
        
        const newTake = {
          id: newTakeId,
          take_number: takeNum,
          created_at: new Date().toISOString(),
          video_filename: filename,
          expanded_prompt: shot.expanded_prompt,
          basic_stub: shot.basic_stub,
          generation_params: shot.generation_params,
          assigned_slots: shot.assigned_slots
        };
        
        const updatedTakes = [...(shot.takes || []), newTake];
        
        shots[shotIdx] = {
          ...shot,
          status: "rendered",
          takes: updatedTakes,
          active_take_id: newTakeId,
          hero_take_id: shot.hero_take_id || newTakeId
        };
      }
      return { ...prev, shots };
    });
    addToast(`Render output pulled: ${filename}`, "success");
  }, [setSceneProject, addToast]);

  const handleExecutionStarted = useCallback((promptId: string) => {
    setSceneProject(prev => {
      const shots = [...prev.shots];
      const shotIdx = shots.findIndex(s => s.latest_prompt_id === promptId);
      if (shotIdx !== -1 && shots[shotIdx].status !== "rendering") {
         shots[shotIdx] = { ...shots[shotIdx], status: "rendering" };
      }
      return { ...prev, shots };
    });
  }, [setSceneProject]);

  const monitorState = useComfyMonitor(
    config.comfyui_api_url, 
    addToast, 
    sceneProject.scene_name,
    handleOutputPulled,
    handleExecutionStarted
  );

  const handleSceneExpandPrompt = useCallback(async (shot: ShotItem): Promise<string> => {
    const shotPrefix = generatePromptPrefix({
      scene_name: shot.shot_name,
      shot_number: shot.shot_number,
      shot_type: shot.shot_type,
      lens_focal_length: shot.lens_focal_length,
      camera_movement: shot.camera_movement,
      aspect_ratio: shot.aspect_ratio
    });
    
    // We need to pass the assigned assets for this shot
    const shotAssets = Object.entries(shot.assigned_slots).map(([idx, filename]) => {
      const asset = assets.find(a => a.filename === filename);
      if (asset) return { ...asset, slot_index: parseInt(idx) };
      return null;
    }).filter(Boolean) as MediaAsset[];

    // Add shared assets if no specific slot
    sceneProject.shared_assets.forEach(shared => {
      if (!shot.assigned_slots[shared.slot_index]) {
        const asset = assets.find(a => a.filename === shared.filename);
        if (asset) shotAssets.push({ ...asset, slot_index: shared.slot_index });
      }
    });
    
    const response = await fetch("/api/generate-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        basic_stub: shot.basic_stub,
        assets: shotAssets,
        prompt_prefix: shotPrefix,
        provider: llmProvider,
        lm_studio_url: config.lm_studio_url,
        gemini_api_key: config.gemini_api_key,
        active_shot: shot,
        shot_type: shot.shot_type,
        camera_movement: shot.camera_movement,
        lens_focal_length: shot.lens_focal_length,
        aspect_ratio: shot.aspect_ratio,
        ots_anchor_subject: shot.ots_anchor_subject,
        ots_focus_subject: shot.ots_focus_subject,
        ots_side: shot.ots_side,
        shot_number: shot.shot_number,
        scene_name: sceneProject.scene_name,
        characters: sceneProject.characters,
        custom_system_prompt: config.llm_custom_system_prompt,
        temperature: config.llm_temperature,
        max_tokens: config.llm_max_tokens
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Expansion failed");
    return data.expanded_prompt;
  }, [assets, sceneProject, llmProvider, config]);

  const handleSceneTransfer = useCallback(async (shot: ShotItem): Promise<boolean> => {
    // Generate the specific node mappings for this shot based on slot_index
    const shotMappings: Record<string, string> = {};
    if (parsedWorkflow) {
      const imgLoaders = parsedWorkflow.nodes_info.image_loader_nodes || [];
      const vidLoaders = parsedWorkflow.nodes_info.video_loader_nodes || [];
      const audLoaders = parsedWorkflow.nodes_info.audio_loader_nodes || [];
      
      const allLoaders = [...imgLoaders, ...vidLoaders, ...audLoaders];
      
      // Assign based on slot index
      for (let i = 0; i < Math.max(allLoaders.length, 15); i++) {
        const filename = shot.assigned_slots[i] || sceneProject.shared_assets.find(a => a.slot_index === i)?.filename;
        if (filename && allLoaders[i]) {
          shotMappings[allLoaders[i].id] = filename;
        }
      }
    }

    const activeSceneName = sceneProject.scene_name.replace(/[^a-zA-Z0-9_-]/g, "_") || "Untitled_Scene";
    const activeShotNumber = shot.shot_number.toString().padStart(2, "0");

    const payload = {
      ...config,
      workflow_filename: selectedWorkflowFile || sceneProject.workflow_file,
      output_workflow_filename: `${activeSceneName}_Shot_${activeShotNumber}.json`,
      prompt_node_id: selectedPromptNodeId,
      expanded_prompt: shot.expanded_prompt,
      node_mappings: shotMappings,
      bypass_missing: bypassMissing,
      generation_parameters: generationParams,
      parameter_node_mappings: parameterNodeMappings,
      scene_name: activeSceneName,
      shot_number: activeShotNumber
    };

    const response = await fetch("/api/workflow/stage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Transfer failed");
    return data.success;
  }, [parsedWorkflow, sceneProject, config, selectedWorkflowFile, selectedPromptNodeId, bypassMissing, generationParams, parameterNodeMappings]);

  const handleSceneTransferAll = useCallback(async (): Promise<boolean> => {
    const activeSceneName = sceneProject.scene_name.replace(/[^a-zA-Z0-9_-]/g, "_") || "Untitled_Scene";
    const shotsData = sceneProject.shots.map(shot => {
      const shotMappings: Record<string, string> = {};
      if (parsedWorkflow) {
        const imgLoaders = parsedWorkflow.nodes_info.image_loader_nodes || [];
        const vidLoaders = parsedWorkflow.nodes_info.video_loader_nodes || [];
        const audLoaders = parsedWorkflow.nodes_info.audio_loader_nodes || [];
        
        const allLoaders = [...imgLoaders, ...vidLoaders, ...audLoaders];
        for (let i = 0; i < Math.max(allLoaders.length, 15); i++) {
          const filename = shot.assigned_slots[i] || sceneProject.shared_assets.find(a => a.slot_index === i)?.filename;
          if (filename && allLoaders[i]) {
            shotMappings[allLoaders[i].id] = filename;
          }
        }
      }
      return {
        shot_number: shot.shot_number.toString().padStart(2, "0"),
        shot_type: shot.shot_type,
        camera_movement: shot.camera_movement,
        lens_focal_length: shot.lens_focal_length || "50mm Standard Prime",
        aspect_ratio: shot.aspect_ratio || "16:9 Widescreen",
        expanded_prompt: shot.expanded_prompt,
        prompt_node_id: selectedPromptNodeId,
        node_mappings: shotMappings
      };
    });

    const payload = {
      ...config,
      workflow_filename: selectedWorkflowFile || sceneProject.workflow_file,
      scene_name: activeSceneName,
      shots: shotsData,
      bypass_missing: bypassMissing,
      generation_parameters: generationParams,
      parameter_node_mappings: parameterNodeMappings
    };

    const response = await fetch("/api/workflow/stage-scene", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Scene transfer failed");
    return data.success;
  }, [sceneProject, parsedWorkflow, selectedPromptNodeId, config, selectedWorkflowFile, bypassMissing, generationParams, parameterNodeMappings]);

  return {
    scenePlanning,
    setScenePlanning,
    promptPrefix,
    basicStub,
    setBasicStub,
    expandedPrompt,
    setExpandedPrompt,
    llmProvider,
    setLlmProvider,
    activeSection,
    setActiveSection,
    activeShotId,
    setActiveShotId,
    scrollToSection,
    updateShot,
    updateActiveShot,
    monitorState,
    handleSceneExpandPrompt,
    handleSceneTransfer,
    handleSceneTransferAll
  };
}
