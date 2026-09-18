import { describe, it, expect } from "vitest";
import {
  cascadeAssetDeletion,
  cascadeAssetRename,
  cascadeCharacterRename,
  sweepGhostReferences,
  getAssetUsageSummary
} from "../utils/referentialIntegrity";
import { SceneProjectFile, MediaAsset, ShotItem } from "../types";

describe("referentialIntegrity", () => {
  const createMockProject = (): SceneProjectFile => {
    const assets: MediaAsset[] = [
      { id: "a1", filename: "neo_headshot.png", original_name: "neo_headshot.png", media_type: "image", type: "Headshot", subject_name: "Neo", description: "", size_bytes: 1000, created_at: Date.now() },
      { id: "a2", filename: "neo_body.png", original_name: "neo_body.png", media_type: "image", type: "Body Reference", subject_name: "Neo", description: "", size_bytes: 1000, created_at: Date.now() },
      { id: "a3", filename: "trinity_ref.png", original_name: "trinity_ref.png", media_type: "image", type: "Headshot", subject_name: "Trinity", description: "", size_bytes: 1000, created_at: Date.now() },
      { id: "a4", filename: "background.png", original_name: "background.png", media_type: "image", type: "Location", subject_name: "Rooftop", description: "", size_bytes: 1000, created_at: Date.now() }
    ];

    const shot1: ShotItem = {
      id: "shot_1",
      shot_number: 1,
      shot_type: "Close Up",
      camera_movement: "Static",
      basic_stub: "Stub",
      expanded_prompt: "Prompt",
      assigned_slots: {
        0: "neo_headshot.png",
        1: "trinity_ref.png",
        8: "background.png"
      },
      characters: ["Neo", "Trinity"],
      ots_anchor_subject: "Neo",
      ots_focus_subject: "Trinity",
      staging_recipe: {
        backgroundAssetFilename: "background.png",
        actors: [
          { id: "a1", characterName: "Neo", referenceAssetFilename: "neo_headshot.png", xPercent: 50, yPercent: 50, scale: 1, isFlipped: false, zIndex: 1 }
        ]
      },
      status: "staged",
      updated_at: new Date().toISOString()
    };

    return {
      schema_version: "1.0",
      scene_id: "scene_123",
      scene_name: "Action Scene",
      workflow_file: "test.json",
      shared_assets: [],
      subjects: ["Neo", "Trinity"],
      characters: {
        "Neo": {
          id: "c1",
          name: "Neo",
          notes: "",
          quick_slots: ["neo_headshot.png", "neo_body.png", "", ""],
          scene_outfit_ref: "neo_outfit.png"
        },
        "Trinity": {
          id: "c2",
          name: "Trinity",
          notes: "",
          quick_slots: ["trinity_ref.png", "", "", ""],
          scene_outfit_ref: ""
        }
      },
      assets,
      shots: [shot1]
    };
  };

  describe("getAssetUsageSummary", () => {
    it("reports all usages of an asset across slots, character profiles, and staging", () => {
      const project = createMockProject();
      const summary = getAssetUsageSummary(project, "neo_headshot.png");

      expect(summary.totalReferences).toBeGreaterThanOrEqual(2);
      expect(summary.isUsed).toBe(true);
      expect(summary.shotSlots.some(s => s.shotId === "shot_1" && s.slotIndex === 0)).toBe(true);
      expect(summary.characterQuickSlots.some(c => c.characterName === "Neo" && c.slotIndex === 1)).toBe(true);
    });
  });

  describe("cascadeAssetDeletion", () => {
    it("removes the asset from assets array, character quick slots, and shot assigned slots", () => {
      const project = createMockProject();
      const { updatedProject, clearedShotSlotsCount } = cascadeAssetDeletion(project, "neo_headshot.png");

      // Removed from assets
      expect(updatedProject.assets?.some(a => a.filename === "neo_headshot.png")).toBe(false);

      // Cleared from quick slots
      expect(updatedProject.characters?.["Neo"].quick_slots?.[0]).toBe("");

      // Cleared from shot assigned slots
      expect(updatedProject.shots[0].assigned_slots[0]).toBeUndefined();
      // Other slots remain untouched
      expect(updatedProject.shots[0].assigned_slots[1]).toBe("trinity_ref.png");

      // Cleared from staging actor cutouts
      expect(updatedProject.shots[0].staging_recipe?.actors?.[0]?.referenceAssetFilename).toBeUndefined();

      expect(clearedShotSlotsCount).toBeGreaterThan(0);
    });
  });

  describe("cascadeAssetRename", () => {
    it("updates all references to the new filename seamlessly", () => {
      const project = createMockProject();
      const { updatedProject, updatedShotSlotsCount } = cascadeAssetRename(
        project,
        "neo_headshot.png",
        "neo_face_v2.png"
      );

      // Asset updated in list
      expect(updatedProject.assets?.some(a => a.filename === "neo_face_v2.png")).toBe(true);
      expect(updatedProject.assets?.some(a => a.filename === "neo_headshot.png")).toBe(false);

      // Updated in quick slots
      expect(updatedProject.characters?.["Neo"].quick_slots?.[0]).toBe("neo_face_v2.png");

      // Updated in shot slots
      expect(updatedProject.shots[0].assigned_slots[0]).toBe("neo_face_v2.png");

      // Updated in staging recipe
      expect(updatedProject.shots[0].staging_recipe?.actors?.[0]?.referenceAssetFilename).toBe("neo_face_v2.png");

      expect(updatedShotSlotsCount).toBeGreaterThan(0);
    });
  });

  describe("cascadeCharacterRename", () => {
    it("renames character profile keys, shot character arrays, staging actors, and asset subject tags", () => {
      const project = createMockProject();
      const { updatedProject, updatedShotsCount } = cascadeCharacterRename(
        project,
        "Neo",
        "Thomas Anderson"
      );

      // Subject list updated
      expect(updatedProject.subjects).toContain("Thomas Anderson");
      expect(updatedProject.subjects).not.toContain("Neo");

      // Character profile updated
      expect(updatedProject.characters?.["Thomas Anderson"]).toBeDefined();
      expect(updatedProject.characters?.["Neo"]).toBeUndefined();
      expect(updatedProject.characters?.["Thomas Anderson"].name).toBe("Thomas Anderson");

      // Shot character lists and OTS updated
      expect(updatedProject.shots[0].characters).toContain("Thomas Anderson");
      expect(updatedProject.shots[0].characters).not.toContain("Neo");
      expect(updatedProject.shots[0].ots_anchor_subject).toBe("Thomas Anderson");

      // Staging recipe actor name updated
      expect(updatedProject.shots[0].staging_recipe?.actors?.[0]?.characterName).toBe("Thomas Anderson");

      // Asset subject_name updated
      const neoAssets = (updatedProject.assets || []).filter(a => a.filename.startsWith("neo_"));
      neoAssets.forEach(a => {
        expect(a.subject_name).toBe("Thomas Anderson");
      });

      expect(updatedShotsCount).toBe(1);
    });
  });

  describe("sweepGhostReferences", () => {
    it("purges references to filenames that no longer exist in the assets registry", () => {
      const project = createMockProject();
      // Introduce ghost references
      project.shots[0].assigned_slots[2] = "deleted_asset_ghost.png";
      if (project.characters) {
        project.characters["Trinity"].quick_slots = ["deleted_asset_ghost.png", "", "", ""];
      }

      const { cleanedProject, totalCleanedSlots } = sweepGhostReferences(project);

      expect(totalCleanedSlots).toBeGreaterThan(0);
      expect(cleanedProject.shots[0].assigned_slots[2]).toBeUndefined();
      expect(cleanedProject.characters?.["Trinity"].quick_slots?.[0]).toBe("");
    });
  });
});
