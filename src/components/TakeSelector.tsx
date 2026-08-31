import React from "react";
import { ShotItem } from "../types";
import { Star, CheckCircle, Clock, Eye } from "lucide-react";

interface TakeSelectorProps {
  shot: ShotItem;
  activeTakeId?: string;
  onSetHeroTake: (takeId: string) => void;
  onReviewTake: (takeId: string) => void;
  onSelectTake?: (takeId: string) => void;
  onCompareTakes?: () => void;
}

export function TakeSelector({
  shot,
  activeTakeId,
  onSetHeroTake,
  onReviewTake,
  onSelectTake,
  onCompareTakes
}: TakeSelectorProps) {
  if (!shot.takes || shot.takes.length === 0) return null;

  // Sort ascending by take_number for intuitive 1, 2, 3 ordering
  const sortedTakes = [...shot.takes].sort((a, b) => a.take_number - b.take_number);
  const currentActiveId = activeTakeId || shot.active_take_id || (sortedTakes.length > 0 ? sortedTakes[sortedTakes.length - 1].id : undefined);

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider shrink-0 mr-1">
        Takes ({sortedTakes.length})
      </span>
      
      <div className="flex items-center gap-1.5 shrink-0">
        {sortedTakes.map(take => {
          const isHero = take.id === shot.hero_take_id || Boolean(take.is_hero);
          const isActive = take.id === currentActiveId;
          
          return (
            <div 
              key={take.id}
              className={`group relative flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold cursor-pointer transition-all shrink-0 ${
                isActive 
                  ? "bg-indigo-600/30 border-indigo-400 text-indigo-200 shadow-sm" 
                  : isHero
                  ? "bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              }`}
              onClick={() => {
                if (onSelectTake) {
                  onSelectTake(take.id);
                } else {
                  onReviewTake(take.id);
                }
              }}
              title={`Take ${take.take_number}${isHero ? " (Hero Take)" : ""} - Click to view`}
            >
              <span>Take {take.take_number}</span>
              
              {isHero && (
                <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
              )}
              
              {take.review_status === "approved" && !isHero && (
                <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
              )}
              {take.review_status === "needs_work" && !isHero && (
                <Clock className="w-3 h-3 text-amber-400 shrink-0" />
              )}

              {/* Action buttons on pill */}
              <div className="flex items-center gap-1 ml-0.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReviewTake(take.id);
                  }}
                  title="Inspect Prompt & Parameters"
                  className="opacity-60 hover:opacity-100 p-0.5 hover:text-white transition-opacity"
                >
                  <Eye className="w-3 h-3" />
                </button>
                {!isHero && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetHeroTake(take.id);
                    }}
                    title="Set as Hero Take"
                    className="opacity-0 group-hover:opacity-100 hover:text-amber-400 p-0.5 transition-opacity"
                  >
                    <Star className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {sortedTakes.length >= 2 && onCompareTakes && (
        <button
          type="button"
          onClick={onCompareTakes}
          className="ml-2 px-2.5 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/80 rounded-full text-[11px] font-semibold transition-colors shrink-0 flex items-center gap-1"
        >
          Compare
        </button>
      )}
    </div>
  );
}

