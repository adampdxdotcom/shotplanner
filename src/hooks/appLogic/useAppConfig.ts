import { useState, useCallback, useEffect } from 'react';
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
    let savedVision = false;
    let savedAutoCaption = false;
    let savedLmStudioUrl = "http://localhost:1234/v1";
    let savedRunpodApiKey = "";
    let savedRunpodAutoConnect = false;
    try {
      savedPrompt = localStorage.getItem("llm_custom_system_prompt") || undefined;
      const t = localStorage.getItem("llm_temperature");
      if (t) savedTemp = parseFloat(t);
      const m = localStorage.getItem("llm_max_tokens");
      if (m) savedMaxTokens = parseInt(m, 10);
      savedVision = localStorage.getItem("vision_enabled") === "true";
      savedAutoCaption = localStorage.getItem("auto_caption_enabled") === "true";
      const url = localStorage.getItem("lm_studio_url");
      if (url && url.trim()) {
        savedLmStudioUrl = url.trim();
      }
      savedRunpodApiKey = localStorage.getItem("runpod_api_key") || "";
      savedRunpodAutoConnect = localStorage.getItem("runpod_auto_connect") === "true";
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
      lm_studio_url: savedLmStudioUrl,
      runpod_api_key: savedRunpodApiKey,
      runpod_auto_connect: savedRunpodAutoConnect,
      default_llm_provider: getDefaultLlmProvider(),
      gemini_api_key: "",
      civitai_api_key: "",
      huggingface_token: "",
      llm_custom_system_prompt: savedPrompt,
      llm_temperature: savedTemp !== undefined ? savedTemp : 0.45,
      llm_max_tokens: savedMaxTokens !== undefined ? savedMaxTokens : 800,
      vision_enabled: savedVision,
      auto_caption_enabled: savedVision ? savedAutoCaption : false
    };
  });

  // Sync settings to localStorage and server
  useEffect(() => {
    try {
      if (config.vision_enabled !== undefined) {
        localStorage.setItem("vision_enabled", String(config.vision_enabled));
      }
      if (config.auto_caption_enabled !== undefined) {
        localStorage.setItem("auto_caption_enabled", String(config.auto_caption_enabled));
      }
      if (config.lm_studio_url && config.lm_studio_url.trim()) {
        localStorage.setItem("lm_studio_url", config.lm_studio_url.trim());
      }
      if (config.runpod_api_key !== undefined) {
        localStorage.setItem("runpod_api_key", config.runpod_api_key);
      }
      if (config.runpod_auto_connect !== undefined) {
        localStorage.setItem("runpod_auto_connect", String(config.runpod_auto_connect));
      }
    } catch (e) {}
  }, [config.vision_enabled, config.auto_caption_enabled, config.lm_studio_url, config.runpod_api_key, config.runpod_auto_connect]);

  // Fetch program-level RunPod API key from server on mount
  useEffect(() => {
    fetch("/api/settings/runpod")
      .then(res => res.json())
      .then(data => {
        if (data && data.api_key) {
          setConfig(prev => ({ ...prev, runpod_api_key: data.api_key }));
        }
      })
      .catch(() => {});
  }, []);

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
