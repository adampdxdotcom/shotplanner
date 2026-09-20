import React, { useRef, useState, useEffect } from "react";
import { Play, Pause, ChevronLeft, ChevronRight, ChevronsRight, Film } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

interface ScrubbableFramePlayerProps {
  videoUrl?: string | null;
  emptyLabel?: string;
  takeNumber?: number;
  isHero?: boolean;
  onVideoElementReady?: (el: HTMLVideoElement | null) => void;
  onCurrentTimeChange?: (time: number, duration: number) => void;
}

// 24 frames per second standard cinematic step
const FRAME_DURATION = 1 / 24;

export const ScrubbableFramePlayer: React.FC<ScrubbableFramePlayerProps> = ({
  videoUrl,
  emptyLabel = "No preceding shot",
  takeNumber,
  isHero = false,
  onVideoElementReady,
  onCurrentTimeChange
}) => {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === "light";
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // Sync video ref to parent for instant frame snapshotting
  useEffect(() => {
    if (onVideoElementReady) {
      onVideoElementReady(videoRef.current);
    }
  }, [onVideoElementReady, videoUrl]);

  // Handle metadata loaded: default playhead to the last frame
  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;

    const dur = video.duration || 0;
    setDuration(dur);
    setIsLoaded(true);

    // Default to last frame (duration minus small epsilon)
    const targetLastFrame = Math.max(0, dur - 0.04);
    video.currentTime = targetLastFrame;
    setCurrentTime(targetLastFrame);

    if (onCurrentTimeChange) {
      onCurrentTimeChange(targetLastFrame, dur);
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
    if (onCurrentTimeChange) {
      onCurrentTimeChange(video.currentTime, video.duration || duration);
    }
  };

  const handleTogglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  // Step -1 frame (24fps step)
  const handleStepBackward = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setIsPlaying(false);
    const newTime = Math.max(0, video.currentTime - FRAME_DURATION);
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Step +1 frame (24fps step)
  const handleStepForward = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setIsPlaying(false);
    const newTime = Math.min(duration || video.duration || 0, video.currentTime + FRAME_DURATION);
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Snap to last frame
  const handleJumpToLastFrame = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setIsPlaying(false);
    const dur = duration || video.duration || 0;
    const newTime = Math.max(0, dur - 0.04);
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = parseFloat(e.target.value);
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  // Format time as MM:SS.ff
  const formatTime = (seconds: number) => {
    if (!isFinite(seconds) || seconds < 0) return "00:00.00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 24);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(frames).padStart(2, "0")}`;
  };

  const currentFrame = Math.max(1, Math.round(currentTime * 24));
  const totalFrames = Math.max(1, Math.round(duration * 24));

  if (!videoUrl) {
    return (
      <div className="w-full aspect-video bg-black rounded-lg overflow-hidden shrink-0 relative flex flex-col items-center justify-center border border-zinc-800 text-center p-3">
        <Film className="w-6 h-6 mb-1.5 text-zinc-500" />
        <span className="text-xs font-semibold text-zinc-300">{emptyLabel}</span>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-1.5 shrink-0 select-none">
      {/* VIDEO CONTAINER */}
      <div className="w-full aspect-video bg-black rounded-lg overflow-hidden relative flex items-center justify-center border border-zinc-800 group shadow-inner">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-contain cursor-pointer"
          playsInline
          muted
          crossOrigin="anonymous"
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onClick={handleTogglePlay}
        />

        {/* TAKE NUMBER BADGE */}
        {takeNumber !== undefined && (
          <span className={`frame-take-badge absolute top-2 left-2 backdrop-blur-md text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border pointer-events-none transition-colors shadow-xs ${
            isLight
              ? "bg-white/95 text-amber-800 border-amber-300 shadow-zinc-300/40"
              : "bg-black/85 text-amber-400 border-amber-500/30"
          }`}>
            Take {takeNumber} {isHero ? "★" : ""}
          </span>
        )}

        {/* TIMECODE & FRAME NUMBER OVERLAY */}
        {isLoaded && duration > 0 && (
          <span className={`frame-timecode-badge absolute bottom-2 right-2 backdrop-blur-md text-[10px] font-mono font-bold px-2 py-0.5 rounded border pointer-events-none transition-colors shadow-xs ${
            isLight
              ? "bg-white/95 text-slate-900 border-slate-300 shadow-zinc-300/50"
              : "bg-zinc-950/90 text-zinc-100 border-zinc-700/80"
          }`}>
            {formatTime(currentTime)} • Frame {currentFrame}/{totalFrames}
          </span>
        )}
      </div>

      {/* SCRUB TIMELINE & TRANSPORT CONTROLS */}
      {isLoaded && duration > 0 && (
        <div className="flex flex-col gap-1 px-0.5 mt-0.5">
          {/* SCRUB RANGE SLIDER */}
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={duration}
              step={0.01}
              value={currentTime}
              onChange={handleSeek}
              className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:accent-blue-500 transition-colors ${
                isLight ? "bg-zinc-200" : "bg-zinc-800"
              }`}
              title="Scrub video timeline"
            />
          </div>

          {/* TRANSPORT BUTTON BAR */}
          <div className="flex items-center justify-between text-[11px] pt-0.5">
            <div className="flex items-center gap-1">
              {/* PLAY / PAUSE */}
              <button
                type="button"
                onClick={handleTogglePlay}
                className={`p-1 rounded transition-colors cursor-pointer ${
                  isLight
                    ? "hover:bg-zinc-200 text-zinc-700 hover:text-zinc-900"
                    : "hover:bg-zinc-800 text-zinc-300 hover:text-white"
                }`}
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>

              {/* -1 FRAME STEP */}
              <button
                type="button"
                onClick={handleStepBackward}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold flex items-center gap-0.5 border transition-colors cursor-pointer ${
                  isLight
                    ? "bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-300"
                    : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border-zinc-800"
                }`}
                title="Step backward 1 frame"
              >
                <ChevronLeft className="w-3 h-3" />
                <span>-1f</span>
              </button>

              {/* +1 FRAME STEP */}
              <button
                type="button"
                onClick={handleStepForward}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold flex items-center gap-0.5 border transition-colors cursor-pointer ${
                  isLight
                    ? "bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-300"
                    : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border-zinc-800"
                }`}
                title="Step forward 1 frame"
              >
                <span>+1f</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {/* SNAP TO LAST FRAME BUTTON */}
            <button
              type="button"
              onClick={handleJumpToLastFrame}
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 border transition-colors cursor-pointer ${
                isLight
                  ? "bg-zinc-100 hover:bg-zinc-200 text-zinc-800 hover:text-amber-800 border-zinc-300"
                  : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-amber-300 border-zinc-800"
              }`}
              title="Snap playhead to the last frame"
            >
              <span>Last Frame</span>
              <ChevronsRight className={`w-3 h-3 ${isLight ? "text-amber-600" : "text-amber-400"}`} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
