import React, { useState } from "react";
import { ScenePlanning, formatShotNumber, generateSaveVideoPrefix, sanitizeFilenamePart, generatePromptPrefix, assembleFinalPrompt } from "../types";
import { 
  Clapperboard, 
  Camera, 
  Film, 
  Move, 
  Hash, 
  Copy, 
  Check, 
  Sparkles,
  Layers,
  Video
} from "lucide-react";

export { formatShotNumber, generateSaveVideoPrefix, sanitizeFilenamePart, generatePromptPrefix, assembleFinalPrompt };

export const SHOT_TYPES = [
  { label: "Extreme Wide Shot (EWS)", value: "Extreme Wide Shot" },
  { label: "Wide Shot (WS)", value: "Wide Shot" },
  { label: "Medium Wide Shot (MWS)", value: "Medium Wide Shot" },
  { label: "Medium Shot (MS)", value: "Medium Shot" },
  { label: "Medium Close-Up (MCU)", value: "Medium Close-Up" },
  { label: "Close-Up (CU)", value: "Close-Up" },
  { label: "Extreme Close-Up (ECU)", value: "Extreme Close-Up" },
  { label: "Over-the-Shoulder (OTS)", value: "Over-the-Shoulder" },
  { label: "Low Angle", value: "Low Angle" },
  { label: "High Angle", value: "High Angle" },
  { label: "Bird's Eye View", value: "Bird's Eye View" }
];

export const CAMERA_MOVEMENTS = [
  { label: "Locked Off (Static)", value: "Locked Off" },
  { label: "Slow Push In (Dolly In)", value: "Slow Push In" },
  { label: "Pull Out (Dolly Out)", value: "Pull Out" },
  { label: "Pan Left", value: "Pan Left" },
  { label: "Pan Right", value: "Pan Right" },
  { label: "Tilt Up", value: "Tilt Up" },
  { label: "Tilt Down", value: "Tilt Down" },
  { label: "Tracking Shot", value: "Tracking Shot" },
  { label: "Handheld Drift", value: "Handheld Drift" },
  { label: "Orbit Shot", value: "Orbit Shot" },
  { label: "Zoom In", value: "Zoom In" },
  { label: "Zoom Out", value: "Zoom Out" }
];

interface ScenePlanningHeaderProps {
  planning: ScenePlanning;
  onChangePlanning: (newPlanning: ScenePlanning) => void;
}

export const ScenePlanningHeader: React.FC<ScenePlanningHeaderProps> = ({
  planning,
  onChangePlanning
}) => {
  const [copied, setCopied] = useState(false);

  const prefix = generatePromptPrefix(planning);
  const formattedShot = formatShotNumber(planning.shot_number);

  const handleSceneNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChangePlanning({ ...planning, scene_name: e.target.value });
  };

  const handleShotNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, "");
    onChangePlanning({ ...planning, shot_number: val });
  };

  const handleShotTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChangePlanning({ ...planning, shot_type: e.target.value });
  };

  const handleCameraMovementChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChangePlanning({ ...planning, camera_movement: e.target.value });
  };

  const handleCopy = () => {
    if (!prefix) return;
    navigator.clipboard.writeText(prefix);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-zinc-950/80 border-2 border-indigo-500/40 hover:border-indigo-500/60 rounded-xl p-4 shadow-md space-y-3.5 transition-all">
      {/* Header & Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <Clapperboard className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              Scene &amp; Camera Planning
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-indigo-950/60 text-indigo-300 border border-indigo-800/60">
                Prompt Prefix Generator
              </span>
            </h2>
            <p className="text-[11px] text-zinc-400">
              Configure cinematic shot details. Assembles into a standardized prompt prefix automatically baked into ComfyUI prompt node.
            </p>
          </div>
        </div>

        {/* Current Shot Badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-md bg-zinc-900 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
            <Film className="w-3.5 h-3.5 text-indigo-400" />
            Shot {formattedShot}
          </span>
        </div>
      </div>

      {/* 4-Column Controls Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Shot Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Shot Name</span>
          </label>
          <input
            type="text"
            value={planning.scene_name}
            onChange={handleSceneNameChange}
            placeholder="e.g. Hero Close-up"
            className="w-full bg-zinc-900 border-2 border-zinc-700 focus:border-indigo-500 focus:outline-hidden text-zinc-100 text-xs px-3 py-2 rounded-lg transition-colors placeholder:text-zinc-500"
          />
        </div>

        {/* 2. Shot # */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-indigo-400" />
              <span>Shot #</span>
            </span>
            <span className="text-[10px] font-mono text-zinc-400">Padded: {formattedShot}</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={planning.shot_number}
              onChange={handleShotNumberChange}
              placeholder="e.g. 12"
              className="w-full bg-zinc-900 border-2 border-zinc-700 focus:border-indigo-500 focus:outline-hidden text-zinc-100 font-mono text-xs px-3 py-2 rounded-lg transition-colors placeholder:text-zinc-500"
            />
          </div>
        </div>

        {/* 3. Shot Type */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-indigo-400" />
            <span>Shot Type</span>
          </label>
          <select
            value={planning.shot_type}
            onChange={handleShotTypeChange}
            className="w-full bg-zinc-900 border-2 border-zinc-700 focus:border-indigo-500 focus:outline-hidden text-zinc-100 text-xs px-3 py-2 rounded-lg transition-colors cursor-pointer"
          >
            {SHOT_TYPES.map((st) => (
              <option key={st.value} value={st.value}>
                {st.label}
              </option>
            ))}
          </select>
        </div>

        {/* 4. Camera Movement */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <Move className="w-3.5 h-3.5 text-indigo-400" />
            <span>Camera Movement</span>
          </label>
          <select
            value={planning.camera_movement}
            onChange={handleCameraMovementChange}
            className="w-full bg-zinc-900 border-2 border-zinc-700 focus:border-indigo-500 focus:outline-hidden text-zinc-100 text-xs px-3 py-2 rounded-lg transition-colors cursor-pointer"
          >
            {CAMERA_MOVEMENTS.map((cm) => (
              <option key={cm.value} value={cm.value}>
                {cm.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Dynamic Prefix Live Preview Banner & SaveVideo Output Preview */}
      <div className="space-y-2">
        <div className="bg-zinc-900/90 border border-indigo-950/80 rounded-lg p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 overflow-hidden min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400 px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-800/40 shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Assembled Prefix
            </span>
            <code className="text-indigo-200 font-mono text-xs font-medium truncate select-all">
              {prefix || "Scene & Shot details will appear here..."}
            </code>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="px-2.5 py-1 text-[11px] font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-md transition-colors shrink-0 flex items-center gap-1 self-end sm:self-auto"
            title="Copy prefix to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-zinc-400" />
                <span>Copy Prefix</span>
              </>
            )}
          </button>
        </div>

        {/* Subtle Read-only Output Prefix Indicator */}
        <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-md px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 font-mono text-[11px] min-w-0">
            <span className="text-zinc-400 font-medium shrink-0 flex items-center gap-1.5">
              <Video className="w-3.5 h-3.5 text-indigo-400" />
              Output Prefix:
            </span>
            <code className="text-emerald-400 font-semibold truncate select-all">
              {generateSaveVideoPrefix(planning.scene_name, planning.shot_number) 
                ? `${generateSaveVideoPrefix(planning.scene_name, planning.shot_number)}#####.mp4`
                : "video/MiniMax_Output_#####.mp4"}
            </code>
          </div>
          <span className="text-[10px] text-zinc-500 font-sans">
            Auto-synced to SaveVideo node (#92 / SaveVideo)
          </span>
        </div>
      </div>
    </div>
  );
};
