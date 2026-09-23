import React from "react";
import { AppConfig, LLMProvider } from "../types";
import {
  ConfigTab,
  probeLMStudioConnection,
  useConfigSectionState,
  ConfigTabBar,
  LLMSetupTab,
  RemoteServerTab,
  ModelHubConfig,
  GeneralSettingsTab
} from "./config";

export { probeLMStudioConnection };
export type { ConfigTab };

export interface ConfigSectionProps {
  config: AppConfig;
  onChange: (newConfig: AppConfig) => void;
  llmProvider?: LLMProvider;
  defaultLlmProvider?: LLMProvider;
  onChangeProvider?: (provider: LLMProvider) => void;
  onSetDefaultProvider?: (provider: LLMProvider) => void;
  onShowToast?: (text: string, type: "success" | "error" | "info") => void;
  initialTab?: ConfigTab;
}

export const ConfigSection: React.FC<ConfigSectionProps> = ({ 
  config, 
  onChange, 
  llmProvider,
  defaultLlmProvider,
  onChangeProvider,
  onSetDefaultProvider,
  onShowToast,
  initialTab
}) => {
  const {
    activeTab,
    setActiveTab,
    activeProvider,
    effectiveDefault,
    isGeminiConnected,
    isLmStudioConnected,
    setIsGeminiConnected,
    testingSSH,
    testResult,
    handleTestSSH,
    isGeneratingKeyPair,
    generatedKeyPair,
    showPublicKeyModal,
    setShowPublicKeyModal,
    hasCopiedPublicKey,
    handleGenerateKeyPair,
    handleCopyPublicKey,
    handleDownloadFile,
    testingLM,
    lmTestResult,
    detectedBackend,
    availableModels,
    handleSelectModel,
    handleInputChange,
    handleProviderSelect,
    handleDeactivateGemini,
    handleTestLMStudio,
    handleSetDefaultLMStudio
  } = useConfigSectionState({
    config,
    onChange,
    llmProvider,
    defaultLlmProvider,
    onChangeProvider,
    onSetDefaultProvider,
    onShowToast,
    initialTab
  });

  return (
    <div id="config-section" className="w-full space-y-6">
      {/* Top 3-Tab Navigation Bar */}
      <ConfigTabBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeProvider={activeProvider}
        effectiveDefault={effectiveDefault}
        isGeminiConnected={isGeminiConnected}
        isLmStudioConnected={isLmStudioConnected}
        hasRemoteHost={Boolean(config.remote_host)}
      />

      {/* Tab 1: LLM Setup */}
      {activeTab === "llm" && (
        <LLMSetupTab
          config={config}
          onChange={onChange}
          activeProvider={activeProvider}
          effectiveDefault={effectiveDefault}
          isLmStudioConnected={isLmStudioConnected}
          isGeminiConnected={isGeminiConnected}
          setIsGeminiConnected={setIsGeminiConnected}
          handleProviderSelect={handleProviderSelect}
          handleInputChange={handleInputChange}
          handleTestLMStudio={handleTestLMStudio}
          handleSetDefaultLMStudio={handleSetDefaultLMStudio}
          testingLM={testingLM}
          lmTestResult={lmTestResult}
          detectedBackend={detectedBackend}
          availableModels={availableModels}
          handleSelectModel={handleSelectModel}
          onSetDefaultProvider={onSetDefaultProvider}
          onDeactivateGemini={handleDeactivateGemini}
          onShowToast={onShowToast}
        />
      )}

      {/* Tab 2: Remote Server */}
      {activeTab === "remote" && (
        <RemoteServerTab
          config={config}
          handleInputChange={handleInputChange}
          handleTestSSH={handleTestSSH}
          testingSSH={testingSSH}
          testResult={testResult}
          handleGenerateKeyPair={handleGenerateKeyPair}
          isGeneratingKeyPair={isGeneratingKeyPair}
          generatedKeyPair={generatedKeyPair}
          onShowToast={onShowToast}
        />
      )}

      {/* Tab 3: Models Ingestion Hub */}
      {activeTab === "models" && (
        <section id="panel-models-hub" className="w-full">
          <ModelHubConfig 
            config={config} 
            onChange={onChange} 
            onShowToast={onShowToast} 
          />
        </section>
      )}

      {/* Tab 4: General Preferences & Appearance */}
      {activeTab === "general" && (
        <section id="panel-general-settings" className="w-full">
          <GeneralSettingsTab />
        </section>
      )}
    </div>
  );
};
