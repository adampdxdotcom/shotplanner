import { CharacterProfile, MediaAsset } from "../types";
import { generateUUID } from "./formatters";

/**
 * Normalizes a raw subject/character string into a clean, canonical Title Case name.
 * Strips accidental 'reference_' prefixes, leading/trailing punctuation or underscores.
 */
export const toCanonicalSubjectName = (raw?: string | null): string => {
  if (!raw) return "";
  let clean = String(raw).trim();

  // Strip accidental prefixes like reference_, reference-, ref_
  clean = clean
    .replace(/^(reference|ref)[_\-\s]+/i, "")
    .replace(/^_+|_+$/g, "")
    .trim();

  if (!clean || ["unknown", "null", "undefined", "subject"].includes(clean.toLowerCase())) {
    return "";
  }

  // Convert words to Title Case:
  // If the word is entirely uppercase (e.g. "MAGGIE" or "JACKIE"), or entirely lowercase (e.g. "maggie"),
  // capitalize first letter and lowercase the rest. If mixed (e.g. "McCoy", "DJ"), preserve special casing.
  const words = clean.split(/[_\s]+/);
  const formattedWords = words.map(w => {
    if (!w) return "";
    if (w === w.toLowerCase() || w === w.toUpperCase()) {
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }
    // Already mixed case
    return w.charAt(0).toUpperCase() + w.slice(1);
  });

  return formattedWords.filter(Boolean).join(" ");
};

/**
 * Case-insensitively searches an existing list of subjects for a match.
 * Returns the exact existing canonical string if found, otherwise null.
 */
export const findCanonicalSubject = (
  name: string,
  existingSubjects: string[] = []
): string | null => {
  const target = (name || "").trim().toLowerCase();
  if (!target) return null;
  const match = existingSubjects.find(s => s.trim().toLowerCase() === target);
  return match ? match.trim() : null;
};

/**
 * Merges two character profiles into a single unified profile.
 */
export const mergeCharacterProfiles = (
  existing: CharacterProfile,
  incoming: CharacterProfile,
  canonicalName: string
): CharacterProfile => {
  const quickSlotsSet = new Set<string>();
  (existing.quick_slots || []).forEach(s => { if (s) quickSlotsSet.add(s); });
  (incoming.quick_slots || []).forEach(s => { if (s) quickSlotsSet.add(s); });

  return {
    id: existing.id || incoming.id || generateUUID(),
    name: canonicalName,
    notes: (existing.notes && existing.notes.trim()) || incoming.notes || "",
    scene_outfit_ref: (existing.scene_outfit_ref && existing.scene_outfit_ref.trim()) || incoming.scene_outfit_ref || "",
    quick_slots: Array.from(quickSlotsSet)
  };
};

/**
 * Performs full project-level subject and character deduplication migration.
 * Collapses duplicate case variations into a single canonical entry, merges profiles,
 * and re-aligns asset subject_name values.
 */
export const normalizeProjectCastAndAssets = <T extends {
  subjects?: string[];
  characters?: Record<string, CharacterProfile>;
  assets?: MediaAsset[];
}>(project: T): {
  subjects: string[];
  characters: Record<string, CharacterProfile>;
  assets: MediaAsset[];
} => {
  const lowerToCanonical = new Map<string, string>();
  const canonicalSubjects: string[] = [];

  // 1. Process project subjects first
  (project.subjects || []).forEach(raw => {
    const canonical = toCanonicalSubjectName(raw);
    if (!canonical) return;
    const lowerKey = canonical.toLowerCase();
    if (!lowerToCanonical.has(lowerKey)) {
      lowerToCanonical.set(lowerKey, canonical);
      canonicalSubjects.push(canonical);
    }
  });

  // 2. Process character profile keys
  const rawCharacters = project.characters || {};
  Object.keys(rawCharacters).forEach(rawKey => {
    const canonical = toCanonicalSubjectName(rawKey);
    if (!canonical) return;
    const lowerKey = canonical.toLowerCase();
    if (!lowerToCanonical.has(lowerKey)) {
      lowerToCanonical.set(lowerKey, canonical);
      canonicalSubjects.push(canonical);
    }
  });

  // 3. Process asset subject names
  const rawAssets = project.assets || [];
  rawAssets.forEach(a => {
    const rawSubj = a.subject_name;
    if (!rawSubj) return;
    const canonical = toCanonicalSubjectName(rawSubj);
    if (!canonical) return;
    const lowerKey = canonical.toLowerCase();
    if (!lowerToCanonical.has(lowerKey)) {
      lowerToCanonical.set(lowerKey, canonical);
      canonicalSubjects.push(canonical);
    }
  });

  // 4. Build deduplicated canonical characters dictionary
  const nextCharacters: Record<string, CharacterProfile> = {};

  Object.entries(rawCharacters).forEach(([rawKey, profile]) => {
    const canonical = lowerToCanonical.get(rawKey.toLowerCase()) || toCanonicalSubjectName(rawKey);
    if (!canonical) return;

    const normalizedProfile: CharacterProfile = {
      id: profile.id || generateUUID(),
      name: canonical,
      notes: profile.notes || "",
      scene_outfit_ref: profile.scene_outfit_ref || "",
      quick_slots: profile.quick_slots || []
    };

    if (nextCharacters[canonical]) {
      nextCharacters[canonical] = mergeCharacterProfiles(nextCharacters[canonical], normalizedProfile, canonical);
    } else {
      nextCharacters[canonical] = normalizedProfile;
    }
  });

  // Ensure every canonical subject has a character profile
  canonicalSubjects.forEach(canonical => {
    if (!nextCharacters[canonical]) {
      nextCharacters[canonical] = {
        id: generateUUID(),
        name: canonical,
        notes: "",
        scene_outfit_ref: "",
        quick_slots: []
      };
    }
  });

  // 5. Re-align assets with canonical subject names
  const nextAssets = rawAssets.map(a => {
    if (!a.subject_name) return a;
    const lowerKey = a.subject_name.trim().toLowerCase();
    const canonical = lowerToCanonical.get(lowerKey) || toCanonicalSubjectName(a.subject_name);
    if (canonical && a.subject_name !== canonical) {
      return { ...a, subject_name: canonical };
    }
    return a;
  });

  return {
    subjects: canonicalSubjects,
    characters: nextCharacters,
    assets: nextAssets
  };
};
