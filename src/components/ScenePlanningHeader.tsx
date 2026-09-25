import React, { useState, useMemo } from "react";
import { ScenePlanning, formatShotNumber, generateSaveVideoPrefix, sanitizeFilenamePart, generatePromptPrefix, assembleFinalPrompt } from "../types";
import { copyToClipboard } from "../utils/clipboard";
import { 
  CAMERA_MOVEMENTS, 
  SHOT_TYPES, 
  LENS_PRESETS, 
  normalizeCameraMovement, 
  normalizeShotType, 
  normalizeLensPreset 
} from "../utils/cameraPresets";
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
  Video, 
  Aperture, 
  RectangleHorizontal,
  UserPlus,
  ShieldCheck
} from "lucide-react";

export { formatShotNumber, generateSaveVideoPrefix, sanitizeFilenamePart, generatePromptPrefix, assembleFinalPrompt };
export { CAMERA_MOVEMENTS, SHOT_TYPES, LENS_PRESETS };

export const ASPECT_RATIO_PRESETS = [
  { label: "16:9 Widescreen", value: "16:9 Widescreen" },
  { label: "2.39:1 Anamorphic Scope", value: "2.39:1 Anamorphic Scope" },
  { label: "3:2 Landscape", value: "3:2 Landscape" },
  { label: "4:3 Classic", value: "4:3 Classic" },
  { label: "1:1 Square", value: "1:1 Square" },
  { label: "2:3 Portrait", value: "2:3 Portrait" },
  { label: "9:16 Vertical (Reels)", value: "9:16 Vertical (Reels)" }
];

interface ScenePlanningHeaderProps {
  planning: ScenePlanning;
  onChangePlanning: (newPlanning: ScenePlanning) => void;
  onAddCharacter?: () => void;
  onAuditContinuity?: () => void;
}

export const ScenePlanningHeader: React.FC<ScenePlanningHeaderProps> = ({
  planning,
  onChangePlanning,
  onAddCharacter,
  onAuditContinuity
}) => {
  const [copied, setCopied] = useState(false);

  const prefix = generatePromptPrefix(planning);
  const formattedShot = formatShotNumber(planning.shot_number);

  const normalizedAspectRatio = useMemo(() => {
    const current = planning.aspect_ratio?.trim();
    if (!current) return "16:9 Widescreen";
    const exactMatch = ASPECT_RATIO_PRESETS.find(p => p.value === current);
    if (exactMatch) return exactMatch.value;
    const prefixMatch = ASPECT_RATIO_PRESETS.find(p => 
      p.value.toLowerCase().startsWith(current.toLowerCase()) || 
      current.toLowerCase().startsWith(p.value.split(" ")[0].toLowerCase())
    );
    if (prefixMatch) return prefixMatch.value;
    return current;
  }, [planning.aspect_ratio]);

  const normalizedShotType = useMemo(() => normalizeShotType(planning.shot_type), [planning.shot_type]);
  const normalizedCameraMovement = useMemo(() => normalizeCameraMovement(planning.camera_movement), [planning.camera_movement]);
  const normalizedLens = useMemo(() => normalizeLensPreset(planning.lens_focal_length), [planning.lens_focal_length]);

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

  const handleLensChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChangePlanning({ ...planning, lens_focal_length: e.target.value });
  };

  const handleAspectRatioChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChangePlanning({ ...planning, aspect_ratio: e.target.value });
  };

  const handleCopy = async () => {
    if (!prefix) return;
    const success = await copyToClipboard(prefix);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="scene-planning-card bg-white dark:bg-zinc-950/80 border-2 border-indigo-200 dark:border-indigo-500/40 hover:border-indigo-300 dark:hover:border-indigo-500/60 rounded-xl p-4 shadow-xs space-y-3.5 transition-all">
      {/* Header & Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800/80 pb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-600/20 dark:text-indigo-400 dark:border-indigo-500/30">
            <Clapperboard className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              Scene &amp; Camera Planning
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/60">
                Prompt Prefix Generator
              </span>
            </h2>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
              Configure cinematic shot details. Assembles into a standardized prompt prefix automatically baked into ComfyUI prompt node.
            </p>
          </div>
        </div>

        {/* Current Shot Badge & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {planning.mood_genre && (
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40 truncate max-w-[160px]" title={`Mood: ${planning.mood_genre}`}>
              🎭 {planning.mood_genre}
            </span>
          )}
          {planning.time_of_day && (
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40 truncate max-w-[130px]" title={`Time: ${planning.time_of_day}`}>
              ⏰ {planning.time_of_day}
            </span>
          )}
          {planning.location_description && (
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40 truncate max-w-[180px]" title={`Location: ${planning.location_description}`}>
              📍 {planning.location_description}
            </span>
          )}
          <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-md bg-zinc-100 text-indigo-700 border border-indigo-200 dark:bg-zinc-900 dark:text-indigo-300 dark:border-indigo-500/30 flex items-center gap-1.5 shadow-xs">
            <Film className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            Shot {formattedShot}
          </span>
          {onAddCharacter && (
            <button
              type="button"
              onClick={onAddCharacter}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-semibold transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Add character to shot"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Character</span>
            </button>
          )}
          {onAuditContinuity && (
            <button
              type="button"
              onClick={onAuditContinuity}
              className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-md text-xs font-semibold transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Run AI Script Supervisor Continuity Audit across all shots"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Audit Continuity</span>
            </button>
          )}
        </div>
      </div>

      {/* 6-Column Controls Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Shot Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Shot Name</span>
          </label>
          <input
            type="text"
            value={planning.scene_name}
            onChange={handleSceneNameChange}
            placeholder="e.g. Hero Close-up"
            className="w-full bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 focus:border-indigo-500 focus:outline-hidden text-zinc-900 dark:text-zinc-100 text-xs px-3 py-2 rounded-lg transition-colors placeholder:text-zinc-400 dark:placeholder:text-zinc-500 shadow-xs"
          />
        </div>

        {/* 2. Shot # */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Shot #</span>
            </span>
            <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">Padded: {formattedShot}</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={planning.shot_number}
              onChange={handleShotNumberChange}
              placeholder="e.g. 12"
              className="w-full bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 focus:border-indigo-500 focus:outline-hidden text-zinc-900 dark:text-zinc-100 font-mono text-xs px-3 py-2 rounded-lg transition-colors placeholder:text-zinc-400 dark:placeholder:text-zinc-500 shadow-xs"
            />
          </div>
        </div>

        {/* 3. Shot Type */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Shot Type</span>
          </label>
          <select
            value={normalizedShotType}
            onChange={handleShotTypeChange}
            className="w-full bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 focus:border-indigo-500 focus:outline-hidden text-zinc-900 dark:text-zinc-100 text-xs px-3 py-2 rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            {SHOT_TYPES.map((st) => (
              <option key={st.value} value={st.value}>
                {st.label}
              </option>
            ))}
            {!SHOT_TYPES.some((st) => st.value === normalizedShotType) && (
              <option value={normalizedShotType}>{normalizedShotType}</option>
            )}
          </select>
        </div>

        {/* 4. Camera Movement */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
            <Move className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Camera Movement</span>
          </label>
          <select
            value={normalizedCameraMovement}
            onChange={handleCameraMovementChange}
            className="w-full bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 focus:border-indigo-500 focus:outline-hidden text-zinc-900 dark:text-zinc-100 text-xs px-3 py-2 rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            {CAMERA_MOVEMENTS.map((cm) => (
              <option key={cm.value} value={cm.value}>
                {cm.label}
              </option>
            ))}
            {!CAMERA_MOVEMENTS.some((cm) => cm.value === normalizedCameraMovement) && (
              <option value={normalizedCameraMovement}>{normalizedCameraMovement}</option>
            )}
          </select>
        </div>

        {/* 5. Lens / Focal Length */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
            <Aperture className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Lens / Focal Length</span>
          </label>
          <select
            value={normalizedLens}
            onChange={handleLensChange}
            className="w-full bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 focus:border-indigo-500 focus:outline-hidden text-zinc-900 dark:text-zinc-100 text-xs px-3 py-2 rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            {LENS_PRESETS.map((lp) => (
              <option key={lp.value} value={lp.value}>
                {lp.label}
              </option>
            ))}
            {!LENS_PRESETS.some((lp) => lp.value === normalizedLens) && (
              <option value={normalizedLens}>{normalizedLens}</option>
            )}
          </select>
        </div>

        {/* 6. Aspect Ratio */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
            <RectangleHorizontal className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Aspect Ratio</span>
          </label>
          <select
            value={normalizedAspectRatio}
            onChange={handleAspectRatioChange}
            className="w-full bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 focus:border-indigo-500 focus:outline-hidden text-zinc-900 dark:text-zinc-100 text-xs px-3 py-2 rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            {ASPECT_RATIO_PRESETS.map((ar) => (
              <option key={ar.value} value={ar.value}>
                {ar.label}
              </option>
            ))}
            {!ASPECT_RATIO_PRESETS.some((p) => p.value === normalizedAspectRatio) && (
              <option value={normalizedAspectRatio}>{normalizedAspectRatio}</option>
            )}
          </select>
        </div>
      </div>

      {/* Dynamic Prefix Live Preview Banner & SaveVideo Output Preview */}
      <div className="space-y-2">
        <div className="assembled-prefix-banner bg-indigo-50/80 dark:bg-zinc-900/90 border border-indigo-200 dark:border-indigo-950/80 rounded-lg p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-xs">
          <div className="flex items-center gap-2 overflow-hidden min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded bg-indigo-100/90 dark:bg-indigo-950/60 border border-indigo-300 dark:border-indigo-800/40 shrink-0 flex items-center gap-1 shadow-xs">
              <Sparkles className="w-3 h-3" />
              Assembled Prefix
            </span>
            <code className="text-indigo-950 dark:text-indigo-200 font-mono text-xs font-medium truncate select-all">
              {prefix || "Scene & Shot details will appear here..."}
            </code>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="px-2.5 py-1 text-[11px] font-medium bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 dark:border-zinc-700 rounded-md transition-colors shrink-0 flex items-center gap-1 self-end sm:self-auto shadow-xs cursor-pointer"
            title="Copy prefix to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />
                <span>Copy Prefix</span>
              </>
            )}
          </button>
        </div>

        {/* Subtle Read-only Output Prefix Indicator */}
        <div className="output-prefix-banner bg-zinc-100/80 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800/80 rounded-md px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs shadow-xs">
          <div className="flex items-center gap-2 font-mono text-[11px] min-w-0">
            <span className="text-zinc-600 dark:text-zinc-400 font-medium shrink-0 flex items-center gap-1.5">
              <Video className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              Output Prefix:
            </span>
            <code className="text-emerald-700 dark:text-emerald-400 font-semibold truncate select-all">
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
