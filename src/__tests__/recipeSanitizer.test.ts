import { describe, it, expect } from "vitest";
import { 
  sanitizeActorRecipeForPersistence, 
  sanitizeStagingRecipeForPersistence, 
  sanitizeProjectForPersistence 
} from "../utils/recipeSanitizer";
import { StagedActorRecipeItem, StagingLayerRecipe, SceneProjectFile, ShotItem } from "../types";

describe("recipeSanitizer", () => {
  describe("sanitizeActorRecipeForPersistence", () => {
    it("strips heavy base64 masks and data URLs while preserving numeric transform precision", () => {
      const mockActor: StagedActorRecipeItem = {
        id: "actor_1",
        characterName: "Sarah Connor",
        referenceAssetFilename: "sarah_ref.png",
        xPercent: 45.12345,
        yPercent: 70.98765,
        scale: 1.25432,
        isFlipped: true,
        zIndex: 2,
        plane: "midground",
        cutoutDataUrl: "data:image/png;base64," + "A".repeat(5000),
        originalCutoutDataUrl: "data:image/png;base64," + "B".repeat(5000),
        maskDataUrl: "data:image/png;base64," + "C".repeat(5000)
      };

      const sanitized = sanitizeActorRecipeForPersistence(mockActor);

      expect(sanitized.id).toBe("actor_1");
      expect(sanitized.characterName).toBe("Sarah Connor");
      expect(sanitized.xPercent).toBe(45.12);
      expect(sanitized.yPercent).toBe(70.99);
      expect(sanitized.scale).toBe(1.254);
      expect(sanitized.isFlipped).toBe(true);
      // Heavy buffers stripped
      expect(sanitized.cutoutDataUrl).toBeUndefined();
      expect(sanitized.originalCutoutDataUrl).toBeUndefined();
      expect(sanitized.maskDataUrl).toBeUndefined();
    });
  });

  describe("sanitizeStagingRecipeForPersistence", () => {
    it("returns undefined for null or undefined recipes", () => {
      expect(sanitizeStagingRecipeForPersistence(null)).toBeUndefined();
      expect(sanitizeStagingRecipeForPersistence(undefined)).toBeUndefined();
    });

    it("sanitizes background URLs and child actor layers", () => {
      const mockRecipe: StagingLayerRecipe = {
        backgroundAssetFilename: "bg_desert.png",
        backgroundUrl: "data:image/png;base64," + "X".repeat(4000),
        aspectRatio: "16:9",
        cameraFraming: "Wide Master",
        lightingAtmosphere: "Golden Hour Sunlight",
        targetSlotIndex: 8,
        actors: [
          {
            id: "a1",
            characterName: "John Wick",
            referenceAssetFilename: "john.png",
            xPercent: 50,
            yPercent: 50,
            scale: 1.0,
            isFlipped: false,
            zIndex: 1,
            cutoutDataUrl: "data:image/png;base64," + "Y".repeat(4000)
          }
        ]
      };

      const sanitized = sanitizeStagingRecipeForPersistence(mockRecipe);
      expect(sanitized).toBeDefined();
      expect(sanitized?.backgroundAssetFilename).toBe("bg_desert.png");
      expect(sanitized?.backgroundUrl).toBeUndefined();
      expect(sanitized?.actors[0].characterName).toBe("John Wick");
      expect(sanitized?.actors[0].cutoutDataUrl).toBeUndefined();
    });
  });

  describe("sanitizeProjectForPersistence", () => {
    it("sanitizes staging recipes in all shots within the project", () => {
      const mockShot: ShotItem = {
        id: "shot_1",
        shot_number: 1,
        shot_type: "Wide Shot",
        camera_movement: "Static",
        basic_stub: "Stub",
        expanded_prompt: "Prompt",
        assigned_slots: {},
        updated_at: new Date().toISOString(),
        staging_recipe: {
          backgroundAssetFilename: "bg.png",
          backgroundUrl: "data:image/png;base64," + "Z".repeat(5000),
          actors: []
        },
        status: "staged"
      };

      const mockProject: SceneProjectFile = {
        schema_version: "1.0",
        scene_id: "sc_1",
        scene_name: "Test",
        workflow_file: "test.json",
        shared_assets: [],
        shots: [mockShot]
      };

      const sanitized = sanitizeProjectForPersistence(mockProject);
      expect(sanitized.shots[0].staging_recipe?.backgroundUrl).toBeUndefined();
      expect(sanitized.shots[0].staging_recipe?.backgroundAssetFilename).toBe("bg.png");
    });
  });
});
