import { describe, it, expect } from "vitest";
import {
  validateActionSafety,
  validateActionSequenceSafety,
  AssistantAction
} from "../types/assistantActions";

describe("validateActionSafety (LLM Mutation Safety)", () => {
  const existingShots = [1, 2, 3];

  it("permits mutations targeting existing shot numbers", () => {
    const validUpdate: AssistantAction = {
      type: "update_shot",
      shot_number: 2,
      changes: { basic_stub: "Elena checks her tactical cyberdeck." }
    };
    const result = validateActionSafety(validUpdate, existingShots);
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("permits string-encoded valid shot numbers (e.g. '3')", () => {
    const validStringShot: AssistantAction = {
      type: "update_shot",
      shot_number: "3" as any,
      changes: { basic_stub: "Wide rain sweep." }
    };
    const result = validateActionSafety(validStringShot, existingShots);
    expect(result.valid).toBe(true);
  });

  it("strictly rejects hallucinated shot numbers (e.g. Shot #8 in a 3-shot scene)", () => {
    const hallucinatedUpdate: AssistantAction = {
      type: "update_shot",
      shot_number: 8,
      changes: { basic_stub: "Non-existent shot action." }
    };
    const result = validateActionSafety(hallucinatedUpdate, existingShots);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Target Shot #8 does not exist in the active scene");
    expect(result.reason).toContain("available: 1, 2, 3");
  });

  it("strictly rejects non-numeric or NaN shot numbers", () => {
    const invalidShot: AssistantAction = {
      type: "update_shot",
      shot_number: "invalid" as any,
      changes: {}
    };
    const result = validateActionSafety(invalidShot, existingShots);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Invalid shot number format");
  });

  it("rejects staging or prompt expansion for non-existent shot numbers", () => {
    const badStage: AssistantAction = {
      type: "stage_shot_assets",
      shot_number: 99
    };
    const badExpand: AssistantAction = {
      type: "expand_shot_prompt",
      shot_number: 0
    };

    expect(validateActionSafety(badStage, existingShots).valid).toBe(false);
    expect(validateActionSafety(badExpand, existingShots).valid).toBe(false);
  });

  it("permits general scene planning updates and valid character updates", () => {
    const planning: AssistantAction = {
      type: "update_scene_planning",
      changes: { mood_genre: "Neo-Noir" }
    };
    const character: AssistantAction = {
      type: "update_character",
      character_name: "Elena",
      changes: { notes: "Cyberpunk protagonist" }
    };

    expect(validateActionSafety(planning, existingShots).valid).toBe(true);
    expect(validateActionSafety(character, existingShots).valid).toBe(true);
  });

  it("rejects blank character names", () => {
    const badChar: AssistantAction = {
      type: "update_character",
      character_name: "   ",
      changes: {}
    };
    const res = validateActionSafety(badChar, existingShots);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain("Character name cannot be blank");
  });
});

describe("validateActionSequenceSafety (Phased Action Protocol)", () => {
  it("validates coordinated sequences where add_shot creates the next shot for subsequent update", () => {
    const initialShots = [1, 2, 3];
    const actions: AssistantAction[] = [
      {
        type: "add_shot",
        shot: { basic_stub: "Establishing drone sweep across the rain-slicked alley." }
      },
      {
        type: "update_shot",
        shot_number: 4,
        changes: { lens_focal_length: "24mm" }
      },
      {
        type: "expand_shot_prompt",
        shot_number: 4,
        guidance: "Detailed anamorphic reflections"
      }
    ];

    const results = validateActionSequenceSafety(actions, initialShots);
    expect(results).toHaveLength(3);
    expect(results[0].valid).toBe(true);
    expect(results[1].valid).toBe(true);
    expect(results[2].valid).toBe(true);
  });

  it("rejects hallucinated shots even within multi-action batches", () => {
    const initialShots = [1, 2, 3];
    const actions: AssistantAction[] = [
      {
        type: "update_shot",
        shot_number: 2,
        changes: { lighting_setup: "Rim light" }
      },
      {
        type: "update_shot",
        shot_number: 9, // Hallucination
        changes: { lighting_setup: "Neon" }
      }
    ];

    const results = validateActionSequenceSafety(actions, initialShots);
    expect(results[0].valid).toBe(true);
    expect(results[1].valid).toBe(false);
    expect(results[1].reason).toContain("Target Shot #9 does not exist");
  });
});
