import React from "react";
import { AssetTypeModifierConfig } from "../../../utils/assetModifiers";

export const PRESET_TYPES = [
  { value: "Headshot", label: "Headshot (Face)" },
  { value: "Body Reference", label: "Body / Outfit" },
  { value: "Scene / Location", label: "Scene / Location" },
  { value: "Object / Prop", label: "Object / Prop" },
  { value: "Style / Mood", label: "Style / Mood" },
  { value: "Other", label: "Other" }
];

interface AssetReferenceTypeSelectorProps {
  assetType: string;
  customType: string;
  selectedModifier: string;
  modifierConfig: AssetTypeModifierConfig | null;
  onTypeChange: (type: string) => void;
  onCustomTypeChange: (customType: string) => void;
  onModifierChange: (modifier: string) => void;
}

export const AssetReferenceTypeSelector: React.FC<AssetReferenceTypeSelectorProps> = ({
  assetType,
  customType,
  selectedModifier,
  modifierConfig,
  onTypeChange,
  onCustomTypeChange,
  onModifierChange
}) => {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-400 mb-1">Type of Reference</label>
      <div className="flex gap-2 flex-wrap sm:flex-nowrap">
        <select 
          value={assetType}
          onChange={(e) => onTypeChange(e.target.value)}
          className="bg-white dark:bg-zinc-950 border-2 border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:border-amber-500 transition-colors outline-none flex-1 min-w-[140px] shadow-2xs"
        >
          {PRESET_TYPES.map(preset => (
            <option key={preset.value} value={preset.value}>
              {preset.label}
            </option>
          ))}
        </select>

        {modifierConfig && (
          <select
            value={selectedModifier}
            onChange={(e) => onModifierChange(e.target.value)}
            className="bg-white dark:bg-zinc-950 border-2 border-amber-500/40 dark:border-amber-600/40 rounded-lg px-3 py-2 text-sm text-amber-800 dark:text-amber-300 focus:border-amber-500 transition-colors outline-none shrink-0 shadow-2xs"
          >
            <option value="">Modifier (Optional)...</option>
            {modifierConfig.modifiers.map(preset => (
              <option key={preset.id} value={preset.modifier}>
                {preset.label}
              </option>
            ))}
          </select>
        )}

        {assetType === "Other" && (
          <input
            type="text"
            value={customType}
            onChange={(e) => onCustomTypeChange(e.target.value)}
            placeholder="Custom type..."
            className="flex-1 bg-white dark:bg-zinc-950 border-2 border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:border-amber-500 transition-colors outline-none shadow-2xs"
          />
        )}
      </div>
    </div>
  );
};
