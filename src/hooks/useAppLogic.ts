import { useRef, useCallback } from 'react';
import { LLMProvider } from '../types';
import { useToastNotification } from './appLogic/useToastNotification';
import { useAppConfig } from './appLogic/useAppConfig';
import { useWorkflowManagement } from './appLogic/useWorkflowManagement';
import { useShotOperations } from './appLogic/useShotOperations';
import { useScenePersistence, ShotOperationsDelegate } from './appLogic/useScenePersistence';
import { useCastManagement } from './appLogic/useCastManagement';
import { useAssetManagement } from './appLogic/useAssetManagement';

export function useAppLogic() {
  // 1. Toasts Notification Stack
  const { toasts, setToasts, addToast, dismissToast } = useToastNotification();

  // 2. Global App Config & Default LLM Provider
  const { config, setConfig, defaultLlmProvider, setDefaultLlmProvider } = useAppConfig({
    addToast,
    onUpdateProjectConfig: (provider: LLMProvider) => {
      setSceneProject(prev => ({
        ...prev,
        config: {
          ...(prev.config || {}),
          default_llm_provider: provider
        }
      }));
    }
  });

  // Mutable delegate ref to bridge shot operations to persistence actions
  const shotOpsRef = useRef<Partial<ShotOperationsDelegate>>({});

  // Forward bridge for shot param updates from workflow controls
  const handleUpdateActiveShotParams = useCallback((updater: (shot: any) => any) => {
    updateActiveShot(updater);
  }, []);

  // 3. Workflow & Node Mappings
  const {
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
  } = useWorkflowManagement({
    activeSceneName: "",
    onUpdateActiveShotParams: handleUpdateActiveShotParams
  });

  // 4. Scene Persistence & Project Lifecycle
  const {
    sceneProject,
    setSceneProject,
    isCodeModalOpen,
    setIsCodeModalOpen,
    isDirty,
    setIsDirty,
    hasLoadedProject,
    setHasLoadedProject,
    isInitialLoad,
    setIsInitialLoad,
    isNewModalOpen,
    setIsNewModalOpen,
    isSaveModalOpen,
    setIsSaveModalOpen,
    isLoadModalOpen,
    setIsLoadModalOpen,
    currentProjectName,
    setCurrentProjectName,
    availableScenes,
    setAvailableScenes,
    handleSaveProject,
    handleLoadProject,
    handleCreateNewProject,
    fetchAssets
  } = useScenePersistence({
    config,
    setConfig,
    defaultLlmProvider,
    generationParams,
    setGenerationParams,
    parameterNodeMappings,
    setParameterNodeMappings,
    selectedWorkflowFile,
    setSelectedWorkflowFile,
    selectedPromptNodeId,
    setSelectedPromptNodeId,
    nodeMappings,
    setNodeMappings,
    bypassMissing,
    setBypassMissing,
    fetchWorkflows,
    addToast,
    getShotOperationsDelegate: () => shotOpsRef.current
  });

  // 5. Cast & Character Management
  const {
    assets,
    subjects,
    handleRegisterSubject,
    handleUpdateCharacter,
    handleDeleteCharacter
  } = useCastManagement({
    sceneProject,
    setSceneProject,
    setScenePlanning: (val) => setScenePlanning(val),
    setIsDirty,
    addToast
  });

  // 6. Asset Management & Node Auto-mapping
  const {
    handleAssetUploaded,
    handleAssetUpdated,
    handleAssetDeleted
  } = useAssetManagement({
    setSceneProject,
    setIsDirty,
    parsedWorkflow,
    nodeMappings,
    setNodeMappings
  });

  // 7. Shot Operations & ComfyUI Execution Monitoring
  const {
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
  } = useShotOperations({
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
  });

  // Keep shot operations delegate ref updated
  shotOpsRef.current = {
    llmProvider,
    setLlmProvider,
    basicStub,
    setBasicStub,
    expandedPrompt,
    setExpandedPrompt,
    scenePlanning,
    setScenePlanning,
    setActiveShotId,
    setActiveSection
  };

  return {
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
  };
}
