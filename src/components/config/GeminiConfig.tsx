import React, { useState, useEffect } from "react";
import { AppConfig } from "../../types";
import { Sparkles, Save, CheckCircle2, AlertCircle, RefreshCw, Star, Trash2 } from "lucide-react";

export interface GeminiConfigProps {
  config: AppConfig;
  onChange: (newConfig: AppConfig) => void;
  isDefault?: boolean;
  onSetDefault?: () => void;
  onDeactivateGemini?: () => void;
  onConnectionStatusChange?: (connected: boolean) => void;
  onShowToast?: (text: string, type: "success" | "error" | "info") => void;
}

export async function probeGeminiConnection(apiKey?: string): Promise<{ success: boolean; message: string }> {
  const keyToTest = apiKey?.trim() || "";
  try {
    const res = await fetch("/api/settings/test-gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: keyToTest })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, message: data.message || "Gemini API verified successfully" };
    }
    const errorMsg = data.error || data.detail || "Invalid API key or unauthorized";
    return { success: false, message: errorMsg };
  } catch (err: any) {
    return { success: false, message: err.message || "Network request failed" };
  }
}

export const GeminiConfig: React.FC<GeminiConfigProps> = ({ 
  config, 
  onChange, 
  isDefault, 
  onSetDefault, 
  onDeactivateGemini,
  onConnectionStatusChange,
  onShowToast 
}) => {
  const [geminiKeyInput, setGeminiKeyInput] = useState("");
  const [isGeminiConfigured, setIsGeminiConfigured] = useState(false);
  const [maskedGeminiKey, setMaskedGeminiKey] = useState("");
  const [savingGemini, setSavingGemini] = useState(false);
  const [testingGemini, setTestingGemini] = useState(false);
  const [deactivatingGemini, setDeactivatingGemini] = useState(false);
  const [geminiFeedback, setGeminiFeedback] = useState<{ success?: boolean; message?: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings/gemini")
      .then((res) => res.json())
      .then((data) => {
        if (data.configured) {
          setIsGeminiConfigured(true);
          setMaskedGeminiKey(data.masked_key || (data.api_key ? `${data.api_key}...` : "Configured"));
          if (onConnectionStatusChange) onConnectionStatusChange(true);
        } else {
          setIsGeminiConfigured(false);
          setMaskedGeminiKey("");
          if (onConnectionStatusChange) onConnectionStatusChange(false);
        }
      })
      .catch(() => {
        if (onConnectionStatusChange) onConnectionStatusChange(false);
      });
  }, []);

  const handleSaveGeminiKey = async () => {
    if (!geminiKeyInput.trim()) {
      setGeminiFeedback({ success: false, message: "Please enter a valid Gemini API Key." });
      return;
    }
    setSavingGemini(true);
    setGeminiFeedback(null);

    try {
      const res = await fetch("/api/settings/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: geminiKeyInput })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsGeminiConfigured(true);
        setMaskedGeminiKey(geminiKeyInput.length > 8 ? `${geminiKeyInput.slice(0, 4)}...${geminiKeyInput.slice(-4)}` : "***");
        setGeminiKeyInput("");
        setGeminiFeedback({ success: true, message: "Gemini API key saved to persistent storage!" });
        onChange({ ...config, gemini_api_key: geminiKeyInput });
        if (onConnectionStatusChange) onConnectionStatusChange(true);
        if (onShowToast) {
          onShowToast("Gemini API key saved successfully", "success");
        }
      } else {
        setGeminiFeedback({ success: false, message: data.error || data.detail || "Failed to save API key." });
        if (onConnectionStatusChange) onConnectionStatusChange(false);
      }
    } catch (e: any) {
      setGeminiFeedback({ success: false, message: e.message });
      if (onConnectionStatusChange) onConnectionStatusChange(false);
    } finally {
      setSavingGemini(false);
    }
  };

  const handleRemoveGeminiKey = async () => {
    setDeactivatingGemini(true);
    setGeminiFeedback(null);

    try {
      // Call DELETE to clear persistent key storage
      const res = await fetch("/api/settings/gemini", {
        method: "DELETE"
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        setIsGeminiConfigured(false);
        setMaskedGeminiKey("");
        setGeminiKeyInput("");
        setGeminiFeedback({ success: true, message: "Gemini API key removed and deactivated." });
        
        // Clear from active state and notify parent
        onChange({ ...config, gemini_api_key: "" });
        if (onConnectionStatusChange) onConnectionStatusChange(false);
        if (onDeactivateGemini) onDeactivateGemini();

        if (onShowToast) {
          onShowToast("Gemini API key removed and deactivated", "info");
        }
      } else {
        setGeminiFeedback({ success: false, message: data.error || data.detail || "Failed to remove API key." });
      }
    } catch (e: any) {
      setGeminiFeedback({ success: false, message: e.message || "Failed to contact settings service." });
    } finally {
      setDeactivatingGemini(false);
    }
  };

  const handleTestGemini = async () => {
    setTestingGemini(true);
    setGeminiFeedback(null);

    const keyToTest = geminiKeyInput.trim() || config.gemini_api_key || "";
    const result = await probeGeminiConnection(keyToTest);
    setTestingGemini(false);

    if (result.success) {
      setGeminiFeedback({ success: true, message: `Connected: ${result.message}` });
      if (onConnectionStatusChange) onConnectionStatusChange(true);
      if (onShowToast) {
        onShowToast("✓ Gemini API verified successfully", "success");
      }
    } else {
      setGeminiFeedback({ success: false, message: `Connection Failed: ${result.message}` });
      if (onConnectionStatusChange) onConnectionStatusChange(false);
      if (onShowToast) {
        onShowToast(`⚠ Gemini API connection failed: ${result.message}`, "error");
      }
    }
  };

  const handleSetDefaultGemini = async () => {
    setTestingGemini(true);
    setGeminiFeedback(null);

    const keyToTest = geminiKeyInput.trim() || config.gemini_api_key || "";
    const result = await probeGeminiConnection(keyToTest);
    setTestingGemini(false);

    if (result.success) {
      setGeminiFeedback({ success: true, message: `Connected: ${result.message}` });
      if (onConnectionStatusChange) onConnectionStatusChange(true);
      if (onSetDefault) onSetDefault();
    } else {
      setGeminiFeedback({ success: false, message: `Connection Failed: ${result.message}` });
      if (onConnectionStatusChange) onConnectionStatusChange(false);
      if (onShowToast) {
        onShowToast(`Failed to set default: Could not connect to Gemini (${result.message})`, "error");
      }
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Gemini API</h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Configure Google GenAI client (gemini-3.7-flash) for cloud-based prompt expansion.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isGeminiConfigured ? (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-100 border border-emerald-300 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-800/40 px-2.5 py-1 rounded-full shrink-0">
              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              Active ({maskedGeminiKey})
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-red-800 bg-red-100 border border-red-300 dark:text-red-400 dark:bg-red-950/40 dark:border-red-800/40 px-2.5 py-1 rounded-full shrink-0">
              <AlertCircle className="w-3 h-3 text-red-600 dark:text-red-400" />
              Unconfigured
            </span>
          )}

          {isDefault ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-100 border border-emerald-300 dark:text-emerald-300 dark:bg-emerald-950/50 dark:border-emerald-700/50 px-2.5 py-1 rounded-lg shrink-0 shadow-xs">
              <Star className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600 dark:fill-emerald-400 dark:text-emerald-400" />
              ★ Default LLM
            </span>
          ) : (
            onSetDefault && (
              <button
                type="button"
                onClick={handleSetDefaultGemini}
                disabled={testingGemini || !isGeminiConfigured}
                title="Set Gemini as default LLM provider"
                className="px-2.5 py-1 text-xs font-medium bg-white hover:bg-emerald-50 text-zinc-700 hover:text-emerald-800 border border-zinc-300 hover:border-emerald-300 dark:bg-zinc-800 dark:hover:bg-emerald-950/40 dark:text-zinc-300 dark:hover:text-emerald-300 dark:border-zinc-700 dark:hover:border-emerald-600/50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50 disabled:hover:bg-white disabled:hover:border-zinc-300 disabled:hover:text-zinc-700 dark:disabled:hover:bg-zinc-800 dark:disabled:hover:border-zinc-700 dark:disabled:hover:text-zinc-300 shadow-xs"
              >
                <RefreshCw className={`w-3 h-3 ${testingGemini ? "animate-spin text-emerald-600 dark:text-emerald-400" : "hidden"}`} />
                <Star className={`w-3.5 h-3.5 text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 ${testingGemini ? "hidden" : ""}`} />
                <span>{testingGemini ? "Testing..." : "Set as Default LLM"}</span>
              </button>
            )
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="relative flex-1">
          <input
            type="password"
            placeholder={isGeminiConfigured ? "Enter new API key to update..." : "AIzaSy..."}
            value={geminiKeyInput}
            onChange={(e) => setGeminiKeyInput(e.target.value)}
            className="w-full bg-white dark:bg-zinc-950 border-2 border-zinc-300 dark:border-zinc-700 focus:border-purple-500 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTestGemini}
            disabled={testingGemini || (!geminiKeyInput.trim() && !isGeminiConfigured)}
            className="px-3.5 py-2 text-xs font-semibold bg-white hover:bg-zinc-100 disabled:opacity-50 text-zinc-700 border border-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 dark:border-zinc-700 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testingGemini ? "animate-spin text-purple-600 dark:text-purple-400" : ""}`} />
            <span>{testingGemini ? "Testing..." : "Test Connection"}</span>
          </button>

          <button
            type="button"
            onClick={handleSaveGeminiKey}
            disabled={savingGemini || !geminiKeyInput.trim()}
            className="px-4 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
          >
            <Save className={`w-3.5 h-3.5 ${savingGemini ? "animate-spin" : ""}`} />
            <span>{savingGemini ? "Saving..." : "Save Config"}</span>
          </button>

          {(isGeminiConfigured || config.gemini_api_key) && (
            <button
              id="btn-remove-gemini-key"
              type="button"
              onClick={handleRemoveGeminiKey}
              disabled={deactivatingGemini || savingGemini}
              title="Remove and deactivate Gemini API key"
              className="px-3 py-2 text-xs font-semibold bg-zinc-100 hover:bg-red-50 text-zinc-700 hover:text-red-700 border border-zinc-300 hover:border-red-300 dark:bg-zinc-800 dark:hover:bg-red-950/40 dark:text-zinc-300 dark:hover:text-red-300 dark:border-zinc-700 dark:hover:border-red-700/60 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50 shadow-xs"
            >
              <Trash2 className={`w-3.5 h-3.5 ${deactivatingGemini ? "animate-spin text-red-500" : "text-red-500"}`} />
              <span>{deactivatingGemini ? "Deactivating..." : "Deactivate & Remove"}</span>
            </button>
          )}
        </div>
      </div>

      {geminiFeedback && (
        <div className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
          geminiFeedback.success 
            ? "bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800/40 dark:text-emerald-300" 
            : "bg-red-50 border-red-300 text-red-800 dark:bg-red-950/30 dark:border-red-800/40 dark:text-red-300"
        }`}>
          {geminiFeedback.success ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
          )}
          <span className="font-semibold">{geminiFeedback.message}</span>
        </div>
      )}
    </div>
  );
};

