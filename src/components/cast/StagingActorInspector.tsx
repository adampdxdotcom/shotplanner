import React from "react";
import { Sliders, Plus, UserPlus, X, Eraser, Trash2, Compass, User } from "lucide-react";
import { StagedActor } from "./AiReferenceStagingStudioModal";

export interface StagingActorInspectorProps {
  stagedActors: StagedActor[];
  selectedActorIndex: number;
  availableCharacters: string[];
  activeSubject: string;
  activeMaskingActorId: string | null;
  updateSelectedActor: (updater: Partial<StagedActor>) => void;
  handleAddActorToStage: (char: string) => void;
  handleRemoveActorFromStage: (index: number) => void;
  onSetMaskingActorId: (id: string | null) => void;
  onOpenPoseInspector: (char: string) => void;
}

export const StagingActorInspector: React.FC<StagingActorInspectorProps> = ({
  stagedActors,
  selectedActorIndex,
  availableCharacters,
  activeSubject,
  activeMaskingActorId,
  updateSelectedActor,
  handleAddActorToStage,
  handleRemoveActorFromStage,
  onSetMaskingActorId,
  onOpenPoseInspector
}) => {
  return (
    <div className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-4 shadow-sm">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                Actor Blocking Controls
              </h4>
              {stagedActors[selectedActorIndex] && (
                <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {stagedActors[selectedActorIndex].characterName}
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-400">
              Spatial positioning, scale, floor anchor, and layer masking
            </p>
          </div>
        </div>

        {/* Cast Quick-Add Buttons & Pose Inspector */}
        <div className="flex items-center flex-wrap gap-2">
          <span className="text-[11px] font-medium text-zinc-400">Add Cast:</span>
          <div className="flex flex-wrap gap-1.5">
            {availableCharacters.map(char => {
              const isStaged = stagedActors.some(a => a.characterName.toLowerCase() === char.toLowerCase());
              return (
                <button
                  key={char}
                  type="button"
                  onClick={() => handleAddActorToStage(char)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                    isStaged 
                      ? "bg-zinc-800 text-zinc-300 border border-zinc-700" 
                      : "bg-indigo-950/60 text-indigo-300 border border-indigo-800/60 hover:bg-indigo-900"
                  }`}
                >
                  <Plus className="w-3 h-3" />
                  {char}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => onOpenPoseInspector(activeSubject || "")}
            className="px-2.5 py-1 bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-800/80 text-indigo-300 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
          >
            <UserPlus className="w-3 h-3" />
            <span>Pose Inspector</span>
          </button>
        </div>
      </div>

      {stagedActors[selectedActorIndex] ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
          {/* Col 1: Figure Representation & Live Masking */}
          <div className="space-y-3 bg-zinc-950/50 border border-zinc-800/80 rounded-xl p-3.5 flex flex-col justify-between h-full">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-300">Figure Representation</span>
                {stagedActors[selectedActorIndex].cutoutDataUrl ? (
                  <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 rounded">
                    Transparent Cutout Active
                  </span>
                ) : (
                  <span className="text-[10px] text-zinc-500 font-mono">Headshot Token</span>
                )}
              </div>

              {stagedActors[selectedActorIndex].cutoutDataUrl ? (
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-800">
                  <div className="flex items-center gap-2.5">
                    <div 
                      className="w-10 h-10 rounded border border-zinc-700 overflow-hidden flex items-center justify-center shrink-0"
                      style={{
                        backgroundImage: `conic-gradient(#27272a 90deg, #18181b 90deg 180deg, #27272a 180deg 270deg, #18181b 270deg)`,
                        backgroundSize: "8px 8px"
                      }}
                    >
                      <img 
                        src={stagedActors[selectedActorIndex].cutoutDataUrl} 
                        alt="Cutout thumbnail" 
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-zinc-200 truncate">
                        {stagedActors[selectedActorIndex].posture || "Custom Pose"}
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate">
                        Keyed chroma background
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onOpenPoseInspector(stagedActors[selectedActorIndex].characterName)}
                      className="text-xs text-indigo-300 hover:text-white bg-indigo-950/70 border border-indigo-800/80 px-2 py-1 rounded transition-colors cursor-pointer"
                    >
                      Re-Key
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSelectedActor({ cutoutDataUrl: undefined })}
                      className="text-xs text-zinc-500 hover:text-red-400 p-1 rounded transition-colors cursor-pointer"
                      title="Remove cutout and use circular token"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenPoseInspector(stagedActors[selectedActorIndex].characterName)}
                  className="w-full border-2 border-dashed border-zinc-800 hover:border-indigo-500/50 hover:bg-indigo-500/10 rounded-lg p-2 flex flex-col items-center justify-center gap-1 transition-colors group cursor-pointer"
                >
                  <UserPlus className="w-4 h-4 text-zinc-500 group-hover:text-indigo-400" />
                  <span className="text-[10px] font-medium text-zinc-400 group-hover:text-indigo-300">
                    Apply Cutout / Pose
                  </span>
                </button>
              )}
            </div>

            <div className="pt-2 border-t border-zinc-800/60 mt-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-300 mb-2">
                <span>Live Masking & Layer Fixes</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const id = stagedActors[selectedActorIndex].id;
                    if (activeMaskingActorId === id) {
                      onSetMaskingActorId(null);
                    } else {
                      onSetMaskingActorId(id);
                    }
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    activeMaskingActorId === stagedActors[selectedActorIndex].id
                      ? "bg-amber-500 text-black shadow-inner"
                      : "bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-200 border border-indigo-700/60"
                  }`}
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>
                    {activeMaskingActorId === stagedActors[selectedActorIndex].id
                      ? "Done Masking"
                      : "Erase on Stage"}
                  </span>
                </button>
                
                {stagedActors[selectedActorIndex].maskDataUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      const currActor = stagedActors[selectedActorIndex];
                      const orig = currActor.originalCutoutDataUrl || currActor.cutoutDataUrl;
                      updateSelectedActor({
                        cutoutDataUrl: orig,
                        maskDataUrl: undefined
                      });
                    }}
                    className="py-1.5 px-2.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 transition-colors cursor-pointer"
                    title="Reset all mask modifications and restore the complete actor cutout"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Col 2: Scale Factor */}
          <div className="space-y-3 bg-zinc-950/50 border border-zinc-800/80 rounded-xl p-3.5 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400 mb-1">
                <span>Scale</span>
                <span className="font-mono text-zinc-200 font-semibold">
                  {Math.round((stagedActors[selectedActorIndex].scale || 1.0) * 100)}% ({((stagedActors[selectedActorIndex].scale || 1.0)).toFixed(2)}x)
                </span>
              </div>
              <input
                type="range"
                min="0.20"
                max="3.50"
                step="0.05"
                value={stagedActors[selectedActorIndex].scale || 1.0}
                onChange={(e) => updateSelectedActor({ scale: Number(e.target.value) })}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <div className="flex justify-between gap-1 text-[9px] text-zinc-500 font-mono mt-1">
                {[
                  { label: "50%", scale: 0.5 },
                  { label: "100%", scale: 1.0 },
                  { label: "150%", scale: 1.5 },
                  { label: "225%", scale: 2.25 },
                  { label: "350%", scale: 3.5 }
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => updateSelectedActor({ scale: preset.scale })}
                    className="px-1.5 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 rounded transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick remove from stage */}
            {stagedActors.length > 0 && stagedActors[selectedActorIndex] && (
              <button
                type="button"
                onClick={() => handleRemoveActorFromStage(selectedActorIndex)}
                className="w-full py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 border border-red-900/40 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove {stagedActors[selectedActorIndex].characterName}</span>
              </button>
            )}
          </div>

          {/* Col 3: Stage Position (X-Axis) & Floor Anchor (Y-Axis) */}
          <div className="space-y-3 bg-zinc-950/50 border border-zinc-800/80 rounded-xl p-3.5 flex flex-col justify-between h-full">
            {/* Horizontal Placement Slider */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400 mb-1">
                <span>Stage Position (X-Axis)</span>
                <span className="font-mono text-zinc-300">
                  {Math.round(stagedActors[selectedActorIndex].xPercent)}%
                  {stagedActors[selectedActorIndex].xPercent < 0 ? (
                    <span className="text-amber-400 text-[10px] ml-1">(Off-L)</span>
                  ) : stagedActors[selectedActorIndex].xPercent > 100 ? (
                    <span className="text-amber-400 text-[10px] ml-1">(Off-R)</span>
                  ) : null}
                </span>
              </div>
              <input
                type="range"
                min="-40"
                max="140"
                step="1"
                value={Math.round(stagedActors[selectedActorIndex].xPercent)}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  updateSelectedActor({ xPercent: val, horizontalPercent: val });
                }}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <div className="flex justify-between gap-1 text-[9px] text-zinc-500 font-mono mt-1">
                {[
                  { label: "Off-L", val: -20 },
                  { label: "L (20%)", val: 20 },
                  { label: "Center", val: 50 },
                  { label: "R (80%)", val: 80 },
                  { label: "Off-R", val: 120 }
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => updateSelectedActor({ xPercent: preset.val, horizontalPercent: preset.val })}
                    className="px-1.5 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 rounded transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Vertical Floor Anchor Slider */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400 mb-1">
                <span>Floor Anchor (Y-Axis)</span>
                <span className="font-mono text-zinc-300">
                  {Math.round(stagedActors[selectedActorIndex].yPercent)}%
                  {stagedActors[selectedActorIndex].yPercent > 100 ? (
                    <span className="text-amber-400 text-[10px] ml-1">(Bleed)</span>
                  ) : null}
                </span>
              </div>
              <input
                type="range"
                min="-20"
                max="130"
                step="1"
                value={Math.round(stagedActors[selectedActorIndex].yPercent)}
                onChange={(e) => updateSelectedActor({ yPercent: Number(e.target.value) })}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <div className="flex justify-between gap-1 text-[9px] text-zinc-500 font-mono mt-1">
                {[
                  { label: "Deep (42%)", val: 42 },
                  { label: "Mid (65%)", val: 65 },
                  { label: "Fg (88%)", val: 88 },
                  { label: "Bleed", val: 115 }
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => updateSelectedActor({ yPercent: preset.val })}
                    className="px-1.5 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 rounded transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Center on Stage Button */}
            <button
              type="button"
              onClick={() => updateSelectedActor({ xPercent: 50, horizontalPercent: 50, yPercent: 85, scale: 1.0 })}
              className="w-full py-1 text-xs text-indigo-300 hover:text-white bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-800/50 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-1"
            >
              <Compass className="w-3.5 h-3.5 text-indigo-400" />
              <span>Center on Stage</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-6 px-4 bg-zinc-950/40 border border-zinc-800/60 rounded-xl space-y-1.5">
          <User className="w-5 h-5 text-zinc-600 mx-auto" />
          <p className="text-xs font-medium text-zinc-400">No actors currently on stage</p>
          <p className="text-[11px] text-zinc-500">Select a character above or open Pose Inspector to stage an actor.</p>
        </div>
      )}
    </div>
  );
};
