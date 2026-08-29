import React, { useState } from "react";
import { 
  Key, 
  Terminal, 
  Copy, 
  Check, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  ShieldAlert, 
  FileKey, 
  Lock, 
  Info,
  BookOpen
} from "lucide-react";

interface CopyButtonProps {
  text: string;
}

const CopyButton: React.FC<CopyButtonProps> = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API unavailable
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-all ${
        copied 
          ? "bg-emerald-950/80 text-emerald-300 border border-emerald-700/50" 
          : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700"
      }`}
      title="Copy command to clipboard"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      <span>{copied ? "Copied!" : "Copy"}</span>
    </button>
  );
};

const CodeBlock: React.FC<{ code: string; label?: string }> = ({ code, label = "Bash" }) => {
  return (
    <div className="relative group bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden my-1.5">
      <div className="flex items-center justify-between px-3 py-1 bg-zinc-900/80 border-b border-zinc-800/80 text-[10px] font-mono text-zinc-400">
        <span>{label}</span>
        <CopyButton text={code} />
      </div>
      <pre className="p-3 text-xs font-mono text-emerald-400 overflow-x-auto whitespace-pre select-all">
        <code>{code}</code>
      </pre>
    </div>
  );
};

export const RunPodSSHPrimerCard: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<"quickstart" | "concepts" | "commands">("quickstart");

  return (
    <div className="bg-zinc-900/70 border-2 border-zinc-700 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-5 py-3.5 bg-zinc-900/90 hover:bg-zinc-800/60 cursor-pointer flex items-center justify-between transition-colors select-none"
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Key className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-100">RunPod SSH Key Setup &amp; Configuration Guide</h3>
              <span className="text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                Documentation &amp; CLI Commands
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Complete setup primer, keypair generation instructions, and copyable terminal snippets for RunPod authentication.
            </p>
          </div>
        </div>

        <button 
          type="button"
          className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expandable Body */}
      {isExpanded && (
        <div className="p-5 border-t border-zinc-800 space-y-5">
          {/* Sub-Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
            <button
              type="button"
              onClick={() => setActiveTab("quickstart")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === "quickstart"
                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                  : "bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>3-Step Quick Setup</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("concepts")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === "concepts"
                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                  : "bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>1. The Key Pair Concept</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("commands")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === "commands"
                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                  : "bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              <FileKey className="w-3.5 h-3.5" />
              <span>2. Key Generation Commands</span>
            </button>
          </div>

          {/* TAB 1: 3-Step Quick Setup */}
          {activeTab === "quickstart" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-amber-400" />
                  RunPod SSH Key Pair Quick Setup
                </h4>
                <span className="text-[11px] text-zinc-400">Step-by-step terminal instructions</span>
              </div>

              <div className="grid grid-cols-1 gap-3.5">
                {/* Step 1 */}
                <div className="bg-zinc-950/60 border border-zinc-800 rounded-lg p-3.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center border border-amber-500/30">
                      1
                    </span>
                    <span className="text-xs font-semibold text-zinc-200">Step 1: Generate on Local Terminal</span>
                  </div>
                  <p className="text-xs text-zinc-400 pl-7">
                    Run this command on your local machine to create a dedicated Ed25519 key pair:
                  </p>
                  <div className="pl-7">
                    <CodeBlock 
                      code={`ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_runpod -C "your_email@example.com"`}
                      label="Bash (Terminal)"
                    />
                  </div>
                </div>

                {/* Step 2 */}
                <div className="bg-zinc-950/60 border border-zinc-800 rounded-lg p-3.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center border border-amber-500/30">
                      2
                    </span>
                    <span className="text-xs font-semibold text-zinc-200">Step 2: Add Public Key to RunPod</span>
                  </div>
                  <p className="text-xs text-zinc-400 pl-7">
                    Print and copy your public key (.pub):
                  </p>
                  <div className="pl-7">
                    <CodeBlock 
                      code={`cat ~/.ssh/id_ed25519_runpod.pub`}
                      label="Bash (Terminal)"
                    />
                    <div className="mt-2 text-[11px] text-zinc-300 bg-zinc-900/90 border border-zinc-700/60 p-2.5 rounded-lg flex items-start gap-2">
                      <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-zinc-100">Action:</strong> Paste this single line into your <strong>RunPod Dashboard &rarr; Settings &rarr; SSH Keys</strong>.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="bg-zinc-950/60 border border-zinc-800 rounded-lg p-3.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center border border-amber-500/30">
                      3
                    </span>
                    <span className="text-xs font-semibold text-zinc-200">Step 3: Load Private Key into Shot Planner</span>
                  </div>
                  <p className="text-xs text-zinc-400 pl-7">
                    Print the private key to paste or upload into this Config section:
                  </p>
                  <div className="pl-7">
                    <CodeBlock 
                      code={`cat ~/.ssh/id_ed25519_runpod`}
                      label="Bash (Terminal)"
                    />
                    <div className="mt-2 text-[11px] text-zinc-300 bg-zinc-900/90 border border-zinc-700/60 p-2.5 rounded-lg flex items-start gap-2">
                      <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-zinc-100">Action:</strong> Paste the entire multi-line block (including <code className="text-amber-300 bg-zinc-800 px-1 py-0.5 rounded">BEGIN</code> and <code className="text-amber-300 bg-zinc-800 px-1 py-0.5 rounded">END</code> headers) into the <strong>SSH Private Key</strong> field in the form, or click <strong>"Upload Key File"</strong>.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: The Key Pair Concept */}
          {activeTab === "concepts" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-indigo-400" />
                  1. The Key Pair Concept (Why Two Keys?)
                </h4>
                <span className="text-[11px] text-zinc-400">Asymmetric SSH Cryptography</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                SSH authentication requires two complementary files that work together to guarantee secure, passwordless access:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Public Key Card */}
                <div className="bg-zinc-950/70 border-2 border-indigo-900/50 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-indigo-500/15 text-indigo-400">
                      <FileKey className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-zinc-100">The Public Key (.pub)</h5>
                      <span className="text-[10px] text-indigo-400 font-mono">The "Lock"</span>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    This file contains a single line starting with <code className="text-indigo-300 bg-zinc-800 px-1 py-0.5 rounded">ssh-ed25519</code> or <code className="text-indigo-300 bg-zinc-800 px-1 py-0.5 rounded">ssh-rsa</code> and ending with the comment/email.
                  </p>
                  <div className="text-[11px] text-zinc-400 bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800">
                    <strong className="text-zinc-200">Where it lives:</strong> It is added to your RunPod account settings and automatically injected into <code className="text-zinc-300 bg-zinc-800 px-1 rounded">/root/.ssh/authorized_keys</code> on the pod when it is provisioned.
                  </div>
                </div>

                {/* Private Key Card */}
                <div className="bg-zinc-950/70 border-2 border-amber-900/50 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-amber-500/15 text-amber-400">
                      <Key className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-zinc-100">The Private Key</h5>
                      <span className="text-[10px] text-amber-400 font-mono">The "Key"</span>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    This file contains multiple lines wrapped in <code className="text-amber-300 bg-zinc-800 px-1 py-0.5 rounded">-----BEGIN OPENSSH PRIVATE KEY-----</code> (or RSA PRIVATE KEY) and <code className="text-amber-300 bg-zinc-800 px-1 py-0.5 rounded">-----END...</code>.
                  </p>
                  <div className="text-[11px] text-zinc-400 bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800">
                    <strong className="text-zinc-200">Where it stays:</strong> It stays secret on the local client machine and must be provided to Shot Planner so its Python backend (paramiko) can authenticate without passwords.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Step-by-Step Key Generation Commands */}
          {activeTab === "commands" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  2. Step-by-Step Key Generation Commands
                </h4>
                <span className="text-[11px] text-zinc-400">Standard terminal commands</span>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                        RECOMMENDED
                      </span>
                      Ed25519 — RunPod Standard
                    </span>
                    <span className="text-[10px] text-zinc-400">Fast, compact &amp; secure</span>
                  </div>
                  <CodeBlock 
                    code={`ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_runpod -C "user@runpod"`}
                    label="Bash"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] font-medium border border-zinc-700">
                        ALTERNATIVE
                      </span>
                      Standard RSA 4096-bit
                    </span>
                    <span className="text-[10px] text-zinc-400">Legacy compatibility</span>
                  </div>
                  <CodeBlock 
                    code={`ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa_runpod -C "user@runpod"`}
                    label="Bash"
                  />
                  <p className="text-[11px] text-zinc-400 italic mt-1 pl-1">
                    (Press Enter twice to skip passphrase unless the app UI specifically supports passphrase inputs).
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div>
                    <span className="text-xs font-semibold text-zinc-200 block mb-1">
                      Get the Public Key (to paste into RunPod Account Settings):
                    </span>
                    <CodeBlock 
                      code={`cat ~/.ssh/id_ed25519_runpod.pub`}
                      label="Bash"
                    />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-zinc-200 block mb-1">
                      Get the Private Key (to paste/upload into Shot Planner UI):
                    </span>
                    <CodeBlock 
                      code={`cat ~/.ssh/id_ed25519_runpod`}
                      label="Bash"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Important Callout / Notice */}
          <div className="bg-amber-950/25 border-2 border-amber-700/40 rounded-xl p-4 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h5 className="text-xs font-bold text-amber-200 flex items-center gap-2">
                Important Callout / Notice on Existing Pods
              </h5>
              <p className="text-xs text-amber-300/90 leading-relaxed">
                RunPod injects public keys into <code className="bg-zinc-900/90 text-amber-200 px-1.5 py-0.5 rounded border border-amber-700/50 font-mono">~/.ssh/authorized_keys</code> <strong>only when a pod is created</strong>. If your pod was launched before adding the public key to RunPod, restart the pod or append the public key manually via the pod's Web Terminal.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
