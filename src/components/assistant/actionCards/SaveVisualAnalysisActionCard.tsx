import React from "react";
import { Eye, Check, RefreshCw, X, Sparkles, Shirt, Sun, Camera, Compass } from "lucide-react";
import { SaveVisualAnalysisAction } from "../../../types/assistantActions";
import { MediaAsset } from "../../../types";
import { getAssetMediaUrl } from "../../../utils/assetUrl";

interface SaveVisualAnalysisActionCardProps {
  action: SaveVisualAnalysisAction;
  isApplied: boolean;
  isDismissed: boolean;
  assets?: MediaAsset[];
  onApply: () => void;
  onDismiss: () => void;
  onUndo: () => void;
}

export const SaveVisualAnalysisActionCard: React.FC<SaveVisualAnalysisActionCardProps> = ({
  action,
  isApplied,
  isDismissed,
  assets = [],
  onApply,
  onDismiss,
  onUndo
}) => {
  const { filename, analysis } = action;
  
  // Find matching asset object if available
  const matchedAsset = assets.find((a) => a.filename === filename);
  const thumbUrl = matchedAsset ? getAssetMediaUrl(matchedAsset, true) : null;

  if (isDismissed) {
    return (
      <div className="p-2 bg-slate-100/60 dark:bg-zinc-800/40 rounded-xl border border-slate-200/50 dark:border-zinc-800 flex items-center justify-between text-xs text-slate-400 dark:text-zinc-500">
        <span className="line-through flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5" />
          Cache visual analysis for {filename}
        </span>
        <button
          onClick={onApply}
          className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer font-medium"
        >
          Restore
        </button>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border p-3 transition-all flex flex-col gap-2.5 shadow-2xs ${
        isApplied
          ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/80"
          : "bg-white dark:bg-zinc-900 border-indigo-200 dark:border-indigo-800/80 hover:border-indigo-400"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-zinc-800/80 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            <Eye className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>Visual Intelligence Breakdown</span>
              <span className="px-1.5 py-0.2 text-[9px] font-medium rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                {filename}
              </span>
            </h4>
            <p className="text-[10px] text-slate-500 dark:text-zinc-400">
              Extracted visual traits to save into the project registry.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          {isApplied ? (
            <div className="flex items-center gap-1">
              <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-[10px] font-medium flex items-center gap-1 border border-emerald-300 dark:border-emerald-800">
                <Check className="w-3 h-3 text-emerald-500" />
                <span>Cached</span>
              </span>
              <button
                onClick={onUndo}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded transition-colors cursor-pointer"
                title="Remove from cache"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={onApply}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <Sparkles className="w-3 h-3" />
                <span>Save to Cache</span>
              </button>
              <button
                onClick={onDismiss}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded transition-colors cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Body */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Optional Image Thumbnail Preview */}
        {thumbUrl && (
          <div className="w-20 h-20 rounded-lg bg-zinc-900 overflow-hidden border border-slate-200 dark:border-zinc-800 shrink-0 self-start">
            <img src={thumbUrl} alt={filename} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="flex-1 flex flex-col gap-2 min-w-0 text-xs">
          {/* Visual Summary */}
          {analysis.summary && (
            <p className="text-slate-800 dark:text-zinc-200 italic font-medium bg-slate-50 dark:bg-zinc-800/60 p-2 rounded-lg border border-slate-100 dark:border-zinc-800/80 leading-snug">
              "{analysis.summary}"
            </p>
          )}

          {/* Structured Attributes Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            {/* Subject / Facial Details */}
            {analysis.subject && (
              <div className="p-2 rounded-lg bg-slate-50/80 dark:bg-zinc-800/40 border border-slate-200/60 dark:border-zinc-800 flex flex-col gap-0.5">
                <span className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  Subject Details
                </span>
                {analysis.subject.identified_name && <span>Name: <strong>{analysis.subject.identified_name}</strong></span>}
                {analysis.subject.apparent_age && <span>Age: {analysis.subject.apparent_age}</span>}
                {analysis.subject.expression && <span>Expression: {analysis.subject.expression}</span>}
                {analysis.subject.hair && <span>Hair: {analysis.subject.hair}</span>}
              </div>
            )}

            {/* Wardrobe */}
            {analysis.wardrobe && (
              <div className="p-2 rounded-lg bg-slate-50/80 dark:bg-zinc-800/40 border border-slate-200/60 dark:border-zinc-800 flex flex-col gap-0.5">
                <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Shirt className="w-3 h-3" />
                  Wardrobe & Style
                </span>
                {analysis.wardrobe.garments && <span>Garments: {analysis.wardrobe.garments}</span>}
                {analysis.wardrobe.colors && <span>Colors: {analysis.wardrobe.colors}</span>}
                {analysis.wardrobe.era_style && <span>Era: {analysis.wardrobe.era_style}</span>}
              </div>
            )}

            {/* Lighting */}
            {analysis.lighting && (
              <div className="p-2 rounded-lg bg-slate-50/80 dark:bg-zinc-800/40 border border-slate-200/60 dark:border-zinc-800 flex flex-col gap-0.5">
                <span className="font-semibold text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                  <Sun className="w-3 h-3" />
                  Lighting Setup
                </span>
                {analysis.lighting.quality && <span>Quality: {analysis.lighting.quality}</span>}
                {analysis.lighting.key_direction && <span>Direction: {analysis.lighting.key_direction}</span>}
                {analysis.lighting.color_temperature && <span>Temp: {analysis.lighting.color_temperature}</span>}
              </div>
            )}

            {/* Cinematography */}
            {analysis.cinematography && (
              <div className="p-2 rounded-lg bg-slate-50/80 dark:bg-zinc-800/40 border border-slate-200/60 dark:border-zinc-800 flex flex-col gap-0.5">
                <span className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <Camera className="w-3 h-3" />
                  Cinematography
                </span>
                {analysis.cinematography.framing && <span>Framing: {analysis.cinematography.framing}</span>}
                {analysis.cinematography.lens_feel && <span>Lens: {analysis.cinematography.lens_feel}</span>}
                {analysis.cinematography.camera_angle && <span>Angle: {analysis.cinematography.camera_angle}</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
