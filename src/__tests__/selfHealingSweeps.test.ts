import { describe, it, expect } from "vitest";
import { sweepGhostReferences } from "../utils/referentialIntegrity";
import { normalizeProjectCastAndAssets } from "../utils/subjectUtils";
import { SceneProjectFile, ShotItem } from "../types";

describe("Self-Healing Sweeps on Project Lifecycle (Phase 2)", () => {
  it("automatically self-heals legacy project JSONs with orphaned assigned slots and staging recipes", () => {
    const rawLegacyProject: SceneProjectFile = {
      schema_version: "1.0",
      scene_id: "scene_legacy_999",
      scene_name: "Legacy Scene",
      workflow_file: "test_workflow.json",
      shared_assets: [],
      subjects: ["Neo", "Morpheus"],
      characters: {
        "Neo": {
          id: "c1",
          name: "Neo",
          notes: "",
          quick_slots: ["real_neo.png", "deleted_ghost_slot.png", "", ""],
          scene_outfit_ref: "deleted_ghost_outfit.png"
        }
      },
      assets: [
        {
          id: "a1",
          filename: "real_neo.png",
          original_name: "real_neo.png",
          media_type: "image",
          type: "Headshot",
          subject_name: "Neo",
          description: "",
          size_bytes: 1200,
          created_at: Date.now()
        }
      ],
      shots: [
        {
          id: "shot_101",
          shot_number: 1,
          shot_type: "Wide Shot",
          camera_movement: "Tracking",
          basic_stub: "A wide shot",
          expanded_prompt: "Expanded prompt",
          assigned_slots: {
            0: "real_neo.png",
            1: "deleted_ghost_gun.png",
            8: "deleted_ghost_background.png"
          },
          characters: ["Neo"],
          staging_recipe: {
            backgroundAssetFilename: "deleted_ghost_background.png",
            compositeAssetFilename: "deleted_ghost_comp.png",
            actors: [
              {
                id: "act_1",
                characterName: "Neo",
                referenceAssetFilename: "real_neo.png",
                cutoutAssetFilename: "deleted_cutout.png",
                maskAssetFilename: "deleted_mask.png",
                xPercent: 50,
                yPercent: 50,
                scale: 1,
                isFlipped: false,
                zIndex: 1
              }
            ]
          },
          status: "unstaged",
          updated_at: new Date().toISOString()
        } as ShotItem
      ]
    };

    // 1. Normalize project
    const normalized = normalizeProjectCastAndAssets(rawLegacyProject);
    const fullProject: SceneProjectFile = {
      ...rawLegacyProject,
      subjects: normalized.subjects,
      characters: normalized.characters,
      assets: normalized.assets
    };
    
    // 2. Perform self-healing sweep
    const { cleanedProject, ghostFilenamesSwept, totalCleanedSlots } = sweepGhostReferences(fullProject);

    // Verify ghost filenames detected and swept
    expect(totalCleanedSlots).toBe(2); // slots 1 and 8
    expect(ghostFilenamesSwept).toContain("deleted_ghost_slot.png");
    expect(ghostFilenamesSwept).toContain("deleted_ghost_gun.png");
    expect(ghostFilenamesSwept).toContain("deleted_ghost_background.png");

    // Real asset is preserved in assigned_slots
    expect(cleanedProject.shots[0].assigned_slots[0]).toBe("real_neo.png");
    // Ghost assigned slots removed
    expect(cleanedProject.shots[0].assigned_slots[1]).toBeUndefined();
    expect(cleanedProject.shots[0].assigned_slots[8]).toBeUndefined();

    // Character quick slots swept
    expect(cleanedProject.characters?.["Neo"].quick_slots?.[0]).toBe("real_neo.png");
    expect(cleanedProject.characters?.["Neo"].quick_slots?.[1]).toBe("");
    expect(cleanedProject.characters?.["Neo"].scene_outfit_ref).toBe("");

    // Staging recipe swept
    expect(cleanedProject.shots[0].staging_recipe?.backgroundAssetFilename).toBeUndefined();
    expect(cleanedProject.shots[0].staging_recipe?.compositeAssetFilename).toBeUndefined();
    expect(cleanedProject.shots[0].staging_recipe?.actors?.[0]?.referenceAssetFilename).toBe("real_neo.png");
    expect(cleanedProject.shots[0].staging_recipe?.actors?.[0]?.cutoutAssetFilename).toBeUndefined();
    expect(cleanedProject.shots[0].staging_recipe?.actors?.[0]?.maskAssetFilename).toBeUndefined();
  });
});
