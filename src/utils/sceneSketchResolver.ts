import { CharacterProfile, UniverseCharacterProfile, MediaAsset } from "../types";

export type CharacterMatchStatus = "in_scene" | "in_universe" | "unrecognized";

export interface ResolvedCharacterItem {
  rawName: string;
  cleanName: string;
  status: CharacterMatchStatus;
  sceneProfile?: CharacterProfile;
  universeProfile?: UniverseCharacterProfile;
  suggestedAction: "keep_scene" | "auto_import_universe" | "leave_unassigned" | "map_to_character";
}

export interface ResolvedShotCharacters {
  shotIndex: number;
  characters: ResolvedCharacterItem[];
}

/**
 * Normalizes name strings for resilient comparison (trims punctuation, lowercases, handles honorifics).
 */
export function normalizeCharacterName(rawName: string): string {
  if (!rawName) return "";
  return rawName
    .replace(/^["'`]|["'`]$/g, "")
    .replace(/^(mr\.|mrs\.|ms\.|dr\.|officer|detective|agent|captain)\s+/i, "")
    .trim()
    .toLowerCase();
}

/**
 * Resolves a list of detected character names from an LLM against active scene cast and global universe cast.
 */
export function resolveDetectedCharacter(
  rawName: string,
  sceneCharacters: Record<string, CharacterProfile> | CharacterProfile[] | string[],
  universeCharacters: Record<string, UniverseCharacterProfile>
): ResolvedCharacterItem {
  const cleanName = rawName.trim();
  const normalized = normalizeCharacterName(cleanName);

  // 1. Check Scene Characters
  let matchedSceneProfile: CharacterProfile | undefined;
  if (Array.isArray(sceneCharacters)) {
    for (const item of sceneCharacters) {
      const name = typeof item === "string" ? item : item.name;
      if (normalizeCharacterName(name) === normalized || name.toLowerCase() === cleanName.toLowerCase()) {
        if (typeof item !== "string") matchedSceneProfile = item;
        else matchedSceneProfile = { id: `char_${name}`, name, notes: "", quick_slots: ["", "", "", ""], scene_outfit_ref: "", in_universe: false };
        break;
      }
    }
  } else if (sceneCharacters && typeof sceneCharacters === "object") {
    for (const [name, profile] of Object.entries(sceneCharacters)) {
      if (normalizeCharacterName(name) === normalized || name.toLowerCase() === cleanName.toLowerCase()) {
        matchedSceneProfile = profile;
        break;
      }
    }
  }

  if (matchedSceneProfile) {
    return {
      rawName,
      cleanName,
      status: "in_scene",
      sceneProfile: matchedSceneProfile,
      suggestedAction: "keep_scene"
    };
  }

  // 2. Check Universe Characters
  let matchedUniverseProfile: UniverseCharacterProfile | undefined;
  if (universeCharacters && typeof universeCharacters === "object") {
    for (const [name, profile] of Object.entries(universeCharacters)) {
      if (normalizeCharacterName(name) === normalized || name.toLowerCase() === cleanName.toLowerCase()) {
        matchedUniverseProfile = profile;
        break;
      }
    }
  }

  if (matchedUniverseProfile) {
    return {
      rawName,
      cleanName,
      status: "in_universe",
      universeProfile: matchedUniverseProfile,
      suggestedAction: "auto_import_universe"
    };
  }

  // 3. Unrecognized
  return {
    rawName,
    cleanName,
    status: "unrecognized",
    suggestedAction: "leave_unassigned"
  };
}

/**
 * Resolves all detected characters for an array of parsed sketch shots.
 */
export function resolveAllShotCharacters(
  shots: { detected_characters?: string[] }[],
  sceneCharacters: Record<string, CharacterProfile> | CharacterProfile[] | string[],
  universeCharacters: Record<string, UniverseCharacterProfile>
): ResolvedShotCharacters[] {
  return shots.map((shot, shotIndex) => {
    const rawNames = shot.detected_characters || [];
    const resolvedItems = rawNames
      .filter(n => n && n.trim().length > 0)
      .map(name => resolveDetectedCharacter(name, sceneCharacters, universeCharacters));

    return {
      shotIndex,
      characters: resolvedItems
    };
  });
}

/**
 * Helper to perform batch Universe -> Scene import for all characters flagged for auto-import.
 */
export function prepareUniverseImportPayload(
  resolvedShots: ResolvedShotCharacters[],
  universeCharacters: Record<string, UniverseCharacterProfile>,
  universeAssets: MediaAsset[],
  existingSceneAssets: MediaAsset[]
): {
  charactersToImport: UniverseCharacterProfile[];
  assetsToImport: MediaAsset[];
} {
  const charactersToImportMap = new Map<string, UniverseCharacterProfile>();

  for (const shot of resolvedShots) {
    for (const char of shot.characters) {
      if (char.status === "in_universe" && char.universeProfile && char.suggestedAction === "auto_import_universe") {
        charactersToImportMap.set(char.universeProfile.name, char.universeProfile);
      }
    }
  }

  const charactersToImport = Array.from(charactersToImportMap.values());
  const assetsToImport: MediaAsset[] = [];

  for (const uChar of charactersToImport) {
    const charName = uChar.name.trim().toLowerCase();
    const relatedAssets = universeAssets.filter(
      a => (a.subject_name || "").trim().toLowerCase() === charName
    );

    for (const uAsset of relatedAssets) {
      if (!existingSceneAssets.some(a => a.filename === uAsset.filename) &&
          !assetsToImport.some(a => a.filename === uAsset.filename)) {
        assetsToImport.push({
          ...uAsset,
          is_universe: true
        });
      }
    }
  }

  return {
    charactersToImport,
    assetsToImport
  };
}
