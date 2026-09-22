import { UniverseCharacterProfile } from "../types";
import { universeApi } from "../api";

/**
 * Fetch all characters from the global universe roster
 */
export async function fetchUniverseCharacters(): Promise<Record<string, UniverseCharacterProfile>> {
  try {
    const data = await universeApi.getCharacters();
    return data?.characters || {};
  } catch (err) {
    console.error("Failed to load universe characters:", err);
    return {};
  }
}

/**
 * Save or update a character in the global universe roster
 */
export async function saveUniverseCharacter(
  profile: Partial<UniverseCharacterProfile> & { name: string }
): Promise<UniverseCharacterProfile | null> {
  try {
    const data = await universeApi.saveCharacter(profile);
    return data?.character || null;
  } catch (err) {
    console.error("Failed to save universe character:", err);
    return null;
  }
}

/**
 * Delete a character from the global universe roster
 */
export async function deleteUniverseCharacter(name: string): Promise<boolean> {
  try {
    const data = await universeApi.deleteCharacter(name);
    return !!data?.deleted;
  } catch (err) {
    console.error("Failed to delete universe character:", err);
    return false;
  }
}

/**
 * Fetch all media reference assets belonging to the Universe media pool
 */
export async function fetchUniverseAssets(): Promise<any[]> {
  try {
    const data = await universeApi.getAssets();
    return data?.assets || [];
  } catch (err) {
    console.error("Failed to load universe media assets:", err);
    return [];
  }
}

/**
 * Promote an asset to the global universe media pool
 */
export async function promoteAssetToUniverse(filename: string): Promise<{ success: boolean; filename: string; error?: string }> {
  try {
    const data = await universeApi.promoteAsset(filename);
    return data || { success: true, filename };
  } catch (err: any) {
    return { success: false, filename, error: err.message };
  }
}
