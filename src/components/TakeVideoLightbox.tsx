import React, { useState, useEffect, useRef } from "react";
import { ShotItem, ShotTake } from "../types";
import { formatTakeFilename, formatSize } from "../utils/formatters";
import { 
  X, 
  Star, 
  Clapperboard, 
  CheckCircle2, 
  XCircle, 
  ChevronLeft, 
  ChevronRight, 
  Copy, 
  Check, 
  Eye, 
  Film,
  Video,
  AlertTriangle
} from "lucide-react";

interface TakeVideoLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  shot: ShotItem;
  take: ShotTake | null;
  sceneName?: string;
  onSetHeroTake?: (takeId: string) => void;
  onReviewTake?: (takeId: string) => void;
  onSelectTake?: (takeId: string) => void;
}

export const TakeVideoLightbox: React.FC<TakeVideoLightboxProps> = ({
  isOpen,
  onClose,
  shot,
  take,
  sceneName = "Scene",
  onSetHeroTake,
  onReviewTake,
  onSelectTake
}) => {
  const [activeTakeId, setActiveTakeId] = useState<string | null>(take?.id || null);
  const [copied, setCopied] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Sync activeTakeId when take prop changes
  useEffect(() => {
    if (take?.id) {
      setActiveTakeId(take.id);
      setVideoError(false);
    }
  }, [take?.id]);

  const allTakes = shot.takes || [];
  const sortedTakes = [...allTakes].sort((a, b) => a.take_number - b.take_number);
  const currentTake = sortedTakes.find(t => t.id === activeTakeId) || take || sortedTakes[0] || null;

  const currentIdx = currentTake ? sortedTakes.findIndex(t => t.id === currentTake.id) : -1;
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx >= 0 && currentIdx < sortedTakes.length - 1;

  const handlePrev = () => {
    if (hasPrev) {
      const prevTake = sortedTakes[currentIdx - 1];
      setActiveTakeId(prevTake.id);
      setVideoError(false);
      onSelectTake?.(prevTake.id);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      const nextTake = sortedTakes[currentIdx + 1];
      setActiveTakeId(nextTake.id);
      setVideoError(false);
      onSelectTake?.(nextTake.id);
    }
  };

  // Keyboard navigation: Escape to close, Left/Right arrows to switch takes
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentIdx, sortedTakes.length]);

  // Clean up video player to prevent memory leaks and background decoding
  useEffect(() => {
    const el = videoRef.current;
    return () => {
      if (el) {
        el.pause();
        el.removeAttribute("src");
        el.load();
      }
    };
  }, [currentTake?.id]);

  if (!isOpen || !currentTake) return null;

  const isHero = currentTake.id === shot.hero_take_id || Boolean(currentTake.is_hero);
  const isGood = currentTake.rating === "good" || currentTake.review_status === "approved";
  const isBad = currentTake.rating === "bad" || currentTake.review_status === "needs_work";

  const filename = currentTake.video_filename || formatTakeFilename(sceneName, shot.shot_number, currentTake.take_number, "mp4");
  const streamUrl = currentTake.video_url || `/api/outputs/stream/${encodeURIComponent(sceneName)}/${encodeURIComponent(filename)}`;
  const isImage = /\.(png|jpg|jpeg|webp|avif)$/i.test(filename || streamUrl || "");

  const handleCopyFilename = () => {
    navigator.clipboard.writeText(filename);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shotNumberDisplay = shot.shot_number.toString().padStart(2, "0");
  const takeNumberDisplay = currentTake.take_number.toString().padStart(2, "0");

  return (
    <div 
      id="take-video-lightbox-overlay"
      className="dark-viewport fixed inset-0 z-[120] bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 select-none animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Top Header Bar */}
      <div 
        className="w-full max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-zinc-800/80 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: Shot & Take identification */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-xl shadow-xs">
            <Clapperboard className="w-5 h-5" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-white tracking-wide">
                Shot {shotNumberDisplay}
              </span>
              <span className="text-zinc-600 font-bold">•</span>
              <span className="text-base font-bold text-amber-400">
                Take {takeNumberDisplay}
              </span>

              {isHero && (
                <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full shadow-xs">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  Hero Take
                </span>
              )}

              {isGood && (
                <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                  <CheckCircle2 className="w-3 h-3" />
                  Good Take
                </span>
              )}

              {isBad && (
                <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full">
                  <XCircle className="w-3 h-3" />
                  Needs Work
                </span>
              )}
            </div>

            <span className="text-xs text-zinc-400 font-medium">
              {shot.shot_name ? `${shot.shot_name} — ` : ""}{sceneName}
            </span>
          </div>
        </div>

        {/* Center: Multiple Takes Switcher if applicable */}
        {sortedTakes.length > 1 && (
          <div className="flex items-center gap-1.5 bg-zinc-900/90 border border-zinc-800/90 px-2 py-1 rounded-xl shadow-inner">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider px-1">
              Takes:
            </span>
            <div className="flex items-center gap-1 overflow-x-auto max-w-xs sm:max-w-md">
              {sortedTakes.map((t) => {
                const isSelected = t.id === currentTake.id;
                const isThisHero = t.id === shot.hero_take_id || Boolean(t.is_hero);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setActiveTakeId(t.id);
                      setVideoError(false);
                      onSelectTake?.(t.id);
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-amber-500 text-black shadow-md font-bold"
                        : isThisHero
                        ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30"
                        : "bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700"
                    }`}
                  >
                    <span>Take {t.take_number}</span>
                    {isThisHero && (
                      <Star className={`w-3 h-3 ${isSelected ? "fill-black text-black" : "fill-amber-400 text-amber-400"}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Right: Close button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            title="Close Lightbox (Esc)"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white rounded-xl shadow-lg transition-colors cursor-pointer text-xs font-semibold"
          >
            <span>Close</span>
            <kbd className="hidden sm:inline px-1.5 py-0.5 bg-zinc-800 text-[10px] text-zinc-400 rounded border border-zinc-700 font-mono">
              ESC
            </kbd>
            <X className="w-4 h-4 ml-0.5" />
          </button>
        </div>
      </div>

      {/* Main Video Viewport */}
      <div 
        className="flex-1 flex items-center justify-center min-h-0 w-full max-w-7xl mx-auto relative px-2 sm:px-12 my-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Previous Take Floating Arrow */}
        {hasPrev && (
          <button
            type="button"
            onClick={handlePrev}
            title="Previous Take (Left Arrow)"
            className="absolute left-0 sm:left-2 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-zinc-900/80 hover:bg-amber-500 hover:text-black border border-zinc-800 text-zinc-200 transition-all shadow-xl backdrop-blur cursor-pointer group"
          >
            <ChevronLeft className="w-6 h-6 group-hover:scale-110 transition-transform" />
          </button>
        )}

        {/* Next Take Floating Arrow */}
        {hasNext && (
          <button
            type="button"
            onClick={handleNext}
            title="Next Take (Right Arrow)"
            className="absolute right-0 sm:right-2 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-zinc-900/80 hover:bg-amber-500 hover:text-black border border-zinc-800 text-zinc-200 transition-all shadow-xl backdrop-blur cursor-pointer group"
          >
            <ChevronRight className="w-6 h-6 group-hover:scale-110 transition-transform" />
          </button>
        )}

        {/* Video Canvas / Card */}
        <div className="relative w-full h-full max-h-[75vh] flex items-center justify-center bg-zinc-950 rounded-2xl border border-zinc-800/90 shadow-2xl overflow-hidden">
          {!videoError ? (
            isImage ? (
              <img
                src={streamUrl}
                alt={filename}
                onError={() => setVideoError(true)}
                className="w-full h-full max-h-[75vh] object-contain rounded-xl"
                referrerPolicy="no-referrer"
              />
            ) : (
              <video
                ref={videoRef}
                src={streamUrl}
                controls
                autoPlay
                loop
                playsInline
                preload="auto"
                onError={() => setVideoError(true)}
                className="w-full h-full max-h-[75vh] object-contain rounded-xl"
              />
            )
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center max-w-md space-y-3">
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-full">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-zinc-200">Video Preview Unavailable</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                The output video file <code className="text-amber-400 font-mono text-[11px]">{filename}</code> has not been rendered yet, or has been moved.
              </p>
              <div className="pt-2">
                <span className="text-[11px] text-zinc-500 font-mono bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-md">
                  Path: outputs/{sceneName}/{filename}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Bar: Video Details & Actions */}
      <div 
        className="w-full max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-800/80 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Filename & specs */}
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <div className="flex items-center gap-1.5 font-mono bg-zinc-900/90 border border-zinc-800 px-3 py-1.5 rounded-lg shadow-inner">
            <Video className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="text-zinc-200 truncate max-w-xs sm:max-w-md" title={filename}>
              {filename}
            </span>
            <button
              type="button"
              onClick={handleCopyFilename}
              title="Copy video filename"
              className="p-1 hover:text-white transition-colors cursor-pointer ml-1"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {currentTake.file_size ? (
            <span className="font-mono text-zinc-500 hidden sm:inline">
              {formatSize(currentTake.file_size)}
            </span>
          ) : null}

          {currentTake.created_at ? (
            <span className="text-zinc-500 hidden md:inline">
              {new Date(currentTake.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          ) : null}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {onSetHeroTake && !isHero && (
            <button
              type="button"
              onClick={() => onSetHeroTake(currentTake.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              <Star className="w-3.5 h-3.5 text-amber-400" />
              <span>Set as Hero Take</span>
            </button>
          )}

          {onReviewTake && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onReviewTake(currentTake.id);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-zinc-400" />
              <span>Inspect Prompt & Parameters</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
