// Asset reference modifiers configuration and description injection utilities

export interface ModifierPreset {
  id: string;
  label: string;
  modifier: string; // e.g. "facing", "3/4 profile", "full profile"
}

export interface AssetTypeModifierConfig {
  assetType: string;
  baseTag: string;
  modifiers: ModifierPreset[];
}

/**
 * Modular configuration map for asset reference types and their available modifier presets.
 */
export const ASSET_REFERENCE_MODIFIERS: Record<string, AssetTypeModifierConfig> = {
  Headshot: {
    assetType: "Headshot",
    baseTag: "headshot",
    modifiers: [
      { id: "facing", label: "Facing", modifier: "facing" },
      { id: "three_quarter", label: "3/4 Profile", modifier: "3/4 profile" },
      { id: "full_profile", label: "Full Profile", modifier: "full profile" },
    ],
  },
  "Body Reference": {
    assetType: "Body Reference",
    baseTag: "body reference",
    modifiers: [
      { id: "pose", label: "Pose (Staging / Cutout)", modifier: "pose" },
      { id: "full_body", label: "Full Body", modifier: "full body" },
      { id: "upper_body", label: "Upper Body / Outfit", modifier: "upper body" },
    ],
  },
  "Body / Outfit": {
    assetType: "Body Reference",
    baseTag: "body reference",
    modifiers: [
      { id: "pose", label: "Pose (Staging / Cutout)", modifier: "pose" },
      { id: "full_body", label: "Full Body", modifier: "full body" },
      { id: "upper_body", label: "Upper Body / Outfit", modifier: "upper body" },
    ],
  },
  "Scene Reference": {
    assetType: "Scene Reference",
    baseTag: "scene reference",
    modifiers: [
      { id: "wide", label: "Wide / Establishing", modifier: "wide shot" },
      { id: "medium", label: "Medium View", modifier: "medium view" },
      { id: "reverse", label: "Reverse Angle", modifier: "reverse angle" },
      { id: "detail", label: "Detail / Close", modifier: "detail view" },
    ],
  },
  "Scene / Location Reference": {
    assetType: "Scene Reference",
    baseTag: "scene reference",
    modifiers: [
      { id: "wide", label: "Wide / Establishing", modifier: "wide shot" },
      { id: "medium", label: "Medium View", modifier: "medium view" },
      { id: "reverse", label: "Reverse Angle", modifier: "reverse angle" },
      { id: "detail", label: "Detail / Close", modifier: "detail view" },
    ],
  },
};

/**
 * Normalizes and retrieves the modifier config for any matching asset type.
 */
export function getModifierConfig(assetType?: string): AssetTypeModifierConfig | undefined {
  if (!assetType) return undefined;
  const trimmed = assetType.trim();
  if (ASSET_REFERENCE_MODIFIERS[trimmed]) return ASSET_REFERENCE_MODIFIERS[trimmed];
  const lower = trimmed.toLowerCase();
  if (lower.includes("headshot")) return ASSET_REFERENCE_MODIFIERS.Headshot;
  if (lower.includes("body") || lower.includes("outfit")) return ASSET_REFERENCE_MODIFIERS["Body Reference"];
  if (lower.includes("scene") || lower.includes("location") || lower.includes("environment")) return ASSET_REFERENCE_MODIFIERS["Scene Reference"];
  return undefined;
}

/**
 * Generates the standardized lowercase combined tag formatted as `{asset_type} {modifier}`.
 */
export function formatModifierTag(baseTag: string, modifier: string): string {
  const cleanBase = baseTag.trim().toLowerCase();
  const cleanMod = modifier.trim().toLowerCase();
  return `${cleanBase} ${cleanMod}`;
}

/**
 * Gets all possible combined tag variants for a given asset type.
 */
export function getAllTagsForAssetType(assetType: string): string[] {
  const config = getModifierConfig(assetType);
  if (!config) return [];
  return config.modifiers.map(m => formatModifierTag(config.baseTag, m.modifier));
}

/**
 * Detects which modifier (if any) is currently present in the description string for an asset type.
 */
export function detectActiveModifier(description: string, assetType: string): string {
  const config = getModifierConfig(assetType);
  if (!config || !description) return "";

  const lowerDesc = description.toLowerCase();
  for (const mod of config.modifiers) {
    const tag = formatModifierTag(config.baseTag, mod.modifier);
    if (lowerDesc.includes(tag)) {
      return mod.modifier;
    }
  }
  return "";
}

/**
 * Reactively updates a description string with the selected modifier:
 * - If a tag from the same category already exists, it is replaced cleanly.
 * - If selecting an empty modifier, existing tags from that category are removed.
 * - If no tag exists and a modifier is chosen, the tag is inserted/prepended with clean punctuation.
 */
export function updateDescriptionWithModifier(
  currentDescription: string,
  assetType: string,
  selectedModifier: string
): string {
  const config = getModifierConfig(assetType);
  if (!config) return currentDescription;

  const allTags = getAllTagsForAssetType(assetType);
  const newTag = selectedModifier ? formatModifierTag(config.baseTag, selectedModifier) : "";

  let desc = currentDescription || "";

  // Check if any existing specific modifier tag is present in the description
  let replaced = false;
  for (const tag of allTags) {
    // Regex matching case-insensitively with boundary checks
    const escapedTag = tag.replace(/[.*+?^${}()|[\]\/\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedTag}\\b`, 'i');

    if (regex.test(desc)) {
      if (newTag) {
        // Replace existing tag with new tag
        desc = desc.replace(regex, newTag);
      } else {
        // Remove existing tag and any following comma/space
        desc = desc.replace(new RegExp(`\\b${escapedTag}\\b[,;]?\\s*`, 'i'), '');
      }
      replaced = true;
      break;
    }
  }

  // If no specific modifier tag was found, check if lone baseTag is present (e.g. "body reference" or "headshot")
  if (!replaced) {
    const escapedBase = config.baseTag.replace(/[.*+?^${}()|[\]\/\\]/g, '\\$&');
    const baseRegex = new RegExp(`\\b${escapedBase}\\b`, 'i');
    if (baseRegex.test(desc)) {
      if (newTag) {
        desc = desc.replace(baseRegex, newTag);
        replaced = true;
      } else {
        desc = desc.replace(new RegExp(`\\b${escapedBase}\\b[,;]?\\s*`, 'i'), '');
        replaced = true;
      }
    }
  }

  // If no previous tag was found to replace and a new tag is selected
  if (!replaced && newTag) {
    const trimmed = desc.trim();
    if (!trimmed) {
      desc = `${newTag}, `;
    } else {
      desc = `${newTag}, ${trimmed}`;
    }
  }

  return desc;
}
