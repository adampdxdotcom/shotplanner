import { StagedActorRecipeItem, StagingLayerRecipe, SceneProjectFile } from "../types";

/**
 * Strips heavy in-memory data URLs (cutout masks, high-res base64 data URLs)
 * so only lightweight asset references, filenames, and 2D coordinate transforms are serialized.
 */
export function sanitizeActorRecipeForPersistence(actor: StagedActorRecipeItem): StagedActorRecipeItem {
  const isDataUrl = typeof actor.cutoutDataUrl === "string" && actor.cutoutDataUrl.startsWith("data:");
  
  // Only persist cutoutDataUrl if it's an asset URL (not a massive in-memory base64 buffer)
  // or if there is no referenceAssetFilename and it's small enough
  const shouldKeepCutout = !isDataUrl || (!actor.referenceAssetFilename && actor.cutoutDataUrl && actor.cutoutDataUrl.length < 2000);

  return {
    id: actor.id,
    characterName: actor.characterName,
    referenceAssetFilename: actor.referenceAssetFilename,
    cutoutAssetFilename: actor.cutoutAssetFilename,
    maskAssetFilename: actor.maskAssetFilename,
    xPercent: Number(actor.xPercent.toFixed(2)),
    yPercent: Number(actor.yPercent.toFixed(2)),
    scale: Number(actor.scale.toFixed(3)),
    isFlipped: Boolean(actor.isFlipped),
    zIndex: actor.zIndex,
    plane: actor.plane,
    posture: actor.posture,
    facing: actor.facing,
    cutoutDataUrl: shouldKeepCutout ? actor.cutoutDataUrl : undefined,
    // Always strip heavy in-memory canvas masks and original buffers from persistent JSON
    originalCutoutDataUrl: undefined,
    maskDataUrl: undefined
  };
}

/**
 * Sanitizes a StagingLayerRecipe by stripping large data URLs and retaining spatial coordinates
 */
export function sanitizeStagingRecipeForPersistence(
  recipe?: StagingLayerRecipe | null
): StagingLayerRecipe | undefined {
  if (!recipe) return undefined;

  const isBgDataUrl = typeof recipe.backgroundUrl === "string" && recipe.backgroundUrl.startsWith("data:");
  const shouldKeepBgUrl = !isBgDataUrl || (!recipe.backgroundAssetFilename && recipe.backgroundUrl && recipe.backgroundUrl.length < 2000);

  return {
    backgroundAssetFilename: recipe.backgroundAssetFilename || undefined,
    backgroundUrl: shouldKeepBgUrl ? recipe.backgroundUrl : undefined,
    aspectRatio: recipe.aspectRatio || "16:9",
    cameraFraming: recipe.cameraFraming || "Eye-Level Straight",
    lightingAtmosphere: recipe.lightingAtmosphere || "Cinematic Studio Glow",
    targetSlotIndex: recipe.targetSlotIndex,
    compositeAssetFilename: recipe.compositeAssetFilename,
    updatedAt: recipe.updatedAt || new Date().toISOString(),
    actors: Array.isArray(recipe.actors)
      ? recipe.actors.map(sanitizeActorRecipeForPersistence)
      : []
  };
}

/**
 * Sanitizes an entire SceneProjectFile before persisting to backend disk storage
 */
export function sanitizeProjectForPersistence(project: SceneProjectFile): SceneProjectFile {
  const sanitizedShots = (project.shots || []).map(shot => {
    if (!shot.staging_recipe) return shot;
    return {
      ...shot,
      staging_recipe: sanitizeStagingRecipeForPersistence(shot.staging_recipe)
    };
  });

  const result = {
    ...project,
    shots: sanitizedShots,
    staging_recipe: sanitizeStagingRecipeForPersistence(project.staging_recipe)
  };

  // Strip machine-specific infrastructure and network connection fields
  delete (result as any).lm_studio_url;
  delete (result as any).local_llm_url;
  delete (result as any).config;

  return result;
}
