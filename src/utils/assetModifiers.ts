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
};

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
  const config = ASSET_REFERENCE_MODIFIERS[assetType];
  if (!config) return [];
  return config.modifiers.map(m => formatModifierTag(config.baseTag, m.modifier));
}

/**
 * Detects which modifier (if any) is currently present in the description string for an asset type.
 */
export function detectActiveModifier(description: string, assetType: string): string {
  const config = ASSET_REFERENCE_MODIFIERS[assetType];
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
  const config = ASSET_REFERENCE_MODIFIERS[assetType];
  if (!config) return currentDescription;

  const allTags = getAllTagsForAssetType(assetType);
  const newTag = selectedModifier ? formatModifierTag(config.baseTag, selectedModifier) : "";

  let desc = currentDescription || "";

  // Check if any existing tag is present in the description
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
