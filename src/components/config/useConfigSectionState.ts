import { useState, useEffect, useRef } from "react";
import { AppConfig, LLMProvider } from "../../types";
import { copyToClipboard } from "../../utils/clipboard";
import { probeGeminiConnection } from "./GeminiConfig";
import { probeLMStudioConnection } from "./lmStudioProbe";
import { ConfigTab } from "./ConfigTabBar";

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

  // LM Studio connection testing state
  const [testingLM, setTestingLM] = useState(false);
  const [lmTestResult, setLmTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

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
    fetch("/api/settings/gemini")
      .then((res) => res.json())
      .then((data) => {
        if (data.configured) {
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
          setLmTestResult({ success: true, message: result.message });
          wasConnectedRef.current.lm_studio = true;
        } else {
          setLmTestResult({ success: false, message: `Connection Failed: ${result.message}` });
          if (previousStatus === true) {
            if (onShowToast) {
              onShowToast("Connection lost to LM Studio", "error");
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
      setLmTestResult({ success: true, message: result.message });
      wasConnectedRef.current.lm_studio = true;
      if (onShowToast) {
        onShowToast("✓ LM Studio connected successfully", "success");
      }
    } else {
      setLmTestResult({ success: false, message: `Connection Failed: ${result.message}` });
      wasConnectedRef.current.lm_studio = false;
      if (onShowToast) {
        onShowToast(`⚠ LM Studio connection failed: ${result.message}`, "error");
      }
    }
  };

  const handleSetDefaultLMStudio = async () => {
    setTestingLM(true);
    setLmTestResult(null);

    const result = await probeLMStudioConnection(config.lm_studio_url);
    setTestingLM(false);

    if (result.success) {
      setLmTestResult({ success: true, message: result.message });
      wasConnectedRef.current.lm_studio = true;
      if (onSetDefaultProvider) {
        onSetDefaultProvider("lm_studio");
      }
    } else {
      setLmTestResult({ success: false, message: `Connection Failed: ${result.message}` });
      wasConnectedRef.current.lm_studio = false;
      if (onShowToast) {
        onShowToast(`Failed to set default: Could not connect to LM Studio`, "error");
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
      const res = await fetch("/api/ssh/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
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
      const res = await fetch("/api/ssh/generate_keypair", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.detail || `Failed to generate key pair (${res.status})`);
      }
      const data = await res.json();
      if (data.private_key && data.public_key) {
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
      }
    } catch (err: any) {
      alert("Failed to generate SSH key pair: " + (err.message || "Unknown error"));
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
    handleInputChange,
    handleProviderSelect,
    handleDeactivateGemini,
    handleTestLMStudio,
    handleSetDefaultLMStudio
  };
}
