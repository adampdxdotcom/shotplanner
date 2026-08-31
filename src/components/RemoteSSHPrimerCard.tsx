import React, { useState } from "react";
import { copyToClipboard } from "../utils/clipboard";
import { 
  Key, 
  Terminal, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  ShieldAlert, 
  FileKey, 
  Lock, 
  Info,
  BookOpen,
  CloudUpload,
  AlertTriangle,
  Sparkles
} from "lucide-react";

interface CopyButtonProps {
  text: string;
}

const CopyButton: React.FC<CopyButtonProps> = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer ${
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

export const CodeBlock: React.FC<{ code: string; label?: string }> = ({ code, label = "Bash" }) => {
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

interface RemoteSSHPrimerCardProps {
  publicKey?: string;
}

export const RemoteSSHPrimerCard: React.FC<RemoteSSHPrimerCardProps> = ({ publicKey }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<"quickstart" | "concepts" | "commands" | "runpod_auth">("quickstart");

  const effectivePublicKey = publicKey?.trim() || "";
  const authCommandOneLiner = effectivePublicKey
    ? `mkdir -p ~/.ssh && echo "${effectivePublicKey}" >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys`
    : `mkdir -p ~/.ssh && echo "YOUR_PUBLIC_KEY" >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys`;

  const authCommandMultiLine = effectivePublicKey
    ? `mkdir -p ~/.ssh\necho "${effectivePublicKey}" >> ~/.ssh/authorized_keys\nchmod 700 ~/.ssh\nchmod 600 ~/.ssh/authorized_keys`
    : `mkdir -p ~/.ssh\necho "PASTE_YOUR_PUBLIC_KEY_STRING_HERE" >> ~/.ssh/authorized_keys\nchmod 700 ~/.ssh\nchmod 600 ~/.ssh/authorized_keys`;

  return (
    <div id="remote-ssh-guide-card" className="bg-zinc-900/80 border-2 border-zinc-700 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-5 py-3.5 bg-zinc-900 hover:bg-zinc-800/60 cursor-pointer flex items-center justify-between transition-colors select-none"
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Key className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-100">Remote GPU SSH Key Setup &amp; Configuration Guide</h3>
              <span className="text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                Documentation &amp; CLI Commands
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Step-by-step keypair generation, Remote GPU authorization, active pod permission fixes, and SSH concepts.
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
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab("quickstart")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "quickstart"
                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                  : "bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>4-Step Quick Setup</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("concepts")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
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
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "commands"
                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                  : "bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              <FileKey className="w-3.5 h-3.5" />
              <span>2. Key Generation Commands</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("runpod_auth")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "runpod_auth"
                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                  : "bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              <CloudUpload className="w-3.5 h-3.5" />
              <span>3. Remote GPU Upload &amp; Active Pod Fix</span>
            </button>
          </div>

          {/* TAB 1: 4-Step Quick Setup */}
          {activeTab === "quickstart" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-amber-400" />
                  Remote GPU SSH Key Pair Quick Setup
                </h4>
                <span className="text-[11px] text-zinc-400">Step-by-step instructions</span>
              </div>

              <div className="grid grid-cols-1 gap-3.5">
                {/* Step 1 */}
                <div className="bg-zinc-950/70 border border-zinc-800 rounded-lg p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center border border-amber-500/30">
                        1
                      </span>
                      <span className="text-xs font-semibold text-zinc-200">Step 1: Generate Key Pair</span>
                    </div>
                    <span className="text-[10px] text-amber-400 bg-amber-950/60 border border-amber-800/50 px-2 py-0.5 rounded-full font-medium">
                      In-App or Terminal
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 pl-7">
                    Click the <strong>"Generate New Key Pair"</strong> button above, or run this snippet in your local terminal:
                  </p>
                  <div className="pl-7">
                    <CodeBlock 
                      code={`ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_remote -C "your_email@example.com"`}
                      label="Bash (Terminal)"
                    />
                  </div>
                </div>

                {/* Step 2 */}
                <div className="bg-zinc-950/70 border border-zinc-800 rounded-lg p-3.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center border border-amber-500/30">
                      2
                    </span>
                    <span className="text-xs font-semibold text-zinc-200">Step 2: Add Public Key to Remote GPU Account</span>
                  </div>
                  <p className="text-xs text-zinc-400 pl-7">
                    View your public key string:
                  </p>
                  <div className="pl-7 space-y-2">
                    <CodeBlock 
                      code={`cat ~/.ssh/id_ed25519_remote.pub`}
                      label="Bash (Terminal)"
                    />
                    <div className="text-[11px] text-zinc-300 bg-zinc-900/90 border border-zinc-700/60 p-2.5 rounded-lg flex items-start gap-2">
                      <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-zinc-100">Destination:</strong> <strong>Remote Console &rarr; Settings &rarr; SSH Keys &rarr; "+ Add SSH Key"</strong>.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="bg-zinc-950/70 border-2 border-amber-900/40 rounded-lg p-3.5 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center border border-amber-500/30">
                        3
                      </span>
                      <span className="text-xs font-semibold text-zinc-200">Step 3: Fix Permissions on Active Pod (If already running)</span>
                    </div>
                    {effectivePublicKey ? (
                      <span className="text-[10px] text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 rounded-full font-mono">
                        ✓ Public Key Filled In
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-400 font-mono">Crucial Step</span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 pl-7">
                    In your pod's <strong>Web Terminal</strong> (via the browser connect button on the Pod card), paste:
                  </p>
                  <div className="pl-7 space-y-2">
                    <CodeBlock 
                      code={authCommandOneLiner}
                      label="Pod Web Terminal (One-liner)"
                    />
                    {!effectivePublicKey ? (
                      <p className="text-[11px] text-zinc-400 italic">
                        Replace <code className="text-amber-300 bg-zinc-800 px-1 py-0.5 rounded">YOUR_PUBLIC_KEY</code> with your single-line <code className="text-emerald-400">ssh-ed25519 AAAAC3...</code> string.
                      </p>
                    ) : (
                      <p className="text-[11px] text-emerald-400/90 font-medium">
                        Your generated public key has been inserted into this command for easy one-click copying.
                      </p>
                    )}
                  </div>
                </div>

                {/* Step 4 */}
                <div className="bg-zinc-950/70 border border-zinc-800 rounded-lg p-3.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center border border-amber-500/30">
                      4
                    </span>
                    <span className="text-xs font-semibold text-zinc-200">Step 4: Load Private Key into Shot Planner</span>
                  </div>
                  <p className="text-xs text-zinc-400 pl-7">
                    Print the private key file on your local terminal:
                  </p>
                  <div className="pl-7 space-y-2">
                    <CodeBlock 
                      code={`cat ~/.ssh/id_ed25519_remote`}
                      label="Bash (Terminal)"
                    />
                    <div className="text-[11px] text-zinc-300 bg-zinc-900/90 border border-zinc-700/60 p-2.5 rounded-lg flex items-start gap-2">
                      <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-zinc-100">Note:</strong> Paste the entire multi-line block (including <code className="text-amber-300 bg-zinc-800 px-1 py-0.5 rounded">BEGIN</code> and <code className="text-amber-300 bg-zinc-800 px-1 py-0.5 rounded">END</code> headers) into the <strong>SSH Private Key</strong> box below, or click <strong>"Upload Key File"</strong>.
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
                SSH authentication requires two complementary files:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Public Key Card */}
                <div className="bg-zinc-950/70 border-2 border-indigo-900/50 rounded-xl p-4 space-y-2.5">
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
                    This file contains a single line starting with <code className="text-indigo-300 bg-zinc-800 px-1 py-0.5 rounded font-mono">ssh-ed25519</code> or <code className="text-indigo-300 bg-zinc-800 px-1 py-0.5 rounded font-mono">ssh-rsa</code> and ending with the comment/email.
                  </p>
                  <div className="text-[11px] text-zinc-400 bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800">
                    <strong className="text-zinc-200">Where it lives:</strong> It lives in your Remote GPU account settings and gets injected into <code className="text-indigo-300 bg-zinc-800 px-1 rounded font-mono">/root/.ssh/authorized_keys</code> on your pods.
                  </div>
                </div>

                {/* Private Key Card */}
                <div className="bg-zinc-950/70 border-2 border-amber-900/50 rounded-xl p-4 space-y-2.5">
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
                    This file contains multiple lines wrapped in <code className="text-amber-300 bg-zinc-800 px-1 py-0.5 rounded font-mono">-----BEGIN OPENSSH PRIVATE KEY-----</code> (or <code className="text-amber-300 bg-zinc-800 px-1 py-0.5 rounded font-mono">RSA PRIVATE KEY</code>) and <code className="text-amber-300 bg-zinc-800 px-1 py-0.5 rounded font-mono">-----END...</code>.
                  </p>
                  <div className="text-[11px] text-zinc-400 bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800">
                    <strong className="text-zinc-200">Where it stays:</strong> It stays secret on your local machine and must be provided to Shot Planner so its Python backend (<code className="text-amber-300 font-mono">paramiko</code>) can authenticate without passwords.
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
                <span className="text-[11px] text-zinc-400">Terminal snippets</span>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                        RECOMMENDED
                      </span>
                      Ed25519 — Remote GPU Standard
                    </span>
                    <span className="text-[10px] text-zinc-400">Fast, compact &amp; secure</span>
                  </div>
                  <CodeBlock 
                    code={`ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_remote -C "user@remotegpu"`}
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
                    code={`ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa_remote -C "user@remotegpu"`}
                    label="Bash"
                  />
                  <p className="text-[11px] text-zinc-400 italic mt-1 pl-1">
                    (Press Enter twice to skip passphrase unless the app UI specifically supports passphrase inputs).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: How to Upload & Authorize the Public Key on Remote GPU */}
          {activeTab === "runpod_auth" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                  <CloudUpload className="w-3.5 h-3.5 text-amber-400" />
                  3. How to Upload &amp; Authorize the Public Key on Remote GPU
                </h4>
                <span className="text-[11px] text-zinc-400">Account Settings &amp; Active Pod Sync</span>
              </div>

              <div className="space-y-4">
                {/* 1. Copy public key */}
                <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-3.5 space-y-2">
                  <h5 className="text-xs font-bold text-zinc-200 flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] font-bold flex items-center justify-center">A</span>
                    Copy the Public Key:
                  </h5>
                  <ul className="text-xs text-zinc-300 space-y-1 pl-6 list-disc">
                    <li>
                      <strong>If generated via terminal:</strong>
                      <CodeBlock code={`cat ~/.ssh/id_ed25519_remote.pub`} label="Bash" />
                    </li>
                    <li>
                      <strong>If generated via Shot Planner's in-app button:</strong> click <strong>"Copy Public Key"</strong>.
                    </li>
                    <li className="text-zinc-400 text-[11px]">
                      (The key is a single line starting with <code className="text-emerald-400">ssh-ed25519...</code>).
                    </li>
                  </ul>
                </div>

                {/* 2. Add to account settings */}
                <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-3.5 space-y-2">
                  <h5 className="text-xs font-bold text-zinc-200 flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] font-bold flex items-center justify-center">B</span>
                    Add to Remote GPU Account Settings (For all future pods):
                  </h5>
                  <ol className="text-xs text-zinc-300 space-y-1.5 pl-6 list-decimal leading-relaxed">
                    <li>Go to the <strong>Remote Console</strong>.</li>
                    <li>Navigate to <strong>Settings</strong> (or <strong>Manage &rarr; SSH Keys</strong>).</li>
                    <li>Under <strong>SSH Public Keys</strong>, click <strong>"+ Add SSH Key"</strong>.</li>
                    <li>Give it a name, paste the public key string, and click <strong>Save</strong>.</li>
                  </ol>
                </div>

                {/* 3. Crucial on Active Pod */}
                <div className="bg-amber-950/30 border-2 border-amber-600/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-xs font-bold text-amber-200">
                        Crucial: Authorizing on an ALREADY RUNNING Pod (Avoids Authentication Failure)
                      </h5>
                      <p className="text-xs text-amber-300/90 leading-relaxed mt-1">
                        Most cloud providers inject SSH keys into containers <strong>only at pod startup</strong>. Adding a key in web settings does not sync to an active pod.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 pl-7">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <p className="text-xs text-zinc-300">
                        1. Open your running pod's <strong>Web Terminal</strong> (via the browser connect button on the Pod card).
                      </p>
                      {effectivePublicKey && (
                        <span className="text-[10px] text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 rounded-full font-mono">
                          ✓ Generated Public Key Filled In
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-300">
                      2. Run these exact commands to authorize the key and lock down file permissions:
                    </p>
                    <CodeBlock 
                      code={authCommandMultiLine}
                      label="Pod Web Terminal"
                    />
                    <div className="bg-zinc-900/90 border border-amber-700/40 rounded-lg p-2.5 text-[11px] text-amber-300/90 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        Without the <code className="text-amber-200 font-mono">chmod</code> step, SSH daemons will silently reject the key due to unsafe permissions.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Footer Notice */}
          <div className="bg-zinc-950/50 border border-zinc-800/80 rounded-xl p-3.5 text-xs text-zinc-400 flex items-center justify-between flex-wrap gap-2">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Shot Planner uses <code className="text-zinc-200 font-mono">paramiko</code> for fast direct SFTP asset transfer and workflow triggering.</span>
            </span>
            <button
              type="button"
              onClick={() => setActiveTab("quickstart")}
              className="text-amber-400 hover:text-amber-300 text-xs font-semibold cursor-pointer underline"
            >
              View Quick Setup Steps &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
