import { ShotItem } from "../types";

/**
 * Creates a duplicated ShotItem retaining camera specs, cast, and asset loaders,
 * while starting with a clean prompt slate:
 * - basic_stub pre-filled with "Duplicated from Shot #X"
 * - expanded_prompt reset to empty string
 * - prompt_variations reset to empty array
 * - active_variation_id reset to undefined
 * - takes cleared and status marked as "unstaged"
 */
export function duplicateShotItem(
  sourceShot: ShotItem,
  nextShotNumber: number,
  newId?: string
): ShotItem {
  const generatedId = newId || ("shot_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6));
  
  return {
    ...sourceShot,
    id: generatedId,
    shot_number: nextShotNumber,
    shot_name: sourceShot.shot_name ? `${sourceShot.shot_name} (Copy)` : undefined,
    basic_stub: `Duplicated from Shot #${sourceShot.shot_number}`,
    expanded_prompt: "",
    prompt_variations: [],
    active_variation_id: undefined,
    status: "unstaged",
    takes: [],
    hero_take_id: undefined,
    assigned_slots: { ...(sourceShot.assigned_slots || {}) },
    characters: sourceShot.characters ? [...sourceShot.characters] : [],
    generation_params: sourceShot.generation_params ? { ...sourceShot.generation_params } : undefined,
    updated_at: new Date().toISOString()
  };
}
