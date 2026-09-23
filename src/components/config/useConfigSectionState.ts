import { useState, useEffect, useRef } from "react";
import { AppConfig, LLMProvider } from "../../types";
import { copyToClipboard } from "../../utils/clipboard";
import { probeGeminiConnection } from "./GeminiConfig";
import { probeLMStudioConnection } from "./lmStudioProbe";
import { ConfigTab } from "./ConfigTabBar";
import { settingsApi } from "../../api";
import { isVisionModel } from "../../hooks/useVisionCaption";

interface UseConfigSectionStateProps {
  config: AppConfig;
  onChange: (newConfig: AppConfig) => void;
  llmProvider?: LLMProvider;
  defaultLlmProvider?: LLMProvider;
  onChangeProvider?: (provider: LLMProvider) => void;
  onSetDefaultProvider?: (provider: LLMProvider) => void;
  onShowToast?: (text: string, type: "success" | "error" | "info") => void;
  initialTab?: ConfigTab;
}

export function useConfigSectionState({
  config,
  onChange,
  llmProvider,
  defaultLlmProvider,
  onChangeProvider,
  onSetDefaultProvider,
  onShowToast,
  initialTab = "llm"
}: UseConfigSectionStateProps) {
  // Active Configuration Tab
  const [activeTab, setActiveTab] = useState<ConfigTab>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Remote SSH Testing state
  const [testingSSH, setTestingSSH] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  // In-App SSH Key Generator state
  const [isGeneratingKeyPair, setIsGeneratingKeyPair] = useState(false);
  const [generatedKeyPair, setGeneratedKeyPair] = useState<{ public_key: string; private_key: string } | null>(null);
  const [showPublicKeyModal, setShowPublicKeyModal] = useState(false);
  const [hasCopiedPublicKey, setHasCopiedPublicKey] = useState(false);

  // Local LLM connection testing state
  const [testingLM, setTestingLM] = useState(false);
  const [lmTestResult, setLmTestResult] = useState<{
    success?: boolean;
    message?: string;
    hasVision?: boolean;
    visionModel?: string;
  } | null>(null);
  const [detectedBackend, setDetectedBackend] = useState<"ollama" | "lm_studio" | "generic" | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  // Gemini connection status state
  const [isGeminiConnected, setIsGeminiConnected] = useState(false);

  // Track previous connection state to avoid redundant connection lost toasts
  const wasConnectedRef = useRef<{ lm_studio: boolean | null; gemini: boolean | null }>({
    lm_studio: null,
    gemini: null,
  });

  const activeProvider: LLMProvider = llmProvider || config.llm_provider || "lm_studio";
  const effectiveDefault: LLMProvider = defaultLlmProvider || config.default_llm_provider || "lm_studio";
  const isLmStudioConnected = lmTestResult?.success === true;

  // Initial Gemini check on mount
  useEffect(() => {
    settingsApi.getGeminiSettings()
      .then((data: any) => {
        if (data && data.configured) {
          setIsGeminiConnected(true);
        }
      })
      .catch(() => {});
  }, []);

  // Periodic health check polling for active default LLM
  useEffect(() => {
    let isMounted = true;

    const performPeriodicHealthCheck = async () => {
      if (effectiveDefault === "lm_studio") {
        const result = await probeLMStudioConnection(config.lm_studio_url);
        if (!isMounted) return;

        const previousStatus = wasConnectedRef.current.lm_studio;
        if (result.success) {
          setLmTestResult({
            success: true,
            message: result.message,
            hasVision: result.hasVision,
            visionModel: result.visionModel
          });
          setDetectedBackend(result.backend || null);
          if (result.models && result.models.length > 0) {
            setAvailableModels(result.models);
            if (!config.local_model || !result.models.includes(config.local_model)) {
              onChange({ ...config, local_model: result.models[0] });
            }
          } else {
            setAvailableModels([]);
          }

          // On fresh setup or initial connection, auto-detect vision and configure toggles
          if (!previousStatus && (localStorage.getItem("vision_enabled") === null || config.vision_enabled === undefined)) {
            const hasVision = Boolean(result.hasVision);
            onChange({
              ...config,
              vision_enabled: hasVision,
              auto_caption_enabled: hasVision
            });
          }

          wasConnectedRef.current.lm_studio = true;
        } else {
          setLmTestResult({ success: false, message: `Connection Failed: ${result.message}`, hasVision: false });
          if (previousStatus === true) {
            if (onShowToast) {
              onShowToast("Connection lost to Local LLM", "error");
            }
          }
          wasConnectedRef.current.lm_studio = false;
        }
      } else if (effectiveDefault === "gemini") {
        const keyToTest = config.gemini_api_key || "";
        const result = await probeGeminiConnection(keyToTest);
        if (!isMounted) return;

        const previousStatus = wasConnectedRef.current.gemini;
        if (result.success) {
          setIsGeminiConnected(true);
          wasConnectedRef.current.gemini = true;
        } else {
          setIsGeminiConnected(false);
          if (previousStatus === true) {
            if (onShowToast) {
              onShowToast("Connection lost to Gemini", "error");
            }
          }
          wasConnectedRef.current.gemini = false;
        }
      }
    };

    performPeriodicHealthCheck();

    const intervalId = setInterval(() => {
      performPeriodicHealthCheck();
    }, 25000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [effectiveDefault, config.lm_studio_url, config.gemini_api_key]);

  const handleInputChange = (field: keyof AppConfig, value: any) => {
    if (field === "lm_studio_url" && lmTestResult) {
      setLmTestResult(null);
    }
    onChange({ ...config, [field]: value });
  };

  const handleProviderSelect = (provider: LLMProvider) => {
    if (onChangeProvider) {
      onChangeProvider(provider);
    }
    onChange({ ...config, llm_provider: provider });

    const providerName = provider === "lm_studio" ? "LM Studio" : "Gemini";
    if (onShowToast) {
      onShowToast(`${providerName} selected`, "info");
    }
  };

  const handleDeactivateGemini = () => {
    setIsGeminiConnected(false);
    wasConnectedRef.current.gemini = false;
    // If Gemini was the active provider or default provider, fall back to LM Studio safely
    if (activeProvider === "gemini" && onChangeProvider) {
      onChangeProvider("lm_studio");
    }
    if (effectiveDefault === "gemini" && onSetDefaultProvider) {
      onSetDefaultProvider("lm_studio");
    }
    onChange({
      ...config,
      gemini_api_key: "",
      llm_provider: activeProvider === "gemini" ? "lm_studio" : config.llm_provider,
      default_llm_provider: effectiveDefault === "gemini" ? "lm_studio" : config.default_llm_provider
    });
  };

  const handleTestLMStudio = async () => {
    setTestingLM(true);
    setLmTestResult(null);

    const result = await probeLMStudioConnection(config.lm_studio_url);
    setTestingLM(false);

    if (result.success) {
      setLmTestResult({
        success: true,
        message: result.message,
        hasVision: result.hasVision,
        visionModel: result.visionModel
      });
      setDetectedBackend(result.backend || null);

      const hasVision = Boolean(result.hasVision);
      const updatedConfig: AppConfig = {
        ...config,
        vision_enabled: hasVision,
        auto_caption_enabled: hasVision
      };

      if (result.models && result.models.length > 0) {
        setAvailableModels(result.models);
        if (!config.local_model || !result.models.includes(config.local_model)) {
          const selected = (hasVision && result.visionModel) ? result.visionModel : result.models[0];
          updatedConfig.local_model = selected;
          updatedConfig.selected_ollama_model = selected;
        }
      } else {
        setAvailableModels([]);
      }

      onChange(updatedConfig);
      wasConnectedRef.current.lm_studio = true;
      if (onShowToast) {
        const backendName = result.backend === "ollama" ? "Ollama" : result.backend === "lm_studio" ? "LM Studio" : "Local LLM";
        if (hasVision) {
          onShowToast(`✓ ${backendName} connected (${result.visionModel || "Vision"} detected — auto-captioning enabled)`, "success");
        } else {
          onShowToast(`✓ ${backendName} connected (text model detected — vision kept off)`, "info");
        }
      }
    } else {
      setLmTestResult({ success: false, message: `Connection Failed: ${result.message}`, hasVision: false });
      setDetectedBackend(null);
      setAvailableModels([]);
      wasConnectedRef.current.lm_studio = false;
      if (onShowToast) {
        onShowToast(`⚠ Connection failed: ${result.message}`, "error");
      }
    }
  };

  const handleSetDefaultLMStudio = async () => {
    setTestingLM(true);
    setLmTestResult(null);

    const result = await probeLMStudioConnection(config.lm_studio_url);
    setTestingLM(false);

    if (result.success) {
      setLmTestResult({
        success: true,
        message: result.message,
        hasVision: result.hasVision,
        visionModel: result.visionModel
      });
      setDetectedBackend(result.backend || null);

      const hasVision = Boolean(result.hasVision);
      const updatedConfig: AppConfig = {
        ...config,
        vision_enabled: hasVision,
        auto_caption_enabled: hasVision
      };

      if (result.models && result.models.length > 0) {
        setAvailableModels(result.models);
        if (!config.local_model || !result.models.includes(config.local_model)) {
          const selected = (hasVision && result.visionModel) ? result.visionModel : result.models[0];
          updatedConfig.local_model = selected;
          updatedConfig.selected_ollama_model = selected;
        }
      } else {
        setAvailableModels([]);
      }

      onChange(updatedConfig);
      wasConnectedRef.current.lm_studio = true;
      if (onSetDefaultProvider) {
        onSetDefaultProvider("lm_studio");
      }
    } else {
      setLmTestResult({ success: false, message: `Connection Failed: ${result.message}`, hasVision: false });
      setDetectedBackend(null);
      setAvailableModels([]);
      wasConnectedRef.current.lm_studio = false;
      if (onShowToast) {
        onShowToast(`Failed to set default: Could not connect to Local LLM`, "error");
      }
    }
  };

  const handleSelectModel = (model: string) => {
    const hasVision = isVisionModel(model);
    onChange({
      ...config,
      local_model: model,
      selected_ollama_model: model,
      vision_enabled: hasVision,
      auto_caption_enabled: hasVision
    });
    if (onShowToast) {
      if (hasVision) {
        onShowToast(`Selected model: ${model} (Vision & Auto-caption enabled)`, "success");
      } else {
        onShowToast(`Selected model: ${model} (Text model — Vision kept off)`, "info");
      }
    }
  };

  const handleTestSSH = async () => {
    setTestingSSH(true);
    setTestResult(null);
    try {
      // Explicitly bundle current live in-memory input values for SSH credentials
      const payload = {
        host: config.remote_host ? config.remote_host.trim() : "",
        port: Number(config.ssh_port) || 22,
        username: config.ssh_username ? config.ssh_username.trim() : "root",
        password: config.ssh_password || "",
        key_path: config.ssh_key_path || "",
        ssh_private_key: config.ssh_private_key || "",
        remote_dir: config.remote_comfyui_root || "/workspace/runpod-slim/ComfyUI/input/"
      };
      const data: any = await settingsApi.testSsh(payload);
      setTestResult(data);
    } catch (e: any) {
      setTestResult({ success: false, message: e.message });
    } finally {
      setTestingSSH(false);
    }
  };

  const handleGenerateKeyPair = async () => {
    setIsGeneratingKeyPair(true);
    try {
      const data: any = await settingsApi.generateSshKeyPair();
      if (data && data.private_key && data.public_key) {
        // Unconditionally persist generated key pair into application state
        onChange({
          ...config,
          ssh_private_key: data.private_key,
          ssh_public_key: data.public_key
        });
        setGeneratedKeyPair(data);
        setShowPublicKeyModal(false);
        setHasCopiedPublicKey(false);
        if (onShowToast) {
          onShowToast("Generated fresh SSH keypair! Fields updated below.", "success");
        }
      } else {
        throw new Error(data?.error || data?.detail || "Failed to generate key pair");
      }
    } catch (err: any) {
      if (onShowToast) {
        onShowToast("Failed to generate SSH key pair: " + (err.message || "Unknown error"), "error");
      }
    } finally {
      setIsGeneratingKeyPair(false);
    }
  };

  const handleCopyPublicKey = async () => {
    if (!generatedKeyPair?.public_key) return;
    const success = await copyToClipboard(generatedKeyPair.public_key);
    if (success) {
      setHasCopiedPublicKey(true);
      setTimeout(() => setHasCopiedPublicKey(false), 2500);
    }
  };

  const handleDownloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return {
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
  };
}
