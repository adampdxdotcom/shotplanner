import React from "react";
import { 
  Star, 
  ThumbsUp, 
  ThumbsDown, 
  Check, 
  Copy, 
  Trash2, 
  Eye, 
  Download, 
  Video, 
  ChevronDown,
  ChevronUp,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock
} from "lucide-react";
import { ShotItem, ShotTake } from "../../types";
import { formatTakeFilename, formatSize } from "../../utils/formatters";

interface TakeItemCardProps {
  take: ShotTake;
  shot: ShotItem;
  sceneName: string;
  isHero: boolean;
  copiedTakeId: string | null;
  isPromptExpanded: boolean;
  onSetRating: (takeId: string, rating: "good" | "bad" | null) => void;
  onSetHero: (takeId: string) => void;
  onReviewTake: (takeId: string) => void;
  onDeleteTake: (take: ShotTake) => void;
  onCopyFilename: (take: ShotTake) => void;
  onUpdateNotes: (takeId: string, notes: string) => void;
  onAssignVariation: (takeId: string, variationId: string) => void;
  onTogglePromptExpanded: (takeId: string) => void;
}

/**
 * Individual video take card with playback controls, rating actions,
 * director notes editor, prompt variations inspector, and file metadata.
 */
export const TakeItemCard: React.FC<TakeItemCardProps> = ({
  take,
  shot,
  sceneName,
  isHero,
  copiedTakeId,
  isPromptExpanded,
  onSetRating,
  onSetHero,
  onReviewTake,
  onDeleteTake,
  onCopyFilename,
  onUpdateNotes,
  onAssignVariation,
  onTogglePromptExpanded
}) => {
  const isGood = take.rating === "good" || take.review_status === "approved";
  const isBad = take.rating === "bad" || take.review_status === "needs_work";
  const filename = take.video_filename || formatTakeFilename(sceneName, shot.shot_number, take.take_number, "mp4");
  const streamUrl = take.video_url || `/api/outputs/stream/${encodeURIComponent(sceneName)}/${encodeURIComponent(filename)}`;

  return (
    <div
      className={`bg-white dark:bg-zinc-900 border rounded-2xl overflow-hidden transition-all shadow-xs ${
        isHero 
          ? "border-amber-400 dark:border-amber-500/60 ring-1 ring-amber-400/30" 
          : isGood 
          ? "border-emerald-300 dark:border-emerald-800/60" 
          : isBad 
          ? "border-rose-300 dark:border-rose-800/60" 
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      {/* Take Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-zinc-100 dark:border-zinc-800/70 bg-zinc-50/70 dark:bg-zinc-950/50">
        <div className="flex items-center gap-2.5">
          {/* Take number badge */}
          <div className="flex items-center gap-1.5">
            <span className={`text-xs font-bold font-mono px-2.5 py-1 rounded-lg border ${
              isHero
                ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-700"
                : "bg-zinc-100 text-zinc-800 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700"
            }`}>
              Take {String(take.take_number).padStart(2, "0")}
            </span>

            {/* Assigned Variation Badge */}
            {take.variation_id && (() => {
              const matchedVar = (shot.prompt_variations || []).find(v => v.id === take.variation_id);
              return (
                <span className="flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-md">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  {matchedVar?.label || `Var ${matchedVar?.variation_number || ""}`}
                </span>
              );
            })()}

            {isHero && (
              <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-full">
                <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                Hero Take
              </span>
            )}
          </div>

          {/* Status badge */}
          {isGood && (
            <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-md">
              <CheckCircle2 className="w-3 h-3" />
              Good Take
            </span>
          )}
          {isBad && (
            <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-md">
              <XCircle className="w-3 h-3" />
              Needs Work
            </span>
          )}
          {!isGood && !isBad && (
            <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-md">
              <Clock className="w-3 h-3" />
              Unreviewed
            </span>
          )}
        </div>

        {/* Rating Buttons & Hero Toggle */}
        <div className="flex items-center gap-2">
          {/* Good / Bad Quick Toggles */}
          <div className="flex items-center bg-zinc-200/70 dark:bg-zinc-800/80 p-0.5 rounded-lg border border-zinc-300/60 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => onSetRating(take.id, "good")}
              title={isGood ? "Clear rating" : "Mark as Good Take"}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                isGood
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400"
              }`}
            >
              <ThumbsUp className={`w-3.5 h-3.5 ${isGood ? "fill-white" : ""}`} />
              <span>Good</span>
            </button>

            <button
              type="button"
              onClick={() => onSetRating(take.id, "bad")}
              title={isBad ? "Clear rating" : "Mark as Bad / Needs Work"}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                isBad
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400"
              }`}
            >
              <ThumbsDown className={`w-3.5 h-3.5 ${isBad ? "fill-white" : ""}`} />
              <span>Bad</span>
            </button>
          </div>

          {/* Set as Hero Button */}
          {!isHero && (
            <button
              type="button"
              onClick={() => onSetHero(take.id)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-zinc-100 hover:bg-amber-50 hover:text-amber-700 dark:bg-zinc-800 dark:hover:bg-amber-950/40 dark:hover:text-amber-300 text-zinc-600 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 transition-colors cursor-pointer"
              title="Set as Hero Take"
            >
              <Star className="w-3.5 h-3.5 text-amber-500" />
              <span>Make Hero</span>
            </button>
          )}

          {/* Review in Modal */}
          <button
            type="button"
            onClick={() => onReviewTake(take.id)}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Inspect Take in Modal"
          >
            <Eye className="w-4 h-4" />
          </button>

          {/* Delete take */}
          <button
            type="button"
            onClick={() => onDeleteTake(take)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
            title="Delete Take"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Take Card Content */}
      <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Video Player */}
        <div className="lg:col-span-6 flex flex-col space-y-2">
          <div className="bg-black rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 aspect-video relative flex items-center justify-center group shadow-xs">
            <video
              src={streamUrl}
              controls
              loop
              playsInline
              preload="metadata"
              className="w-full h-full object-contain"
            />
          </div>

          {/* Filename & Info Bar */}
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 pt-1">
            <div className="flex items-center gap-1.5 truncate max-w-[70%]">
              <Video className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span className="font-mono text-[11px] truncate" title={filename}>
                {filename}
              </span>
              <button
                type="button"
                onClick={() => onCopyFilename(take)}
                className="p-1 hover:text-zinc-900 dark:hover:text-zinc-200 cursor-pointer"
                title="Copy filename"
              >
                {copiedTakeId === take.id ? (
                  <Check className="w-3 h-3 text-emerald-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>

            <div className="flex items-center gap-2">
              {take.file_size && (
                <span className="text-[11px] font-mono">{formatSize(take.file_size)}</span>
              )}
              <a
                href={streamUrl}
                download={filename}
                className="p-1 text-zinc-400 hover:text-amber-500 transition-colors"
                title="Download video clip"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>

        {/* Right: Notes & Snapshot */}
        <div className="lg:col-span-6 flex flex-col space-y-3">
          {/* Notes Field */}
          <div className="flex-1 flex flex-col">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center justify-between">
              <span>Take Notes & Director Feedback</span>
              <span className="text-[10px] text-zinc-400 font-normal">Autosaves</span>
            </label>
            <textarea
              value={take.notes || ""}
              onChange={(e) => onUpdateNotes(take.id, e.target.value)}
              placeholder="Add review notes for this take (e.g. 'Great camera motion, watch hand glitch at end, approved for final edit')..."
              rows={3}
              className="w-full flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>

          {/* Metadata & Prompt Snapshot Accordion */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/40 p-2.5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => onTogglePromptExpanded(take.id)}
                className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer"
              >
                {isPromptExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
                <span>Prompt Snapshot & Parameters</span>
              </button>

              <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                {take.aspect_ratio && <span>{take.aspect_ratio}</span>}
                {take.sampling_steps && <span>• {take.sampling_steps} steps</span>}
              </div>
            </div>

            {/* Prompt Variation Assignment Bar */}
            <div className="mt-2 pt-2 border-t border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">Assigned Variation:</label>
              </div>

              <select
                value={take.variation_id || ""}
                onChange={(e) => onAssignVariation(take.id, e.target.value)}
                className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md px-2 py-1 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-amber-500 font-mono max-w-[240px]"
              >
                <option value="">-- Custom / Current Prompt --</option>
                {(shot.prompt_variations || []).map((v) => (
                  <option key={v.id} value={v.id}>
                    Variation {v.variation_number} {v.provider ? `(${v.provider})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {isPromptExpanded && (
              <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-800 text-xs space-y-2">
                {take.basic_stub && (
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">Concept Stub</span>
                    <p className="text-zinc-700 dark:text-zinc-300 text-xs bg-white dark:bg-zinc-900 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800">
                      {take.basic_stub}
                    </p>
                  </div>
                )}

                <div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">Expanded Prompt</span>
                  <div className="text-zinc-700 dark:text-zinc-300 text-[11px] font-mono bg-white dark:bg-zinc-900 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 max-h-28 overflow-y-auto whitespace-pre-wrap">
                    {take.expanded_prompt || "No prompt snapshot recorded for this take."}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
