import React, { useState, useEffect } from "react";
import { AppConfig, MediaAsset, WorkflowItem, ParsedWorkflow } from "./types";
import { Navbar } from "./components/Navbar";
import { ConfigSection } from "./components/ConfigSection";
import { WorkflowSection } from "./components/WorkflowSection";
import { AssetManagerSection } from "./components/AssetManagerSection";
import { LLMSection } from "./components/LLMSection";
import { ExecutionSection } from "./components/ExecutionSection";
import { CodeViewerModal } from "./components/CodeViewerModal";
import { Sparkles, ArrowDown, HelpCircle, Terminal } from "lucide-react";

export default function App() {
  // 1. Config State
  const [config, setConfig] = useState<AppConfig>({
    runpod_ip: "194.26.196.105",
    ssh_port: 22,
    ssh_username: "root",
    ssh_password: "",
    ssh_key_path: "",
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

  // 3. Asset Management State
  const [assets, setAssets] = useState<MediaAsset[]>([]);

  // 4. LLM Prompt Expansion State
  const [basicStub, setBasicStub] = useState<string>(
    "Jackie walking through a rainy neon cyberpunk alleyway, turning towards the camera with a subtle smirk as holographic advertisements reflect on her leather jacket."
  );
  const [expandedPrompt, setExpandedPrompt] = useState<string>(
    "Cinematic 4K shot based on Jackie walking through a rainy neon cyberpunk alleyway. Featuring <Picture 1> with authentic facial contours and sharp focus. Dynamic camera dolly-in, reflections on wet asphalt, volumetric cyan and magenta rim lighting, photorealistic 8k render."
  );

  // UI Navigation & Code Modal
  const [activeSection, setActiveSection] = useState<string>("workflow");
  const [isCodeModalOpen, setIsCodeModalOpen] = useState<boolean>(false);

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
        setAssets(data.assets);
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

          // Auto-select primary prompt node
          if (data.nodes_info.prompt_nodes?.length > 0) {
            setSelectedPromptNodeId(data.nodes_info.prompt_nodes[0].id);
          } else {
            setSelectedPromptNodeId("");
          }

          // Initialize clean node mapping
          const initialMappings: Record<string, string> = {};
          data.nodes_info.image_loader_nodes?.forEach((n: any) => {
            initialMappings[n.id] = "";
          });
          data.nodes_info.video_loader_nodes?.forEach((n: any) => {
            initialMappings[n.id] = "";
          });
          data.nodes_info.audio_loader_nodes?.forEach((n: any) => {
            initialMappings[n.id] = "";
          });
          setNodeMappings(initialMappings);
        }
      } catch (err) {
        console.error("Failed to parse workflow", err);
      }
    };

    parseSelectedWorkflow();
  }, [selectedWorkflowFile]);

  // Asset handlers
  const handleAssetUploaded = (newAsset: MediaAsset) => {
    setAssets(prev => [newAsset, ...prev]);

    // Auto-map if there's an unassigned loader node
    if (parsedWorkflow) {
      const emptySlot = Object.keys(nodeMappings).find(nodeId => !nodeMappings[nodeId]);
      if (emptySlot) {
        setNodeMappings(prev => ({ ...prev, [emptySlot]: newAsset.filename }));
      }
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
    const el = document.getElementById(`${sectionId}-section`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar 
        onOpenCodeViewer={() => setIsCodeModalOpen(true)}
        activeSection={activeSection}
        onNavigate={scrollToSection}
      />

      {/* Main Workspace Layout */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-6 space-y-6">
        {/* Quick Pipeline Status Banner */}
        <div className="bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-indigo-950/40 border border-zinc-800/90 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <h2 className="text-base font-bold text-zinc-100">
                ComfyUI Multi-Asset Orchestrator
              </h2>
            </div>
            <p className="text-xs text-zinc-400 max-w-2xl leading-relaxed">
              Upload local reference media with semantic metadata, expand prompt stubs using your local LM Studio LLM with <code className="text-zinc-200 bg-zinc-800 px-1 py-0.5 rounded">&lt;Picture 1&gt;</code> reference tags, and seamlessly dispatch modified flat JSON dictionary payloads to remote RunPod ComfyUI via SSH and API.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right text-xs">
              <span className="text-zinc-400 block">Active Workflow:</span>
              <span className="font-mono font-semibold text-amber-300">
                {selectedWorkflowFile || "None Selected"}
              </span>
            </div>

            <button
              onClick={() => scrollToSection("execute")}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <span>Jump to Execute</span>
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Section 1: Configuration */}
        <ConfigSection 
          config={config} 
          onChange={setConfig} 
        />

        {/* Section 2: Workflow Management & Dynamic Mapping */}
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
        />

        {/* Section 3: Segmented Asset Management */}
        <AssetManagerSection
          assets={assets}
          onAssetUploaded={handleAssetUploaded}
          onAssetDeleted={handleAssetDeleted}
        />

        {/* Section 4: LLM Prompt Expansion */}
        <LLMSection
          basicStub={basicStub}
          onChangeBasicStub={setBasicStub}
          expandedPrompt={expandedPrompt}
          onChangeExpandedPrompt={setExpandedPrompt}
          assets={assets}
          lmStudioUrl={config.lm_studio_url}
        />

        {/* Section 5: Master Pipeline Execution */}
        <ExecutionSection
          config={config}
          workflowFilename={selectedWorkflowFile}
          promptNodeId={selectedPromptNodeId}
          expandedPrompt={expandedPrompt}
          nodeMappings={nodeMappings}
          bypassMissing={bypassMissing}
        />
      </main>

      {/* Code Inspector Modal */}
      <CodeViewerModal
        isOpen={isCodeModalOpen}
        onClose={() => setIsCodeModalOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 py-6 mt-12 text-center text-xs text-zinc-500">
        <p>ComfyUI Bridge &amp; RunPod Orchestrator • Dockerized Local Bridge Architecture</p>
      </footer>
    </div>
  );
}
