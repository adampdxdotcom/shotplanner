import React from "react";
import { Eye, Shirt, Sun, Camera } from "lucide-react";

export interface VisualIntelligenceBreakdownValues {
  summary: string;
  subjectIdentifiedName: string;
  subjectAge: string;
  subjectExpression: string;
  subjectHair: string;
  wardrobeGarments: string;
  wardrobeColors: string;
  wardrobeEra: string;
  lightingQuality: string;
  lightingDirection: string;
  lightingTemp: string;
  cinemaFraming: string;
  cinemaLens: string;
  cinemaAngle: string;
  envLocationType: string;
  envPalette: string;
}

interface VisualIntelligenceBreakdownEditorProps {
  values: VisualIntelligenceBreakdownValues;
  onChangeField: <K extends keyof VisualIntelligenceBreakdownValues>(
    field: K,
    value: VisualIntelligenceBreakdownValues[K]
  ) => void;
}

export const VisualIntelligenceBreakdownEditor: React.FC<VisualIntelligenceBreakdownEditorProps> = ({
  values,
  onChangeField
}) => {
  return (
    <div className="bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3.5 space-y-3 shadow-2xs">
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800/80 pb-2">
        <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
          <Eye className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          Visual Intelligence Breakdown
        </span>
        <span className="text-[10px] text-zinc-500 font-mono">Editable Cache</span>
      </div>

      {/* Overall Summary */}
      <div>
        <label className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-400 mb-1">
          Visual Summary
        </label>
        <textarea
          value={values.summary}
          onChange={(e) => onChangeField("summary", e.target.value)}
          rows={2}
          placeholder="Overall description of subject, lighting, framing..."
          className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700/80 rounded-lg px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-200 focus:border-amber-500 outline-none resize-none placeholder-zinc-400 dark:placeholder-zinc-600 shadow-2xs"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
        {/* Subject Details */}
        <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 flex flex-col gap-1.5 shadow-2xs">
          <span className="font-semibold text-indigo-600 dark:text-indigo-400 text-[11px] flex items-center gap-1">
            Subject / Actor Details
          </span>
          <div>
            <label className="block text-[10px] text-zinc-500 dark:text-zinc-400">Identified Name</label>
            <input
              type="text"
              value={values.subjectIdentifiedName}
              onChange={(e) => onChangeField("subjectIdentifiedName", e.target.value)}
              placeholder="e.g., John / Hero"
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700/60 rounded px-2 py-1 text-[11px] text-zinc-900 dark:text-zinc-200 focus:border-indigo-500 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="block text-[10px] text-zinc-500 dark:text-zinc-400">Apparent Age</label>
              <input
                type="text"
                value={values.subjectAge}
                onChange={(e) => onChangeField("subjectAge", e.target.value)}
                placeholder="e.g., Late 20s"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700/60 rounded px-2 py-1 text-[11px] text-zinc-900 dark:text-zinc-200 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-500 dark:text-zinc-400">Expression</label>
              <input
                type="text"
                value={values.subjectExpression}
                onChange={(e) => onChangeField("subjectExpression", e.target.value)}
                placeholder="e.g., Stern, focused"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700/60 rounded px-2 py-1 text-[11px] text-zinc-900 dark:text-zinc-200 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-zinc-500 dark:text-zinc-400">Hair & Features</label>
            <input
              type="text"
              value={values.subjectHair}
              onChange={(e) => onChangeField("subjectHair", e.target.value)}
              placeholder="e.g., Short dark hair"
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700/60 rounded px-2 py-1 text-[11px] text-zinc-900 dark:text-zinc-200 focus:border-indigo-500 outline-none"
            />
          </div>
        </div>

        {/* Wardrobe & Style */}
        <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 flex flex-col gap-1.5 shadow-2xs">
          <span className="font-semibold text-amber-600 dark:text-amber-400 text-[11px] flex items-center gap-1">
            <Shirt className="w-3 h-3" />
            Wardrobe & Style
          </span>
          <div>
            <label className="block text-[10px] text-zinc-500 dark:text-zinc-400">Garments</label>
            <input
              type="text"
              value={values.wardrobeGarments}
              onChange={(e) => onChangeField("wardrobeGarments", e.target.value)}
              placeholder="e.g., Leather jacket, t-shirt"
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700/60 rounded px-2 py-1 text-[11px] text-zinc-900 dark:text-zinc-200 focus:border-amber-500 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="block text-[10px] text-zinc-500 dark:text-zinc-400">Colors</label>
              <input
                type="text"
                value={values.wardrobeColors}
                onChange={(e) => onChangeField("wardrobeColors", e.target.value)}
                placeholder="e.g., Black, crimson"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700/60 rounded px-2 py-1 text-[11px] text-zinc-900 dark:text-zinc-200 focus:border-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-500 dark:text-zinc-400">Era / Style</label>
              <input
                type="text"
                value={values.wardrobeEra}
                onChange={(e) => onChangeField("wardrobeEra", e.target.value)}
                placeholder="e.g., Cyberpunk, 90s"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700/60 rounded px-2 py-1 text-[11px] text-zinc-900 dark:text-zinc-200 focus:border-amber-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Lighting Setup */}
        <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 flex flex-col gap-1.5 shadow-2xs">
          <span className="font-semibold text-yellow-600 dark:text-yellow-400 text-[11px] flex items-center gap-1">
            <Sun className="w-3 h-3" />
            Lighting Setup
          </span>
          <div>
            <label className="block text-[10px] text-zinc-500 dark:text-zinc-400">Quality</label>
            <input
              type="text"
              value={values.lightingQuality}
              onChange={(e) => onChangeField("lightingQuality", e.target.value)}
              placeholder="e.g., Hard contrast, soft diffuse"
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700/60 rounded px-2 py-1 text-[11px] text-zinc-900 dark:text-zinc-200 focus:border-yellow-500 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="block text-[10px] text-zinc-500 dark:text-zinc-400">Key Direction</label>
              <input
                type="text"
                value={values.lightingDirection}
                onChange={(e) => onChangeField("lightingDirection", e.target.value)}
                placeholder="e.g., Side-lit 45 deg"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700/60 rounded px-2 py-1 text-[11px] text-zinc-900 dark:text-zinc-200 focus:border-yellow-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-500 dark:text-zinc-400">Color Temp</label>
              <input
                type="text"
                value={values.lightingTemp}
                onChange={(e) => onChangeField("lightingTemp", e.target.value)}
                placeholder="e.g., Cool blue, warm tungsten"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700/60 rounded px-2 py-1 text-[11px] text-zinc-900 dark:text-zinc-200 focus:border-yellow-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Cinematography */}
        <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 flex flex-col gap-1.5 shadow-2xs">
          <span className="font-semibold text-blue-600 dark:text-blue-400 text-[11px] flex items-center gap-1">
            <Camera className="w-3 h-3" />
            Cinematography
          </span>
          <div>
            <label className="block text-[10px] text-zinc-500 dark:text-zinc-400">Framing / Shot Type</label>
            <input
              type="text"
              value={values.cinemaFraming}
              onChange={(e) => onChangeField("cinemaFraming", e.target.value)}
              placeholder="e.g., Close-Up, Medium Shot"
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700/60 rounded px-2 py-1 text-[11px] text-zinc-900 dark:text-zinc-200 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="block text-[10px] text-zinc-500 dark:text-zinc-400">Lens Feel</label>
              <input
                type="text"
                value={values.cinemaLens}
                onChange={(e) => onChangeField("cinemaLens", e.target.value)}
                placeholder="e.g., 50mm, anamorphic"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700/60 rounded px-2 py-1 text-[11px] text-zinc-900 dark:text-zinc-200 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-500 dark:text-zinc-400">Camera Angle</label>
              <input
                type="text"
                value={values.cinemaAngle}
                onChange={(e) => onChangeField("cinemaAngle", e.target.value)}
                placeholder="e.g., Eye-level, low angle"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700/60 rounded px-2 py-1 text-[11px] text-zinc-900 dark:text-zinc-200 focus:border-blue-500 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Environment & Palette */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 border-t border-zinc-200 dark:border-zinc-800/60">
        <div>
          <label className="block text-[10px] font-medium text-zinc-600 dark:text-zinc-400 mb-0.5">Location Type</label>
          <input
            type="text"
            value={values.envLocationType}
            onChange={(e) => onChangeField("envLocationType", e.target.value)}
            placeholder="e.g., Cyberpunk alleyway, studio interior"
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700/60 rounded px-2 py-1 text-[11px] text-zinc-900 dark:text-zinc-200 focus:border-emerald-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-zinc-600 dark:text-zinc-400 mb-0.5">Dominant Palette</label>
          <input
            type="text"
            value={values.envPalette}
            onChange={(e) => onChangeField("envPalette", e.target.value)}
            placeholder="e.g., Neon cyan, dark purple"
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700/60 rounded px-2 py-1 text-[11px] text-zinc-900 dark:text-zinc-200 focus:border-emerald-500 outline-none"
          />
        </div>
      </div>
    </div>
  );
};
