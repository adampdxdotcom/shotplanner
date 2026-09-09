import React from "react";
import { Sliders, Plus, UserPlus, X, Eraser, Trash2, Compass, User, FlipHorizontal } from "lucide-react";
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
    <div id="staging-actor-inspector" className="staging-inspector-panel w-full bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 shadow-xs">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/30 flex items-center justify-center shrink-0">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-200 uppercase tracking-wider">
                Actor Blocking Controls
              </h4>
              {stagedActors[selectedActorIndex] && (
                <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/20 px-2 py-0.5 rounded">
                  {stagedActors[selectedActorIndex].characterName}
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
              Spatial positioning, scale, floor anchor, and layer masking
            </p>
          </div>
        </div>

        {/* Cast Quick-Add Buttons & Pose Inspector */}
        <div className="flex items-center flex-wrap gap-2">
          <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Add Cast:</span>
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
                      ? "bg-zinc-100 text-zinc-700 border border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700" 
                      : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/60 dark:hover:bg-indigo-900"
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
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-600 shadow-xs dark:bg-indigo-950/70 dark:hover:bg-indigo-900 dark:border-indigo-800/80 dark:text-indigo-300 dark:hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Pose Inspector</span>
          </button>
        </div>
      </div>

      {stagedActors[selectedActorIndex] ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
          {/* Col 1: Figure Representation & Live Masking */}
          <div className="space-y-3 bg-slate-50/70 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-3.5 flex flex-col justify-between h-full shadow-xs">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-300">Figure Representation</span>
                {stagedActors[selectedActorIndex].cutoutDataUrl ? (
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-1.5 py-0.5 rounded">
                    Transparent Cutout Active
                  </span>
                ) : (
                  <span className="text-[10px] text-zinc-500 font-mono">Headshot Token</span>
                )}
              </div>

              {stagedActors[selectedActorIndex].cutoutDataUrl ? (
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-2.5">
                    <div 
                      className="w-10 h-10 rounded border border-zinc-300 dark:border-zinc-700 overflow-hidden flex items-center justify-center shrink-0 bg-white"
                      style={{
                        backgroundImage: `conic-gradient(#e2e8f0 90deg, #ffffff 90deg 180deg, #e2e8f0 180deg 270deg, #ffffff 270deg)`,
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
                      <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 truncate">
                        {stagedActors[selectedActorIndex].posture || "Custom Pose"}
                      </div>
                      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                        Keyed chroma background
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onOpenPoseInspector(stagedActors[selectedActorIndex].characterName)}
                      className="text-xs text-indigo-700 hover:text-indigo-900 bg-indigo-50 border border-indigo-200 dark:text-indigo-300 dark:hover:text-white dark:bg-indigo-950/70 dark:border-indigo-800/80 px-2 py-1 rounded transition-colors cursor-pointer"
                    >
                      Re-Key
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSelectedActor({ cutoutDataUrl: undefined })}
                      className="text-xs text-zinc-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400 p-1 rounded transition-colors cursor-pointer"
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
                  className="w-full border-2 border-dashed border-zinc-300 hover:border-indigo-500 dark:border-zinc-800 dark:hover:border-indigo-500/50 bg-white hover:bg-indigo-50/40 dark:bg-transparent dark:hover:bg-indigo-500/10 rounded-lg p-2 flex flex-col items-center justify-center gap-1 transition-colors group cursor-pointer shadow-xs"
                >
                  <UserPlus className="w-4 h-4 text-zinc-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
                  <span className="text-[10px] font-medium text-zinc-600 group-hover:text-indigo-700 dark:text-zinc-400 dark:group-hover:text-indigo-300">
                    Apply Cutout / Pose
                  </span>
                </button>
              )}
            </div>

            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/60 mt-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-800 dark:text-zinc-300 mb-2">
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
                      : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 dark:text-indigo-200 dark:border-indigo-700/60"
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
                    className="py-1.5 px-2.5 rounded-lg text-xs font-medium text-zinc-700 hover:text-zinc-900 bg-white hover:bg-zinc-100 border border-zinc-300 dark:text-zinc-400 dark:hover:text-white dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-700 transition-colors cursor-pointer shadow-xs"
                    title="Reset all mask modifications and restore the complete actor cutout"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Col 2: Scale, Flip, Posture & Facing */}
          <div className="space-y-3 bg-slate-50/70 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-3.5 flex flex-col justify-between h-full shadow-xs">
            <div className="space-y-3">
              {/* Scale Control */}
              <div>
                <div className="flex items-center justify-between text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  <span>Scale Factor</span>
                  <span className="font-mono text-zinc-900 dark:text-zinc-200 font-semibold">
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
                  className="w-full accent-indigo-600 dark:accent-indigo-500 cursor-pointer"
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
                      className="px-1.5 py-0.5 bg-white hover:bg-zinc-100 text-zinc-700 hover:text-zinc-900 border border-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 dark:border-zinc-800 rounded transition-colors shadow-2xs"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Posture & Facing Selectors */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800/80">
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">Posture</label>
                  <select
                    value={stagedActors[selectedActorIndex].posture || "Standing Heroic"}
                    onChange={(e) => updateSelectedActor({ posture: e.target.value })}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg px-2 py-1 text-xs text-zinc-900 dark:text-zinc-200 outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
                  >
                    <option value="Standing Heroic">Standing Heroic</option>
                    <option value="Walking Forward">Walking Forward</option>
                    <option value="Sitting">Sitting</option>
                    <option value="Dramatic Turn">Dramatic Turn</option>
                    <option value="Crouching / Stealth">Crouching / Stealth</option>
                    <option value="Leaning">Leaning</option>
                    <option value="Action Stance">Action Stance</option>
                    <option value="Arms Crossed">Arms Crossed</option>
                    <option value="Looking at Screen / Tablet">Looking at Tablet</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">Facing Direction</label>
                  <select
                    value={stagedActors[selectedActorIndex].facing || "facing_camera"}
                    onChange={(e) => updateSelectedActor({ facing: e.target.value as any })}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg px-2 py-1 text-xs text-zinc-900 dark:text-zinc-200 outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
                  >
                    <option value="facing_camera">Facing Camera</option>
                    <option value="turn_left">Turn Left (3/4)</option>
                    <option value="turn_right">Turn Right (3/4)</option>
                    <option value="profile_left">Profile Left</option>
                    <option value="profile_right">Profile Right</option>
                    <option value="back_camera">Back to Camera</option>
                  </select>
                </div>
              </div>

              {/* Horizontal Flip & Plane Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => updateSelectedActor({ isFlipped: !stagedActors[selectedActorIndex].isFlipped })}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer border ${
                    stagedActors[selectedActorIndex].isFlipped
                      ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40"
                      : "bg-white hover:bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-800"
                  }`}
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                  <span>{stagedActors[selectedActorIndex].isFlipped ? "Flipped" : "Flip Horizontal"}</span>
                </button>

                <select
                  value={stagedActors[selectedActorIndex].plane || "midground"}
                  onChange={(e) => updateSelectedActor({ plane: e.target.value as any })}
                  className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
                  title="Depth plane layer"
                >
                  <option value="background">Background</option>
                  <option value="midground">Midground</option>
                  <option value="foreground">Foreground</option>
                </select>
              </div>
            </div>

            {/* Quick remove from stage */}
            {stagedActors.length > 0 && stagedActors[selectedActorIndex] && (
              <button
                type="button"
                onClick={() => handleRemoveActorFromStage(selectedActorIndex)}
                className="w-full py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/30 dark:border-red-900/40 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-2 shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove {stagedActors[selectedActorIndex].characterName}</span>
              </button>
            )}
          </div>

          {/* Col 3: Stage Position (X-Axis) & Floor Anchor (Y-Axis) */}
          <div className="space-y-3 bg-slate-50/70 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-3.5 flex flex-col justify-between h-full shadow-xs">
            {/* Horizontal Placement Slider */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                <span>Stage Position (X-Axis)</span>
                <span className="font-mono text-zinc-900 dark:text-zinc-300 font-semibold">
                  {Math.round(stagedActors[selectedActorIndex].xPercent)}%
                  {stagedActors[selectedActorIndex].xPercent < 0 ? (
                    <span className="text-amber-600 dark:text-amber-400 text-[10px] ml-1">(Off-L)</span>
                  ) : stagedActors[selectedActorIndex].xPercent > 100 ? (
                    <span className="text-amber-600 dark:text-amber-400 text-[10px] ml-1">(Off-R)</span>
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
                className="w-full accent-indigo-600 dark:accent-indigo-500 cursor-pointer"
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
                    className="px-1.5 py-0.5 bg-white hover:bg-zinc-100 text-zinc-700 hover:text-zinc-900 border border-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 dark:border-zinc-800 rounded transition-colors shadow-2xs"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Vertical Floor Anchor Slider */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                <span>Floor Anchor (Y-Axis)</span>
                <span className="font-mono text-zinc-900 dark:text-zinc-300 font-semibold">
                  {Math.round(stagedActors[selectedActorIndex].yPercent)}%
                  {stagedActors[selectedActorIndex].yPercent > 100 ? (
                    <span className="text-amber-600 dark:text-amber-400 text-[10px] ml-1">(Bleed)</span>
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
                className="w-full accent-indigo-600 dark:accent-indigo-500 cursor-pointer"
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
                    className="px-1.5 py-0.5 bg-white hover:bg-zinc-100 text-zinc-700 hover:text-zinc-900 border border-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 dark:border-zinc-800 rounded transition-colors shadow-2xs"
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
              className="w-full py-1.5 text-xs text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 dark:text-indigo-300 dark:hover:text-white dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 dark:border-indigo-800/50 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-1 shadow-2xs"
            >
              <Compass className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Center on Stage</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-6 px-4 bg-slate-50/80 dark:bg-zinc-950/40 border-2 border-dashed border-zinc-200 dark:border-zinc-800/60 rounded-xl space-y-1.5 shadow-2xs">
          <User className="w-6 h-6 text-zinc-400 dark:text-zinc-600 mx-auto" />
          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-400">No actors currently on stage</p>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-500">Select a character above or open Pose Inspector to stage an actor.</p>
        </div>
      )}
    </div>
  );
};
