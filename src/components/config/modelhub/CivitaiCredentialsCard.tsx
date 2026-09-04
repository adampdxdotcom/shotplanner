import React from "react";
import { Key, ExternalLink, Save, Trash2, CheckCircle2, AlertCircle } from "lucide-react";

export interface CivitaiCredentialsCardProps {
  civitaiConfigured: boolean;
  civitaiMaskedKey: string;
  civitaiKeyInput: string;
  setCivitaiKeyInput: (val: string) => void;
  savingCivitaiKey: boolean;
  onSaveKey: () => void;
  onClearKey: () => void;
  tokenFeedback: { success?: boolean; message?: string } | null;
}

export const CivitaiCredentialsCard: React.FC<CivitaiCredentialsCardProps> = ({
  civitaiConfigured,
  civitaiMaskedKey,
  civitaiKeyInput,
  setCivitaiKeyInput,
  savingCivitaiKey,
  onSaveKey,
  onClearKey,
  tokenFeedback
}) => {
  return (
    <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-neutral-200 uppercase tracking-wider">
            Civitai API Key (Required for authenticated/NSFW/creator weights)
          </span>
        </div>
        <a
          href="https://civitai.com/user/account"
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-blue-400/90 hover:text-blue-300 flex items-center gap-1 transition-colors"
        >
          <span>Get Civitai API Key</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1">
          <input
            id="input-civitai-key"
            type="password"
            placeholder={civitaiConfigured ? `Configured (${civitaiMaskedKey})` : "Enter Civitai API Key"}
            value={civitaiKeyInput}
            onChange={(e) => setCivitaiKeyInput(e.target.value)}
            className="w-full bg-neutral-950/80 border border-neutral-700/70 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-neutral-200 placeholder-neutral-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-save-civitai-key"
            type="button"
            onClick={onSaveKey}
            disabled={savingCivitaiKey || !civitaiKeyInput.trim()}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs disabled:opacity-50 transition-colors shrink-0 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            {savingCivitaiKey ? "Saving..." : "Save Key"}
          </button>

          {civitaiConfigured && (
            <button
              id="btn-clear-civitai-key"
              type="button"
              onClick={onClearKey}
              disabled={savingCivitaiKey}
              className="p-2 rounded-lg bg-neutral-800 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 border border-neutral-700 transition-colors cursor-pointer"
              title="Clear Key"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {tokenFeedback && (
        <div className={`mt-2 flex items-center gap-1.5 text-xs ${tokenFeedback.success ? "text-emerald-400" : "text-red-400"}`}>
          {tokenFeedback.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
          <span>{tokenFeedback.message}</span>
        </div>
      )}
    </div>
  );
};
