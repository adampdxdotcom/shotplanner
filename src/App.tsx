import React, { useState } from "react";
import { Navbar } from "./components/Navbar";
import { ConfigSection, ConfigTab } from "./components/ConfigSection";
import { WorkflowSection } from "./components/WorkflowSection";
import { AssetManagerSection } from "./components/AssetManagerSection";
import { CastSection } from "./components/CastSection";
import { GallerySection } from "./components/GallerySection";
import { LLMSection } from "./components/LLMSection";
import { ExecutionSection } from "./components/ExecutionSection";
import { StagingSection } from "./components/StagingSection";
import { AppModals } from "./components/AppModals";
import SceneProjectHub from "./components/SceneProjectHub";
import { AssistantFloatingChat } from "./components/assistant/AssistantFloatingChat";
import { useAppLogic } from "./hooks/useAppLogic";

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

      </main>

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
      />

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800/80 py-6 mt-12 text-center text-xs text-zinc-500">
        <p>Shot Planner version 1.0</p>
      </footer>
    </div>
  );
}
