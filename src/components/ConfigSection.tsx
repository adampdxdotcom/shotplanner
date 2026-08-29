import React, { useState, useEffect } from "react";
import { AppConfig } from "../types";
import { RunPodSSHPrimerCard, CodeBlock } from "./RunPodSSHPrimerCard";
import { 
  Server, 
  Terminal, 
  Key, 
  Bot, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Info, 
  ShieldCheck, 
  Sparkles, 
  Save, 
  FileCode2,
  FolderOpen,
  HelpCircle,
  Copy,
  Check,
  Download,
  X,
  FileKey,
  Upload,
  ChevronDown,
  ChevronUp
} from "lucide-react";

interface ConfigSectionProps {
  config: AppConfig;
  onChange: (newConfig: AppConfig) => void;
  onOpenCodeViewer?: () => void;
}

export const ConfigSection: React.FC<ConfigSectionProps> = ({ config, onChange, onOpenCodeViewer }) => {
  const [testingSSH, setTestingSSH] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  // Gemini API Key state
  const [geminiKeyInput, setGeminiKeyInput] = useState("");
  const [isGeminiConfigured, setIsGeminiConfigured] = useState(false);
  const [maskedGeminiKey, setMaskedGeminiKey] = useState("");
  const [savingGemini, setSavingGemini] = useState(false);
  const [geminiFeedback, setGeminiFeedback] = useState<{ success?: boolean; message?: string } | null>(null);

  // In-App SSH Key Generator state
  const [isGeneratingKeyPair, setIsGeneratingKeyPair] = useState(false);
  const [generatedKeyPair, setGeneratedKeyPair] = useState<{ public_key: string; private_key: string } | null>(null);
  const [showPublicKeyModal, setShowPublicKeyModal] = useState(false);
  const [hasCopiedPublicKey, setHasCopiedPublicKey] = useState(false);
  const [showInlineSSHGuide, setShowInlineSSHGuide] = useState(false);

  // Check Gemini Status on mount
  useEffect(() => {
    fetch("/api/settings/gemini")
      .then(res => res.json())
      .then(data => {
        if (data.configured) {
          setIsGeminiConfigured(true);
          setMaskedGeminiKey(data.masked_key);
        }
      })
      .catch(() => {});
  }, []);

  const handleInputChange = (field: keyof AppConfig, value: any) => {
    onChange({ ...config, [field]: value });
  };

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

  const handleTestSSH = async () => {
    setTestingSSH(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/ssh/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: config.runpod_ip,
          port: config.ssh_port,
          username: config.ssh_username,
          password: config.ssh_password,
          key_path: config.ssh_key_path,
          ssh_private_key: config.ssh_private_key,
          remote_dir: config.remote_input_dir || "/workspace/runpod-slim/ComfyUI/input/"
        })
      });
      const data = await res.json();
      setTestResult(data);
    } catch (e: any) {
      setTestResult({ success: false, message: e.message });
    } finally {
      setTestingSSH(false);
    }
  };

  const handleKeyFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        handleInputChange("ssh_private_key", content);
      }
    };
    reader.readAsText(file);
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
        // Auto-populate into state/config
        handleInputChange("ssh_private_key", data.private_key);
        setGeneratedKeyPair(data);
        setShowPublicKeyModal(true);
        setHasCopiedPublicKey(false);
      }
    } catch (err: any) {
      alert("Failed to generate SSH key pair: " + (err.message || "Unknown error"));
    } finally {
      setIsGeneratingKeyPair(false);
    }
  };

  const handleCopyPublicKey = async () => {
    if (!generatedKeyPair?.public_key) return;
    try {
      await navigator.clipboard.writeText(generatedKeyPair.public_key);
      setHasCopiedPublicKey(true);
      setTimeout(() => setHasCopiedPublicKey(false), 2500);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = generatedKeyPair.public_key;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
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

  return (
    <div id="config-section" className="bg-zinc-900/60 border-2 border-zinc-700 rounded-xl p-5 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">5. Infrastructure &amp; Remote Credentials</h2>
            <p className="text-xs text-zinc-400">Configure RunPod SSH instance, ComfyUI API endpoint, and local LM Studio server.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onOpenCodeViewer && (
            <button
              onClick={onOpenCodeViewer}
              className="px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 hover:text-white rounded-lg border border-zinc-700 transition-all flex items-center gap-1.5 shadow-xs"
              title="View Python FastAPI & Docker files"
            >
              <FileCode2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Backend &amp; Docker Code</span>
            </button>
          )}
          <button
            onClick={handleTestSSH}
            disabled={testingSSH || !config.runpod_ip}
            className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 border border-zinc-700 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testingSSH ? "animate-spin text-indigo-400" : ""}`} />
            {testingSSH ? "Testing SSH..." : "Test RunPod SSH"}
          </button>
        </div>
      </div>

      {testResult && (
        <div className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
          testResult.success 
            ? "bg-emerald-950/30 border-emerald-800/40 text-emerald-300" 
            : "bg-red-950/30 border-red-800/40 text-red-300"
        }`}>
          {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />}
          <div>
            <p className="font-medium">{testResult.success ? "SSH Connection Verified" : "SSH Connection Notice"}</p>
            <p className="opacity-90 mt-0.5">{testResult.message}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* RunPod IP */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-zinc-400" />
            RunPod IP / Host
          </label>
          <input
            type="text"
            placeholder="194.26.196.xxx"
            value={config.runpod_ip}
            onChange={(e) => handleInputChange("runpod_ip", e.target.value)}
            className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
          />
        </div>

        {/* SSH Port & Username */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">SSH Port</label>
            <input
              type="number"
              placeholder="22"
              value={config.ssh_port}
              onChange={(e) => handleInputChange("ssh_port", parseInt(e.target.value) || 22)}
              className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">Username</label>
            <input
              type="text"
              placeholder="root"
              value={config.ssh_username}
              onChange={(e) => handleInputChange("ssh_username", e.target.value)}
              className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
            />
          </div>
        </div>

        {/* SSH Private Key or Password */}
        <div className="space-y-1.5 md:col-span-2 bg-zinc-950/70 border-2 border-zinc-750 p-3.5 rounded-xl">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>SSH Private Key (RunPod Required)</span>
              </label>
              {config.ssh_private_key ? (
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-mono">
                  {config.ssh_private_key.includes("ED25519") ? "Ed25519 Key Loaded" : config.ssh_private_key.includes("RSA") ? "RSA Key Loaded" : "Key Loaded"}
                </span>
              ) : null}
            </div>

            {/* In-App Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleGenerateKeyPair}
                disabled={isGeneratingKeyPair}
                className="px-2.5 py-1 text-xs font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 rounded-lg shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                title="Generate a fresh Ed25519 keypair and display the public key for RunPod"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isGeneratingKeyPair ? "animate-spin" : ""}`} />
                <span>{isGeneratingKeyPair ? "Generating..." : "Generate New Key Pair"}</span>
              </button>

              {generatedKeyPair && (
                <button
                  type="button"
                  onClick={() => setShowPublicKeyModal(true)}
                  className="px-2 py-1 text-xs text-amber-300 hover:text-amber-200 bg-amber-950/60 hover:bg-amber-900/60 border border-amber-700/50 rounded-lg font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  title="View Public Key for RunPod"
                >
                  <FileKey className="w-3 h-3 text-amber-400" />
                  <span>Public Key Tray</span>
                </button>
              )}

              <label className="cursor-pointer text-[11px] text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-2 py-1 rounded-lg font-medium flex items-center gap-1 transition-colors">
                <Upload className="w-3 h-3 text-zinc-400" />
                <span>Upload Key File</span>
                <input
                  type="file"
                  accept=".pem,.pub,.key,text/plain,id_rsa,id_ed25519"
                  onChange={handleKeyFileUpload}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() => setShowInlineSSHGuide(!showInlineSSHGuide)}
                className={`text-[11px] px-2 py-1 rounded-lg font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                  showInlineSSHGuide
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700"
                }`}
                title="Toggle inline SSH setup instructions"
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>Quick Setup</span>
                {showInlineSSHGuide ? <ChevronUp className="w-3 h-3 text-amber-400" /> : <ChevronDown className="w-3 h-3 text-zinc-400" />}
              </button>
            </div>
          </div>

          <textarea
            rows={2}
            placeholder="-----BEGIN OPENSSH PRIVATE KEY----- (or click 'Generate New Key Pair' above)"
            value={config.ssh_private_key || ""}
            onChange={(e) => handleInputChange("ssh_private_key", e.target.value)}
            className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-amber-500 rounded-lg px-3 py-1.5 text-[11px] font-mono text-zinc-100 placeholder-zinc-600 outline-none transition-colors resize-y mt-1.5"
          />

          {/* Inline Dedicated Helper Card */}
          {showInlineSSHGuide && (
            <div className="mt-2 bg-zinc-900 border-2 border-amber-600/60 rounded-xl p-4 space-y-3.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-amber-400" />
                  RunPod SSH Key Pair Quick Setup
                </h4>
                <button
                  type="button"
                  onClick={() => setShowInlineSSHGuide(false)}
                  className="text-zinc-400 hover:text-zinc-200 text-[11px] cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {/* Step 1 */}
                <div className="bg-zinc-950/80 border border-zinc-800 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold flex items-center justify-center">1</span>
                      <span className="text-xs font-semibold text-zinc-200">Step 1: Generate Key Pair</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerateKeyPair}
                      disabled={isGeneratingKeyPair}
                      className="text-[10px] text-amber-400 hover:text-amber-300 underline font-medium cursor-pointer"
                    >
                      Click "Generate New Key Pair"
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-400 pl-6">
                    Or run this generation snippet in your terminal:
                  </p>
                  <div className="pl-6">
                    <CodeBlock 
                      code={`ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_runpod -C "your_email@example.com"`}
                      label="Bash"
                    />
                  </div>
                </div>

                {/* Step 2 */}
                <div className="bg-zinc-950/80 border border-zinc-800 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold flex items-center justify-center">2</span>
                    <span className="text-xs font-semibold text-zinc-200">Step 2: Add Public Key to RunPod Account</span>
                  </div>
                  <div className="pl-6 space-y-1.5">
                    <p className="text-[11px] text-zinc-400">
                      View public key: <code className="text-amber-300 bg-zinc-800 px-1 py-0.5 rounded">cat ~/.ssh/id_ed25519_runpod.pub</code>
                    </p>
                    <div className="text-[11px] text-zinc-300 bg-zinc-900/90 border border-zinc-700/60 p-2 rounded-lg flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Destination:</strong> RunPod Console &rarr; Settings &rarr; SSH Keys &rarr; "+ Add SSH Key".
                      </span>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="bg-zinc-950/80 border-2 border-amber-900/50 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold flex items-center justify-center">3</span>
                      <span className="text-xs font-semibold text-amber-200">Step 3: Fix Permissions on Active Pod (If already running)</span>
                    </div>
                    <span className="text-[10px] text-amber-400 font-mono">Crucial</span>
                  </div>
                  <div className="pl-6 space-y-1.5">
                    <p className="text-[11px] text-zinc-400">
                      In your pod's <strong>Web Terminal</strong>, paste:
                    </p>
                    <CodeBlock 
                      code={`mkdir -p ~/.ssh && echo "YOUR_PUBLIC_KEY" >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys`}
                      label="Pod Web Terminal"
                    />
                  </div>
                </div>

                {/* Step 4 */}
                <div className="bg-zinc-950/80 border border-zinc-800 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold flex items-center justify-center">4</span>
                    <span className="text-xs font-semibold text-zinc-200">Step 4: Load Private Key into Shot Planner</span>
                  </div>
                  <div className="pl-6 space-y-1.5">
                    <p className="text-[11px] text-zinc-400">
                      Show command: <code className="text-amber-300 bg-zinc-800 px-1 py-0.5 rounded">cat ~/.ssh/id_ed25519_runpod</code>
                    </p>
                    <div className="text-[11px] text-zinc-300 bg-zinc-900/90 border border-zinc-700/60 p-2 rounded-lg flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Note:</strong> Paste the entire multi-line block (including BEGIN and END headers) into the Private Key box below, or click "Upload Key File".
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-0.5">
            <span>The private key is stored securely in your app settings for automated Paramiko authentication.</span>
            {config.ssh_private_key && (
              <button
                type="button"
                onClick={() => handleInputChange("ssh_private_key", "")}
                className="text-zinc-500 hover:text-red-400 transition-colors text-[10px] cursor-pointer"
              >
                Clear key
              </button>
            )}
          </div>
        </div>

        {/* LM Studio Local URL */}
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-amber-400" />
            Local LM Studio API URL
          </label>
          <input
            type="text"
            placeholder="http://localhost:1234/v1"
            value={config.lm_studio_url}
            onChange={(e) => handleInputChange("lm_studio_url", e.target.value)}
            className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
        {/* Remote ComfyUI Input Directory */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
            Remote ComfyUI Input Dir
          </label>
          <input
            type="text"
            placeholder="/workspace/runpod-slim/ComfyUI/input/"
            value={config.remote_input_dir || ""}
            onChange={(e) => handleInputChange("remote_input_dir", e.target.value)}
            className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-amber-500 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
          />
        </div>

        {/* ComfyUI API URL */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-emerald-400" />
            RunPod ComfyUI API URL
          </label>
          <input
            type="text"
            placeholder="http://127.0.0.1:8188 or https://pod-8188.proxy.runpod.net"
            value={config.comfyui_api_url}
            onChange={(e) => handleInputChange("comfyui_api_url", e.target.value)}
            className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
          />
        </div>

        {/* RunPod API Token (for proxy auth) */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
            RunPod API Token (Optional Proxy Auth Header)
          </label>
          <input
            type="password"
            placeholder="Bearer token if using RunPod proxy endpoint"
            value={config.runpod_api_token}
            onChange={(e) => handleInputChange("runpod_api_token", e.target.value)}
            className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
          />
        </div>
      </div>

      {/* --- New Gemini API Section --- */}
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

      <div className="text-[11px] text-zinc-400 bg-zinc-950/40 p-2.5 rounded-lg border-2 border-zinc-700/60 flex items-center gap-2">
        <Info className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
        <span>During execution, media assets are pushed via Paramiko SCP into <code className="text-zinc-200 bg-zinc-800 px-1 py-0.5 rounded">{config.remote_input_dir || "/workspace/runpod-slim/ComfyUI/input/"}</code>, and modified JSON graphs are submitted to <code className="text-zinc-200 bg-zinc-800 px-1 py-0.5 rounded">/prompt</code>.</span>
      </div>

      {/* Feature & Documentation Primer: RunPod SSH Key Setup & Configuration Card */}
      <div id="runpod-ssh-guide" className="pt-2">
        <RunPodSSHPrimerCard />
      </div>

      {/* Public Key Modal / Copy Tray */}
      {showPublicKeyModal && generatedKeyPair && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-zinc-900 border-2 border-amber-500/80 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-100">Generated Ed25519 SSH Key Pair</h3>
                  <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 rounded-full inline-block mt-0.5">
                    ✓ Private key auto-saved into app settings
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPublicKeyModal(false)}
                className="p-1 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Success Notice Box */}
            <div className="bg-amber-950/30 border border-amber-700/50 rounded-xl p-3 text-xs text-amber-300/90 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-200">Private Key Automatically Configured!</p>
                <p className="text-[11px] text-amber-300/80 mt-0.5">
                  Your new Ed25519 private key is ready in Shot Planner. Now copy this matching <strong>Public Key</strong> to your RunPod account.
                </p>
              </div>
            </div>

            {/* Public Key Display & Copy Action */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <FileKey className="w-3.5 h-3.5 text-amber-400" />
                  <span>RunPod Public Key (Single-line authorized_keys format)</span>
                </label>
                <span className="text-[10px] text-zinc-500 font-mono">Ed25519 Standard</span>
              </div>

              <div className="relative group bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
                <pre className="p-3 text-xs font-mono text-emerald-400 overflow-x-auto whitespace-pre select-all">
                  <code>{generatedKeyPair.public_key}</code>
                </pre>
              </div>
            </div>

            {/* Prominent Copy Button & Backups */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopyPublicKey}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer ${
                  hasCopiedPublicKey
                    ? "bg-emerald-600 text-white shadow-emerald-900/40"
                    : "bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-amber-900/20"
                }`}
              >
                {hasCopiedPublicKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{hasCopiedPublicKey ? "Public Key Copied to Clipboard!" : "Copy Public Key"}</span>
              </button>

              <button
                type="button"
                onClick={() => handleDownloadFile(generatedKeyPair.public_key, "id_ed25519_runpod.pub")}
                className="py-2.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Download public key file (.pub)"
              >
                <Download className="w-3.5 h-3.5 text-zinc-400" />
                <span>.pub</span>
              </button>

              <button
                type="button"
                onClick={() => handleDownloadFile(generatedKeyPair.private_key, "id_ed25519_runpod")}
                className="py-2.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Download private key file backup"
              >
                <Download className="w-3.5 h-3.5 text-zinc-400" />
                <span>.pem</span>
              </button>
            </div>

            {/* Subtext instructions */}
            <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-400 space-y-1">
              <p className="text-zinc-300 font-medium flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-indigo-400" />
                Next Step in RunPod:
              </p>
              <p className="text-[11px] leading-relaxed text-zinc-400">
                Paste this public key into your <strong>RunPod Dashboard &rarr; Settings &rarr; SSH Keys</strong> (or append it to <code className="text-amber-300 bg-zinc-800 px-1 py-0.5 rounded">~/.ssh/authorized_keys</code> on your active pod).
              </p>
            </div>

            {/* Footer Close */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowPublicKeyModal(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
