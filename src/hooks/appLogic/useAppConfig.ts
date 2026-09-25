import { useState, useCallback, useEffect, useRef } from 'react';
import { AppConfig, LLMProvider } from '../../types';
import { settingsApi } from '../../api';

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
  const isRemoteLoadedRef = useRef(false);

  const [config, setConfig] = useState<AppConfig>(() => {
    let savedPrompt: string | undefined = undefined;
    let savedTemp: number | undefined = undefined;
    let savedMaxTokens: number | undefined = undefined;
    let savedVision = false;
    let savedAutoCaption = false;
    let savedLmStudioUrl = "http://localhost:1234/v1";
    let savedRunpodApiKey = "";
    let savedRunpodAutoConnect = false;
    let savedLocalModel = "";
    let savedRemoteHost = "";
    let savedSshPort = 22;
    let savedSshUsername = "root";
    let savedSshPassword = "";
    let savedSshKeyPath = "";
    let savedSshPrivateKey = "";
    let savedSshPublicKey = "";
    let savedComfyuiApiUrl = "http://127.0.0.1:8188";
    let savedRemoteComfyuiRoot = "/workspace/runpod-slim/ComfyUI";
    let savedRemoteApiToken = "";

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
      savedLocalModel = localStorage.getItem("local_llm_model") || "";
      savedRunpodApiKey = localStorage.getItem("runpod_api_key") || "";
      savedRunpodAutoConnect = localStorage.getItem("runpod_auto_connect") === "true";

      savedRemoteHost = localStorage.getItem("remote_host") || "";
      const portVal = localStorage.getItem("ssh_port");
      if (portVal) {
        const parsed = parseInt(portVal, 10);
        if (!isNaN(parsed) && parsed > 0) savedSshPort = parsed;
      }
      savedSshUsername = localStorage.getItem("ssh_username") || "root";
      savedSshPassword = localStorage.getItem("ssh_password") || "";
      savedSshKeyPath = localStorage.getItem("ssh_key_path") || "";
      savedSshPrivateKey = localStorage.getItem("ssh_private_key") || "";
      savedSshPublicKey = localStorage.getItem("ssh_public_key") || "";
      savedComfyuiApiUrl = localStorage.getItem("comfyui_api_url") || "http://127.0.0.1:8188";
      savedRemoteComfyuiRoot = localStorage.getItem("remote_comfyui_root") || "/workspace/runpod-slim/ComfyUI";
      savedRemoteApiToken = localStorage.getItem("remote_api_token") || "";
    } catch (e) {}

    return {
      remote_host: savedRemoteHost,
      ssh_port: savedSshPort,
      ssh_username: savedSshUsername,
      ssh_password: savedSshPassword,
      ssh_key_path: savedSshKeyPath,
      ssh_private_key: savedSshPrivateKey,
      ssh_public_key: savedSshPublicKey,
      remote_comfyui_root: savedRemoteComfyuiRoot,
      comfyui_api_url: savedComfyuiApiUrl,
      remote_api_token: savedRemoteApiToken,
      lm_studio_url: savedLmStudioUrl,
      local_model: savedLocalModel || undefined,
      selected_ollama_model: savedLocalModel || undefined,
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
      if (config.local_model) {
        localStorage.setItem("local_llm_model", config.local_model);
      }
      if (config.runpod_api_key !== undefined) {
        localStorage.setItem("runpod_api_key", config.runpod_api_key);
      }
      if (config.runpod_auto_connect !== undefined) {
        localStorage.setItem("runpod_auto_connect", String(config.runpod_auto_connect));
      }

      // Remote Server & SSH Keypair local persistence
      if (config.remote_host !== undefined) {
        localStorage.setItem("remote_host", config.remote_host);
      }
      if (config.ssh_port !== undefined) {
        localStorage.setItem("ssh_port", String(config.ssh_port));
      }
      if (config.ssh_username !== undefined) {
        localStorage.setItem("ssh_username", config.ssh_username);
      }
      if (config.ssh_password !== undefined) {
        localStorage.setItem("ssh_password", config.ssh_password);
      }
      if (config.ssh_key_path !== undefined) {
        localStorage.setItem("ssh_key_path", config.ssh_key_path);
      }
      if (config.ssh_private_key !== undefined) {
        localStorage.setItem("ssh_private_key", config.ssh_private_key);
      }
      if (config.ssh_public_key !== undefined) {
        localStorage.setItem("ssh_public_key", config.ssh_public_key);
      }
      if (config.comfyui_api_url !== undefined) {
        localStorage.setItem("comfyui_api_url", config.comfyui_api_url);
      }
      if (config.remote_comfyui_root !== undefined) {
        localStorage.setItem("remote_comfyui_root", config.remote_comfyui_root);
      }
      if (config.remote_api_token !== undefined) {
        localStorage.setItem("remote_api_token", config.remote_api_token);
      }
    } catch (e) {}

    // Persist global program-level LLM configuration to server
    settingsApi.saveLLMSettings({
      lm_studio_url: config.lm_studio_url,
      local_model: config.local_model,
      default_llm_provider: config.default_llm_provider,
      vision_enabled: config.vision_enabled,
      auto_caption_enabled: config.auto_caption_enabled,
      llm_custom_system_prompt: config.llm_custom_system_prompt,
      llm_temperature: config.llm_temperature,
      llm_max_tokens: config.llm_max_tokens
    }).catch(() => {});

    // Persist remote server & SSH configuration to server if initial load is done
    if (isRemoteLoadedRef.current) {
      settingsApi.saveRemoteSettings({
        remote_host: config.remote_host,
        ssh_port: config.ssh_port,
        ssh_username: config.ssh_username,
        ssh_password: config.ssh_password,
        ssh_key_path: config.ssh_key_path,
        ssh_private_key: config.ssh_private_key,
        ssh_public_key: config.ssh_public_key,
        comfyui_api_url: config.comfyui_api_url,
        remote_comfyui_root: config.remote_comfyui_root,
        remote_api_token: config.remote_api_token
      }).catch(() => {});
    }
  }, [
    config.vision_enabled,
    config.auto_caption_enabled,
    config.lm_studio_url,
    config.local_model,
    config.default_llm_provider,
    config.llm_custom_system_prompt,
    config.llm_temperature,
    config.llm_max_tokens,
    config.runpod_api_key,
    config.runpod_auto_connect,
    config.remote_host,
    config.ssh_port,
    config.ssh_username,
    config.ssh_password,
    config.ssh_key_path,
    config.ssh_private_key,
    config.ssh_public_key,
    config.comfyui_api_url,
    config.remote_comfyui_root,
    config.remote_api_token
  ]);

  // Fetch program-level settings (LLM, RunPod, and Remote Server) from server on mount
  useEffect(() => {
    settingsApi.getLLMSettings()
      .then(data => {
        if (data) {
          setConfig(prev => ({
            ...prev,
            lm_studio_url: data.lm_studio_url || prev.lm_studio_url,
            local_model: data.local_model || prev.local_model,
            selected_ollama_model: data.local_model || prev.selected_ollama_model,
            vision_enabled: data.vision_enabled !== undefined ? data.vision_enabled : prev.vision_enabled,
            auto_caption_enabled: data.auto_caption_enabled !== undefined ? data.auto_caption_enabled : prev.auto_caption_enabled,
            llm_custom_system_prompt: data.llm_custom_system_prompt !== undefined ? data.llm_custom_system_prompt : prev.llm_custom_system_prompt,
            llm_temperature: data.llm_temperature !== undefined ? data.llm_temperature : prev.llm_temperature,
            llm_max_tokens: data.llm_max_tokens !== undefined ? data.llm_max_tokens : prev.llm_max_tokens
          }));
          if (data.default_llm_provider) {
            setDefaultLlmProviderState(data.default_llm_provider);
          }
        }
      })
      .catch(() => {});

    settingsApi.getRunpodKey()
      .then(data => {
        if (data && data.api_key) {
          setConfig(prev => ({ ...prev, runpod_api_key: data.api_key }));
        }
      })
      .catch(() => {});

    settingsApi.getCivitaiKey()
      .then(data => {
        if (data && (data.configured || data.api_key)) {
          setConfig(prev => ({
            ...prev,
            civitai_api_key: data.api_key || (data.configured ? "CONFIGURED" : prev.civitai_api_key)
          }));
        }
      })
      .catch(() => {});

    settingsApi.getRemoteSettings()
      .then(data => {
        if (data) {
          setConfig(prev => {
            const loadedHost = data.remote_host || prev.remote_host || "";
            const loadedPort = data.ssh_port || prev.ssh_port || 22;
            const loadedUser = data.ssh_username || prev.ssh_username || "root";
            const loadedPass = data.ssh_password || prev.ssh_password || "";
            const loadedKeyPath = data.ssh_key_path || prev.ssh_key_path || "";
            const loadedPrivateKey = data.ssh_private_key || prev.ssh_private_key || "";
            const loadedPublicKey = data.ssh_public_key || prev.ssh_public_key || "";
            const loadedComfyUrl = data.comfyui_api_url || prev.comfyui_api_url || "http://127.0.0.1:8188";
            const loadedComfyRoot = data.remote_comfyui_root || prev.remote_comfyui_root || "/workspace/runpod-slim/ComfyUI";
            const loadedToken = data.remote_api_token || prev.remote_api_token || "";

            try {
              if (loadedHost) localStorage.setItem("remote_host", loadedHost);
              if (loadedPort) localStorage.setItem("ssh_port", String(loadedPort));
              if (loadedUser) localStorage.setItem("ssh_username", loadedUser);
              if (loadedPass) localStorage.setItem("ssh_password", loadedPass);
              if (loadedKeyPath) localStorage.setItem("ssh_key_path", loadedKeyPath);
              if (loadedPrivateKey) localStorage.setItem("ssh_private_key", loadedPrivateKey);
              if (loadedPublicKey) localStorage.setItem("ssh_public_key", loadedPublicKey);
              if (loadedComfyUrl) localStorage.setItem("comfyui_api_url", loadedComfyUrl);
              if (loadedComfyRoot) localStorage.setItem("remote_comfyui_root", loadedComfyRoot);
              if (loadedToken) localStorage.setItem("remote_api_token", loadedToken);
            } catch (e) {}

            return {
              ...prev,
              remote_host: loadedHost,
              ssh_port: loadedPort,
              ssh_username: loadedUser,
              ssh_password: loadedPass,
              ssh_key_path: loadedKeyPath,
              ssh_private_key: loadedPrivateKey,
              ssh_public_key: loadedPublicKey,
              comfyui_api_url: loadedComfyUrl,
              remote_comfyui_root: loadedComfyRoot,
              remote_api_token: loadedToken
            };
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        isRemoteLoadedRef.current = true;
      });
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
