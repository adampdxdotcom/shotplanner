import React, { useState, useEffect } from "react";
import { AppConfig, MediaAsset, WorkflowItem, ParsedWorkflow, ToastMessage, GenerationParameters, ParameterNodeMappings } from "./types";
import { Navbar } from "./components/Navbar";
import { ConfigSection } from "./components/ConfigSection";
import { WorkflowSection } from "./components/WorkflowSection";
import { AssetManagerSection } from "./components/AssetManagerSection";
import { LLMSection } from "./components/LLMSection";
import { ExecutionSection } from "./components/ExecutionSection";
import { CodeViewerModal } from "./components/CodeViewerModal";
import { SaveProjectModal, LoadProjectModal } from "./components/ProjectModals";
import { Sparkles, ArrowDown, HelpCircle, Terminal } from "lucide-react";

export default function App() {
  // 1. Config State
  const [config, setConfig] = useState<AppConfig>({
    runpod_ip: "194.26.196.105",
    ssh_port: 22,
    ssh_username: "root",
    ssh_password: "",
    ssh_key_path: "",
    ssh_private_key: "",
    remote_input_dir: "/workspace/runpod-slim/ComfyUI/input/",
    comfyui_api_url: "http://127.0.0.1:8188",
    runpod_api_token: "",
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

  // 4. LLM Prompt Expansion State
  const [basicStub, setBasicStub] = useState<string>("");
  const [expandedPrompt, setExpandedPrompt] = useState<string>("");

  // UI Navigation & Code Modal
  const [activeSection, setActiveSection] = useState<string>("assets");
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

  useEffect(() => {
    if (isInitialLoad) {
      setIsInitialLoad(false);
      return;
    }
    setIsDirty(true);
  }, [config, selectedWorkflowFile, selectedPromptNodeId, nodeMappings, bypassMissing, basicStub, expandedPrompt, generationParams, parameterNodeMappings, subjects]);

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

  const handleUpdateParam = (key: keyof GenerationParameters, value: number) => {
    setGenerationParams(prev => ({ ...prev, [key]: value }));
  };

  const handleUpdateParameterMapping = (key: keyof ParameterNodeMappings, nodeId: string) => {
    setParameterNodeMappings(prev => ({ ...prev, [key]: nodeId }));
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
      basicStub,
      expandedPrompt,
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

    // 1. Sync & set saved assets if present
    if (Array.isArray(data.assets) && data.assets.length > 0) {
      const normalizedAssets = data.assets.map((a: any, idx: number) => ({
        ...a,
        slot_index: a.slot_index !== undefined ? a.slot_index : idx,
        media_type: a.media_type || (/\.(mp3|wav|ogg|m4a|flac)$/i.test(a.filename) ? "audio" : /\.(mp4|mov|webm|mkv)$/i.test(a.filename) ? "video" : "image"),
        preview_url: `/api/assets/file/${a.filename}`
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
        remote_input_dir: data.config.remote_input_dir || prev.remote_input_dir || "/workspace/runpod-slim/ComfyUI/input/"
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
    setBasicStub(data.basicStub || "");
    setExpandedPrompt(data.expandedPrompt || "");
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
          preview_url: `/api/assets/file/${a.filename}`
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
  };

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500 selection:text-white">
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
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-6 space-y-6">
        {/* Tab Content Rendering */}
        {activeSection === "assets" && (
          <AssetManagerSection
            assets={assets}
            subjects={subjects}
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
          />
        )}

        {activeSection === "llm" && (
          <LLMSection
            basicStub={basicStub}
            onChangeBasicStub={setBasicStub}
            expandedPrompt={expandedPrompt}
            onChangeExpandedPrompt={setExpandedPrompt}
            assets={assets}
            lmStudioUrl={config.lm_studio_url}
            geminiApiKey={config.gemini_api_key}
          />
        )}

        {activeSection === "execute" && (
          <ExecutionSection
            config={config}
            workflowFilename={selectedWorkflowFile}
            promptNodeId={selectedPromptNodeId}
            expandedPrompt={expandedPrompt}
            nodeMappings={nodeMappings}
            bypassMissing={bypassMissing}
            generationParams={generationParams}
            parameterNodeMappings={parameterNodeMappings}
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
        <p>ComfyUI Bridge &amp; RunPod Orchestrator • Dockerized Local Bridge Architecture</p>
      </footer>
    </div>
  );
}
