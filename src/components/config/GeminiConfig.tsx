import React, { useState, useEffect } from "react";
import { AppConfig } from "../../types";
import { Sparkles, Save, CheckCircle2, AlertCircle, RefreshCw, Star } from "lucide-react";

export interface GeminiConfigProps {
  config: AppConfig;
  onChange: (newConfig: AppConfig) => void;
  isDefault?: boolean;
  onSetDefault?: () => void;
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
  onConnectionStatusChange,
  onShowToast 
}) => {
  const [geminiKeyInput, setGeminiKeyInput] = useState("");
  const [isGeminiConfigured, setIsGeminiConfigured] = useState(false);
  const [maskedGeminiKey, setMaskedGeminiKey] = useState("");
  const [savingGemini, setSavingGemini] = useState(false);
  const [testingGemini, setTestingGemini] = useState(false);
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
          <div className="p-1 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-zinc-200">Gemini API</h3>
            <p className="text-[11px] text-zinc-400">Configure Google GenAI client (gemini-3.6-flash) for cloud-based prompt expansion.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isGeminiConfigured && (
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded-full shrink-0">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              Active ({maskedGeminiKey})
            </span>
          )}

          {isDefault ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/50 border border-emerald-700/50 px-2.5 py-1 rounded-lg shrink-0 shadow-xs">
              <Star className="w-3.5 h-3.5 fill-emerald-400 text-emerald-400" />
              ★ Default LLM
            </span>
          ) : (
            onSetDefault && (
              <button
                type="button"
                onClick={handleSetDefaultGemini}
                disabled={testingGemini}
                title="Set Gemini as default LLM provider"
                className="px-2.5 py-1 text-xs font-medium bg-zinc-800 hover:bg-emerald-950/40 text-zinc-300 hover:text-emerald-300 border border-zinc-700 hover:border-emerald-600/50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${testingGemini ? "animate-spin text-emerald-400" : "hidden"}`} />
                <Star className={`w-3.5 h-3.5 text-zinc-400 hover:text-emerald-400 ${testingGemini ? "hidden" : ""}`} />
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
            className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-purple-500 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTestGemini}
            disabled={testingGemini || (!geminiKeyInput.trim() && !isGeminiConfigured && !config.gemini_api_key)}
            className="px-3.5 py-2 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 border border-zinc-700 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testingGemini ? "animate-spin text-purple-400" : ""}`} />
            <span>{testingGemini ? "Testing..." : "Test Connection"}</span>
          </button>

          <button
            type="button"
            onClick={handleSaveGeminiKey}
            disabled={savingGemini || !geminiKeyInput.trim()}
            className="px-4 py-2 text-xs font-medium bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Save className={`w-3.5 h-3.5 ${savingGemini ? "animate-spin" : ""}`} />
            <span>{savingGemini ? "Saving..." : "Save Config"}</span>
          </button>
        </div>
      </div>

      {geminiFeedback && (
        <div className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
          geminiFeedback.success 
            ? "bg-emerald-950/30 border-emerald-800/40 text-emerald-300" 
            : "bg-red-950/30 border-red-800/40 text-red-300"
        }`}>
          {geminiFeedback.success ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
          <span className="font-medium">{geminiFeedback.message}</span>
        </div>
      )}
    </div>
  );
};

