import React, { useState, useMemo } from "react";
import { ShotItem, MediaAsset } from "../types";
import { getAssetMediaUrl } from "../utils/assetUrl";
import { copyToClipboard } from "../utils/clipboard";
import { 
  Film, 
  Camera, 
  Move, 
  Aperture, 
  RectangleHorizontal, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Copy, 
  Check, 
  Sparkles,
  Quote,
  Compass
} from "lucide-react";

export interface ShotDossierCardProps {
  shots: ShotItem[];
  activeShotId: string | null;
  onSelectShot: (id: string | null) => void;
  assets?: MediaAsset[];
  sceneName?: string;
  onNewShot?: () => void;
  onDuplicateShot?: () => void;
  onOpenScenePlan?: () => void;
  hasScenePlan?: boolean;
  extraActions?: React.ReactNode;
  className?: string;
}

export const ShotDossierCard: React.FC<ShotDossierCardProps> = ({
  shots = [],
  activeShotId,
  onSelectShot,
  assets = [],
  sceneName = "Scene",
  onNewShot,
  onDuplicateShot,
  onOpenScenePlan,
  hasScenePlan = false,
  extraActions,
  className = ""
}) => {
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Derive active shot and its index in the list
  const activeShotIndex = useMemo(() => {
    return shots.findIndex(s => s.id === activeShotId);
  }, [shots, activeShotId]);

  const activeShot = activeShotIndex >= 0 ? shots[activeShotIndex] : null;

  // Previous and next shot navigation handlers
  const hasPrevious = activeShotIndex > 0;
  const hasNext = activeShotIndex >= 0 && activeShotIndex < shots.length - 1;

  const handleSelectPrevious = () => {
    if (hasPrevious) {
      onSelectShot(shots[activeShotIndex - 1].id);
    }
  };

  const handleSelectNext = () => {
    if (hasNext) {
      onSelectShot(shots[activeShotIndex + 1].id);
    }
  };

  // Derive preview media thumbnail for the shot (9th asset slot / location slot)
  const { previewUrl, isVideo } = useMemo(() => {
    if (!activeShot) return { previewUrl: null, isVideo: false };

    // Primary: 9th asset slot (Slot 9, index 8, 9, or 'location')
    const locFilename = activeShot.assigned_slots?.[8] ?? 
                        activeShot.assigned_slots?.[9] ?? 
                        (activeShot.assigned_slots as any)?.["8"] ??
                        (activeShot.assigned_slots as any)?.["9"] ??
                        (activeShot.assigned_slots as any)?.["location"];

    if (locFilename) {
      const isVideoAsset = Boolean(locFilename && /\.(mp4|mov|webm|mkv|avi)$/i.test(locFilename));
      return { previewUrl: getAssetMediaUrl(locFilename, true), isVideo: isVideoAsset };
    }

    return { previewUrl: null, isVideo: false };
  }, [activeShot]);

  // Copy prompt stub handler
  const handleCopyStub = async () => {
    if (!activeShot?.basic_stub) return;
    const ok = await copyToClipboard(activeShot.basic_stub);
    if (ok) {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    }
  };

  // Shot display info
  const shotNumberFormatted = activeShot ? activeShot.shot_number.toString().padStart(2, "0") : "--";
  const displayTitle = activeShot?.shot_name || (activeShot ? `Shot ${shotNumberFormatted}` : "No Shot Selected");
  const heroTake = (activeShot?.takes || []).find(t => t.id === activeShot?.hero_take_id || t.is_hero);
  const takesCount = activeShot?.takes?.length || 0;

  return (
    <div 
      id="unified-shot-dossier-card"
      className={`w-full bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs p-4 flex flex-col gap-3 transition-colors ${className}`}
    >
      {/* TOP BAR: SHOT SELECTOR & MAIN ACTIONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
        <div className="flex items-center gap-2 flex-wrap">
          {/* DOSSIER BADGE */}
          <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 rounded-md text-indigo-700 dark:text-indigo-300 text-xs font-bold tracking-wide uppercase">
            <Film className="w-3.5 h-3.5" />
            <span>Shot Dossier</span>
          </div>

          {/* PREVIOUS / NEXT STEPPERS */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5 border border-zinc-200 dark:border-zinc-700">
            <button
              type="button"
              onClick={handleSelectPrevious}
              disabled={!hasPrevious}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                hasPrevious
                  ? "text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white shadow-xs"
                  : "text-zinc-300 dark:text-zinc-600 cursor-not-allowed"
              }`}
              title="Previous Shot"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleSelectNext}
              disabled={!hasNext}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                hasNext
                  ? "text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white shadow-xs"
                  : "text-zinc-300 dark:text-zinc-600 cursor-not-allowed"
              }`}
              title="Next Shot"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* SHOT SWITCHER DROPDOWN */}
          <select
            value={activeShotId || ""}
            onChange={(e) => onSelectShot(e.target.value || null)}
            className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-900 dark:text-white focus:border-indigo-500 focus:outline-hidden min-w-[220px] shadow-xs cursor-pointer"
          >
            <option key="empty" value="">-- Select Shot --</option>
            {shots.map((s) => (
              <option key={s.id} value={s.id}>
                Shot {s.shot_number.toString().padStart(2, "0")} • {s.shot_type || "Setup"} {s.shot_name ? `(${s.shot_name})` : ""}
              </option>
            ))}
          </select>

          {/* STATUS PILL */}
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider border shadow-xs ${
            !activeShot
              ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-700"
              : activeShot.status === "rendered" 
              ? "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
              : activeShot.status === "rendering"
              ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 animate-pulse"
              : activeShot.status === "staged"
              ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
          }`}>
            {!activeShot 
              ? "N/A"
              : activeShot.status === "rendered" ? "✓ Rendered"
              : activeShot.status === "rendering" ? "⟳ Rendering"
              : activeShot.status === "staged" ? "✓ Staged" : "Unstaged"}
          </span>
        </div>

        {/* TOP RIGHT ACTIONS */}
        <div className="flex items-center gap-2 shrink-0">
          {onDuplicateShot && activeShot && (
            <button
              type="button"
              onClick={onDuplicateShot}
              className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700 dark:text-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-semibold transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              title={`Duplicate ${activeShot.shot_name || `Shot ${shotNumberFormatted}`}`}
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Duplicate Shot</span>
            </button>
          )}
          {onNewShot && (
            <button
              type="button"
              onClick={onNewShot}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-600/20 dark:hover:bg-indigo-600/30 dark:text-indigo-300 dark:border-indigo-500/30 rounded-lg text-xs font-semibold transition-colors shadow-xs flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Shot</span>
            </button>
          )}
          {onOpenScenePlan && (
            <button
              type="button"
              onClick={onOpenScenePlan}
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-600/20 dark:hover:bg-amber-600/30 dark:text-amber-300 dark:border-amber-500/30 rounded-lg text-xs font-semibold transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Open Scene Plan & Directives"
            >
              <Compass className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Scene Plan</span>
              {hasScenePlan && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Scene Plan defined" />
              )}
            </button>
          )}
          {extraActions}
        </div>
      </div>

      {/* DOSSIER BODY: FULL SIZE PREVIEW THUMBNAIL + METADATA & PROMPT STUB */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch">
        
        {/* PREVIEW THUMBNAIL (16:9 RATIO BOX) */}
        <div className="w-full md:w-48 aspect-video rounded-lg overflow-hidden shrink-0 relative bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 group shadow-inner flex items-center justify-center">
          <div className="flex flex-col items-center justify-center text-center p-2 text-zinc-500 dark:text-zinc-400">
            <Camera className="w-6 h-6 mb-1 opacity-50 text-indigo-500 dark:text-indigo-400" />
            <span className="text-[11px] font-medium">No Location Asset</span>
          </div>
          {previewUrl && (
            isVideo ? (
              <video
                src={`${previewUrl}#t=0.001`}
                preload="metadata"
                muted
                playsInline
                onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <img
                src={previewUrl}
                alt={displayTitle}
                onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                className="absolute inset-0 w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            )
          )}

          {/* THUMBNAIL BADGES */}
          <span className={`absolute top-1.5 left-1.5 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shadow-2xs pointer-events-none backdrop-blur-xs ${
            previewUrl
              ? "bg-black/75 dark:bg-black/85 text-white border border-white/20 dark:border-white/10"
              : "bg-white/90 dark:bg-zinc-900/90 text-zinc-800 dark:text-zinc-100 border border-zinc-200/90 dark:border-zinc-700/80"
          }`}>
            {activeShot ? `Shot ${shotNumberFormatted}` : "Shot --"}
          </span>

          {heroTake ? (
            <span className={`absolute bottom-1.5 right-1.5 backdrop-blur-xs text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border shadow-2xs pointer-events-none ${
              previewUrl
                ? "bg-black/75 dark:bg-black/85 text-amber-300 dark:text-amber-400 border-amber-400/40 dark:border-amber-500/30"
                : "bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
            }`}>
              Take {heroTake.take_number} ★
            </span>
          ) : takesCount > 0 ? (
            <span className={`absolute bottom-1.5 right-1.5 backdrop-blur-xs text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border shadow-2xs pointer-events-none ${
              previewUrl
                ? "bg-black/75 dark:bg-black/85 text-zinc-200 dark:text-zinc-300 border-white/20 dark:border-zinc-700"
                : "bg-white/90 dark:bg-zinc-900/90 text-zinc-700 dark:text-zinc-300 border-zinc-200/90 dark:border-zinc-700/80"
            }`}>
              {takesCount} {takesCount === 1 ? "Take" : "Takes"}
            </span>
          ) : (
            <span className={`absolute bottom-1.5 right-1.5 backdrop-blur-xs text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border shadow-2xs pointer-events-none ${
              previewUrl
                ? "bg-black/75 dark:bg-black/85 text-zinc-300 dark:text-zinc-400 border-white/20 dark:border-zinc-800"
                : "bg-white/90 dark:bg-zinc-900/90 text-zinc-500 dark:text-zinc-400 border-zinc-200/90 dark:border-zinc-700/80"
            }`}>
              N/A
            </span>
          )}
        </div>

        {/* DOSSIER CONTENT: SPEC CHIPS + PROMPT STUB */}
        <div className="flex-1 flex flex-col justify-between gap-2.5 min-w-0">
          
          {/* SPECS & METADATA CHIPS */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* SHOT TYPE CHIP */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800/90 rounded-md border border-zinc-200 dark:border-zinc-700 text-xs">
              <Camera className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
              <span className="text-zinc-500 dark:text-zinc-400 font-medium">Type:</span>
              <span className="text-zinc-900 dark:text-zinc-100 font-semibold truncate max-w-[140px]" title={activeShot?.shot_type || "N/A"}>
                {activeShot?.shot_type || "N/A"}
              </span>
            </div>

            {/* CAMERA MOVEMENT CHIP */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800/90 rounded-md border border-zinc-200 dark:border-zinc-700 text-xs">
              <Move className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400 shrink-0" />
              <span className="text-zinc-500 dark:text-zinc-400 font-medium">Movement:</span>
              <span className="text-zinc-900 dark:text-zinc-100 font-semibold truncate max-w-[140px]" title={activeShot?.camera_movement || "N/A"}>
                {activeShot?.camera_movement || "N/A"}
              </span>
            </div>

            {/* LENS / FOCAL LENGTH CHIP */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800/90 rounded-md border border-zinc-200 dark:border-zinc-700 text-xs">
              <Aperture className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400 shrink-0" />
              <span className="text-zinc-500 dark:text-zinc-400 font-medium">Lens:</span>
              <span className="text-zinc-900 dark:text-zinc-100 font-semibold truncate max-w-[140px]" title={activeShot?.lens_focal_length || "N/A"}>
                {activeShot?.lens_focal_length || "N/A"}
              </span>
            </div>

            {/* ASPECT RATIO CHIP */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800/90 rounded-md border border-zinc-200 dark:border-zinc-700 text-xs">
              <RectangleHorizontal className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
              <span className="text-zinc-500 dark:text-zinc-400 font-medium">Ratio:</span>
              <span className="text-zinc-900 dark:text-zinc-100 font-semibold">
                {activeShot?.aspect_ratio || "N/A"}
              </span>
            </div>
          </div>

          {/* PROMPT STUB DISPLAY */}
          <div className="bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 relative group">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                <Quote className="w-3 h-3 text-indigo-500" />
                <span>Prompt Stub</span>
              </div>
              {activeShot?.basic_stub && (
                <button
                  type="button"
                  onClick={handleCopyStub}
                  className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 font-medium transition-colors cursor-pointer"
                  title="Copy Prompt Stub"
                >
                  {copiedPrompt ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedPrompt ? "Copied" : "Copy"}</span>
                </button>
              )}
            </div>
            <p className="text-xs text-zinc-800 dark:text-zinc-200 line-clamp-2 leading-relaxed font-sans">
              {activeShot?.basic_stub ? (
                activeShot.basic_stub
              ) : activeShot?.expanded_prompt ? (
                <span className="text-zinc-500 dark:text-zinc-400 italic">{activeShot.expanded_prompt}</span>
              ) : (
                <span className="text-zinc-400 dark:text-zinc-500 italic">No prompt stub available.</span>
              )}
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};
