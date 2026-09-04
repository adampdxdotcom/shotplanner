import React from "react";
import { Key, CheckCircle2, ExternalLink, Save, Trash2, AlertCircle } from "lucide-react";

export interface CivitaiCredentialsCardProps {
  apiKeyInput: string;
  setApiKeyInput: (val: string) => void;
  isConfigured: boolean;
  maskedKey: string;
  savingKey: boolean;
  tokenFeedback: { success?: boolean; message?: string } | null;
  onSaveApiKey: () => void;
  onClearApiKey: () => void;
}

export const CivitaiCredentialsCard: React.FC<CivitaiCredentialsCardProps> = ({
  apiKeyInput,
  setApiKeyInput,
  isConfigured,
  maskedKey,
  savingKey,
  tokenFeedback,
  onSaveApiKey,
  onClearApiKey
}) => {
  return (
    <div className="bg-zinc-950/50 border border-zinc-800/80 rounded-xl p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
          <Key className="w-3.5 h-3.5 text-cyan-400" />
          <span>Civitai API Token</span>
          <span className="text-[10px] text-zinc-500 font-normal">
            (Optional for public models, required for gated/early-access models)
          </span>
        </label>

        <div className="flex items-center gap-2">
          {isConfigured && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-300 bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 rounded-md">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>
                Token Active: <code className="text-emerald-200">{maskedKey}</code>
              </span>
            </span>
          )}
          <a
            href="https://civitai.com/user/account"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1"
          >
            <span>Get Civitai API Key</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <input
          id="input-civitai-standalone-key"
          type="password"
          placeholder={isConfigured ? "Enter new API token to update..." : "Paste your Civitai API Token..."}
          value={apiKeyInput}
          onChange={(e) => setApiKeyInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSaveApiKey();
            }
          }}
          className="flex-1 bg-zinc-900 border border-zinc-700 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
        />
        <button
          id="btn-save-civitai-standalone-key"
          type="button"
          onClick={onSaveApiKey}
          disabled={savingKey || !apiKeyInput.trim()}
          className="px-3.5 py-2 text-xs font-medium bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
        >
          <Save className={`w-3.5 h-3.5 ${savingKey ? "animate-spin" : ""}`} />
          <span>{savingKey ? "Saving..." : "Save Token"}</span>
        </button>
        {isConfigured && (
          <button
            id="btn-clear-civitai-standalone-key"
            type="button"
            onClick={onClearApiKey}
            title="Remove Civitai token"
            className="px-2.5 py-2 text-xs font-medium bg-zinc-800 hover:bg-red-950/40 text-zinc-400 hover:text-red-300 border border-zinc-700 hover:border-red-800/50 rounded-lg transition-colors flex items-center justify-center cursor-pointer shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {tokenFeedback && (
        <div
          className={`p-2 rounded-lg border text-xs flex items-center gap-2 ${
            tokenFeedback.success
              ? "bg-emerald-950/30 border-emerald-800/40 text-emerald-300"
              : "bg-red-950/30 border-red-800/40 text-red-300"
          }`}
        >
          {tokenFeedback.success ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          )}
          <span>{tokenFeedback.message}</span>
        </div>
      )}
    </div>
  );
};
