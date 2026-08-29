import React, { useState, useEffect, useMemo } from "react";
import { AppConfig, MediaAsset, WorkflowItem, ParsedWorkflow, ToastMessage, GenerationParameters, ParameterNodeMappings, LLMProvider, ScenePlanning } from "./types";
import { getAssetMediaUrl } from "./utils/assetUrl";
import { Navbar } from "./components/Navbar";
import { ConfigSection } from "./components/ConfigSection";
import { WorkflowSection } from "./components/WorkflowSection";
import { AssetManagerSection } from "./components/AssetManagerSection";
import { generatePromptPrefix } from "./components/ScenePlanningHeader";
import { LLMSection } from "./components/LLMSection";
import { ExecutionSection } from "./components/ExecutionSection";
import { CodeViewerModal } from "./components/CodeViewerModal";
import { SaveProjectModal, LoadProjectModal } from "./components/ProjectModals";
import SceneProjectHub from "./components/SceneProjectHub";
import { SceneProjectFile, ShotItem } from "./types";
import { Sparkles, ArrowDown, HelpCircle, Terminal } from "lucide-react";

export default function App() {
  // 1. Config State
  const [config, setConfig] = useState<AppConfig>({
    remote_host: "194.26.196.105",
    ssh_port: 22,
    ssh_username: "root",
    ssh_password: "",
    ssh_key_path: "",
    ssh_private_key: "",
    remote_comfyui_root: "/workspace/runpod-slim/ComfyUI",
    comfyui_api_url: "http://127.0.0.1:8188",
    remote_api_token: "",
    lm_studio_url: "http://localhost:1234/v1"
  });

  // 2. Workflow & Node Mapping State
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

  // 3. Asset Management State
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);

  // Function to register subject in project registry
  const handleRegisterSubject = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSubjects(prev => {
      if (prev.some(s => s.toLowerCase() === trimmed.toLowerCase())) return prev;
      return [...prev, trimmed];
    });
  };

  // Sync subjects when assets change
  useEffect(() => {
    if (assets.length > 0) {
      setSubjects(prev => {
        let changed = false;
        const currentLower = new Set(prev.map(s => s.toLowerCase()));
        const next = [...prev];
        for (const a of assets) {
          const s = (a.subject_name || "").trim();
          if (s && !currentLower.has(s.toLowerCase())) {
            currentLower.add(s.toLowerCase());
            next.push(s);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }
  }, [assets]);

  // 4. LLM Prompt Expansion & Scene Planning State
  // Scene Hub State
  const [sceneProject, setSceneProject] = useState<SceneProjectFile>({
    schema_version: "1.0",
    scene_id: "scene_" + Date.now(),
    scene_name: "New Scene",
    workflow_file: "",
    shared_assets: [],
    shots: [{
      id: "shot_" + Date.now(),
      shot_number: 1,
      shot_type: "Medium Shot",
      camera_movement: "Locked Off",
      basic_stub: "",
      expanded_prompt: "",
      assigned_slots: {},
      staged: false,
      updated_at: new Date().toISOString()
    }]
  });

  const [scenePlanning, setScenePlanning] = useState<ScenePlanning>({
    scene_name: "",
    shot_number: "01",
    shot_type: "Medium Shot (MS)",
    camera_movement: "Locked Off (Static)"
  });
  const promptPrefix = useMemo(() => generatePromptPrefix(scenePlanning), [scenePlanning]);

  const [basicStub, setBasicStub] = useState<string>("");
  const [expandedPrompt, setExpandedPrompt] = useState<string>("");
  const [llmProvider, setLlmProvider] = useState<LLMProvider>("lm_studio");

  // UI Navigation & Code Modal
  const [activeSection, setActiveSection] = useState<string>("scene");
  const [activeShotId, setActiveShotId] = useState<string | null>(null);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState<boolean>(false);

  // Project Save/Load State
  const [isDirty, setIsDirty] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [currentProjectName, setCurrentProjectName] = useState<string>("");

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (text: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const [availableScenes, setAvailableScenes] = useState<string[]>([]);
  
  useEffect(() => {
    fetch("/api/projects")
      .then(res => res.json())
      .then(data => {
        if (data.projects) {
          setAvailableScenes(data.projects.filter((p: string) => p.startsWith("scene_")));
        }
      })
      .catch(e => console.error("Failed to load scene list", e));
  }, []);

  const handleSelectScene = async (sceneFilename: string) => {
    if (!sceneFilename) return;
    try {
      const res = await fetch(`/api/projects/${sceneFilename}`);
      if (!res.ok) throw new Error("Failed to fetch scene");
      const data = await res.json();
      setSceneProject({
        schema_version: "1.0",
        scene_id: data.scene_id || "scene_" + Date.now(),
        scene_name: data.scene_name || "New Scene",
        workflow_file: data.workflow_file || "",
        shared_assets: data.shared_assets || [],
        shots: data.shots || []
      });
      setActiveShotId(null);
      addToast(`Loaded scene: ${data.scene_name || sceneFilename}`, "success");
    } catch (e: any) {
      addToast(e.message || "Failed to load scene", "error");
    }
  };

  useEffect(() => {
    if (isInitialLoad) {
      setIsInitialLoad(false);
      return;
    }
    setIsDirty(true);
  }, [config, selectedWorkflowFile, selectedPromptNodeId, nodeMappings, bypassMissing, basicStub, expandedPrompt, generationParams, parameterNodeMappings, subjects, llmProvider, scenePlanning]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Auto-save sceneProject to disk
  useEffect(() => {
    if (isInitialLoad) return;
    const saveSceneProject = async () => {
      try {
        const payload = {
          name: `scene_${sceneProject.scene_name.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
          data: sceneProject
        };
        await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } catch (err) {
        console.error("Auto-save failed:", err);
      }
    };
    
    const timer = setTimeout(saveSceneProject, 1000);
    return () => clearTimeout(timer);
  }, [sceneProject, isInitialLoad]);

  const handleUpdateParam = (key: keyof GenerationParameters, value: number) => {
    setGenerationParams(prev => ({ ...prev, [key]: value }));
    if (activeShotId) {
      setSceneProject(prev => {
        const shots = [...prev.shots];
        const idx = shots.findIndex(s => s.id === activeShotId);
        if (idx !== -1) {
          shots[idx] = {
            ...shots[idx],
            generation_params: {
              ...(shots[idx].generation_params || { steps: 30, megapixels: 0.5, frames: 81 }),
              [key]: value
            }
          };
        }
        return { ...prev, shots };
      });
    }
  };

  const handleUpdateParameterMapping = (key: keyof ParameterNodeMappings, nodeId: string) => {
    setParameterNodeMappings(prev => ({ ...prev, [key]: nodeId }));
    if (activeShotId) {
      setSceneProject(prev => {
        const shots = [...prev.shots];
        const idx = shots.findIndex(s => s.id === activeShotId);
        if (idx !== -1) {
          shots[idx] = {
            ...shots[idx],
            parameter_node_mappings: {
              ...(shots[idx].parameter_node_mappings || { steps: "", megapixels: "", frames: "" }),
              [key]: nodeId
            }
          };
        }
        return { ...prev, shots };
      });
    }
  };

  const handleSceneExpandPrompt = async (shot: ShotItem): Promise<string> => {
    const shotPrefix = `${sceneProject.scene_name ? sceneProject.scene_name + " - " : ""}Shot ${shot.shot_number.toString().padStart(2, "0")} - ${shot.shot_type} - ${shot.camera_movement}`;
    
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
    
    const response = await fetch("/api/llm/expand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        basic_stub: shot.basic_stub,
        assets: shotAssets,
        prompt_prefix: shotPrefix,
        provider: llmProvider,
        lm_studio_url: config.lm_studio_url,
        gemini_api_key: config.gemini_api_key
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Expansion failed");
    return data.expanded_prompt;
  };

  const handleSceneTransfer = async (shot: ShotItem): Promise<boolean> => {
    // Generate the specific node mappings for this shot based on slot_index
    const shotMappings: Record<string, string> = {};
    if (parsedWorkflow) {
      const imgLoaders = parsedWorkflow.nodes_info.image_loader_nodes || [];
      const vidLoaders = parsedWorkflow.nodes_info.video_loader_nodes || [];
      const audLoaders = parsedWorkflow.nodes_info.audio_loader_nodes || [];
      
      const allLoaders = [...imgLoaders, ...vidLoaders, ...audLoaders];
      
      // Assign based on slot index
      for (let i = 0; i < 9; i++) {
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
  };

  const handleSceneTransferAll = async (): Promise<boolean> => {
    const activeSceneName = sceneProject.scene_name.replace(/[^a-zA-Z0-9_-]/g, "_") || "Untitled_Scene";
    const shotsData = sceneProject.shots.map(shot => {
      const shotMappings: Record<string, string> = {};
      if (parsedWorkflow) {
        const imgLoaders = parsedWorkflow.nodes_info.image_loader_nodes || [];
        const vidLoaders = parsedWorkflow.nodes_info.video_loader_nodes || [];
        const audLoaders = parsedWorkflow.nodes_info.audio_loader_nodes || [];
        
        const allLoaders = [...imgLoaders, ...vidLoaders, ...audLoaders];
        for (let i = 0; i < 9; i++) {
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
  };

  const handleSaveProject = async (filename: string) => {
    const consolidatedSubjects = Array.from(
      new Set([
        ...subjects.map(s => s.trim()).filter(Boolean),
        ...assets.map(a => (a.subject_name || "").trim()).filter(Boolean)
      ])
    );

    const payload = {
      config,
      selectedWorkflowFile,
      selectedPromptNodeId,
      nodeMappings,
      bypassMissing,
      generationParams,
      parameterNodeMappings,
      scenePlanning,
      scene_planning: scenePlanning,
      basicStub,
      expandedPrompt,
      llmProvider, // Save user's choice of LLM
      llm_provider: llmProvider,
      assets, // Save media assets with the project
      subjects: consolidatedSubjects // Save global subjects registry
    };
    
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, data: payload })
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to save project.");
    }
    
    setCurrentProjectName(filename.replace(/\.json$/, ""));
    setIsDirty(false);
    addToast(`Project "${filename}" saved successfully with ${assets.length} image asset(s) and ${consolidatedSubjects.length} subject(s).`, "success");
  };

  const handleLoadProject = async (filename: string) => {
    const res = await fetch(`/api/projects/${filename}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to load project.");
    }
    const data = await res.json();

    if (data.schema_version === "1.0") {
      setSceneProject(data);
      setCurrentProjectName(filename);
      setActiveSection("scene");
      setIsDirty(false);
      return;
    }

    // 1. Sync & set saved assets if present
    if (Array.isArray(data.assets) && data.assets.length > 0) {
      const normalizedAssets = data.assets.map((a: any, idx: number) => ({
        ...a,
        slot_index: a.slot_index !== undefined ? a.slot_index : idx,
        media_type: a.media_type || (/\.(mp3|wav|ogg|m4a|flac)$/i.test(a.filename) ? "audio" : /\.(mp4|mov|webm|mkv)$/i.test(a.filename) ? "video" : "image"),
        preview_url: getAssetMediaUrl(a.filename)
      }));
      setAssets(normalizedAssets);
      try {
        await fetch("/api/assets/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assets: normalizedAssets })
        });
      } catch (e) {
        console.error("Failed to sync project assets", e);
      }
    } else {
      await fetchAssets();
    }
    
    // 2. Restore subjects registry
    if (Array.isArray(data.subjects)) {
      setSubjects(data.subjects);
    } else if (Array.isArray(data.assets)) {
      setSubjects(Array.from(new Set(data.assets.map((a: any) => (a.subject_name || "").trim()).filter(Boolean))));
    }

    if (data.config) {
      setConfig(prev => ({
        ...prev,
        ...data.config,
        remote_host: data.config.remote_host || data.config.runpod_ip || prev.remote_host,
        remote_api_token: data.config.remote_api_token || data.config.runpod_api_token || prev.remote_api_token,
        remote_comfyui_root: data.config.remote_comfyui_root || (data.config.remote_input_dir ? data.config.remote_input_dir.replace(/\/input\/?$/, "") : null) || prev.remote_comfyui_root || "/workspace/runpod-slim/ComfyUI"
      }));
    }
    setSelectedWorkflowFile(data.selectedWorkflowFile || "");
    setSelectedPromptNodeId(data.selectedPromptNodeId || "");
    setNodeMappings(data.nodeMappings || {});
    setBypassMissing(data.bypassMissing ?? true);
    if (data.generationParams) {
      setGenerationParams(data.generationParams);
    }
    if (data.parameterNodeMappings) {
      setParameterNodeMappings(data.parameterNodeMappings);
    }
    if (data.scenePlanning || data.scene_planning) {
      const loadedPlanning = data.scenePlanning || data.scene_planning;
      setScenePlanning({
        scene_name: loadedPlanning.scene_name || "",
        shot_number: loadedPlanning.shot_number || "01",
        shot_type: loadedPlanning.shot_type || "Medium Shot (MS)",
        camera_movement: loadedPlanning.camera_movement || "Locked Off (Static)"
      });
    }
    setBasicStub(data.basicStub || "");
    setExpandedPrompt(data.expandedPrompt || "");
    const loadedLlmProvider = data.llmProvider || data.llm_provider || data.llmChoice || data.providerChoice || "lm_studio";
    setLlmProvider(loadedLlmProvider === "gemini" ? "gemini" : "lm_studio");
    setCurrentProjectName(filename.replace(/\.json$/, ""));
    
    await fetchWorkflows();
    
    setTimeout(() => setIsDirty(false), 100);
    const assetCount = Array.isArray(data.assets) ? data.assets.length : 0;
    addToast(`Project "${filename}" loaded successfully (${assetCount} image assets restored).`, "success");
  };

  // Fetch workflows and assets on initial mount
  const fetchWorkflows = async () => {
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
  };

  const fetchAssets = async () => {
    try {
      const res = await fetch("/api/assets");
      const data = await res.json();
      if (data.assets) {
        setAssets(data.assets.map((a: any, idx: number) => ({
          ...a,
          slot_index: a.slot_index !== undefined ? a.slot_index : idx,
          media_type: a.media_type || (/\.(mp3|wav|ogg|m4a|flac)$/i.test(a.filename) ? "audio" : /\.(mp4|mov|webm|mkv)$/i.test(a.filename) ? "video" : "image"),
          preview_url: getAssetMediaUrl(a.filename)
        })));
      }
    } catch (e) {
      console.error("Failed to load assets", e);
    }
  };

  useEffect(() => {
    fetchWorkflows();
    fetchAssets();
  }, []);

  // Parse workflow when selection changes
  useEffect(() => {
    if (!selectedWorkflowFile) return;

    const parseSelectedWorkflow = async () => {
      try {
        const res = await fetch("/api/workflows/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: selectedWorkflowFile })
        });
        const data = await res.json();
        if (res.ok && data.nodes_info) {
          setParsedWorkflow(data);

          // Auto-sync detected parameter nodes
          const detected = data.detected_nodes || data.nodes_info.detected_nodes;
          if (detected) {
            setParameterNodeMappings(prev => ({
              steps: detected.steps || prev.steps || "",
              megapixels: detected.megapixels || prev.megapixels || "",
              frames: detected.frames || prev.frames || ""
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
  }, [selectedWorkflowFile]);

  // Asset handlers
  const handleAssetUploaded = (newAsset: MediaAsset, targetSlotIndex?: number, mediaType?: "image" | "audio" | "video") => {
    const slotIdx = targetSlotIndex !== undefined ? targetSlotIndex : (newAsset.slot_index ?? 0);
    const mType = mediaType || newAsset.media_type || "image";
    const assetWithSlot: MediaAsset = {
      ...newAsset,
      slot_index: slotIdx,
      media_type: mType
    };

    setAssets(prev => {
      // Find if an asset of this media type exists with this slot_index
      const existingIndex = prev.findIndex(a => {
        const isMatch = mType === "image" 
          ? (a.media_type === "image" || (!a.media_type && !/\.(mp3|wav|ogg|m4a|flac|mp4|mov|webm|mkv)$/i.test(a.filename)))
          : mType === "audio" 
          ? (a.media_type === "audio" || /\.(mp3|wav|ogg|m4a|flac)$/i.test(a.filename))
          : (a.media_type === "video" || /\.(mp4|mov|webm|mkv)$/i.test(a.filename));
        return isMatch && (a.slot_index === slotIdx || (a.slot_index === undefined && prev.filter(p => p.media_type === mType).indexOf(a) === slotIdx));
      });

      if (existingIndex !== -1) {
        const next = [...prev];
        next[existingIndex] = assetWithSlot;
        return next;
      }
      return [...prev, assetWithSlot];
    });

    // Auto-map if there's a loader node for this slot type and index
    if (parsedWorkflow) {
      const loaderNodes = mType === "image" 
        ? parsedWorkflow.nodes_info.image_loader_nodes 
        : mType === "video" 
        ? parsedWorkflow.nodes_info.video_loader_nodes 
        : parsedWorkflow.nodes_info.audio_loader_nodes;

      if (loaderNodes && loaderNodes[slotIdx]) {
        const targetNodeId = loaderNodes[slotIdx].id;
        setNodeMappings(prev => ({ ...prev, [targetNodeId]: newAsset.filename }));
      } else {
        const emptySlot = loaderNodes?.find((n: any) => !nodeMappings[n.id]);
        if (emptySlot) {
          setNodeMappings(prev => ({ ...prev, [emptySlot.id]: newAsset.filename }));
        }
      }
    }
  };

  const handleAssetUpdated = (oldFilename: string, newAsset: MediaAsset) => {
    setAssets(prev => prev.map(a => a.filename === oldFilename ? { ...newAsset, slot_index: a.slot_index ?? newAsset.slot_index } : a));
    // Update nodeMappings if the filename changed
    if (oldFilename !== newAsset.filename) {
      setNodeMappings(prev => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (next[key] === oldFilename) next[key] = newAsset.filename;
        }
        return next;
      });
    }
  };

  const handleAssetDeleted = (filename: string) => {
    setAssets(prev => prev.filter(a => a.filename !== filename));
    // Clear mappings referencing this deleted asset
    setNodeMappings(prev => {
      const updated = { ...prev };
      for (const [nodeId, file] of Object.entries(updated)) {
        if (file === filename) updated[nodeId] = "";
      }
      return updated;
    });
  };

  const handleUpdateMapping = (nodeId: string, filename: string) => {
    setNodeMappings(prev => ({ ...prev, [nodeId]: filename }));
    if (activeShotId) {
      updateActiveShot(prev => ({
        ...prev,
        node_mappings: {
          ...(prev.node_mappings || {}),
          [nodeId]: filename
        }
      }));
    }
  };

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
  };

  const updateActiveShot = (updater: (prev: ShotItem) => ShotItem) => {
    setSceneProject(prev => {
      const shots = [...prev.shots];
      const idx = shots.findIndex(s => s.id === activeShotId);
      if (idx !== -1) {
        shots[idx] = updater(shots[idx]);
      }
      return { ...prev, shots };
    });
  };

  useEffect(() => {
    if (activeShotId) {
      const shot = sceneProject.shots.find(s => s.id === activeShotId);
      if (shot) {
        if (shot.workflow_file !== undefined) setSelectedWorkflowFile(shot.workflow_file);
        if (shot.prompt_node_id !== undefined) setSelectedPromptNodeId(shot.prompt_node_id);
        if (shot.node_mappings !== undefined) setNodeMappings(shot.node_mappings);
        if (shot.generation_params !== undefined) setGenerationParams(shot.generation_params);
        if (shot.parameter_node_mappings !== undefined) setParameterNodeMappings(shot.parameter_node_mappings);
        if (shot.basic_stub !== undefined) setBasicStub(shot.basic_stub);
        if (shot.expanded_prompt !== undefined) setExpandedPrompt(shot.expanded_prompt);
      }
    }
  }, [activeShotId, sceneProject.shots]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500 selection:text-white flex flex-col">
      {/* Top Navbar */}
      <Navbar 
        activeSection={activeSection}
        onNavigate={scrollToSection}
        onSaveProject={() => setIsSaveModalOpen(true)}
        onLoadProject={() => setIsLoadModalOpen(true)}
        toasts={toasts}
        onDismissToast={(id) => setToasts(prev => prev.filter(t => t.id !== id))}
      />

      {/* Main Workspace Layout */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-6 space-y-6 flex-1 flex flex-col min-h-0">
        {/* Tab Content Rendering */}
        {activeSection === "scene" && (
          <div className="flex flex-col gap-6 min-h-0 flex-1">
            <div className="flex items-center gap-4 bg-zinc-900/40 p-4 rounded-xl border border-zinc-800">
              <label className="text-sm font-medium text-zinc-400">Active Scene Project:</label>
              <select
                value={sceneProject.scene_name}
                onChange={(e) => {
                  const sel = e.target.value;
                  const sceneFile = availableScenes.find(s => s === sel || s === `scene_${sel.replace(/[^a-zA-Z0-9_-]/g, "_")}`);
                  if (sceneFile) {
                    handleSelectScene(sceneFile);
                  } else {
                    setSceneProject(prev => ({ ...prev, scene_name: sel }));
                  }
                }}
                className="bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none min-w-[200px]"
              >
                <option key="active" value={sceneProject.scene_name}>{sceneProject.scene_name}</option>
                {availableScenes
                  .filter(s => s !== `scene_${sceneProject.scene_name.replace(/[^a-zA-Z0-9_-]/g, "_")}`)
                  .map(s => (
                  <option key={s} value={s}>{s.replace(/^scene_/, "").replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            
            <SceneProjectHub
              project={sceneProject}
              onUpdateProject={setSceneProject}
              activeShotId={activeShotId}
              onSelectShot={setActiveShotId}
              config={config}
              assets={assets}
              onShowToast={addToast}
              onTransfer={handleSceneTransfer}
              onTransferScene={handleSceneTransferAll}
              onExpandPrompt={handleSceneExpandPrompt}
            />
          </div>
        )}

        {activeSection === "assets" && (
          <AssetManagerSection
            assets={assets}
            subjects={subjects}
            activeShotId={activeShotId}
            onSelectShot={setActiveShotId}
            sceneProject={sceneProject}
            onUpdateProject={setSceneProject}
            onRegisterSubject={handleRegisterSubject}
            onAssetUploaded={handleAssetUploaded}
            onAssetDeleted={handleAssetDeleted}
            onAssetUpdated={handleAssetUpdated}
          />
        )}

        {activeSection === "workflow" && (
          <WorkflowSection
            workflows={workflows}
            selectedWorkflowFile={selectedWorkflowFile}
            onSelectWorkflow={setSelectedWorkflowFile}
            onRefreshWorkflows={fetchWorkflows}
            parsedWorkflow={parsedWorkflow}
            selectedPromptNodeId={selectedPromptNodeId}
            onSelectPromptNodeId={setSelectedPromptNodeId}
            nodeMappings={nodeMappings}
            onUpdateMapping={handleUpdateMapping}
            uploadedAssets={assets}
            bypassMissing={bypassMissing}
            onToggleBypass={setBypassMissing}
            generationParams={generationParams}
            onUpdateParam={handleUpdateParam}
            parameterNodeMappings={parameterNodeMappings}
            onUpdateParameterMapping={handleUpdateParameterMapping}
            activeShotId={activeShotId}
            onSelectShot={setActiveShotId}
            sceneProject={sceneProject}
            onUpdateShot={updateActiveShot}
          />
        )}

        {activeSection === "llm" && (
          <LLMSection
            basicStub={basicStub}
            onChangeBasicStub={(val) => {
              setBasicStub(val);
              if (activeShotId) updateActiveShot(prev => ({ ...prev, basic_stub: val, staged: false }));
            }}
            expandedPrompt={expandedPrompt}
            onChangeExpandedPrompt={(val) => {
              setExpandedPrompt(val);
              if (activeShotId) updateActiveShot(prev => ({ ...prev, expanded_prompt: val, staged: false }));
            }}
            providerChoice={llmProvider}
            onChangeProviderChoice={setLlmProvider}
            promptPrefix={promptPrefix}
            planning={scenePlanning}
            assets={assets}
            lmStudioUrl={config.lm_studio_url}
            geminiApiKey={config.gemini_api_key}
            onShowToast={addToast}
            activeShotId={activeShotId}
            onSelectShot={setActiveShotId}
            sceneProject={sceneProject}
            onUpdateShot={updateActiveShot}
          />
        )}

        {activeSection === "execute" && (
          <ExecutionSection
            config={config}
            activeShotId={activeShotId}
            sceneProject={sceneProject}
            onSelectShot={setActiveShotId}
            onUpdateShot={updateActiveShot}
            onUpdateSceneProject={setSceneProject}
            onShowToast={addToast}
          />
        )}

        {activeSection === "config" && (
          <ConfigSection 
            config={config} 
            onChange={setConfig} 
            onOpenCodeViewer={() => setIsCodeModalOpen(true)}
          />
        )}
      </main>

      {/* Code Inspector Modal */}
      <CodeViewerModal
        isOpen={isCodeModalOpen}
        onClose={() => setIsCodeModalOpen(false)}
      />

      <SaveProjectModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={handleSaveProject}
        currentProjectName={currentProjectName}
      />

      <LoadProjectModal
        isOpen={isLoadModalOpen}
        onClose={() => setIsLoadModalOpen(false)}
        onLoad={handleLoadProject}
      />

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 py-6 mt-12 text-center text-xs text-zinc-500">
        <p>ComfyUI Bridge &amp; Remote Orchestrator • Dockerized Local Bridge Architecture</p>
      </footer>
    </div>
  );
}
