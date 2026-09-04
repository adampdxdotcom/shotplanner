import React, { useState } from "react";
import { PromptDebugInfo } from "../types";
import { copyToClipboard } from "../utils/clipboard";
import { 
  X, 
  Copy, 
  Check, 
  Terminal, 
  Sparkles, 
  Clock, 
  Cpu, 
  FileText, 
  Sliders, 
  Layers, 
  CheckCircle2 
} from "lucide-react";

interface PromptDebugModalProps {
  isOpen: boolean;
  onClose: () => void;
  debugInfo: PromptDebugInfo | null;
  assembledPrompt?: string;
}

export const PromptDebugModal: React.FC<PromptDebugModalProps> = ({
  isOpen,
  onClose,
  debugInfo,
  assembledPrompt
}) => {
  const [activeTab, setActiveTab] = useState<"payload" | "raw" | "assembled">("payload");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen || !debugInfo) return null;

  const handleCopy = async (text: string, key: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const fullJsonPayload = JSON.stringify(
    {
      messages: [
        { role: "system", content: debugInfo.system_prompt_sent },
        { role: "user", content: debugInfo.user_prompt_sent }
      ],
      temperature: debugInfo.temperature_used,
      max_tokens: debugInfo.max_tokens_used,
      model: debugInfo.model_used
    },
    null,
    2
  );

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-zinc-900 border-2 border-zinc-700 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-zinc-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 bg-zinc-950/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Terminal className="w-4 h-4" />
              </div>
              <h3 className="text-base font-semibold text-zinc-100">LLM Prompt &amp; Exchange Inspector</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                Phase 2 Debug
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Direct audit of parameters, system directives, and verbatim model response.
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Close inspector"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Metadata Banner */}
        <div className="px-4 py-2.5 bg-zinc-950/90 border-b border-zinc-800/80 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <div className="flex items-center gap-1.5 text-zinc-300">
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-zinc-500">Provider:</span>
            <span className="font-semibold text-zinc-200">{debugInfo.provider}</span>
          </div>

          <div className="flex items-center gap-1.5 text-zinc-300">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-zinc-500">Model:</span>
            <span className="font-mono font-medium text-purple-300">{debugInfo.model_used}</span>
          </div>

          <div className="flex items-center gap-1.5 text-zinc-300">
            <Sliders className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-zinc-500">Temp:</span>
            <span className="font-mono text-blue-300">{debugInfo.temperature_used}</span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-500">Max Tokens:</span>
            <span className="font-mono text-blue-300">{debugInfo.max_tokens_used}</span>
          </div>

          <div className="flex items-center gap-1.5 text-zinc-300">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-zinc-500">Latency:</span>
            <span className="font-mono text-emerald-300">{debugInfo.latency_ms} ms</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between px-4 sm:px-5 border-b border-zinc-800 bg-zinc-900/90 shrink-0">
          <div className="flex items-center gap-2 py-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab("payload")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === "payload"
                  ? "bg-zinc-800 text-zinc-100 border-zinc-600 shadow-xs"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border-transparent"
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>1. Delivered Payload</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("raw")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === "raw"
                  ? "bg-zinc-800 text-zinc-100 border-zinc-600 shadow-xs"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border-transparent"
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>2. Raw Model Response</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("assembled")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === "assembled"
                  ? "bg-zinc-800 text-zinc-100 border-zinc-600 shadow-xs"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border-transparent"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>3. Assembled Workflow Prompt</span>
            </button>
          </div>

          <div className="shrink-0 pl-2">
            {activeTab === "payload" && (
              <button
                type="button"
                onClick={() => handleCopy(fullJsonPayload, "json")}
                className="px-2.5 py-1 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Copy full JSON payload formatted for OpenAI / LM Studio"
              >
                {copiedKey === "json" ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-300">Copied JSON</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-zinc-400" />
                    <span>Copy JSON Payload</span>
                  </>
                )}
              </button>
            )}

            {activeTab === "raw" && (
              <button
                type="button"
                onClick={() => handleCopy(debugInfo.raw_llm_output, "raw")}
                className="px-2.5 py-1 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                {copiedKey === "raw" ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-300">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-zinc-400" />
                    <span>Copy Raw Output</span>
                  </>
                )}
              </button>
            )}

            {activeTab === "assembled" && (
              <button
                type="button"
                onClick={() => handleCopy(assembledPrompt || "", "assembled")}
                className="px-2.5 py-1 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                {copiedKey === "assembled" ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-300">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-zinc-400" />
                    <span>Copy Final Prompt</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 bg-zinc-950/40">
          {activeTab === "payload" && (
            <div className="space-y-4">
              {/* System Prompt */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                    Role: System Prompt (Interpolated Rules)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(debugInfo.system_prompt_sent, "system")}
                    className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === "system" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === "system" ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 font-mono text-xs text-zinc-300 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed selection:bg-amber-900/40">
                  {debugInfo.system_prompt_sent}
                </div>
              </div>

              {/* User Prompt */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                    Role: User Prompt (Scene Context &amp; Tags)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(debugInfo.user_prompt_sent, "user")}
                    className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === "user" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === "user" ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 font-mono text-xs text-zinc-300 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed selection:bg-blue-900/40">
                  {debugInfo.user_prompt_sent}
                </div>
              </div>
            </div>
          )}

          {activeTab === "raw" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Exact string returned by model before prefix/suffix stitching:</span>
                <span className="font-mono text-zinc-500">{debugInfo.raw_llm_output.length} characters</span>
              </div>
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 font-mono text-xs text-emerald-300/90 whitespace-pre-wrap max-h-[60vh] overflow-y-auto leading-relaxed selection:bg-emerald-900/40">
                {debugInfo.raw_llm_output || "(Empty output received from model)"}
              </div>
            </div>
          )}

          {activeTab === "assembled" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Deterministic Ref2VA assembly passed to ComfyUI node:</span>
                <span className="font-mono text-zinc-500">{(assembledPrompt || "").length} characters</span>
              </div>
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 font-mono text-xs text-purple-200 whitespace-pre-wrap max-h-[60vh] overflow-y-auto leading-relaxed selection:bg-purple-900/40">
                {assembledPrompt || "(Assembled prompt unavailable)"}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:px-5 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between text-xs text-zinc-500">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Recorded at {new Date(debugInfo.timestamp).toLocaleTimeString()}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg font-medium cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
