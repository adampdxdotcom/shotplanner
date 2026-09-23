import React, { useState, Suspense, lazy } from "react";
import { Navbar } from "./components/Navbar";
import { ConfigTab } from "./components/ConfigSection";
import { SectionLoadingFallback } from "./components/common/SectionLoadingFallback";
import { ShotDossierCard } from "./components/ShotDossierCard";
import { ShotItem } from "./types";
import { useAppLogic } from "./hooks/useAppLogic";

// Lazy-loaded top-level sections for optimal initial bundle performance
const SceneProjectHub = lazy(() => import("./components/SceneProjectHub"));
const AssetManagerSection = lazy(() => import("./components/AssetManagerSection").then(m => ({ default: m.AssetManagerSection })));
const StagingSection = lazy(() => import("./components/StagingSection").then(m => ({ default: m.StagingSection })));
const LLMSection = lazy(() => import("./components/LLMSection").then(m => ({ default: m.LLMSection })));
const WorkflowSection = lazy(() => import("./components/WorkflowSection").then(m => ({ default: m.WorkflowSection })));
const ExecutionSection = lazy(() => import("./components/ExecutionSection").then(m => ({ default: m.ExecutionSection })));
const GallerySection = lazy(() => import("./components/GallerySection").then(m => ({ default: m.GallerySection })));
const CastSection = lazy(() => import("./components/CastSection").then(m => ({ default: m.CastSection })));
const ConfigSection = lazy(() => import("./components/ConfigSection").then(m => ({ default: m.ConfigSection })));
const AppModals = lazy(() => import("./components/AppModals").then(m => ({ default: m.AppModals })));
const AssistantFloatingChat = lazy(() => import("./components/assistant/AssistantFloatingChat").then(m => ({ default: m.AssistantFloatingChat })));

export default function App() {
  const {
    config, setConfig,
    workflows, setWorkflows,
    selectedWorkflowFile, setSelectedWorkflowFile,
    parsedWorkflow, setParsedWorkflow,
    selectedPromptNodeId, setSelectedPromptNodeId,
    nodeMappings, setNodeMappings,
    bypassMissing, setBypassMissing,
    generationParams, setGenerationParams,
    parameterNodeMappings, setParameterNodeMappings,
    assets,
    sceneProject, setSceneProject,
    scenePlanning, setScenePlanning,
    basicStub, setBasicStub,
    expandedPrompt, setExpandedPrompt,
    llmProvider, setLlmProvider,
    defaultLlmProvider, setDefaultLlmProvider,
    activeSection, setActiveSection,
    activeShotId, setActiveShotId,
    isDirty, setIsDirty,
    hasLoadedProject, setHasLoadedProject,
    isInitialLoad, setIsInitialLoad,
    isNewModalOpen, setIsNewModalOpen,
    isSaveModalOpen, setIsSaveModalOpen,
    isLoadModalOpen, setIsLoadModalOpen,
    currentProjectName, setCurrentProjectName,
    toasts, setToasts,
    monitorState,
    availableScenes, setAvailableScenes,
    addToast,
    dismissToast,
    subjects,
    promptPrefix,
    handleRegisterSubject,
    handleUpdateCharacter,
    handleDeleteCharacter,
    fetchWorkflows,
    handleUpdateParam,
    handleUpdateParameterMapping,
    handleSceneExpandPrompt,
    handleSceneTransfer,
    handleSceneTransferAll,
    handleSaveProject,
    handleLoadProject,
    handleCreateNewProject,
    handleAssetUploaded,
    handleAssetUpdated,
    handleAssetDeleted,
    handleUpdateMapping,
    scrollToSection,
    updateShot,
    updateActiveShot,
    autosaveStatus,
    lastSavedAt
  } = useAppLogic();

  const [activeConfigTab, setActiveConfigTab] = useState<ConfigTab>("llm");
  const [isScenePlanOpen, setIsScenePlanOpen] = useState(false);

  const hasScenePlan = Boolean(
    sceneProject?.scene_planning?.overarching_goal?.trim() ||
    sceneProject?.scene_planning?.mood_genre?.trim() ||
    sceneProject?.scene_planning?.location_description?.trim() ||
    scenePlanning?.overarching_goal?.trim() ||
    scenePlanning?.mood_genre?.trim() ||
    scenePlanning?.location_description?.trim()
  );

  const handleSaveScenePlan = (payload: {
    sceneName: string;
    planning: Partial<any>;
  }) => {
    setSceneProject((prev) => ({
      ...prev,
      scene_name: payload.sceneName || prev.scene_name,
      scene_planning: {
        ...(prev.scene_planning || {}),
        ...payload.planning
      },
      updated_at: new Date().toISOString()
    }));
    if (payload.planning) {
      setScenePlanning((prev: any) => ({
        ...prev,
        ...payload.planning
      }));
    }
    setIsDirty(true);
    addToast("Scene Plan updated.", "success");
  };

  const activeShot = sceneProject.shots?.find((s) => s.id === activeShotId) || null;

  const handleAddBlankShot = () => {
    const newShot: ShotItem = {
      id: "shot_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      shot_number: (sceneProject.shots?.length || 0) + 1,
      shot_type: "Medium Shot",
      camera_movement: "Locked Off",
      lens_focal_length: "50mm Standard Prime",
      aspect_ratio: "16:9 Widescreen",
      basic_stub: "",
      expanded_prompt: "",
      assigned_slots: {},
      status: "unstaged",
      updated_at: new Date().toISOString()
    };
    setSceneProject((prev) => ({ ...prev, shots: [...(prev.shots || []), newShot] }));
    setActiveShotId(newShot.id);
  };

  const handleDuplicateShot = () => {
    if (!activeShot) return;
    const newId = "shot_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
    setSceneProject((prev) => {
      const idx = prev.shots.findIndex((s) => s.id === activeShot.id);
      if (idx === -1) return prev;
      const duplicatedShot: ShotItem = {
        ...activeShot,
        id: newId,
        shot_number: activeShot.shot_number + 1,
        shot_name: activeShot.shot_name ? `${activeShot.shot_name} (Copy)` : undefined,
        status: "unstaged",
        takes: [],
        hero_take_id: undefined,
        assigned_slots: { ...(activeShot.assigned_slots || {}) },
        characters: activeShot.characters ? [...activeShot.characters] : [],
        updated_at: new Date().toISOString()
      };
      const shots = [...prev.shots];
      shots.splice(idx + 1, 0, duplicatedShot);
      shots.forEach((s, i) => (s.shot_number = i + 1));
      return { ...prev, shots };
    });
    setActiveShotId(newId);
  };

  // Keep browser tab title synchronized with active scene or project name
  React.useEffect(() => {
    const displayName = sceneProject.scene_name?.trim() || currentProjectName?.trim() || "Untitled Project";
    document.title = `Shot Planner: ${displayName}`;
  }, [sceneProject.scene_name, currentProjectName]);

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] font-sans selection:bg-indigo-500 selection:text-white flex flex-col transition-colors duration-200">
      {/* Top Navbar */}
      <Navbar 
        projectName={sceneProject.scene_name}
        isDirty={isDirty}
        activeSection={activeSection}
        onNavigate={scrollToSection}
        onSaveProject={() => setIsSaveModalOpen(true)}
        onLoadProject={() => setIsLoadModalOpen(true)}
        onNewProject={() => setIsNewModalOpen(true)}
        toasts={toasts}
        onDismissToast={dismissToast}
        monitorState={monitorState}
      />

      {/* Main Workspace Layout */}
      <main className="w-full max-w-7xl mx-auto px-4 lg:px-8 py-6 space-y-6 flex-1 flex flex-col min-h-0">
        {/* Universal Shot Dossier Card (Mounted once for all workspace tabs) */}
        {activeSection !== "gallery" && activeSection !== "cast" && activeSection !== "config" && (
          <ShotDossierCard
            shots={sceneProject.shots || []}
            activeShotId={activeShotId}
            onSelectShot={setActiveShotId}
            assets={assets}
            sceneName={sceneProject.scene_name || currentProjectName || "Scene"}
            onNewShot={handleAddBlankShot}
            onDuplicateShot={activeShot ? handleDuplicateShot : undefined}
            onOpenScenePlan={() => setIsScenePlanOpen(true)}
            hasScenePlan={hasScenePlan}
          />
        )}

        <Suspense fallback={<SectionLoadingFallback label={`Loading ${activeSection} module...`} />}>
          {/* Tab Content Rendering */}
          {activeSection === "scene" && (
            <div className="flex flex-col gap-6 min-h-0 flex-1">
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
                onAssetUploaded={handleAssetUploaded}
                onUpdateSpecificShot={updateShot}
                onNavigate={scrollToSection}
                monitorState={monitorState}
              />
            </div>
          )}

          {activeSection === "assets" && (
            <AssetManagerSection
              key={sceneProject.scene_id || currentProjectName}
              assets={assets}
              subjects={subjects}
              characters={sceneProject.characters || {}}
              config={config}
              onUpdateCharacter={handleUpdateCharacter}
              activeShotId={activeShotId}
              onSelectShot={setActiveShotId}
              sceneProject={sceneProject}
              activeSceneName={sceneProject.scene_name || currentProjectName || "Untitled_Scene"}
              onUpdateProject={setSceneProject}
              onRegisterSubject={handleRegisterSubject}
              onAssetUploaded={handleAssetUploaded}
              onAssetDeleted={handleAssetDeleted}
              onAssetUpdated={handleAssetUpdated}
              addToast={addToast}
            />
          )}

          {activeSection === "staging" && (
            <StagingSection
              sceneProject={sceneProject}
              activeShotId={activeShotId}
              onSelectShot={setActiveShotId}
              assets={assets}
              characters={sceneProject.characters || {}}
              subjects={subjects}
              activeSceneName={sceneProject.scene_name || currentProjectName || "Untitled_Scene"}
              onUpdateProject={setSceneProject}
              onUpdateShot={updateActiveShot}
              onAssetUploaded={handleAssetUploaded}
              addToast={addToast}
              autosaveStatus={autosaveStatus}
              lastSavedAt={lastSavedAt}
            />
          )}

          {activeSection === "llm" && (
            <LLMSection
              basicStub={basicStub}
              onChangeBasicStub={(val) => {
                setBasicStub(val);
                if (activeShotId) updateShot(activeShotId, prev => ({ ...prev, basic_stub: val, status: "unstaged" }));
              }}
              expandedPrompt={expandedPrompt}
              onChangeExpandedPrompt={(val) => {
                setExpandedPrompt(val);
                if (activeShotId) updateShot(activeShotId, prev => ({ ...prev, expanded_prompt: val, status: "unstaged" }));
              }}
              defaultProvider={defaultLlmProvider || config.default_llm_provider}
              providerChoice={defaultLlmProvider || config.default_llm_provider || llmProvider}
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
              onUpdateSpecificShot={updateShot}
              onUpdateProject={setSceneProject}
              config={config}
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
              onUpdateProject={setSceneProject}
              activeSceneName={sceneProject.scene_name || currentProjectName || "Untitled_Scene"}
            />
          )}

          {activeSection === "execute" && (
            <ExecutionSection
              config={config}
              monitorState={monitorState}
              activeShotId={activeShotId}
              sceneProject={sceneProject}
              selectedWorkflowFile={selectedWorkflowFile}
              assets={assets}
              onSelectShot={setActiveShotId}
              onUpdateShot={updateActiveShot}
              onUpdateSceneProject={setSceneProject}
              onShowToast={addToast}
              onUpdateConfig={setConfig}
            />
          )}

          {activeSection === "gallery" && (
            <GallerySection
              key={sceneProject.scene_id || currentProjectName}
              assets={assets}
              subjects={subjects}
              characters={sceneProject.characters || {}}
              config={config}
              sceneProject={sceneProject}
              onUpdateCharacter={handleUpdateCharacter}
              onDeleteCharacter={handleDeleteCharacter}
              sceneName={sceneProject.scene_name || currentProjectName || "Untitled_Scene"}
              onRegisterSubject={handleRegisterSubject}
              onAssetUploaded={handleAssetUploaded}
              onAssetDeleted={handleAssetDeleted}
              onAssetUpdated={handleAssetUpdated}
            />
          )}

          {activeSection === "cast" && (
            <CastSection
              assets={assets}
              subjects={subjects}
              characters={sceneProject.characters || {}}
              sceneProject={sceneProject}
              activeSceneName={sceneProject.scene_name || currentProjectName || "Untitled_Scene"}
              config={config}
              onUpdateCharacter={handleUpdateCharacter}
              onDeleteCharacter={handleDeleteCharacter}
              onRegisterSubject={handleRegisterSubject}
              onAssetUploaded={handleAssetUploaded}
              onAssetDeleted={handleAssetDeleted}
              onAssetUpdated={handleAssetUpdated}
              onUpdateProject={setSceneProject}
              addToast={addToast}
            />
          )}

          {activeSection === "config" && (
            <ConfigSection 
               config={config}
               onChange={(newConfig) => {
                setConfig(newConfig);
                if (newConfig.llm_provider) {
                  setLlmProvider(newConfig.llm_provider);
                }
                setSceneProject(prev => ({
                  ...prev,
                  lm_studio_url: newConfig.lm_studio_url,
                  llm_provider: newConfig.llm_provider || llmProvider,
                  config: {
                    ...(prev.config || {}),
                    ...newConfig
                  }
                }));
                setIsDirty(true);
              }}
              llmProvider={llmProvider}
              defaultLlmProvider={defaultLlmProvider}
              onSetDefaultProvider={setDefaultLlmProvider}
              initialTab={activeConfigTab}
              onChangeProvider={(provider) => {
                setLlmProvider(provider);
                setConfig(prev => ({ ...prev, llm_provider: provider }));
                setSceneProject(prev => ({
                  ...prev,
                  llm_provider: provider,
                  config: {
                    ...(prev.config || {}),
                    llm_provider: provider
                  }
                }));
                setIsDirty(true);
              }}
              onShowToast={addToast}
            />
          )}
        </Suspense>
      </main>

      <Suspense fallback={null}>
        {/* Floating Production Assistant Chat */}
        <AssistantFloatingChat
          sceneProject={sceneProject}
          activeShotId={activeShotId}
          activeSection={activeSection}
          config={config}
          assets={assets}
          lmStudioUrl={config.lm_studio_url}
          llmProvider={llmProvider}
          defaultLlmProvider={defaultLlmProvider}
          geminiApiKey={config.gemini_api_key}
          onSelectShot={setActiveShotId}
          onNavigateToConfig={(tab = "llm") => {
            setActiveConfigTab(tab);
            scrollToSection("config");
          }}
          onNavigateToSection={scrollToSection}
          onUpdateProject={(updater) => {
            setSceneProject(updater);
            setIsDirty(true);
          }}
          onShowToast={addToast}
          onStageShot={handleSceneTransfer}
          onExpandPrompt={handleSceneExpandPrompt}
        />

        <AppModals 
          isSaveModalOpen={isSaveModalOpen} setIsSaveModalOpen={setIsSaveModalOpen}
          handleSaveProject={handleSaveProject} currentProjectName={currentProjectName}
          isLoadModalOpen={isLoadModalOpen} setIsLoadModalOpen={setIsLoadModalOpen}
          handleLoadProject={handleLoadProject}
          isNewModalOpen={isNewModalOpen} setIsNewModalOpen={setIsNewModalOpen}
          handleCreateNewProject={handleCreateNewProject}
          sceneProject={sceneProject}
          isScenePlanOpen={isScenePlanOpen}
          setIsScenePlanOpen={setIsScenePlanOpen}
          handleSaveScenePlan={handleSaveScenePlan}
          scenePlanning={scenePlanning}
        />
      </Suspense>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800/80 py-6 mt-12 text-center text-xs text-zinc-500">
        <p>Shot Planner version 1.0</p>
      </footer>
    </div>
  );
}
