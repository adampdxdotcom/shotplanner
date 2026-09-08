import React from "react";
import { Bot, Cpu, Sparkles, Star, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
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
  lmTestResult: { success?: boolean; message?: string } | null;
  onSetDefaultProvider?: (provider: LLMProvider) => void;
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
  onSetDefaultProvider,
  onShowToast
}) => {
  return (
    <div className="space-y-6 w-full">
      <section 
        id="panel-llm-setup"
        className="w-full bg-zinc-900/60 border-2 border-zinc-700 rounded-xl p-5 shadow-sm space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">LLM Connection &amp; Provider Setup</h2>
              <p className="text-xs text-zinc-400">Select active LLM provider, manage local endpoints or API credentials, and set defaults.</p>
            </div>
          </div>

          {/* Provider Selector Pill-Bar */}
          <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800 gap-1.5 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => handleProviderSelect("lm_studio")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-2 cursor-pointer ${
                isLmStudioConnected
                  ? activeProvider === "lm_studio"
                    ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/60 shadow-xs"
                    : "bg-emerald-950/40 text-emerald-300 hover:text-emerald-100 hover:bg-emerald-900/50 border-emerald-700/60"
                  : activeProvider === "lm_studio"
                    ? "bg-amber-500/20 text-amber-200 border-amber-500/50 shadow-xs"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border-transparent"
              }`}
            >
              <Cpu className={`w-3.5 h-3.5 transition-colors ${
                isLmStudioConnected 
                  ? "text-emerald-400" 
                  : activeProvider === "lm_studio" 
                    ? "text-amber-400" 
                    : "text-zinc-400"
              }`} />
              <span>LM Studio</span>
            </button>

            <button
              type="button"
              onClick={() => handleProviderSelect("gemini")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-2 cursor-pointer ${
                isGeminiConnected
                  ? activeProvider === "gemini"
                    ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/60 shadow-xs"
                    : "bg-emerald-950/40 text-emerald-300 hover:text-emerald-100 hover:bg-emerald-900/50 border-emerald-700/60"
                  : activeProvider === "gemini"
                    ? "bg-purple-500/20 text-purple-200 border-purple-500/50 shadow-xs"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border-transparent"
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 transition-colors ${
                isGeminiConnected 
                  ? "text-emerald-400" 
                  : activeProvider === "gemini" 
                    ? "text-purple-400" 
                    : "text-zinc-400"
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
                <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-amber-400" />
                  Local LM Studio API URL
                </label>

                {effectiveDefault === "lm_studio" ? (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/50 border border-emerald-700/50 px-2.5 py-1 rounded-lg shrink-0 shadow-xs">
                    <Star className="w-3.5 h-3.5 fill-emerald-400 text-emerald-400" />
                    ★ Default LLM
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSetDefaultLMStudio}
                    disabled={testingLM}
                    title="Set LM Studio as default LLM provider"
                    className="px-2.5 py-1 text-xs font-medium bg-zinc-800 hover:bg-emerald-950/40 text-zinc-300 hover:text-emerald-300 border border-zinc-700 hover:border-emerald-600/50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${testingLM ? "animate-spin text-emerald-400" : "hidden"}`} />
                    <Star className={`w-3.5 h-3.5 text-zinc-400 hover:text-emerald-400 ${testingLM ? "hidden" : ""}`} />
                    <span>{testingLM ? "Testing..." : "Set as Default LLM"}</span>
                  </button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  placeholder="http://localhost:1234/v1"
                  value={config.lm_studio_url || ""}
                  onChange={(e) => handleInputChange("lm_studio_url", e.target.value)}
                  className="flex-1 bg-zinc-950 border-2 border-zinc-700 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={handleTestLMStudio}
                  disabled={testingLM}
                  className="px-3.5 py-2 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 border border-zinc-700 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingLM ? "animate-spin text-amber-400" : ""}`} />
                  <span>{testingLM ? "Testing..." : "Test Connection"}</span>
                </button>
              </div>
              <p className="text-[11px] text-zinc-500">Local OpenAI-compatible endpoint hosted by LM Studio for offline LLM expansion and scene planning.</p>
            </div>

            {lmTestResult && (
              <div className={`p-3 rounded-lg border text-xs flex items-center gap-2.5 ${
                lmTestResult.success 
                  ? "bg-emerald-950/30 border-emerald-800/40 text-emerald-300" 
                  : "bg-red-950/30 border-red-800/40 text-red-300"
              }`}>
                {lmTestResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
                <span className="font-medium">{lmTestResult.message}</span>
              </div>
            )}
          </div>
        ) : (
          <GeminiConfig 
            config={config}
            onChange={onChange}
            isDefault={effectiveDefault === "gemini"}
            onSetDefault={() => onSetDefaultProvider && onSetDefaultProvider("gemini")}
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
