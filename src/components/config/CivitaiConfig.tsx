import React from "react";
import { AppConfig } from "../../types";
import { DownloadCloud } from "lucide-react";
import { 
  useCivitaiConfig,
  CivitaiCredentialsCard,
  CivitaiLookupCard,
  CivitaiModelPreviewCard,
  CivitaiDownloadSection
} from "./civitai";

export interface CivitaiConfigProps {
  config: AppConfig;
  onChange: (newConfig: AppConfig) => void;
  onShowToast?: (text: string, type: "success" | "error" | "info") => void;
}

export const CivitaiConfig: React.FC<CivitaiConfigProps> = ({
  config,
  onChange,
  onShowToast
}) => {
  const {
    apiKeyInput,
    setApiKeyInput,
    isConfigured,
    maskedKey,
    savingKey,
    tokenFeedback,
    handleSaveApiKey,
    handleClearApiKey,
    lookupQuery,
    setLookupQuery,
    lookingUp,
    modelMetadata,
    lookupError,
    handleLookupModel,
    selectedVersionId,
    handleSelectVersion,
    targetDestination,
    setTargetDestination,
    targetFilename,
    setTargetFilename,
    fullDestinationPath,
    copiedCommand,
    copiedTriggerWord,
    handleCopyTriggerWord,
    handleCopyAllTriggerWords,
    handleCopyCommand,
    favorites,
    loadingFavorites,
    isFavorited,
    handleSelectFavorite,
    handleRemoveFavorite,
    handleToggleFavorite,
    downloading,
    downloadElapsed,
    downloadResult,
    handleDownloadToRemote
  } = useCivitaiConfig({ config, onChange, onShowToast });

  return (
    <section id="civitai-model-downloader-section" className="bg-zinc-900/60 border-2 border-zinc-700 rounded-xl p-5 shadow-sm space-y-6">
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <DownloadCloud className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <span>Civitai &amp; Model Downloader</span>
              <span className="text-[10px] font-semibold text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded-full">
                Remote GPU Accelerated
              </span>
            </h2>
            <p className="text-xs text-zinc-400">
              Inspect model metadata from Civitai and stream weights (Checkpoints, LoRAs, ControlNets, VAEs) directly onto your remote GPU ComfyUI instance.
            </p>
          </div>
        </div>
      </div>

      {/* 1. Credentials Sub-Panel */}
      <CivitaiCredentialsCard
        apiKeyInput={apiKeyInput}
        setApiKeyInput={setApiKeyInput}
        isConfigured={isConfigured}
        maskedKey={maskedKey}
        savingKey={savingKey}
        tokenFeedback={tokenFeedback}
        onSaveApiKey={handleSaveApiKey}
        onClearApiKey={handleClearApiKey}
      />

      {/* 2. Model Lookup & Downloader Tool */}
      <CivitaiLookupCard
        lookupQuery={lookupQuery}
        setLookupQuery={setLookupQuery}
        lookingUp={lookingUp}
        onLookupModel={handleLookupModel}
        lookupError={lookupError}
        favorites={favorites}
        activeVersionId={modelMetadata?.version_id}
        onSelectFavorite={handleSelectFavorite}
        onRemoveFavorite={handleRemoveFavorite}
        loadingFavorites={loadingFavorites}
      />

      {/* 3. Interactive Model Preview Card & Download Section */}
      {modelMetadata && (
        <div className="bg-zinc-950 border-2 border-cyan-900/60 rounded-xl p-4 shadow-md space-y-4">
          <CivitaiModelPreviewCard
            modelMetadata={modelMetadata}
            selectedVersionId={selectedVersionId}
            onSelectVersion={handleSelectVersion}
            isFavorited={isFavorited}
            onToggleFavorite={handleToggleFavorite}
            copiedTriggerWord={copiedTriggerWord}
            onCopyTriggerWord={handleCopyTriggerWord}
            onCopyAllTriggerWords={handleCopyAllTriggerWords}
          />

          <CivitaiDownloadSection
            targetDestination={targetDestination}
            setTargetDestination={setTargetDestination}
            targetFilename={targetFilename}
            setTargetFilename={setTargetFilename}
            fullDestinationPath={fullDestinationPath}
            config={config}
            copiedCommand={copiedCommand}
            onCopyCommand={handleCopyCommand}
            downloading={downloading}
            downloadElapsed={downloadElapsed}
            downloadResult={downloadResult}
            onDownloadToRemote={handleDownloadToRemote}
          />
        </div>
      )}
    </section>
  );
};
