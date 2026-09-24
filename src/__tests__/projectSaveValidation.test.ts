import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  validateProjectPayload,
  sanitizeProjectPayloadForStorage,
  saveProjectData,
  saveProjectDataAsync,
  getProjectData
} from "../../server/services/project/projectCrud";
import { KeyedMutex } from "../../server/utils/mutex";
import { ASSETS_DIR } from "../../server/config/constants";

describe("Project Save Validation & Concurrency Mutex (Phase 2)", () => {
  const testProjectName = "test_validation_scene";
  const sceneDir = path.join(ASSETS_DIR, testProjectName);

  beforeEach(() => {
    if (fs.existsSync(sceneDir)) {
      fs.rmSync(sceneDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(sceneDir)) {
      fs.rmSync(sceneDir, { recursive: true, force: true });
    }
  });

  describe("validateProjectPayload", () => {
    it("rejects non-object or null payloads", () => {
      expect(validateProjectPayload(null).valid).toBe(false);
      expect(validateProjectPayload("string").valid).toBe(false);
      expect(validateProjectPayload([1, 2, 3]).valid).toBe(false);
    });

    it("rejects non-array shots property", () => {
      const result = validateProjectPayload({ scene_name: "test", shots: "not-an-array" });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("'shots' field must be an array");
    });

    it("accepts valid scene project objects", () => {
      const result = validateProjectPayload({ scene_name: "test", shots: [{ id: "1" }] });
      expect(result.valid).toBe(true);
    });

    it("triggers catastrophic truncation guard when incoming shots drop to 0 from 3+", () => {
      const existingData = {
        scene_name: testProjectName,
        shots: [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }]
      };

      const incomingTruncated = {
        scene_name: testProjectName,
        shots: []
      };

      // Should fail without allowEmpty
      const blocked = validateProjectPayload(incomingTruncated, existingData);
      expect(blocked.valid).toBe(false);
      expect(blocked.error).toContain("Catastrophic truncation prevented");

      // Should succeed with allowEmpty: true
      const allowed = validateProjectPayload(incomingTruncated, existingData, { allowEmpty: true });
      expect(allowed.valid).toBe(true);
    });
  });

  describe("KeyedMutex", () => {
    it("executes tasks sequentially for the same key", async () => {
      const mutex = new KeyedMutex();
      const executionOrder: number[] = [];

      const task1 = mutex.runExclusive("resource-a", async () => {
        await new Promise((r) => setTimeout(r, 50));
        executionOrder.push(1);
      });

      const task2 = mutex.runExclusive("resource-a", async () => {
        executionOrder.push(2);
      });

      await Promise.all([task1, task2]);
      expect(executionOrder).toEqual([1, 2]);
    });

    it("executes tasks concurrently for different keys", async () => {
      const mutex = new KeyedMutex();
      const executionOrder: string[] = [];

      const taskA = mutex.runExclusive("resource-a", async () => {
        await new Promise((r) => setTimeout(r, 50));
        executionOrder.push("A");
      });

      const taskB = mutex.runExclusive("resource-b", async () => {
        executionOrder.push("B");
      });

      await Promise.all([taskA, taskB]);
      // Resource B should finish before Resource A because it has no delay
      expect(executionOrder).toEqual(["B", "A"]);
    });
  });

  describe("saveProjectDataAsync with Mutex & Validation", () => {
    it("serializes concurrent save operations without corrupting data", async () => {
      const initialProject = {
        scene_name: testProjectName,
        shots: [{ id: "1", title: "Shot 1" }]
      };

      // Fire 5 concurrent saves with incrementing shot counts
      const saves = Array.from({ length: 5 }, (_, i) => {
        const payload = {
          ...initialProject,
          shots: Array.from({ length: i + 1 }, (_, j) => ({ id: `${j + 1}`, title: `Shot ${j + 1}` }))
        };
        return saveProjectDataAsync(testProjectName, payload);
      });

      const results = await Promise.all(saves);
      expect(results.length).toBe(5);

      const finalData = getProjectData(testProjectName);
      expect(finalData).not.toBeNull();
      expect(finalData.shots.length).toBe(5);
    });

    it("rejects catastrophic truncation during save", async () => {
      // 1. Save project with 4 shots
      await saveProjectDataAsync(testProjectName, {
        scene_name: testProjectName,
        shots: [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }]
      });

      // 2. Attempt saving 0 shots without override flag
      await expect(
        saveProjectDataAsync(testProjectName, {
          scene_name: testProjectName,
          shots: []
        })
      ).rejects.toThrow("Catastrophic truncation prevented");

      // Verify original shots are intact
      const intact = getProjectData(testProjectName);
      expect(intact.shots.length).toBe(4);
    });

    it("strips heavy base64 data URLs on server save to prevent JSON bloat", async () => {
      const bloatedPayload = {
        scene_name: testProjectName,
        staging_recipe: {
          backgroundAssetFilename: "downtown.png",
          backgroundUrl: "data:image/png;base64," + "A".repeat(5000),
          actors: [
            {
              id: "actor_1",
              characterName: "Elena",
              cutoutAssetFilename: "elena_cutout.png",
              cutoutDataUrl: "data:image/png;base64," + "B".repeat(5000),
              maskDataUrl: "data:image/png;base64," + "C".repeat(5000),
              originalCutoutDataUrl: "data:image/png;base64," + "D".repeat(5000),
              xPercent: 50,
              yPercent: 75,
              scale: 1.0,
              isFlipped: false
            }
          ]
        },
        shots: [
          {
            id: "shot_1",
            shot_number: 1,
            staging_recipe: {
              backgroundAssetFilename: "downtown.png",
              backgroundUrl: "data:image/png;base64," + "A".repeat(5000),
              actors: [
                {
                  id: "actor_1",
                  characterName: "Elena",
                  cutoutAssetFilename: "elena_cutout.png",
                  cutoutDataUrl: "data:image/png;base64," + "B".repeat(5000),
                  maskDataUrl: "data:image/png;base64," + "C".repeat(5000),
                  xPercent: 50,
                  yPercent: 75,
                  scale: 1.0,
                  isFlipped: false
                }
              ]
            }
          }
        ],
        local_llm_url: "http://localhost:1234/v1"
      };

      await saveProjectDataAsync(testProjectName, bloatedPayload);

      const saved = getProjectData(testProjectName);
      expect(saved).not.toBeNull();
      // Server-side stripped base64
      expect(saved.staging_recipe.backgroundUrl).toBeUndefined();
      expect(saved.staging_recipe.actors[0].cutoutDataUrl).toBeUndefined();
      expect(saved.staging_recipe.actors[0].maskDataUrl).toBeUndefined();
      expect(saved.staging_recipe.actors[0].originalCutoutDataUrl).toBeUndefined();
      expect(saved.shots[0].staging_recipe.actors[0].cutoutDataUrl).toBeUndefined();
      // Preserved clean metadata
      expect(saved.staging_recipe.backgroundAssetFilename).toBe("downtown.png");
      expect(saved.staging_recipe.actors[0].cutoutAssetFilename).toBe("elena_cutout.png");
      expect((saved as any).local_llm_url).toBeUndefined();
    });
  });
});
