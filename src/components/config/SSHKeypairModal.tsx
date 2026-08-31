import React from "react";
import { X, CheckCircle2, Copy, FileKey, Check, Download, Info } from "lucide-react";

export interface SSHKeypairModalProps {
  showPublicKeyModal: boolean;
  generatedKeyPair: { public_key: string; private_key: string } | null;
  hasCopiedPublicKey: boolean;
  onCopyPublicKey: () => void;
  onDownloadFile: (content: string, filename: string) => void;
  onClose: () => void;
}

export const SSHKeypairModal: React.FC<SSHKeypairModalProps> = ({
  showPublicKeyModal,
  generatedKeyPair,
  hasCopiedPublicKey,
  onCopyPublicKey,
  onDownloadFile,
  onClose
}) => {
  if (!showPublicKeyModal || !generatedKeyPair) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">SSH Keypair Generated</h3>
              <p className="text-xs text-zinc-400">Ed25519 key successfully created for Remote GPU access.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-white rounded-md hover:bg-zinc-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5">
          {/* Success Notice Box */}
          <div className="bg-emerald-950/20 border border-emerald-900/50 rounded-lg p-3.5 flex gap-3 text-emerald-400">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed text-emerald-200/90">
              The <strong>Private Key</strong> has automatically been saved to your configuration. 
              You must now copy the <strong>Public Key</strong> below and append it to your remote GPU's 
              <code className="px-1.5 py-0.5 mx-1 bg-emerald-950 border border-emerald-800 rounded font-mono text-[10px]">~/.ssh/authorized_keys</code> file.
            </div>
          </div>

          {/* Public Key Display & Copy Action */}
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <FileKey className="w-3.5 h-3.5 text-indigo-400" />
                Your New Public Key
              </label>
              <span className="text-[10px] text-zinc-500 font-mono">id_ed25519.pub</span>
            </div>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-lg blur opacity-50 group-hover:opacity-100 transition-opacity"></div>
              <textarea 
                readOnly
                value={generatedKeyPair.public_key}
                className="relative w-full h-24 bg-zinc-950 border border-zinc-700/80 rounded-lg p-3 text-[11px] font-mono text-zinc-300 resize-none outline-none focus:border-indigo-500/50 shadow-inner"
              />
            </div>
          </div>

          {/* Prominent Copy Button & Backups */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={onCopyPublicKey}
              className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-sm
                ${hasCopiedPublicKey 
                  ? "bg-emerald-600 text-white border border-emerald-500" 
                  : "bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500"
                }
              `}
            >
              {hasCopiedPublicKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {hasCopiedPublicKey ? "Copied to Clipboard!" : "Copy Public Key"}
            </button>
            <button
              onClick={() => onDownloadFile(generatedKeyPair.private_key, "id_ed25519")}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
              title="Download the private key as a backup file"
            >
              <Download className="w-3.5 h-3.5" />
              Backup Private Key
            </button>
          </div>

          {/* Running Pod One-Liner Quick Fix Box */}
          <div className="pt-4 border-t border-zinc-800/80 space-y-2">
            <h4 className="text-xs font-medium text-zinc-400">Quick Setup for RunPod / Vast.ai</h4>
            <div className="bg-black/60 border border-zinc-800 rounded-lg p-2.5">
              <code className="text-[10px] text-zinc-400 font-mono break-all leading-relaxed">
                <span className="text-indigo-400">echo</span> "{generatedKeyPair.public_key.trim()}" <span className="text-purple-400">&gt;&gt;</span> ~/.ssh/authorized_keys
              </code>
            </div>
            <p className="text-[10px] text-zinc-500">
              Run this command in your remote instance's web terminal to instantly authorize this key.
            </p>
          </div>
        </div>

        {/* Footer Close */}
        <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex justify-end">
          <button 
            onClick={onClose}
            className="px-5 py-2 bg-zinc-100 hover:bg-white text-zinc-900 rounded-lg text-xs font-semibold transition-colors"
          >
            I've Added the Key - Close
          </button>
        </div>
      </div>
    </div>
  );
};
