import React from "react";
import { Server } from "lucide-react";
import { AppConfig } from "../../types";
import { RemoteGPUConfig } from "./RemoteGPUConfig";

interface RemoteServerTabProps {
  config: AppConfig;
  handleInputChange: (field: keyof AppConfig, value: any) => void;
  handleTestSSH?: () => void;
  testingSSH?: boolean;
  testResult?: { success?: boolean; message?: string } | null;
  handleGenerateKeyPair: () => void;
  isGeneratingKeyPair: boolean;
  generatedKeyPair: { public_key: string; private_key: string } | null;
  onShowToast?: (text: string, type: "success" | "error" | "info") => void;
}

export const RemoteServerTab: React.FC<RemoteServerTabProps> = ({
  config,
  handleInputChange,
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
      </div>

      {/* SSH Connection Credentials & Manual Settings Accordion */}
      <RemoteGPUConfig 
        config={config}
        handleInputChange={handleInputChange}
        handleGenerateKeyPair={handleGenerateKeyPair}
        isGeneratingKeyPair={isGeneratingKeyPair}
        generatedKeyPair={generatedKeyPair}
        onShowToast={onShowToast}
      />
    </section>
  );
};
