import { UniverseCharacterProfile } from "../types";

/**
 * Fetch all characters from the global universe roster
 */
export async function fetchUniverseCharacters(): Promise<Record<string, UniverseCharacterProfile>> {
  try {
    const res = await fetch("/api/universe/characters");
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    return data.characters || {};
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
    const res = await fetch("/api/universe/characters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile)
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    return data.character || null;
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
    const res = await fetch(`/api/universe/characters/${encodeURIComponent(name)}`, {
      method: "DELETE"
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    return !!data.deleted;
  } catch (err) {
    console.error("Failed to delete universe character:", err);
    return false;
  }
}

/**
 * Promote an asset to the global universe media pool
 */
export async function promoteAssetToUniverse(filename: string): Promise<{ success: boolean; filename: string; error?: string }> {
  try {
    const res = await fetch("/api/universe/characters/promote-asset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename })
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, filename, error: err.message };
  }
}
