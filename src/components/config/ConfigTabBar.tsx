import React from "react";
import { Bot, Server, DownloadCloud, Sliders } from "lucide-react";
import { LLMProvider } from "../../types";

export type ConfigTab = "llm" | "remote" | "models" | "general";

interface ConfigTabBarProps {
  activeTab: ConfigTab;
  setActiveTab: (tab: ConfigTab) => void;
  activeProvider: LLMProvider;
  effectiveDefault: LLMProvider;
  isGeminiConnected: boolean;
  isLmStudioConnected: boolean;
  hasRemoteHost: boolean;
}

export const ConfigTabBar: React.FC<ConfigTabBarProps> = ({
  activeTab,
  setActiveTab,
  activeProvider,
  effectiveDefault,
  isGeminiConnected,
  isLmStudioConnected,
  hasRemoteHost
}) => {
  return (
    <div 
      id="config-tab-bar"
      className="w-full bg-zinc-900/90 border-2 border-zinc-700/80 rounded-xl p-1.5 shadow-sm backdrop-blur-xs"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 w-full">
        {/* Tab 1: LLM Setup */}
        <button
          id="config-tab-llm"
          type="button"
          onClick={() => setActiveTab("llm")}
          className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer justify-start ${
            activeTab === "llm"
              ? "bg-zinc-800 text-white border border-zinc-600 shadow-xs"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 border border-transparent"
          }`}
        >
          <div className={`p-1 rounded-md shrink-0 ${
            activeTab === "llm" 
              ? "bg-purple-500/20 text-purple-300" 
              : "bg-zinc-800/60 text-zinc-400"
          }`}>
            <Bot className="w-4 h-4" />
          </div>
          <div className="text-left min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate">LLM Setup</span>
              {effectiveDefault === "gemini" ? (
                <span className={`w-2 h-2 rounded-full shrink-0 ${isGeminiConnected ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" : "bg-purple-400"}`} />
              ) : (
                <span className={`w-2 h-2 rounded-full shrink-0 ${isLmStudioConnected ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" : "bg-amber-400"}`} />
              )}
            </div>
            <span className="text-[10px] font-normal text-zinc-400 block -mt-0.5 truncate">
              {activeProvider === "gemini" ? "Google Gemini" : "LM Studio Local"}
            </span>
          </div>
        </button>

        {/* Tab 2: Remote Server */}
        <button
          id="config-tab-remote"
          type="button"
          onClick={() => setActiveTab("remote")}
          className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer justify-start ${
            activeTab === "remote"
              ? "bg-zinc-800 text-white border border-zinc-600 shadow-xs"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 border border-transparent"
          }`}
        >
          <div className={`p-1 rounded-md shrink-0 ${
            activeTab === "remote" 
              ? "bg-indigo-500/20 text-indigo-300" 
              : "bg-zinc-800/60 text-zinc-400"
          }`}>
            <Server className="w-4 h-4" />
          </div>
          <div className="text-left min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate">Remote Server</span>
              {hasRemoteHost ? (
                <span className="w-2 h-2 rounded-full shrink-0 bg-indigo-400" />
              ) : null}
            </div>
            <span className="text-[10px] font-normal text-zinc-400 block -mt-0.5 truncate">
              GPU SSH &amp; ComfyUI
            </span>
          </div>
        </button>

        {/* Tab 3: Models */}
        <button
          id="config-tab-models"
          type="button"
          onClick={() => setActiveTab("models")}
          className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer justify-start ${
            activeTab === "models"
              ? "bg-zinc-800 text-white border border-zinc-600 shadow-xs"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 border border-transparent"
          }`}
        >
          <div className={`p-1 rounded-md shrink-0 ${
            activeTab === "models" 
              ? "bg-blue-500/20 text-blue-300" 
              : "bg-zinc-800/60 text-zinc-400"
          }`}>
            <DownloadCloud className="w-4 h-4" />
          </div>
          <div className="text-left min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate">Models</span>
            </div>
            <span className="text-[10px] font-normal text-zinc-400 block -mt-0.5 truncate">
              Civitai &amp; Hugging Face
            </span>
          </div>
        </button>

        {/* Tab 4: General Settings */}
        <button
          id="config-tab-general"
          type="button"
          onClick={() => setActiveTab("general")}
          className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer justify-start ${
            activeTab === "general"
              ? "bg-zinc-800 text-white border border-zinc-600 shadow-xs"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 border border-transparent"
          }`}
        >
          <div className={`p-1 rounded-md shrink-0 ${
            activeTab === "general" 
              ? "bg-amber-500/20 text-amber-300" 
              : "bg-zinc-800/60 text-zinc-400"
          }`}>
            <Sliders className="w-4 h-4" />
          </div>
          <div className="text-left min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate">General</span>
            </div>
            <span className="text-[10px] font-normal text-zinc-400 block -mt-0.5 truncate">
              Appearance &amp; Theme
            </span>
          </div>
        </button>
      </div>
    </div>
  );
};
