/**
 * Frontend Type Definitions & Utilities
 * Re-exports canonical domain interfaces from src/shared/types along with client utilities.
 */

export * from "./shared/types";

export { 
  assembleFinalPrompt, 
  generatePromptPrefix, 
  formatShotNumber, 
  sanitizeFilenamePart, 
  sanitizeSlug,
  generateSaveVideoPrefix,
  buildSubjectDefinitions,
  computePrePromptContext
} from "./utils/formatters";

export type {
  SubjectAssetDefinition,
  PrePromptContextOptions
} from "./utils/formatters";

export function hasSceneReferencePhoto(assets: Array<{ type?: string; media_type?: string; filename?: string; subject_name?: string }>): boolean {
  if (!assets || !Array.isArray(assets)) return false;
  return assets.some(a => {
    if (!a) return false;
    const isImage = !a.media_type || a.media_type === "image";
    const typeStr = (a.type || "").toLowerCase();
    const sname = (a.subject_name || "").toLowerCase();
    const fname = (a.filename || "").toLowerCase();
    return isImage && (
      typeStr === "scene reference" ||
      typeStr.includes("scene") ||
      typeStr.includes("location") ||
      typeStr.includes("environment") ||
      sname.includes("location") ||
      fname.startsWith("scene_") ||
      fname.includes("scene_reference")
    );
  });
}

export { isLocationEntity, LOCATION_KEYWORDS } from "./utils/locationUtils";
export { getAssetMediaUrl } from "./utils/assetUrl";
