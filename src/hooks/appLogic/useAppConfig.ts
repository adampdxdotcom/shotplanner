import { useState, useCallback } from 'react';
import { AppConfig, LLMProvider } from '../../types';

export const getDefaultLlmProvider = (): LLMProvider => {
  try {
    const saved = localStorage.getItem("default_llm_provider");
    if (saved === "gemini" || saved === "lm_studio") {
      return saved;
    }
  } catch (e) {}
  return "lm_studio";
};

interface UseAppConfigParams {
  addToast: (text: string, type?: "success" | "error" | "info") => void;
  onUpdateProjectConfig?: (provider: LLMProvider) => void;
}

export function useAppConfig({ addToast, onUpdateProjectConfig }: UseAppConfigParams) {
  const [defaultLlmProvider, setDefaultLlmProviderState] = useState<LLMProvider>(getDefaultLlmProvider);

  const [config, setConfig] = useState<AppConfig>(() => {
    let savedPrompt: string | undefined = undefined;
    let savedTemp: number | undefined = undefined;
    let savedMaxTokens: number | undefined = undefined;
    try {
      savedPrompt = localStorage.getItem("llm_custom_system_prompt") || undefined;
      const t = localStorage.getItem("llm_temperature");
      if (t) savedTemp = parseFloat(t);
      const m = localStorage.getItem("llm_max_tokens");
      if (m) savedMaxTokens = parseInt(m, 10);
    } catch (e) {}

    return {
      remote_host: "194.26.196.105",
      ssh_port: 22,
      ssh_username: "root",
      ssh_password: "",
      ssh_key_path: "",
      ssh_private_key: "",
      remote_comfyui_root: "/workspace/runpod-slim/ComfyUI",
      comfyui_api_url: "http://127.0.0.1:8188",
      remote_api_token: "",
      lm_studio_url: "http://localhost:1234/v1",
      default_llm_provider: getDefaultLlmProvider(),
      gemini_api_key: "",
      civitai_api_key: "",
      huggingface_token: "",
      llm_custom_system_prompt: savedPrompt,
      llm_temperature: savedTemp !== undefined ? savedTemp : 0.45,
      llm_max_tokens: savedMaxTokens !== undefined ? savedMaxTokens : 800
    };
  });

  const setDefaultLlmProvider = useCallback((provider: LLMProvider) => {
    try {
      localStorage.setItem("default_llm_provider", provider);
    } catch (e) {}
    setDefaultLlmProviderState(provider);
    setConfig(prev => ({ ...prev, default_llm_provider: provider }));
    if (onUpdateProjectConfig) {
      onUpdateProjectConfig(provider);
    }

    const providerName = provider === "lm_studio" ? "LM Studio" : "Gemini";
    addToast(`${providerName} set as default LLM`, "info");
  }, [addToast, onUpdateProjectConfig]);

  return {
    config,
    setConfig,
    defaultLlmProvider,
    setDefaultLlmProvider
  };
}
