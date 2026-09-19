import React from "react";
import { Server, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { AppConfig } from "../../types";
import { RemoteGPUConfig } from "./RemoteGPUConfig";

interface RemoteServerTabProps {
  config: AppConfig;
  handleInputChange: (field: keyof AppConfig, value: any) => void;
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
      className="w-full bg-white dark:bg-zinc-900/60 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl p-5 shadow-xs space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 shrink-0">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Remote Server &amp; GPU Orchestration</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Configure Remote GPU SSH credentials, ComfyUI root and input paths, and API endpoints.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button
            onClick={handleTestSSH}
            disabled={testingSSH || !config.remote_host}
            className="px-3 py-1.5 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 disabled:opacity-50 dark:text-zinc-200 border dark:border-zinc-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testingSSH ? "animate-spin text-indigo-600 dark:text-indigo-400" : ""}`} />
            {testingSSH ? "Testing SSH..." : "Test Remote SSH"}
          </button>
        </div>
      </div>

      {testResult && (
        <div className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
          testResult.success 
            ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-300" 
            : "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800/40 text-red-900 dark:text-red-300"
        }`}>
          {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />}
          <div>
            <p className="font-medium">{testResult.success ? "SSH Connection Verified" : "SSH Connection Notice"}</p>
            <p className="opacity-90 mt-0.5">{testResult.message}</p>
          </div>
        </div>
      )}

      {/* SSH Connection Credentials & Manual Settings Accordion */}
      <RemoteGPUConfig 
        config={config}
        handleInputChange={handleInputChange}
        handleGenerateKeyPair={handleGenerateKeyPair}
        isGeneratingKeyPair={isGeneratingKeyPair}
        generatedKeyPair={generatedKeyPair}
        onShowToast={onShowToast}
        handleTestSSH={handleTestSSH}
      />
    </section>
  );
};
