import React, { useState, useEffect, useRef } from "react";
import { AppConfig, LLMProvider, PromptDebugInfo } from "../../types";
import { PromptDebugModal } from "../PromptDebugModal";
import { copyToClipboard } from "../../utils/clipboard";
import { 
  Sliders, 
  Terminal, 
  RotateCcw, 
  Sparkles, 
  Copy, 
  Check, 
  Play, 
  RefreshCw, 
  Info, 
  Code, 
  AlertCircle,
  Eye,
  CheckCircle2,
  ChevronDown,
  ChevronUp
} from "lucide-react";

interface LLMPromptSettingsCardProps {
  config: AppConfig;
  onChange: (newConfig: AppConfig) => void;
  onShowToast?: (text: string, type: "success" | "error" | "info") => void;
  activeProvider: LLMProvider;
}

const DEFAULT_SYSTEM_PROMPT = `You are an expert AI Screenwriter and Prompt Engineer specializing in advanced multimodal video generation frameworks (MiniMax-H3 / Ref2VA pipelines).

Your task is to generate ONLY the integrated_multimodal_description content. Do not generate headers, footers, or subject definitions. Use exact asset tags (<Picture N>, <Video N>) provided in the context.

### Strict Output Constraints:
- Spatial Initialization: Always define the subject's exact spatial position and initial posture at the very beginning (e.g., "[Shot 1] Live-action, cinematic... At the start of the shot, [Subject] is positioned at...").
- Exact Tags: Differentiate between facial likeness and styling using the exact tags provided (e.g., "<Picture 1>"). Do NOT invent new tags or reference off-screen characters.
- Cinematography & Optical Rendering: Reflect the visual characteristics of the selected lens ({{LENS}}) and framing ({{ASPECT_RATIO}}) in depth-of-field, perspective compression, and environmental sharpness, while strictly adhering to camera motion constraints.
- Framing Directives: When a Framing Directive is provided in context, utilize the specific anchor and focus subject likenesses provided in the Global Subject Definitions to execute this framing.
- Camera Motion Hard Constraint: {{CAMERA_CONSTRAINT}}
- Dialogue: If dialogue is present, format as <d>[Language] Dialogue text</d> with speaker tags like (S1).
- No Boilerplate: Output ONLY the narrative visual description. Do NOT output "Global Subject Definitions:", "overall_soundscape:", or "non_diegetic_music:".`;

const QWEN_OPTIMIZED_PROMPT = `You are an expert AI Screenwriter and Prompt Engineer specializing in advanced multimodal video generation frameworks (MiniMax-H3 / Ref2VA pipelines).

Your task is to generate ONLY the integrated_multimodal_description narrative paragraph. Do not generate headers, footers, or subject definitions. Use exact asset tags (<Picture N>, <Video N>) provided in the context.

### Strict Qwen Output Rules:
- Direct Scene Start: Begin directly with "[Shot 1] Live-action, cinematic..." or the immediate scene action. Absolutely NO conversational greetings, NO preambles (e.g., "Here is the...", "Certainly"), and NO markdown code blocks (\`\`\`).
- Spatial Initialization: Explicitly establish character spatial coordinates (screen-left, screen-right, foreground, background) and physical posture in the opening sentence.
- Exact Tag Integration: Integrate character likeness tags naturally (e.g., "Elena (<Picture 1>) sits opposite Marcus (<Picture 2>)"). Do NOT reference untagged characters.
- Cinematography & Optics: Render depth of field, perspective compression, and background separation matching the {{LENS}} optic within a {{ASPECT_RATIO}} frame.
- Camera Motion Constraint: {{CAMERA_CONSTRAINT}}. If locked off, the camera tripod is stationary with zero drift; all motion in the frame comes exclusively from actors and environmental elements.
- Dialogue Formatting: Format any spoken dialogue strictly as <d>[Language] Spoken dialogue text</d> with speaker attribution (S1).
- Output Boundary: Produce ONLY the visual narrative paragraph without labels, titles, or closing remarks.`;

const VARIABLE_PILLS = [
  { tag: "{{LENS}}", label: "Lens", desc: "Injects active camera lens (e.g., 50mm standard prime)" },
  { tag: "{{ASPECT_RATIO}}", label: "Aspect Ratio", desc: "Injects active canvas aspect ratio (e.g., 2.39:1 Anamorphic)" },
  { tag: "{{CAMERA_CONSTRAINT}}", label: "Camera Rule", desc: "Injects dynamic camera motion rule (e.g., Locked Off vs Pan)" }
];

export const LLMPromptSettingsCard: React.FC<LLMPromptSettingsCardProps> = ({
  config,
  onChange,
  onShowToast,
  activeProvider
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showInspectorModal, setShowInspectorModal] = useState(false);
  const [lastDebugInfo, setLastDebugInfo] = useState<PromptDebugInfo | null>(null);
  const [lastAssembledPrompt, setLastAssembledPrompt] = useState<string>("");
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [testStub, setTestStub] = useState("Elena sits across from Marcus in a neon-lit diner at night, nervously speaking to him while rain hits the window.");
  const [isTestExpanded, setIsTestExpanded] = useState(false);

  // Active prompt values with fallbacks
  const activePrompt = config.llm_custom_system_prompt !== undefined 
    ? config.llm_custom_system_prompt 
    : DEFAULT_SYSTEM_PROMPT;

  const activeTemperature = typeof config.llm_temperature === "number"
    ? config.llm_temperature
    : 0.45;

  const activeMaxTokens = typeof config.llm_max_tokens === "number"
    ? config.llm_max_tokens
    : 800;

  const handleUpdateConfig = (updates: Partial<AppConfig>) => {
    const updated = { ...config, ...updates };
    onChange(updated);
    // Persist to local storage for instant recall
    if (updates.llm_custom_system_prompt !== undefined) {
      try { localStorage.setItem("llm_custom_system_prompt", updates.llm_custom_system_prompt); } catch (e) {}
    }
    if (updates.llm_temperature !== undefined) {
      try { localStorage.setItem("llm_temperature", updates.llm_temperature.toString()); } catch (e) {}
    }
    if (updates.llm_max_tokens !== undefined) {
      try { localStorage.setItem("llm_max_tokens", updates.llm_max_tokens.toString()); } catch (e) {}
    }
  };

  const handleInsertVariable = (tag: string) => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = activePrompt;
    const updated = text.substring(0, start) + tag + text.substring(end);
    handleUpdateConfig({ llm_custom_system_prompt: updated });
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);
  };

  const handleResetToDefault = () => {
    handleUpdateConfig({ 
      llm_custom_system_prompt: DEFAULT_SYSTEM_PROMPT,
      llm_temperature: 0.7,
      llm_max_tokens: 800
    });
    onShowToast?.("Reset prompt template to factory default.", "info");
  };

  const handleApplyQwenPreset = () => {
    handleUpdateConfig({
      llm_custom_system_prompt: QWEN_OPTIMIZED_PROMPT,
      llm_temperature: 0.45,
      llm_max_tokens: 800
    });
    onShowToast?.("Applied Qwen 3.6 optimized preset (T=0.45 + anti-preamble directives).", "success");
  };

  const handleCopyPrompt = async () => {
    const success = await copyToClipboard(activePrompt);
    if (success) {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
      onShowToast?.("Prompt template copied to clipboard.", "info");
    }
  };

  // Run test exchange against active LLM to generate real inspection payload
  const handleRunTestExchange = async () => {
    setIsRunningTest(true);
    try {
      const res = await fetch("/api/generate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          basic_stub: testStub,
          assets: [
            { media_type: "image", filename: "elena_ref.png", subject_name: "Elena" },
            { media_type: "image", filename: "marcus_ref.png", subject_name: "Marcus" }
          ],
          camera_movement: "Locked off (Static tripod)",
          lens_focal_length: "50mm standard prime",
          aspect_ratio: "2.39:1 Anamorphic",
          framing_directive: "Over-the-shoulder (OTS) past Marcus looking toward Elena",
          custom_system_prompt: activePrompt,
          temperature: activeTemperature,
          max_tokens: activeMaxTokens,
          provider: activeProvider,
          lm_studio_url: config.lm_studio_url,
          gemini_api_key: config.gemini_api_key
        })
      });

      const data = await res.json();
      if (res.ok && data.debug) {
        setLastDebugInfo(data.debug);
        setLastAssembledPrompt(data.expanded_prompt || "");
        setShowInspectorModal(true);
        onShowToast?.(`Test completed in ${data.debug.latency_ms}ms! Inspector opened.`, "success");
      } else {
        onShowToast?.(data.error || "Failed to execute test prompt with LLM", "error");
      }
    } catch (err: any) {
      onShowToast?.(`Test error: ${err.message}`, "error");
    } finally {
      setIsRunningTest(false);
    }
  };

  return (
    <section 
      id="panel-llm-prompt-settings"
      className="w-full bg-zinc-900/60 border-2 border-zinc-700 rounded-xl p-5 shadow-sm space-y-5"
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-100">LLM Prompt Engineering &amp; Directives</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-700/50">
                Active for all LLMs
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Customize the system prompt template, dynamic placeholders, temperature, and inspect exact LLM payloads.
            </p>
          </div>
        </div>

        {/* Preset & Reset Actions */}
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button
            type="button"
            onClick={handleApplyQwenPreset}
            className="px-2.5 py-1.5 text-xs font-medium bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 hover:text-amber-100 border border-amber-700/60 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Load optimized prompt for Qwen 3.6 (anti-preamble rules + T=0.45)"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Qwen 3.6 Preset</span>
          </button>

          <button
            type="button"
            onClick={handleResetToDefault}
            className="px-2.5 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 border border-zinc-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Reset to factory standard prompt"
          >
            <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
            <span>Reset Default</span>
          </button>

          <button
            type="button"
            onClick={handleCopyPrompt}
            className="px-2.5 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 border border-zinc-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            {copiedPrompt ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
            <span>{copiedPrompt ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>

      {/* Dynamic Placeholder Insertion Chips */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span className="font-medium flex items-center gap-1.5">
            <Code className="w-3.5 h-3.5 text-amber-400" />
            Dynamic Template Variables:
          </span>
          <span className="text-[11px] text-zinc-500">Click any tag below to insert into prompt at cursor</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {VARIABLE_PILLS.map((v) => (
            <button
              key={v.tag}
              type="button"
              onClick={() => handleInsertVariable(v.tag)}
              className="px-2.5 py-1 rounded-lg text-xs font-mono bg-zinc-950 hover:bg-zinc-800 text-amber-300 hover:text-amber-200 border border-zinc-700 hover:border-amber-600/60 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              title={v.desc}
            >
              <span>{v.tag}</span>
              <span className="text-[10px] text-zinc-400 font-sans">({v.label})</span>
            </button>
          ))}
        </div>
      </div>

      {/* System Prompt Textarea */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <label className="font-medium text-zinc-300 flex items-center gap-1.5">
            System Prompt Template
            {activePrompt !== DEFAULT_SYSTEM_PROMPT && (
              <span className="text-[10px] text-amber-400 bg-amber-950/50 border border-amber-800/60 px-1.5 py-0.2 rounded font-normal">
                Modified
              </span>
            )}
          </label>
          <span className="text-[11px] text-zinc-500 font-mono">
            {activePrompt.length} characters
          </span>
        </div>

        <textarea
          ref={textareaRef}
          rows={10}
          value={activePrompt}
          onChange={(e) => handleUpdateConfig({ llm_custom_system_prompt: e.target.value })}
          placeholder="Enter custom system prompt directives..."
          className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-amber-500 rounded-xl p-3.5 font-mono text-xs text-zinc-200 placeholder-zinc-600 outline-none transition-colors leading-relaxed selection:bg-amber-900/40"
        />
        <p className="text-[11px] text-zinc-500">
          This system prompt instructs the LLM how to parse scene stubs and insert multimodal <span className="font-mono text-zinc-400">&lt;Picture N&gt;</span> character and scene likeness tags.
        </p>
      </div>

      {/* Sampling Parameters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 border-t border-zinc-800">
        {/* Temperature Control */}
        <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
              <span>Sampling Temperature</span>
              <span className="font-mono text-xs text-amber-400 font-semibold bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-800/40">
                {activeTemperature.toFixed(2)}
              </span>
            </label>

            {/* Quick Presets */}
            <div className="flex items-center gap-1 text-[11px]">
              <button
                type="button"
                onClick={() => handleUpdateConfig({ llm_temperature: 0.2 })}
                className={`px-1.5 py-0.5 rounded cursor-pointer border ${
                  activeTemperature === 0.2 
                    ? "bg-amber-500/20 text-amber-300 border-amber-600/50" 
                    : "text-zinc-400 hover:text-zinc-200 border-transparent hover:bg-zinc-800"
                }`}
              >
                Strict (0.2)
              </button>
              <button
                type="button"
                onClick={() => handleUpdateConfig({ llm_temperature: 0.45 })}
                className={`px-1.5 py-0.5 rounded cursor-pointer border ${
                  activeTemperature === 0.45 
                    ? "bg-amber-500/20 text-amber-300 border-amber-600/50" 
                    : "text-zinc-400 hover:text-zinc-200 border-transparent hover:bg-zinc-800"
                }`}
              >
                Qwen (0.45)
              </button>
              <button
                type="button"
                onClick={() => handleUpdateConfig({ llm_temperature: 0.7 })}
                className={`px-1.5 py-0.5 rounded cursor-pointer border ${
                  activeTemperature === 0.7 
                    ? "bg-amber-500/20 text-amber-300 border-amber-600/50" 
                    : "text-zinc-400 hover:text-zinc-200 border-transparent hover:bg-zinc-800"
                }`}
              >
                Creative (0.7)
              </button>
            </div>
          </div>

          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.05"
            value={activeTemperature}
            onChange={(e) => handleUpdateConfig({ llm_temperature: parseFloat(e.target.value) })}
            className="w-full accent-amber-400 cursor-pointer"
          />

          <div className="flex items-start gap-1.5 text-[11px] text-zinc-500">
            <Info className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
            <span>
              {activeTemperature <= 0.45 
                ? "Optimal for Qwen 3.6: Enforces camera lock-off, eliminates conversational chatter, and prevents tag hallucinations."
                : "Higher creativity: Generates varied narrative descriptions, but may occasionally drift from strict camera constraints."}
            </span>
          </div>
        </div>

        {/* Max Tokens Control */}
        <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
              <span>Max Output Tokens</span>
              <span className="font-mono text-xs text-purple-400 font-semibold bg-purple-950/50 px-2 py-0.5 rounded-md border border-purple-800/40">
                {activeMaxTokens}
              </span>
            </label>

            <div className="flex items-center gap-1 text-[11px]">
              {[500, 800, 1200].map((tok) => (
                <button
                  key={tok}
                  type="button"
                  onClick={() => handleUpdateConfig({ llm_max_tokens: tok })}
                  className={`px-1.5 py-0.5 rounded cursor-pointer border ${
                    activeMaxTokens === tok 
                      ? "bg-purple-500/20 text-purple-300 border-purple-600/50" 
                      : "text-zinc-400 hover:text-zinc-200 border-transparent hover:bg-zinc-800"
                  }`}
                >
                  {tok}
                </button>
              ))}
            </div>
          </div>

          <input
            type="range"
            min="200"
            max="2000"
            step="50"
            value={activeMaxTokens}
            onChange={(e) => handleUpdateConfig({ llm_max_tokens: parseInt(e.target.value, 10) })}
            className="w-full accent-purple-400 cursor-pointer"
          />

          <div className="flex items-start gap-1.5 text-[11px] text-zinc-500">
            <Info className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
            <span>
              Cap on generated output length. 800 tokens is sufficient for detailed Ref2VA scene blocking without timeouts.
            </span>
          </div>
        </div>
      </div>

      {/* Phase 2: Live Prompt Testing & Inspector Sandbox */}
      <div className="border border-zinc-800 rounded-xl bg-zinc-950/80 overflow-hidden">
        <div 
          className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-zinc-900/40 transition-colors"
          onClick={() => setIsTestExpanded(!isTestExpanded)}
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-zinc-200">
              Live Prompt Inspector &amp; Test Sandbox
            </span>
            <span className="text-[10px] text-zinc-500">
              (Simulate model payload &amp; verify output)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {lastDebugInfo && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowInspectorModal(true);
                }}
                className="px-2.5 py-1 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-emerald-300 border border-emerald-600/40 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Last Exchange ({lastDebugInfo.latency_ms}ms)</span>
              </button>
            )}
            <button
              type="button"
              className="text-zinc-400 hover:text-zinc-200 p-1"
            >
              {isTestExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {isTestExpanded && (
          <div className="p-3.5 pt-0 space-y-3 border-t border-zinc-800/80 mt-1">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">
                Test Scene Stub:
              </label>
              <input
                type="text"
                value={testStub}
                onChange={(e) => setTestStub(e.target.value)}
                placeholder="Enter sample scene text to test prompt..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-zinc-500">
                Sends test request to <span className="text-zinc-300 font-semibold">{activeProvider === "lm_studio" ? "Local LM Studio" : "Google Gemini"}</span> using active parameters.
              </span>

              <button
                type="button"
                onClick={handleRunTestExchange}
                disabled={isRunningTest || !testStub.trim()}
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg transition-all flex items-center gap-2 cursor-pointer shadow-xs shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRunningTest ? "animate-spin" : ""}`} />
                <span>{isRunningTest ? "Running Test..." : "Run Test & Inspect"}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Prompt Debug Modal */}
      <PromptDebugModal
        isOpen={showInspectorModal}
        onClose={() => setShowInspectorModal(false)}
        debugInfo={lastDebugInfo}
        assembledPrompt={lastAssembledPrompt}
      />
    </section>
  );
};
