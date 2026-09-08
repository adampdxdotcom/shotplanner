import React from "react";
import { Server, FileCode2, RefreshCw, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { AppConfig } from "../../types";
import { RemoteGPUConfig } from "./RemoteGPUConfig";
import { ComfyUIConfig } from "./ComfyUIConfig";
import { RemoteSSHPrimerCard } from "../RemoteSSHPrimerCard";

interface RemoteServerTabProps {
  config: AppConfig;
  handleInputChange: (field: keyof AppConfig, value: any) => void;
  onOpenCodeViewer?: () => void;
  handleTestSSH: () => void;
  testingSSH: boolean;
  testResult: { success?: boolean; message?: string } | null;
  handleGenerateKeyPair: () => void;
  isGeneratingKeyPair: boolean;
  generatedKeyPair: { public_key: string; private_key: string } | null;
  onShowToast?: (text: string, type: "success" | "error" | "info") => void;
}

export const RemoteServerTab: React.FC<RemoteServerTabProps> = ({
  config,
  handleInputChange,
  onOpenCodeViewer,
  handleTestSSH,
  testingSSH,
  testResult,
  handleGenerateKeyPair,
  isGeneratingKeyPair,
  generatedKeyPair,
  onShowToast
}) => {
  return (
    <section 
      id="panel-remote-server"
      className="w-full bg-zinc-900/60 border-2 border-zinc-700 rounded-xl p-5 shadow-sm space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Remote Server &amp; GPU Orchestration</h2>
            <p className="text-xs text-zinc-400">Configure Remote GPU SSH credentials, ComfyUI root and input paths, and API endpoints.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {onOpenCodeViewer && (
            <button
              onClick={onOpenCodeViewer}
              className="px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 hover:text-white rounded-lg border border-zinc-700 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="View Python FastAPI & Docker files"
            >
              <FileCode2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Backend &amp; Docker Code</span>
            </button>
          )}
          <button
            onClick={handleTestSSH}
            disabled={testingSSH || !config.remote_host}
            className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 border border-zinc-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testingSSH ? "animate-spin text-indigo-400" : ""}`} />
            {testingSSH ? "Testing SSH..." : "Test Remote SSH"}
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

      {/* SSH Connection Credentials */}
      <RemoteGPUConfig 
        config={config}
        handleInputChange={handleInputChange}
        handleGenerateKeyPair={handleGenerateKeyPair}
        isGeneratingKeyPair={isGeneratingKeyPair}
        generatedKeyPair={generatedKeyPair}
      />

      {/* Remote ComfyUI Paths & Endpoints */}
      <ComfyUIConfig 
        config={config}
        handleInputChange={handleInputChange}
        onShowToast={onShowToast}
      />

      {/* Informational Callout */}
      <div className="text-[11px] text-zinc-400 bg-zinc-950/40 p-3.5 rounded-lg border-2 border-zinc-700/60 flex items-center gap-2.5">
        <Info className="w-4 h-4 text-indigo-400 shrink-0" />
        <span>During execution, media assets are pushed via Paramiko SCP into <code className="text-zinc-200 bg-zinc-800 px-1.5 py-0.5 rounded font-mono">{config.remote_comfyui_root ? `${config.remote_comfyui_root.replace(/\/$/, '')}/input/` : "/workspace/remote-slim/ComfyUI/input/"}</code>, and modified JSON graphs are submitted to <code className="text-zinc-200 bg-zinc-800 px-1.5 py-0.5 rounded font-mono">/prompt</code>.</span>
      </div>

      {/* Expandable Guide Accordion nested at bottom */}
      <div id="remote-ssh-guide" className="pt-3 border-t border-zinc-800">
        <RemoteSSHPrimerCard publicKey={generatedKeyPair?.public_key || config.ssh_public_key || undefined} />
      </div>
    </section>
  );
};
