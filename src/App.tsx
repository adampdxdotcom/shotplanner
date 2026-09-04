import React from "react";
import { Navbar } from "./components/Navbar";
import { ConfigSection } from "./components/ConfigSection";
import { WorkflowSection } from "./components/WorkflowSection";
import { AssetManagerSection } from "./components/AssetManagerSection";
import { CastSection } from "./components/CastSection";
import { GallerySection } from "./components/GallerySection";
import { LLMSection } from "./components/LLMSection";
import { ExecutionSection } from "./components/ExecutionSection";
import { AppModals } from "./components/AppModals";
import SceneProjectHub from "./components/SceneProjectHub";
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
    isCodeModalOpen, setIsCodeModalOpen,
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
    updateActiveShot
  } = useAppLogic();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500 selection:text-white flex flex-col">
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
      />

      {/* Main Workspace Layout */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-6 space-y-6 flex-1 flex flex-col min-h-0">
        
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
            />
          </div>
        )}

        {activeSection === "assets" && (
          <AssetManagerSection
            key={sceneProject.scene_id || currentProjectName}
            assets={assets}
            subjects={subjects}
            characters={sceneProject.characters || {}}
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
            activeSceneName={sceneProject.scene_name || currentProjectName || "Untitled_Scene"}
          />
        )}

        {activeSection === "llm" && (
          <LLMSection
            basicStub={basicStub}
            onChangeBasicStub={(val) => {
              setBasicStub(val);
              if (activeShotId) updateActiveShot(prev => ({ ...prev, basic_stub: val, status: "unstaged" }));
            }}
            expandedPrompt={expandedPrompt}
            onChangeExpandedPrompt={(val) => {
              setExpandedPrompt(val);
              if (activeShotId) updateActiveShot(prev => ({ ...prev, expanded_prompt: val, status: "unstaged" }));
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
            onUpdateSpecificShot={updateShot}
            config={config}
          />
        )}

        {activeSection === "execute" && (
          <ExecutionSection
            config={config}
            monitorState={monitorState}
            activeShotId={activeShotId}
            sceneProject={sceneProject}
            selectedWorkflowFile={selectedWorkflowFile}
            onSelectShot={setActiveShotId}
            onUpdateShot={updateActiveShot}
            onUpdateSceneProject={setSceneProject}
            onShowToast={addToast}
          />
        )}

        {activeSection === "gallery" && (
          <GallerySection
            key={sceneProject.scene_id || currentProjectName}
            assets={assets}
            subjects={subjects}
            characters={sceneProject.characters || {}}
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
            onOpenCodeViewer={() => setIsCodeModalOpen(true)}
          />
        )}

      </main>

      <AppModals 
        isCodeModalOpen={isCodeModalOpen} setIsCodeModalOpen={setIsCodeModalOpen}
        isSaveModalOpen={isSaveModalOpen} setIsSaveModalOpen={setIsSaveModalOpen}
        handleSaveProject={handleSaveProject} currentProjectName={currentProjectName}
        isLoadModalOpen={isLoadModalOpen} setIsLoadModalOpen={setIsLoadModalOpen}
        handleLoadProject={handleLoadProject}
        isNewModalOpen={isNewModalOpen} setIsNewModalOpen={setIsNewModalOpen}
        handleCreateNewProject={handleCreateNewProject}
      />

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 py-6 mt-12 text-center text-xs text-zinc-500">
        <p>ComfyUI Bridge &amp; Remote Orchestrator • Dockerized Local Bridge Architecture</p>
      </footer>
    </div>
  );
}
