import React, { useState, useEffect } from "react";
import { AppConfig } from "../../types";
import { Sparkles, Save, CheckCircle2, AlertCircle } from "lucide-react";

export interface GeminiConfigProps {
  config: AppConfig;
  onChange: (newConfig: AppConfig) => void;
}

export const GeminiConfig: React.FC<GeminiConfigProps> = ({ config, onChange }) => {
  const [geminiKeyInput, setGeminiKeyInput] = useState("");
  const [isGeminiConfigured, setIsGeminiConfigured] = useState(false);
  const [maskedGeminiKey, setMaskedGeminiKey] = useState("");
  const [savingGemini, setSavingGemini] = useState(false);
  const [geminiFeedback, setGeminiFeedback] = useState<{ success?: boolean; message?: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings/gemini")
      .then((res) => res.json())
      .then((data) => {
        if (data.configured) {
          setIsGeminiConfigured(true);
          setMaskedGeminiKey(data.masked_key);
        }
      })
      .catch(() => {});
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
      } else {
        setGeminiFeedback({ success: false, message: data.error || data.detail || "Failed to save API key." });
      }
    } catch (e: any) {
      setGeminiFeedback({ success: false, message: e.message });
    } finally {
      setSavingGemini(false);
    }
  };

  return (
    <div className="border-t border-zinc-800 pt-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-zinc-200">Gemini API</h3>
            <p className="text-[11px] text-zinc-400">Configure Google GenAI client (gemini-3.6-flash) for cloud-based prompt expansion.</p>
          </div>
        </div>
        {isGeminiConfigured && (
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded-full">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Active ({maskedGeminiKey})
          </span>
        )}
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
        <button
          onClick={handleSaveGeminiKey}
          disabled={savingGemini || !geminiKeyInput.trim()}
          className="px-4 py-2 text-xs font-medium bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
        >
          <Save className={`w-3.5 h-3.5 ${savingGemini ? "animate-spin" : ""}`} />
          {savingGemini ? "Saving..." : "Save Config"}
        </button>
      </div>

      {geminiFeedback && (
        <div className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
          geminiFeedback.success 
            ? "bg-emerald-950/30 border-emerald-800/40 text-emerald-300" 
            : "bg-red-950/30 border-red-800/40 text-red-300"
        }`}>
          {geminiFeedback.success ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
          <span>{geminiFeedback.message}</span>
        </div>
      )}
    </div>
  );
};
