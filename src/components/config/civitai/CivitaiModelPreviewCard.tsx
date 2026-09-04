import React from "react";
import { 
  Layers, 
  Star, 
  HardDrive, 
  Sparkles, 
  Copy, 
  CheckCircle2, 
  Check, 
  FileText 
} from "lucide-react";
import { CivitaiModelMetadata, CivitaiModelVersionOption } from "../../../types";

export interface CivitaiModelPreviewCardProps {
  modelMetadata: CivitaiModelMetadata;
  selectedVersionId: number | null;
  onSelectVersion: (version: CivitaiModelVersionOption) => void;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  copiedTriggerWord: string | null;
  onCopyTriggerWord: (word: string) => void;
  onCopyAllTriggerWords: () => void;
}

export const CivitaiModelPreviewCard: React.FC<CivitaiModelPreviewCardProps> = ({
  modelMetadata,
  selectedVersionId,
  onSelectVersion,
  isFavorited,
  onToggleFavorite,
  copiedTriggerWord,
  onCopyTriggerWord,
  onCopyAllTriggerWords
}) => {
  const triggerWords = modelMetadata.trained_words || modelMetadata.trainedWords || [];
  const description = modelMetadata.clean_description || modelMetadata.description;

  return (
    <div className="space-y-4">
      {/* Top Details & Artwork */}
      <div className="flex flex-col md:flex-row items-start gap-4">
        {/* Cover Preview Image */}
        <div className="w-full md:w-36 h-36 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 shrink-0 flex items-center justify-center relative">
          {modelMetadata.preview_image_url ? (
            <img
              src={modelMetadata.preview_image_url}
              alt={modelMetadata.model_name}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="text-zinc-600 flex flex-col items-center gap-1 text-[10px]">
              <Layers className="w-8 h-8 opacity-40" />
              <span>No Preview</span>
            </div>
          )}
          <span className="absolute bottom-1.5 left-1.5 bg-black/80 backdrop-blur-xs text-[10px] font-bold text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/30">
            {modelMetadata.category}
          </span>
        </div>

        {/* Metadata Details */}
        <div className="flex-1 space-y-2.5 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-zinc-100 truncate" title={modelMetadata.model_name}>
              {modelMetadata.model_name}
            </h3>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {/* Prominent Favorite Toggle Button */}
              <button
                id="btn-toggle-favorite-standalone"
                type="button"
                onClick={onToggleFavorite}
                title={isFavorited ? "Remove model from saved favorites" : "Save model to favorites"}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md border text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                  isFavorited
                    ? "bg-amber-950/70 hover:bg-amber-900/80 border-amber-500/80 text-amber-300 ring-1 ring-amber-500/30"
                    : "bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300 hover:text-amber-300"
                }`}
              >
                <Star
                  className={`w-3.5 h-3.5 ${
                    isFavorited ? "text-amber-400 fill-amber-400" : "text-zinc-400"
                  }`}
                />
                <span>{isFavorited ? "★ Favorited" : "⭐ Favorite"}</span>
              </button>

              <span className="text-[11px] font-semibold text-purple-300 bg-purple-950/60 border border-purple-800/50 px-2 py-0.5 rounded-md">
                {modelMetadata.base_model}
              </span>
              <span className="text-[11px] font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 rounded-md flex items-center gap-1">
                <HardDrive className="w-3 h-3" />
                {modelMetadata.file_size_formatted}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <span>
              Version: <strong className="text-zinc-200">{modelMetadata.version_name}</strong>
            </span>
            <span>•</span>
            <span>
              File: <code className="text-zinc-300 bg-zinc-900 px-1.5 py-0.5 rounded text-[11px]">{modelMetadata.filename}</code>
            </span>
          </div>

          {/* Available Versions Picker if multiple */}
          {modelMetadata.versions && modelMetadata.versions.length > 1 && (
            <div className="pt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-zinc-400">Available Versions:</span>
              {modelMetadata.versions.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onSelectVersion(v)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors cursor-pointer ${
                    v.id === selectedVersionId
                      ? "bg-cyan-500/20 text-cyan-200 border-cyan-500/60"
                      : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  {v.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Trained Trigger Words Section */}
      {triggerWords.length > 0 && (
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Trained Trigger Words</span>
              <span className="text-[10px] font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full">
                {triggerWords.length}
              </span>
            </div>
            <button
              type="button"
              onClick={onCopyAllTriggerWords}
              className="text-[11px] font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1 bg-cyan-950/40 hover:bg-cyan-900/50 px-2.5 py-1 rounded border border-cyan-800/50 transition-colors cursor-pointer"
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
                      : "bg-cyan-950/30 hover:bg-cyan-900/40 border-cyan-800/40 hover:border-cyan-700 text-cyan-200"
                  }`}
                >
                  {isCopied ? (
                    <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                  ) : (
                    <Copy className="w-3 h-3 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  )}
                  <span className="truncate max-w-[280px]">{word}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Description & Release Notes Section */}
      {description && (
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-3.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
              <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Model Description &amp; Release Notes</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">Civitai API</span>
          </div>
          <div className="text-xs text-zinc-300/90 leading-relaxed font-sans whitespace-pre-wrap max-h-36 overflow-y-auto bg-zinc-950/80 p-2.5 rounded border border-zinc-800/60 select-text">
            {description}
          </div>
        </div>
      )}
    </div>
  );
};
