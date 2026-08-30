import React, { useState } from "react";
import { MediaAsset, LLMProvider, ScenePlanning, hasSceneReferencePhoto, SCENE_REFERENCE_DIRECTIVE, assembleFinalPrompt } from "../types";
import { formatShotNumber } from "./ScenePlanningHeader";
import { 
  Sparkles, 
  Bot, 
  Send, 
  Check, 
  Copy, 
  AlertCircle, 
  Info, 
  FileText,
  Sliders,
  Film,
  Camera,
  Layers,
  MapPin
} from "lucide-react";

interface LLMSectionProps {
  basicStub: string;
  onChangeBasicStub: (val: string) => void;
  expandedPrompt: string;
  onChangeExpandedPrompt: (val: string) => void;
  providerChoice?: LLMProvider;
  onChangeProviderChoice?: (val: LLMProvider) => void;
  promptPrefix?: string;
  planning?: ScenePlanning;
  assets: MediaAsset[];
  lmStudioUrl: string;
  geminiApiKey?: string;
  onShowToast?: (text: string, type: "success" | "error" | "info") => void;
  activeShotId: string | null;
  onSelectShot: (id: string | null) => void;
  sceneProject: import("../types").SceneProjectFile;
  onUpdateShot: (updater: (prev: import("../types").ShotItem) => import("../types").ShotItem) => void;
}

export const LLMSection: React.FC<LLMSectionProps> = ({
  basicStub,
  onChangeBasicStub,
  expandedPrompt,
  onChangeExpandedPrompt,
  providerChoice: controlledProvider,
  onChangeProviderChoice,
  promptPrefix = "",
  planning,
  assets,
  lmStudioUrl,
  geminiApiKey,
  onShowToast,
  activeShotId,
  onSelectShot,
  sceneProject,
  onUpdateShot
}) => {
  const [internalProvider, setInternalProvider] = useState<LLMProvider>("lm_studio");
  const providerChoice = controlledProvider !== undefined ? controlledProvider : internalProvider;

  const setProviderChoice = (p: LLMProvider) => {
    setInternalProvider(p);
    onChangeProviderChoice?.(p);
  };

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerUsed, setProviderUsed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isSceneRefPresent = hasSceneReferencePhoto(assets);

  const activeShot = activeShotId ? sceneProject.shots.find(s => s.id === activeShotId) : null;
  const activeShotAssets = activeShot ? Object.values(activeShot.assigned_slots).filter(Boolean) : [];
  
  const activeShotPrefix = activeShot 
    ? `${sceneProject.scene_name ? sceneProject.scene_name + " - " : ""}Shot ${activeShot.shot_number.toString().padStart(2, "0")} - ${activeShot.shot_type} - ${activeShot.camera_movement}`
    : promptPrefix;

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
          assets: activeShot ? assets.filter(a => activeShotAssets.includes(a.filename) || sceneProject.shared_assets?.some(sa => sa.filename === a.filename)) : assets,
          lm_studio_url: lmStudioUrl,
          provider: providerChoice,
          prompt_prefix: activeShotPrefix,
          scene_planning: planning,
          planning: planning,
          active_shot: activeShot || undefined,
          shot_type: activeShot ? activeShot.shot_type : planning?.shot_type,
          ots_anchor_subject: activeShot?.ots_anchor_subject || planning?.ots_anchor_subject,
          ots_focus_subject: activeShot?.ots_focus_subject || planning?.ots_focus_subject,
          ots_side: activeShot?.ots_side || planning?.ots_side,
          gemini_api_key: geminiApiKey
        })
      });

      const data = await res.json();
      if (res.ok && data.expanded_prompt) {
        const assembled = assembleFinalPrompt(data.expanded_prompt, activeShotPrefix, isSceneRefPresent);
        onChangeExpandedPrompt(assembled);
        if (data.provider) setProviderUsed(data.provider);
        onShowToast?.("Prompt expanded and auto-compiled successfully!", "success");
      } else {
        setError(data.error || "Failed to generate prompt from LLM");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  // Auto-inject header and photo statement once when shot changes
  const lastLoadedShotIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (activeShotId && expandedPrompt && expandedPrompt.trim()) {
      if (lastLoadedShotIdRef.current !== activeShotId) {
        const assembled = assembleFinalPrompt(expandedPrompt, activeShotPrefix, isSceneRefPresent);
        if (assembled !== expandedPrompt) {
          onChangeExpandedPrompt(assembled);
        }
        lastLoadedShotIdRef.current = activeShotId;
      }
    } else if (!expandedPrompt) {
      lastLoadedShotIdRef.current = null;
    }
  }, [activeShotId, expandedPrompt, activeShotPrefix, isSceneRefPresent, onChangeExpandedPrompt]);

  const handleCopy = async () => {
    const textToCopy = expandedPrompt;
    if (!textToCopy || !textToCopy.trim()) {
      onShowToast?.("No prompt text to copy.", "info");
      return;
    }

    let success = false;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(textToCopy);
        success = true;
      } else {
        throw new Error("Clipboard API not available");
      }
    } catch {
      // Fallback for iframe / non-focused context
      try {
        const textArea = document.createElement("textarea");
        textArea.value = textToCopy;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        success = document.execCommand("copy");
        document.body.removeChild(textArea);
      } catch (err) {
        console.error("ExecCommand copy failed:", err);
      }
    }

    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      onShowToast?.("Final prompt (with Scene & Shot header at top) copied to clipboard!", "success");
    } else {
      onShowToast?.("Failed to copy prompt to clipboard.", "error");
    }
  };

  return (
    <div id="llm-section" className="space-y-5 flex flex-col min-h-0">
      {/* Prompt Screen Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-zinc-300">Shot Context:</label>
          <select 
            value={activeShotId || ""}
            onChange={(e) => onSelectShot(e.target.value || null)}
            className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none min-w-[250px]"
          >
            <option key="empty" value="">-- Select a Shot to Edit Prompt --</option>
            {sceneProject.shots.map(s => (
              <option key={s.id} value={s.id}>
                Shot {s.shot_number.toString().padStart(2, '0')} - {s.shot_type}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!activeShotId ? (
        <div className="flex flex-col items-center justify-center p-12 bg-zinc-900/40 border-2 border-dashed border-zinc-800 rounded-xl">
          <Bot className="w-12 h-12 text-zinc-600 mb-4" />
          <h2 className="text-xl font-semibold text-zinc-300 mb-2">No Shot Selected</h2>
          <p className="text-sm text-zinc-500 text-center max-w-md">
            Select a shot from the dropdown above to write the concept stub, expand with LLM, and inspect the injected prompt.
          </p>
        </div>
      ) : (
        <div className="bg-zinc-900/60 border-2 border-zinc-700 rounded-xl p-5 shadow-sm space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">LLM Prompt Expansion ("Generate from Stub")</h2>
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
              <span className="text-[11px] text-zinc-400 bg-zinc-950 px-2.5 py-1 rounded-lg border-2 border-zinc-700">
                {activeShotAssets.length} reference asset(s) in context
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
        <div className="bg-zinc-950/50 p-4 rounded-xl border-2 border-zinc-700/80 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-zinc-400" />
                Basic Prompt / Stub
              </label>
              
              {/* Provider Selection */}
              <div className="flex items-center bg-zinc-900 border-2 border-zinc-700 rounded-lg p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setProviderChoice("lm_studio")}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors flex items-center gap-1 ${
                    providerChoice === "lm_studio" 
                      ? "bg-amber-600/80 text-white" 
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Bot className="w-3 h-3" />
                  LM Studio
                </button>
                <button
                  type="button"
                  onClick={() => setProviderChoice("gemini")}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors flex items-center gap-1 ${
                    providerChoice === "gemini" 
                      ? "bg-purple-600/80 text-white" 
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  Gemini 3.6 Flash
                </button>
              </div>
            </div>

            <textarea
              rows={5}
              placeholder="e.g. Jackie walking through a neon-lit cyberpunk alleyway in the rain, turning towards the camera with a confident smile..."
              value={basicStub}
              onChange={(e) => onChangeBasicStub(e.target.value)}
              className="w-full bg-zinc-900 border-2 border-zinc-700 focus:border-amber-500 rounded-lg p-3 text-xs text-zinc-100 placeholder-zinc-600 outline-none resize-none leading-relaxed"
            />

            {/* Asset Context Formatter Preview */}
            <div className="bg-zinc-900/60 p-2.5 rounded-lg border-2 border-zinc-700/60 text-[11px] space-y-1">
              <span className="font-semibold text-zinc-300 block">LLM Formatted Reference Tags:</span>
              {assets.length === 0 ? (
                <p className="text-zinc-500 italic">No assets uploaded. Upload in section 3 to inject reference tags.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {assets.map((asset, i) => {
                    const slotNum = asset.slot_index !== undefined ? asset.slot_index + 1 : i + 1;
                    return (
                      <span key={asset.filename} className="px-2 py-0.5 bg-zinc-800 text-amber-300 font-mono text-[10px] rounded border border-zinc-700">
                        {asset.media_type === "video" ? `<Video ${slotNum}>` : asset.media_type === "audio" ? `<Audio ${slotNum}>` : `<Picture ${slotNum}>`} ({asset.subject_name})
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleGeneratePrompt}
            disabled={generating || !basicStub.trim() || assets.length === 0}
            title={assets.length === 0 ? "You must upload at least one asset to generate a prompt." : ""}
            className={`w-full mt-3 py-2.5 px-4 font-semibold rounded-lg text-xs transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer ${
              assets.length === 0 
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700" 
                : providerChoice === "gemini"
                ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white disabled:opacity-50"
                : "bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-zinc-950 disabled:opacity-50"
            }`}
          >
            {providerChoice === "gemini" ? (
              <Sparkles className={`w-4 h-4 ${generating ? "animate-spin" : ""}`} />
            ) : (
              <Bot className={`w-4 h-4 ${generating ? "animate-spin" : ""}`} />
            )}
            <span>
              {generating 
                ? `Synthesizing with ${providerChoice === "gemini" ? "Gemini 3.6 Flash..." : "LM Studio..."}` 
                : expandedPrompt && expandedPrompt.trim()
                ? `Regenerate Prompt with ${providerChoice === "gemini" ? "Gemini 3.6 Flash" : "LM Studio"}`
                : `Generate Prompt with ${providerChoice === "gemini" ? "Gemini 3.6 Flash" : "LM Studio"}`}
            </span>
          </button>
        </div>

        {/* Right: Preview & Editable Prompt */}
        <div className="bg-zinc-950/50 p-4 rounded-xl border-2 border-zinc-700/80 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Preview / Edit Expanded Prompt (Injected into Node)
              </label>
              
              <div className="flex items-center gap-2">
                {copied && (
                  <span className="text-[11px] text-emerald-400 font-medium bg-emerald-950/90 border border-emerald-800/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Copied!
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!expandedPrompt || !expandedPrompt.trim()}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 shadow-xs ${
                    copied
                      ? "bg-emerald-600 border-emerald-500 text-white shadow-emerald-900/30 cursor-default"
                      : expandedPrompt && expandedPrompt.trim()
                      ? "bg-zinc-800 hover:bg-zinc-700 text-amber-300 hover:text-amber-200 border-zinc-700 hover:border-amber-500/50 cursor-pointer"
                      : "bg-zinc-900 text-zinc-600 border-zinc-800 cursor-not-allowed"
                  }`}
                  title={expandedPrompt && expandedPrompt.trim() ? "Copy LLM generated prompt" : "Generate a prompt first"}
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "Copied to Clipboard" : "Copy Prompt"}</span>
                </button>
              </div>
            </div>

            <textarea
              rows={18}
              placeholder="The expanded, tagged prompt will appear here ready for editing before execution..."
              value={expandedPrompt}
              onChange={(e) => onChangeExpandedPrompt(e.target.value)}
              className="w-full bg-zinc-900 border-2 border-zinc-700 focus:border-amber-500 rounded-lg p-3 text-xs text-zinc-100 placeholder-zinc-600 outline-none resize-none leading-relaxed font-mono"
            />
          </div>

          <div className="text-[11px] text-zinc-400 bg-zinc-900/60 p-2 rounded-lg border-2 border-zinc-700/60 flex items-center justify-between">
            <span>Character Count: {expandedPrompt.length}</span>
            <span className="text-zinc-500">Target Node: Configured in Step 2</span>
          </div>
        </div>
      </div>
      </div>
      )}
    </div>
  );
};
