// Utilities for detecting and managing Location entities vs Character entities
import { CharacterProfile, MediaAsset } from "../types";

/**
  * Standard location keywords used to heuristically detect if a subject name represents a location/environment.
  */
export const LOCATION_KEYWORDS = [
  "location",
  "scene",
  "environment",
  "setting",
  "room",
  "hall",
  "street",
  "interior",
  "exterior",
  "int.",
  "ext.",
  "office",
  "apartment",
  "house",
  "backdrop",
  "background",
  "landscape",
  "studio",
  "cafe",
  "coffee shop",
  "diner",
  "warehouse",
  "kitchen",
  "bedroom",
  "alley",
  "rooftop",
  "bar",
  "club",
  "patio",
  "balcony",
  "parking",
  "garage",
  "park",
  "stage"
];

/**
 * Robust check to determine if an entity is a Location entity.
 * Checks in order:
 * 1. Explicit profile property `is_location === true` or `is_location === false`
 * 2. Name-based keywords (e.g. "Living Room", "Scene 1 Location", "Cafe Interior")
 * 3. Asset-based types (e.g. exclusively Scene Reference assets, no Headshot/Body Reference assets)
 */
export function isLocationEntity(
  subjectName?: string,
  profile?: Partial<CharacterProfile> | null,
  assets?: MediaAsset[]
): boolean {
  // 1. Explicit setting on profile takes highest precedence
  if (profile && typeof profile.is_location === "boolean") {
    return profile.is_location;
  }

  const name = (subjectName || "").trim().toLowerCase();
  if (!name) return false;

  // 2. Name keyword detection
  const hasKeyword = LOCATION_KEYWORDS.some(kw => {
    if (name === kw) return true;
    // Word boundary or substring check
    return name.includes(kw);
  });
  if (hasKeyword) return true;

  // 3. Asset-based heuristics if assets are provided
  if (assets && assets.length > 0) {
    const subjectAssets = assets.filter(
      a => (a.subject_name || "").trim().toLowerCase() === name
    );
    if (subjectAssets.length > 0) {
      const hasCharacterAssets = subjectAssets.some(a => {
        const t = (a.type || "").toLowerCase();
        return t.includes("headshot") || t.includes("body");
      });
      const hasSceneAssets = subjectAssets.some(a => {
        const t = (a.type || "").toLowerCase();
        const f = (a.filename || "").toLowerCase();
        return t.includes("scene") || t.includes("location") || f.startsWith("scene_") || f.includes("scene_ref");
      });
      if (hasSceneAssets && !hasCharacterAssets) {
        return true;
      }
    }
  }

  return false;
}
