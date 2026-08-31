import React, { useState } from "react";
import { ShotItem, ShotTake } from "../types";
import { X, Star, ArrowRightLeft, Check, Sparkles, Sliders, Film } from "lucide-react";

interface TakeComparisonModalProps {
  shot: ShotItem;
  sceneName: string;
  onClose: () => void;
  onSetHeroTake: (takeId: string) => void;
}

export function TakeComparisonModal({
  shot,
  sceneName,
  onClose,
  onSetHeroTake
}: TakeComparisonModalProps) {
  const takes = shot.takes || [];
  
  // Default to comparing the latest two takes if available, or first two
  const [takeAId, setTakeAId] = useState<string>(
    takes.length >= 2 ? takes[takes.length - 2].id : takes[0]?.id || ""
  );
  const [takeBId, setTakeBId] = useState<string>(
    takes.length >= 1 ? takes[takes.length - 1].id : ""
  );

  const takeA = takes.find(t => t.id === takeAId) || takes[0];
  const takeB = takes.find(t => t.id === takeBId) || takes[1] || takes[0];

  const paddedShot = String(shot.shot_number).padStart(2, "0");

  const getStreamUrl = (take?: ShotTake) => {
    if (!take) return null;
    const filename = take.video_filename || `${sceneName}_Shot_${paddedShot}_Take_${take.take_number}.mp4`;
    return `/api/outputs/stream/${encodeURIComponent(filename)}?scene_name=${encodeURIComponent(sceneName)}`;
  };

  const isHeroA = takeA?.id === shot.hero_take_id || takeA?.is_hero;
  const isHeroB = takeB?.id === shot.hero_take_id || takeB?.is_hero;

  const urlA = getStreamUrl(takeA);
  const urlB = getStreamUrl(takeB);

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[110] p-3 sm:p-6">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-6xl flex flex-col max-h-[92vh] overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded uppercase">
                  Shot {paddedShot}
                </span>
                <h2 className="text-lg font-bold text-white">Compare Takes</h2>
              </div>
              <p className="text-xs text-zinc-400">Side-by-side prompt and generation parameter diff</p>
            </div>
          </div>
          
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comparison Selector Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-zinc-900/30 border-b border-zinc-800">
          {/* Select Take A */}
          <div className="flex items-center gap-3 bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 shrink-0">Take A:</span>
            <select
              value={takeAId}
              onChange={(e) => setTakeAId(e.target.value)}
              className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500"
            >
              {takes.map(t => (
                <option key={`a-${t.id}`} value={t.id}>
                  Take {t.take_number} {t.id === shot.hero_take_id || t.is_hero ? "⭐ (Hero)" : ""}
                </option>
              ))}
            </select>
            {takeA && !isHeroA && (
              <button
                onClick={() => onSetHeroTake(takeA.id)}
                className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shrink-0"
              >
                <Star className="w-3.5 h-3.5" />
                Set Hero
              </button>
            )}
            {isHeroA && (
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1 shrink-0 px-2">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                Hero
              </span>
            )}
          </div>

          {/* Select Take B */}
          <div className="flex items-center gap-3 bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 shrink-0">Take B:</span>
            <select
              value={takeBId}
              onChange={(e) => setTakeBId(e.target.value)}
              className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500"
            >
              {takes.map(t => (
                <option key={`b-${t.id}`} value={t.id}>
                  Take {t.take_number} {t.id === shot.hero_take_id || t.is_hero ? "⭐ (Hero)" : ""}
                </option>
              ))}
            </select>
            {takeB && !isHeroB && (
              <button
                onClick={() => onSetHeroTake(takeB.id)}
                className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shrink-0"
              >
                <Star className="w-3.5 h-3.5" />
                Set Hero
              </button>
            )}
            {isHeroB && (
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1 shrink-0 px-2">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                Hero
              </span>
            )}
          </div>
        </div>

        {/* Comparison Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Side-by-Side Video Players */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400 font-semibold px-1">
                <span>Take {takeA?.take_number || 1} Output Video</span>
                <span className="font-mono text-zinc-500">{takeA?.video_filename || "output.mp4"}</span>
              </div>
              <div className="bg-black border border-zinc-800 rounded-xl overflow-hidden aspect-video flex items-center justify-center relative">
                {urlA ? (
                  <video src={urlA} controls className="w-full h-full object-contain" />
                ) : (
                  <div className="text-zinc-600 text-xs flex flex-col items-center gap-1">
                    <Film className="w-6 h-6" />
                    <span>No render output</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400 font-semibold px-1">
                <span>Take {takeB?.take_number || 2} Output Video</span>
                <span className="font-mono text-zinc-500">{takeB?.video_filename || "output.mp4"}</span>
              </div>
              <div className="bg-black border border-zinc-800 rounded-xl overflow-hidden aspect-video flex items-center justify-center relative">
                {urlB ? (
                  <video src={urlB} controls className="w-full h-full object-contain" />
                ) : (
                  <div className="text-zinc-600 text-xs flex flex-col items-center gap-1">
                    <Film className="w-6 h-6" />
                    <span>No render output</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Parameter Diff Table */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-300 uppercase tracking-wider">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span>Generation Parameters Comparison</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400">
                    <th className="py-2 px-3 font-semibold">Parameter</th>
                    <th className="py-2 px-3 font-semibold text-indigo-300">Take {takeA?.take_number}</th>
                    <th className="py-2 px-3 font-semibold text-emerald-300">Take {takeB?.take_number}</th>
                    <th className="py-2 px-3 font-semibold text-zinc-400">Difference Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50 font-mono">
                  {[
                    { label: "Sampling Steps", valA: takeA?.generation_params?.steps ?? takeA?.sampling_steps ?? 30, valB: takeB?.generation_params?.steps ?? takeB?.sampling_steps ?? 30 },
                    { label: "Resolution (Megapixels)", valA: takeA?.generation_params?.megapixels ?? 0.5, valB: takeB?.generation_params?.megapixels ?? 0.5 },
                    { label: "Video Frames", valA: takeA?.generation_params?.frames ?? 81, valB: takeB?.generation_params?.frames ?? 81 },
                    { label: "Review Status", valA: takeA?.review_status || "unreviewed", valB: takeB?.review_status || "unreviewed" }
                  ].map((row, idx) => {
                    const isDiff = String(row.valA) !== String(row.valB);
                    return (
                      <tr key={idx} className={isDiff ? "bg-amber-500/5" : ""}>
                        <td className="py-2 px-3 font-sans font-medium text-zinc-300">{row.label}</td>
                        <td className="py-2 px-3 text-zinc-200">{String(row.valA)}</td>
                        <td className="py-2 px-3 text-zinc-200">{String(row.valB)}</td>
                        <td className="py-2 px-3 font-sans">
                          {isDiff ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
                              Modified
                            </span>
                          ) : (
                            <span className="text-[10px] text-zinc-500">Identical</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Prompt Comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Take A Prompt */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-indigo-300">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Take {takeA?.take_number} Prompt Snapshot
                </span>
                {takeA?.basic_stub && (
                  <span className="text-[10px] font-normal text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                    Stub: {takeA.basic_stub}
                  </span>
                )}
              </div>
              <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 text-xs font-mono text-zinc-300 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                {takeA?.expanded_prompt || "No prompt snapshot recorded for this take."}
              </div>
            </div>

            {/* Take B Prompt */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-emerald-300">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Take {takeB?.take_number} Prompt Snapshot
                </span>
                {takeB?.basic_stub && (
                  <span className="text-[10px] font-normal text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                    Stub: {takeB.basic_stub}
                  </span>
                )}
              </div>
              <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 text-xs font-mono text-zinc-300 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                {takeB?.expanded_prompt || "No prompt snapshot recorded for this take."}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
          <p className="text-xs text-zinc-500">
            Click <strong className="text-amber-400">Set Hero</strong> on any take to designate it for staging and final exports.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Close Comparison
          </button>
        </div>

      </div>
    </div>
  );
}
