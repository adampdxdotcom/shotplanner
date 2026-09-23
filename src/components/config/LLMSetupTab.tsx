import React, { useState } from "react";
import { Bot, Cpu, Sparkles, Star, RefreshCw, CheckCircle2, AlertCircle, Eye } from "lucide-react";
import { AppConfig, LLMProvider } from "../../types";
import { GeminiConfig } from "./GeminiConfig";
import { LLMPromptSettingsCard } from "./LLMPromptSettingsCard";

interface LLMSetupTabProps {
  config: AppConfig;
  onChange: (newConfig: AppConfig) => void;
  activeProvider: LLMProvider;
  effectiveDefault: LLMProvider;
  isLmStudioConnected: boolean;
  isGeminiConnected: boolean;
  setIsGeminiConnected: (val: boolean) => void;
  handleProviderSelect: (provider: LLMProvider) => void;
  handleInputChange: (field: keyof AppConfig, value: any) => void;
  handleTestLMStudio: () => void;
  handleSetDefaultLMStudio: () => void;
  testingLM: boolean;
  lmTestResult: {
    success?: boolean;
    message?: string;
    hasVision?: boolean;
    visionModel?: string;
  } | null;
  detectedBackend?: "ollama" | "lm_studio" | "generic" | null;
  availableModels?: string[];
  handleSelectModel?: (model: string) => void;
  onSetDefaultProvider?: (provider: LLMProvider) => void;
  onDeactivateGemini?: () => void;
  onShowToast?: (text: string, type: "success" | "error" | "info") => void;
}

export const LLMSetupTab: React.FC<LLMSetupTabProps> = ({
  config,
  onChange,
  activeProvider,
  effectiveDefault,
  isLmStudioConnected,
  isGeminiConnected,
  setIsGeminiConnected,
  handleProviderSelect,
  handleInputChange,
  handleTestLMStudio,
  handleSetDefaultLMStudio,
  testingLM,
  lmTestResult,
  detectedBackend,
  availableModels = [],
  handleSelectModel,
  onSetDefaultProvider,
  onDeactivateGemini,
  onShowToast
}) => {
  const [urlEdited, setUrlEdited] = useState(false);

  const hasUrl = Boolean(config.lm_studio_url && config.lm_studio_url.trim().length > 0);
  const isConnected = !urlEdited && lmTestResult?.success === true;
  const isError = !urlEdited && lmTestResult && !lmTestResult.success;

  const isOllamaDetected =
    detectedBackend === "ollama" ||
    (config.lm_studio_url || "").includes("11434") ||
    availableModels.some((m) => m.includes(":") && !m.includes("@"));

  const handleRunTest = () => {
    setUrlEdited(false);
    handleTestLMStudio();
  };

  return (
    <div className="space-y-6 w-full">
      <section 
        id="panel-llm-setup"
        className="w-full bg-zinc-900/60 border-2 border-zinc-700 rounded-xl p-5 shadow-sm space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20 shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">LLM Connection &amp; Provider Setup</h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">Select active LLM provider, manage local endpoints (LM Studio, Ollama) or API credentials, and set defaults.</p>
            </div>
          </div>

          {/* Provider Selector Pill-Bar */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-300 dark:border-zinc-800 gap-1.5 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => handleProviderSelect("lm_studio")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-2 cursor-pointer ${
                isLmStudioConnected
                  ? activeProvider === "lm_studio"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-400 shadow-xs dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-500/60"
                    : "bg-emerald-50 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:text-emerald-100 dark:hover:bg-emerald-900/50 dark:border-emerald-700/60"
                  : activeProvider === "lm_studio"
                    ? "bg-amber-100 text-amber-900 border-amber-400 shadow-xs dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-500/50"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70 border-transparent dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/60"
              }`}
            >
              <Cpu className={`w-3.5 h-3.5 transition-colors ${
                isLmStudioConnected 
                  ? "text-emerald-700 dark:text-emerald-400" 
                  : activeProvider === "lm_studio" 
                    ? "text-amber-800 dark:text-amber-400" 
                    : "text-zinc-500 dark:text-zinc-400"
              }`} />
              <span>Local LLM</span>
            </button>

            <button
              type="button"
              onClick={() => handleProviderSelect("gemini")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-2 cursor-pointer ${
                isGeminiConnected
                  ? activeProvider === "gemini"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-400 shadow-xs dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-500/60"
                    : "bg-emerald-50 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:text-emerald-100 dark:hover:bg-emerald-900/50 dark:border-emerald-700/60"
                  : activeProvider === "gemini"
                    ? "bg-purple-100 text-purple-900 border-purple-300 shadow-xs dark:bg-purple-500/20 dark:text-purple-200 dark:border-purple-500/50"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70 border-transparent dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/60"
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 transition-colors ${
                isGeminiConnected 
                  ? "text-emerald-700 dark:text-emerald-400" 
                  : activeProvider === "gemini" 
                    ? "text-purple-700 dark:text-purple-400" 
                    : "text-zinc-500 dark:text-zinc-400"
              }`} />
              <span>Google Gemini</span>
            </button>
          </div>
        </div>

        {/* Contextual Configuration Body */}
        {activeProvider === "lm_studio" ? (
          <div className="space-y-4 w-full">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                  Local LLM Endpoint URL (LM Studio / Ollama)
                </label>

                {effectiveDefault === "lm_studio" ? (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-100 border border-emerald-300 dark:text-emerald-300 dark:bg-emerald-950/50 dark:border-emerald-700/50 px-2.5 py-1 rounded-lg shrink-0 shadow-xs">
                    <Star className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600 dark:fill-emerald-400 dark:text-emerald-400" />
                    ★ Default LLM
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSetDefaultLMStudio}
                    disabled={testingLM}
                    title="Set Local LLM as default provider"
                    className="px-2.5 py-1 text-xs font-medium bg-white hover:bg-emerald-50 text-zinc-700 hover:text-emerald-800 border border-zinc-300 hover:border-emerald-300 dark:bg-zinc-800 dark:hover:bg-emerald-950/40 dark:text-zinc-300 dark:hover:text-emerald-300 dark:border-zinc-700 dark:hover:border-emerald-600/50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50 shadow-xs"
                  >
                    <RefreshCw className={`w-3 h-3 ${testingLM ? "animate-spin text-emerald-600 dark:text-emerald-400" : "hidden"}`} />
                    <Star className={`w-3.5 h-3.5 text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 ${testingLM ? "hidden" : ""}`} />
                    <span>{testingLM ? "Testing..." : "Set as Default LLM"}</span>
                  </button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  placeholder="http://localhost:1234/v1 or http://localhost:11434/v1"
                  value={config.lm_studio_url || ""}
                  onChange={(e) => {
                    handleInputChange("lm_studio_url", e.target.value);
                    setUrlEdited(true);
                  }}
                  className="flex-1 bg-white dark:bg-zinc-950 border-2 border-zinc-300 dark:border-zinc-700 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={handleRunTest}
                  disabled={!hasUrl || testingLM}
                  className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-xs shrink-0 ${
                    !hasUrl
                      ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed opacity-60"
                      : isConnected
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                      : isError
                      ? "bg-red-600 hover:bg-red-500 text-white cursor-pointer"
                      : testingLM
                      ? "bg-amber-600 text-white opacity-90 cursor-wait"
                      : "bg-amber-600 hover:bg-amber-500 text-white cursor-pointer"
                  }`}
                  title={
                    !hasUrl
                      ? "Enter a Local LLM URL first to enable testing"
                      : "Test connection to Local LLM endpoint"
                  }
                >
                  {testingLM ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : isConnected ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : isError ? (
                    <AlertCircle className="w-3.5 h-3.5" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {testingLM
                      ? "Testing..."
                      : isConnected
                      ? "Connected"
                      : isError
                      ? "Connection Error"
                      : "Test Connection"}
                  </span>
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Supports LM Studio (port 1234), Ollama (port 11434), or any local OpenAI-compatible endpoint.
              </p>
            </div>

            {lmTestResult && (
              <div className="space-y-2">
                <div className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-2.5 ${
                  lmTestResult.success 
                    ? "bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800/40 dark:text-emerald-300" 
                    : "bg-red-50 border-red-300 text-red-800 dark:bg-red-950/30 dark:border-red-800/40 dark:text-red-300"
                }`}>
                  <div className="flex items-center gap-2">
                    {lmTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                    )}
                    <span className="font-semibold">{lmTestResult.message}</span>
                  </div>
                </div>

                {lmTestResult.success && (
                  <div className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 transition-all ${
                    lmTestResult.hasVision
                      ? "bg-purple-50/80 border-purple-200 text-purple-900 dark:bg-purple-950/30 dark:border-purple-800/50 dark:text-purple-200"
                      : "bg-zinc-50 border-zinc-200 text-zinc-700 dark:bg-zinc-950/40 dark:border-zinc-800 dark:text-zinc-400"
                  }`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <Eye className={`w-3.5 h-3.5 shrink-0 ${lmTestResult.hasVision ? "text-purple-600 dark:text-purple-400" : "text-zinc-400"}`} />
                      <span className="truncate">
                        {lmTestResult.hasVision
                          ? `Vision Support Detected: ${lmTestResult.visionModel || "Multimodal Model"}`
                          : "Text-Only Model Detected (No vision capabilities)"}
                      </span>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 uppercase tracking-wide ${
                      lmTestResult.hasVision
                        ? "bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200 border border-purple-300 dark:border-purple-700"
                        : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700"
                    }`}>
                      {lmTestResult.hasVision ? "Vision & Auto-Caption ON" : "Vision Kept Off"}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Ollama Model Selector vs LM Studio Management Notice */}
            {isConnected && (
              <div className="pt-1">
                {isOllamaDetected ? (
                  <div className="p-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-300 dark:border-zinc-800 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] px-2 py-0.5 rounded font-mono font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/50">
                          Ollama Detected
                        </span>
                        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          Select Ollama Model
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRunTest}
                        disabled={testingLM}
                        title="Refresh list of installed Ollama models"
                        className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${testingLM ? "animate-spin" : ""}`} />
                        <span>Refresh Models</span>
                      </button>
                    </div>

                    {availableModels.length > 0 ? (
                      <div className="space-y-1.5">
                        <select
                          value={config.local_model || availableModels[0] || ""}
                          onChange={(e) => {
                            if (handleSelectModel) {
                              handleSelectModel(e.target.value);
                            } else {
                              handleInputChange("local_model", e.target.value);
                            }
                          }}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 focus:border-amber-500 rounded-lg px-3 py-2 text-xs font-mono text-zinc-900 dark:text-zinc-100 outline-none transition-colors cursor-pointer"
                        >
                          {availableModels.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          Ollama will dynamically load and serve this model on demand when generating prompts or chatting.
                        </p>
                      </div>
                    ) : (
                      <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/40 p-2.5 rounded-lg">
                        No downloaded models found on this Ollama instance. Run <code className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded">ollama pull &lt;model&gt;</code> in your terminal and click Refresh Models.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] px-2 py-0.5 rounded font-mono font-semibold bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700">
                        LM Studio Backend
                      </span>
                      <span className="text-zinc-600 dark:text-zinc-400">
                        Active model is loaded and managed directly inside your LM Studio desktop app.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Vision Model & Auto Captioning Combined Settings Row */}
            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800/80">
              <div className="p-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 transition-colors">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 divide-y md:divide-y-0 md:divide-x divide-zinc-200 dark:divide-zinc-800/80">
                  {/* Vision Enabled */}
                  <div className="flex items-start justify-between gap-3 md:pr-4">
                    <div className="flex items-start gap-2.5">
                      <div className={`p-1.5 mt-0.5 rounded-md border shrink-0 transition-colors ${
                        config.vision_enabled
                          ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30"
                          : "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-400 dark:border-zinc-700/60"
                      }`}>
                        <Eye className="w-4 h-4" />
                      </div>
                      <div>
                        <label 
                          htmlFor="toggle-vision-enabled"
                          className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 cursor-pointer select-none"
                        >
                          Vision Enabled
                          {config.vision_enabled ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/50">
                              {lmTestResult?.hasVision ? "Auto-Enabled" : "Active"}
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                              Off
                            </span>
                          )}
                        </label>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                          Enable if your loaded model supports vision (Qwen2-VL, Llama-3.2-Vision, LLaVA). Offers AI captioning and visual descriptions.
                        </p>
                      </div>
                    </div>
                    <input
                      id="toggle-vision-enabled"
                      type="checkbox"
                      checked={Boolean(config.vision_enabled)}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        handleInputChange("vision_enabled", isChecked);
                        if (!isChecked) {
                          handleInputChange("auto_caption_enabled", false);
                        }
                      }}
                      className="mt-1 h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0"
                    />
                  </div>

                  {/* Auto Caption on Upload */}
                  <div className={`flex items-start justify-between gap-3 pt-3 md:pt-0 md:pl-4 transition-all ${
                    config.vision_enabled ? "opacity-100" : "opacity-50"
                  }`}>
                    <div className="flex items-start gap-2.5">
                      <div className={`p-1.5 mt-0.5 rounded-md border shrink-0 transition-colors ${
                        config.auto_caption_enabled && config.vision_enabled
                          ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30"
                          : "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-400 dark:border-zinc-700/60"
                      }`}>
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <label 
                          htmlFor="toggle-auto-caption"
                          className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 cursor-pointer select-none"
                        >
                          Auto Caption on Upload
                        </label>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                          Automatically request an AI caption from the vision model when reference images are uploaded.
                        </p>
                      </div>
                    </div>
                    <input
                      id="toggle-auto-caption"
                      type="checkbox"
                      disabled={!config.vision_enabled}
                      checked={Boolean(config.auto_caption_enabled && config.vision_enabled)}
                      onChange={(e) => handleInputChange("auto_caption_enabled", e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <GeminiConfig 
            config={config}
            onChange={onChange}
            isDefault={effectiveDefault === "gemini"}
            onSetDefault={() => onSetDefaultProvider && onSetDefaultProvider("gemini")}
            onDeactivateGemini={onDeactivateGemini}
            onConnectionStatusChange={setIsGeminiConnected}
            onShowToast={onShowToast}
          />
        )}
      </section>

      {/* Dedicated LLM Prompt Engineering & Tuning Area - Always Present */}
      <LLMPromptSettingsCard
        config={config}
        onChange={onChange}
        onShowToast={onShowToast}
        activeProvider={activeProvider}
      />
    </div>
  );
};

