import React from "react";
import { CheckCircle2, Maximize2, Check } from "lucide-react";
import { CandidateItem } from "./types";

interface CandidateGalleryProps {
  candidates: CandidateItem[];
  isAccepting: boolean;
  onInspect: (candidate: CandidateItem) => void;
  onAccept: (candidate: CandidateItem) => void;
}

export const CandidateGallery: React.FC<CandidateGalleryProps> = ({
  candidates,
  isAccepting,
  onInspect,
  onAccept
}) => {
  if (candidates.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 pt-3 border-t border-zinc-800/80 animate-in fade-in">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-white flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Generated Frame 0 Candidates ({candidates.length})</span>
        </span>
        <span className="text-[11px] text-zinc-400">Click a candidate to inspect or accept as First Frame</span>
      </div>

      <div
        className={`grid gap-3 ${
          candidates.length === 1
            ? "grid-cols-1 max-w-lg"
            : candidates.length === 2
            ? "grid-cols-1 sm:grid-cols-2"
            : "grid-cols-2 sm:grid-cols-2 md:grid-cols-4"
        }`}
      >
        {candidates.map((cand) => (
          <div
            key={cand.id}
            className="group relative bg-zinc-900 border border-zinc-800 hover:border-purple-500 rounded-xl overflow-hidden flex flex-col transition-all shadow-md"
          >
            <div className="aspect-video bg-black relative flex items-center justify-center overflow-hidden">
              <img
                src={`data:${cand.mimeType};base64,${cand.base64}`}
                alt={`Candidate ${cand.index}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <button
                type="button"
                onClick={() => onInspect(cand)}
                className="absolute top-2 right-2 p-1.5 rounded-md bg-black/70 hover:bg-black text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                title="Zoom Lightbox"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <span className="absolute bottom-1.5 left-2 bg-black/80 text-[10px] font-bold text-purple-300 px-1.5 py-0.5 rounded">
                Option {cand.index}
              </span>
            </div>

            <div className="p-2.5 flex items-center justify-between bg-zinc-950/80 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => onInspect(cand)}
                className="text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                Inspect
              </button>

              <button
                type="button"
                onClick={() => onAccept(cand)}
                disabled={isAccepting}
                className="px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded text-[11px] font-bold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
              >
                <Check className="w-3 h-3" />
                <span>{isAccepting ? "Saving..." : "Save to Gallery"}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
