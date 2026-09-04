import React from "react";
import { CivitaiModelMetadata } from "../../../types";
import { ModelDestinationConfigGrid } from "./ModelDestinationConfigGrid";
import { 
  Layers, 
  Star, 
  FileCode, 
  Sparkles, 
  CheckCircle2, 
  Copy, 
  Check, 
  FileText, 
  Terminal, 
  RefreshCw, 
  DownloadCloud 
} from "lucide-react";

export interface CivitaiModelCardProps {
  civitaiMetadata: CivitaiModelMetadata;
  selectedVersionId: number | null;
  onSelectVersion: (versionId: number) => void;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  copiedTriggerWord: string | null;
  onCopyTriggerWord: (word: string) => void;
  onCopyAllTriggerWords: () => void;
  categoryPreset: string;
  onCategoryChange: (presetId: string) => void;
  targetDest: string;
  onTargetDestChange: (dest: string) => void;
  targetFilename: string;
  onTargetFilenameChange: (filename: string) => void;
  remoteComfyRoot?: string;
  copiedCmd: boolean;
  onCopyCommand: () => void;
  downloading: boolean;
  downloadElapsed: number;
  remoteHostConfigured: boolean;
  onIngest: () => void;
}

export const CivitaiModelCard: React.FC<CivitaiModelCardProps> = ({
  civitaiMetadata,
  selectedVersionId,
  onSelectVersion,
  isFavorited,
  onToggleFavorite,
  copiedTriggerWord,
  onCopyTriggerWord,
  onCopyAllTriggerWords,
  categoryPreset,
  onCategoryChange,
  targetDest,
  onTargetDestChange,
  targetFilename,
  onTargetFilenameChange,
  remoteComfyRoot,
  copiedCmd,
  onCopyCommand,
  downloading,
  downloadElapsed,
  remoteHostConfigured,
  onIngest
}) => {
  const triggerWords = civitaiMetadata.trained_words || civitaiMetadata.trainedWords || [];

  return (
    <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-5 shadow-lg space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-neutral-800 pb-4">
        <div className="flex items-start gap-4">
          {civitaiMetadata.preview_image_url ? (
            <img
              src={civitaiMetadata.preview_image_url}
              alt={civitaiMetadata.model_name}
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-lg object-cover border border-neutral-700 shrink-0 bg-neutral-950"
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-center text-neutral-500 shrink-0">
              <Layers className="w-6 h-6" />
            </div>
          )}

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-base font-bold text-white">
                {civitaiMetadata.model_name}
              </h4>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {civitaiMetadata.category}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-800 text-neutral-300 border border-neutral-700">
                {civitaiMetadata.base_model}
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Version: <span className="font-semibold text-neutral-300">{civitaiMetadata.version_name}</span> (ID: {civitaiMetadata.version_id})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap self-start">
          {/* Favorite Toggle Button */}
          <button
            id="btn-toggle-favorite-civitai"
            type="button"
            onClick={onToggleFavorite}
            title={isFavorited ? "Remove model from saved favorites" : "Save model to favorites"}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer shadow-xs ${
              isFavorited
                ? "bg-amber-950/70 hover:bg-amber-900/80 border-amber-500/80 text-amber-300 ring-1 ring-amber-500/30"
                : "bg-neutral-800 hover:bg-neutral-750 border-neutral-700 text-neutral-300 hover:text-amber-300"
            }`}
          >
            <Star
              className={`w-3.5 h-3.5 ${
                isFavorited ? "text-amber-400 fill-amber-400" : "text-neutral-400"
              }`}
            />
            <span>{isFavorited ? "★ Favorited" : "⭐ Favorite"}</span>
          </button>

          <div className="bg-neutral-950 px-3 py-1.5 rounded-lg border border-neutral-800 text-right">
            <span className="text-[10px] text-neutral-400 block font-medium">Model Size</span>
            <span className="text-xs font-mono font-bold text-blue-300">
              {civitaiMetadata.file_size_formatted}
            </span>
          </div>
        </div>
      </div>

      {/* Version Selector if multiple versions exist */}
      {civitaiMetadata.versions && civitaiMetadata.versions.length > 1 && (
        <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-lg p-3.5 space-y-2">
          <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
            <FileCode className="w-3.5 h-3.5 text-blue-400" />
            Select Model Version
          </label>
          <select
            value={selectedVersionId || civitaiMetadata.version_id}
            onChange={(e) => {
              const vid = parseInt(e.target.value, 10);
              onSelectVersion(vid);
            }}
            className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 text-xs rounded-lg px-3 py-2 outline-none focus:border-blue-500 font-mono"
          >
            {civitaiMetadata.versions.map((ver) => (
              <option key={ver.id} value={ver.id}>
                {ver.name} {ver.baseModel ? `(${ver.baseModel})` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Trained Trigger Words Section */}
      {triggerWords.length > 0 && (
        <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-lg p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Trained Trigger Words</span>
              <span className="text-[10px] font-mono bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded-full">
                {triggerWords.length}
              </span>
            </div>
            <button
              type="button"
              onClick={onCopyAllTriggerWords}
              className="text-[11px] font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-blue-950/40 hover:bg-blue-900/50 px-2.5 py-1 rounded border border-blue-800/50 transition-colors cursor-pointer"
            >
              {copiedTriggerWord === "__ALL__" ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-300 font-semibold">Copied All</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy All</span>
                </>
              )}
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
            {triggerWords.map((word, idx) => {
              const isCopied = copiedTriggerWord === word;
              return (
                <button
                  key={`${word}-${idx}`}
                  type="button"
                  onClick={() => onCopyTriggerWord(word)}
                  title="Click to copy trigger word"
                  className={`text-xs px-2.5 py-1 rounded-md border font-mono flex items-center gap-1.5 transition-all text-left group active:scale-95 cursor-pointer ${
                    isCopied
                      ? "bg-emerald-950/60 border-emerald-700 text-emerald-300"
                      : "bg-blue-950/30 hover:bg-blue-900/40 border-blue-800/40 hover:border-blue-700 text-blue-200"
                  }`}
                >
                  {isCopied ? (
                    <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                  ) : (
                    <Copy className="w-3 h-3 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  )}
                  <span className="truncate max-w-[280px]">{word}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Description & Release Notes Section */}
      {(civitaiMetadata.clean_description || civitaiMetadata.description) && (
        <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-lg p-3.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
              <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>Model Description & Release Notes</span>
            </div>
            <span className="text-[10px] text-neutral-500 font-mono">Civitai API</span>
          </div>
          <div className="text-xs text-neutral-300/90 leading-relaxed font-sans whitespace-pre-wrap max-h-36 overflow-y-auto bg-neutral-900/60 p-2.5 rounded border border-neutral-800/60 select-text">
            {civitaiMetadata.clean_description || civitaiMetadata.description}
          </div>
        </div>
      )}

      {/* Shared Destination Configuration Grid */}
      <ModelDestinationConfigGrid
        categoryPreset={categoryPreset}
        onCategoryChange={onCategoryChange}
        targetDest={targetDest}
        onTargetDestChange={onTargetDestChange}
        targetFilename={targetFilename}
        onTargetFilenameChange={onTargetFilenameChange}
        remoteComfyRoot={remoteComfyRoot}
        accentColor="blue"
      />

      {/* Download CTA & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="text-xs text-neutral-400">
          <span>Method: </span>
          <span className="font-mono text-neutral-300">curl (resumable stream)</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="btn-copy-civitai-command"
            type="button"
            onClick={onCopyCommand}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 hover:text-white font-semibold text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            {copiedCmd ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-300 font-bold">Command Copied!</span>
              </>
            ) : (
              <>
                <Terminal className="w-4 h-4 text-blue-400" />
                <span>Copy Download Command</span>
              </>
            )}
          </button>

          <button
            id="btn-download-civitai-model"
            type="button"
            onClick={onIngest}
            disabled={downloading || !remoteHostConfigured}
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs disabled:opacity-50 transition-all shadow-md shrink-0 active:scale-95 cursor-pointer"
          >
            {downloading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Ingesting Model ({downloadElapsed}s)...</span>
              </>
            ) : (
              <>
                <DownloadCloud className="w-4 h-4" />
                <span>Ingest to Remote ComfyUI</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
