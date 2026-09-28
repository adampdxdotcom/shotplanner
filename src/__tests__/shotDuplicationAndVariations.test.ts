import { describe, it, expect } from "vitest";
import { duplicateShotItem } from "../utils/shotDuplication";
import { applyPromptVariationToShot } from "../components/assistant/useAssistantActions";
import { ShotItem } from "../types";

describe("Shot Duplication & Prompt Variation System", () => {
  const baseShot: ShotItem = {
    id: "shot_123",
    shot_number: 2,
    shot_name: "Original Shot 2",
    shot_type: "Close-Up",
    camera_movement: "Slow Push In",
    lens_focal_length: "85mm Portrait Telephoto",
    aspect_ratio: "2.39:1 Anamorphic Scope",
    basic_stub: "Elena stares out the window.",
    expanded_prompt: "Cinematic close-up of Elena staring out the rain-slicked window with blue rim lighting.",
    characters: ["Elena"],
    assigned_slots: { 0: "elena_ref1.png", 1: "elena_ref2.png" },
    generation_params: { steps: 35, megapixels: 1.0, frames: 81 },
    prompt_variations: [
      {
        id: "var_1",
        variation_number: 1,
        created_at: "2026-01-01T00:00:00Z",
        basic_stub: "Elena stares out the window.",
        expanded_prompt: "Cinematic close-up of Elena staring out the rain-slicked window with blue rim lighting.",
        label: "Variation 1"
      },
      {
        id: "var_2",
        variation_number: 2,
        created_at: "2026-01-01T00:01:00Z",
        basic_stub: "Elena stares out the window.",
        expanded_prompt: "Dramatic close-up with neon magenta reflections.",
        label: "Variation 2"
      }
    ],
    active_variation_id: "var_2",
    takes: [{ id: "take_1", take_number: 1, created_at: "2026-01-01T00:00:00Z", expanded_prompt: "test", video_url: "/video.mp4", is_hero: true }],
    hero_take_id: "take_1",
    status: "staged"
  };

  it("duplicates a shot retaining camera specs, cast, and slots while clearing prompt and takes", () => {
    const duplicated = duplicateShotItem(baseShot, 3);

    // Retains camera specs
    expect(duplicated.shot_type).toBe("Close-Up");
    expect(duplicated.camera_movement).toBe("Slow Push In");
    expect(duplicated.lens_focal_length).toBe("85mm Portrait Telephoto");
    expect(duplicated.aspect_ratio).toBe("2.39:1 Anamorphic Scope");

    // Retains cast and slots
    expect(duplicated.characters).toEqual(["Elena"]);
    expect(duplicated.assigned_slots).toEqual({ 0: "elena_ref1.png", 1: "elena_ref2.png" });
    expect(duplicated.generation_params).toEqual({ steps: 35, megapixels: 1.0, frames: 81 });

    // Pre-fills basic stub with duplication notice
    expect(duplicated.basic_stub).toBe("Duplicated from Shot #2");

    // Fresh prompt slate
    expect(duplicated.expanded_prompt).toBe("");
    expect(duplicated.prompt_variations).toEqual([]);
    expect(duplicated.active_variation_id).toBeUndefined();

    // Reset takes and status
    expect(duplicated.takes).toEqual([]);
    expect(duplicated.hero_take_id).toBeUndefined();
    expect(duplicated.status).toBe("unstaged");
    expect(duplicated.shot_number).toBe(3);
    expect(duplicated.shot_name).toBe("Original Shot 2 (Copy)");
  });

  it("creates Variation 1 on the first prompt expansion of a new or duplicated shot", () => {
    const duplicated = duplicateShotItem(baseShot, 3);

    // First expansion should result in Variation 1, NOT Variation 2
    const expanded = applyPromptVariationToShot(
      duplicated,
      "Freshly expanded cinematic prompt for duplicated shot",
      duplicated.basic_stub
    );

    expect(expanded.prompt_variations).toHaveLength(1);
    expect(expanded.prompt_variations![0].variation_number).toBe(1);
    expect(expanded.prompt_variations![0].label).toBe("Variation 1");
    expect(expanded.prompt_variations![0].expanded_prompt).toBe(
      "Freshly expanded cinematic prompt for duplicated shot"
    );
    expect(expanded.active_variation_id).toBe(expanded.prompt_variations![0].id);
    expect(expanded.expanded_prompt).toBe("Freshly expanded cinematic prompt for duplicated shot");
  });

  it("creates Variation 2 only on subsequent prompt expansions after Variation 1 exists with content", () => {
    const duplicated = duplicateShotItem(baseShot, 3);

    const firstExpansion = applyPromptVariationToShot(
      duplicated,
      "First expanded prompt",
      duplicated.basic_stub
    );
    expect(firstExpansion.prompt_variations).toHaveLength(1);
    expect(firstExpansion.prompt_variations![0].variation_number).toBe(1);

    // Second expansion on the same shot should branch into Variation 2
    const secondExpansion = applyPromptVariationToShot(
      firstExpansion,
      "Second expanded alternative prompt",
      firstExpansion.basic_stub
    );

    expect(secondExpansion.prompt_variations).toHaveLength(2);
    expect(secondExpansion.prompt_variations![1].variation_number).toBe(2);
    expect(secondExpansion.prompt_variations![1].label).toContain("Variation 2");
    expect(secondExpansion.prompt_variations![1].expanded_prompt).toBe("Second expanded alternative prompt");
    expect(secondExpansion.active_variation_id).toBe(secondExpansion.prompt_variations![1].id);
  });
});
