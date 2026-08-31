import React, { useEffect, useState, useRef } from "react";
import { ShotTake } from "../types";
import { X, Star, CheckCircle, XCircle } from "lucide-react";

interface TakeReviewModalProps {
  take: ShotTake;
  sceneName: string;
  shotNumber: number;
  onClose: () => void;
  onSetHero: () => void;
}

export function TakeReviewModal({ take, sceneName, shotNumber, onClose, onSetHero }: TakeReviewModalProps) {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Determine the video filename
    // Typically it will be {sceneName}_Shot_{paddedShot}_Take_{takeNumber}.mp4
    const paddedShot = String(shotNumber).padStart(2, "0");
    const filename = `${sceneName}_Shot_${paddedShot}_Take_${take.take_number}.mp4`;
    setVideoSrc(`/api/outputs/stream/${filename}?scene_name=${encodeURIComponent(sceneName)}`);
  }, [take, sceneName, shotNumber]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 sm:p-8">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-5xl flex flex-col max-h-full overflow-hidden shadow-2xl">
        
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-white">Review Take {take.take_number}</h2>
            {take.is_hero && (
              <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full">
                <Star className="w-3 h-3 fill-amber-400" />
                Hero Take
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
          {/* Left Column: Video & Actions */}
          <div className="space-y-4 flex flex-col">
            <div className="bg-black border border-zinc-800 rounded-xl overflow-hidden aspect-video relative flex items-center justify-center">
              {videoSrc ? (
                <video 
                  ref={videoRef}
                  src={videoSrc}
                  className="w-full h-full object-contain"
                  controls
                  autoPlay
                  loop
                  onError={() => setVideoSrc(null)}
                />
              ) : (
                <div className="text-zinc-500 text-sm flex flex-col items-center gap-2">
                  <XCircle className="w-8 h-8 opacity-50" />
                  <span>Output video not found or not rendered yet.</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={onSetHero}
                disabled={take.is_hero}
                className="flex-1 flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-semibold py-2.5 rounded-lg transition-colors"
              >
                <Star className={`w-4 h-4 ${take.is_hero ? "" : "fill-amber-400"}`} />
                {take.is_hero ? "Current Hero Take" : "Set as Hero Take"}
              </button>
            </div>
          </div>

          {/* Right Column: Prompt & Metadata */}
          <div className="space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Concept Stub</h3>
              <p className="text-sm text-zinc-200 bg-zinc-950 p-3 rounded-lg border border-zinc-800/50">
                {take.basic_stub || "No concept stub provided."}
              </p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2 flex-1 flex flex-col">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Expanded Prompt Snapshot</h3>
              <div className="flex-1 text-xs text-zinc-300 font-mono bg-zinc-950 p-3 rounded-lg border border-zinc-800/50 overflow-y-auto whitespace-pre-wrap min-h-[150px]">
                {take.expanded_prompt || "No expanded prompt available."}
              </div>
            </div>
            
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 grid grid-cols-3 gap-3 text-center">
              <div className="bg-zinc-950 border border-zinc-800/50 rounded-lg p-2">
                <div className="text-[10px] text-zinc-500 font-medium uppercase mb-1">Steps</div>
                <div className="text-sm font-semibold text-white">{take.generation_params?.steps || "--"}</div>
              </div>
              <div className="bg-zinc-950 border border-zinc-800/50 rounded-lg p-2">
                <div className="text-[10px] text-zinc-500 font-medium uppercase mb-1">Frames</div>
                <div className="text-sm font-semibold text-white">{take.generation_params?.frames || "--"}</div>
              </div>
              <div className="bg-zinc-950 border border-zinc-800/50 rounded-lg p-2">
                <div className="text-[10px] text-zinc-500 font-medium uppercase mb-1">Megapixels</div>
                <div className="text-sm font-semibold text-white">{take.generation_params?.megapixels || "--"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
