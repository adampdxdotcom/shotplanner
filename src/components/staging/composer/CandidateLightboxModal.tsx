import React from "react";
import { Sparkles, X, Check } from "lucide-react";
import { CandidateItem } from "./types";
import { ShotItem } from "../../../types";

interface CandidateLightboxModalProps {
  candidate: CandidateItem | null;
  activeShot: ShotItem;
  isAccepting: boolean;
  onAccept: (candidate: CandidateItem) => void;
  onClose: () => void;
}

export const CandidateLightboxModal: React.FC<CandidateLightboxModalProps> = ({
  candidate,
  activeShot,
  isAccepting,
  onAccept,
  onClose
}) => {
  if (!candidate) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            Frame 0 Candidate {candidate.index} - Shot {activeShot.shot_number}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-md bg-zinc-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto flex flex-col items-center justify-center bg-black/60">
          <img
            src={`data:${candidate.mimeType};base64,${candidate.base64}`}
            alt="Candidate Lightbox"
            className="max-h-[60vh] w-auto object-contain rounded-lg border border-zinc-800 shadow-lg"
          />
          <p className="text-xs text-zinc-400 mt-3 text-center max-w-xl">
            {candidate.promptUsed}
          </p>
        </div>

        <div className="p-4 border-t border-zinc-800 flex items-center justify-between bg-zinc-900/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => onAccept(candidate)}
            disabled={isAccepting}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-md cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{isAccepting ? "Saving Asset..." : "Save to Gallery"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
