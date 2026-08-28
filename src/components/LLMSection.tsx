import React, { useState } from "react";
import { MediaAsset } from "../types";
import { 
  Sparkles, 
  Bot, 
  Send, 
  Check, 
  Copy, 
  AlertCircle, 
  Info, 
  FileText,
  Sliders
} from "lucide-react";

interface LLMSectionProps {
  basicStub: string;
  onChangeBasicStub: (val: string) => void;
  expandedPrompt: string;
  onChangeExpandedPrompt: (val: string) => void;
  assets: MediaAsset[];
  lmStudioUrl: string;
}

export const LLMSection: React.FC<LLMSectionProps> = ({
  basicStub,
  onChangeBasicStub,
  expandedPrompt,
  onChangeExpandedPrompt,
  assets,
  lmStudioUrl
}) => {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerUsed, setProviderUsed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGeneratePrompt = async () => {
    if (!basicStub.trim()) {
      setError("Please provide a basic prompt stub first.");
      return;
    }

    setGenerating(true);
    setError(null);
    setProviderUsed(null);

    try {
      const res = await fetch("/api/generate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          basic_stub: basicStub,
          assets: assets,
          lm_studio_url: lmStudioUrl
        })
      });

      const data = await res.json();
      if (res.ok && data.expanded_prompt) {
        onChangeExpandedPrompt(data.expanded_prompt);
        if (data.provider) setProviderUsed(data.provider);
      } else {
        setError(data.error || "Failed to generate prompt from LLM");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(expandedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="llm-section" className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">4. LLM Prompt Expansion ("Generate from Stub")</h2>
            <p className="text-xs text-zinc-400">
              Passes basic concept + all uploaded asset metadata into local LM Studio to generate ComfyUI-tagged prompts (<code className="text-zinc-300">&lt;Picture 1&gt;</code>, <code className="text-zinc-300">&lt;Video 1&gt;</code>).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {providerUsed && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-indigo-950 border border-indigo-800/60 text-indigo-300">
              Provider: {providerUsed}
            </span>
          )}
          <span className="text-[11px] text-zinc-400 bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800">
            {assets.length} reference asset(s) in context
          </span>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-950/30 border border-red-800/40 text-xs text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2-Column Split: Input Stub & Output Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Basic Stub Input */}
        <div className="bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/80 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-zinc-400" />
                Basic Prompt / Stub
              </label>
              <span className="text-[11px] text-zinc-400">Core narrative or idea</span>
            </div>

            <textarea
              rows={5}
              placeholder="e.g. Jackie walking through a neon-lit cyberpunk alleyway in the rain, turning towards the camera with a confident smile..."
              value={basicStub}
              onChange={(e) => onChangeBasicStub(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500 rounded-lg p-3 text-xs text-zinc-100 placeholder-zinc-600 outline-none resize-none leading-relaxed"
            />

            {/* Asset Context Formatter Preview */}
            <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800/60 text-[11px] space-y-1">
              <span className="font-semibold text-zinc-300 block">LLM Formatted Reference Tags:</span>
              {assets.length === 0 ? (
                <p className="text-zinc-500 italic">No assets uploaded. Upload in section 3 to inject reference tags.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {assets.map((asset, i) => (
                    <span key={asset.filename} className="px-2 py-0.5 bg-zinc-800 text-amber-300 font-mono text-[10px] rounded border border-zinc-700">
                      {asset.media_type === "video" ? `<Video ${i + 1}>` : asset.media_type === "audio" ? `<Audio ${i + 1}>` : `<Picture ${i + 1}>`} ({asset.subject_name})
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleGeneratePrompt}
            disabled={generating || !basicStub.trim()}
            className="w-full mt-3 py-2.5 px-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-50 text-zinc-950 font-semibold rounded-lg text-xs transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            <Bot className={`w-4 h-4 ${generating ? "animate-spin" : ""}`} />
            <span>{generating ? "Synthesizing with LM Studio..." : "Generate Prompt with LM Studio"}</span>
          </button>
        </div>

        {/* Right: Preview & Editable Prompt */}
        <div className="bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/80 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Preview / Edit Expanded Prompt (Injected into Node)
              </label>
              
              {expandedPrompt && (
                <button
                  onClick={handleCopy}
                  className="px-2 py-1 text-[11px] text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800 rounded transition-colors flex items-center gap-1"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              )}
            </div>

            <textarea
              rows={8}
              placeholder="The expanded, tagged prompt will appear here ready for editing before execution..."
              value={expandedPrompt}
              onChange={(e) => onChangeExpandedPrompt(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500 rounded-lg p-3 text-xs text-zinc-100 placeholder-zinc-600 outline-none resize-none leading-relaxed font-mono"
            />
          </div>

          <div className="text-[11px] text-zinc-400 bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/60 flex items-center justify-between">
            <span>Character Count: {expandedPrompt.length}</span>
            <span className="text-zinc-500">Target Node: Configured in Step 2</span>
          </div>
        </div>
      </div>
    </div>
  );
};
