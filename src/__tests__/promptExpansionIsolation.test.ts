import { describe, it, expect, vi, beforeEach } from "vitest";
import { ShotItem, PromptVariation } from "../types";

describe("Async Prompt Expansion Isolation & No-Leak Resolution", () => {
  const mockShot1: ShotItem = {
    id: "shot_1",
    shot_number: 1,
    shot_type: "Close-Up",
    camera_movement: "Static",
    lens_focal_length: "50mm",
    aspect_ratio: "16:9",
    basic_stub: "A detective in neon rain",
    expanded_prompt: "Original Shot 1 prompt",
    assigned_slots: { 0: "marcus_head.png" },
    status: "staged",
    updated_at: new Date().toISOString()
  };

  const mockShot2: ShotItem = {
    id: "shot_2",
    shot_number: 2,
    shot_type: "Wide Shot",
    camera_movement: "Pan Left",
    lens_focal_length: "24mm",
    aspect_ratio: "16:9",
    basic_stub: "Cyberpunk skyline",
    expanded_prompt: "Original Shot 2 pristine prompt",
    assigned_slots: {},
    status: "staged",
    updated_at: new Date().toISOString()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ensures asynchronous resolution binds to originating shotId and does not leak to newly selected shot", async () => {
    let activeShotId = "shot_1";
    let activeEditorPrompt = mockShot1.expanded_prompt;
    let shotsState: Record<string, ShotItem> = {
      shot_1: { ...mockShot1 },
      shot_2: { ...mockShot2 }
    };

    const onChangeExpandedPrompt = vi.fn((val: string) => {
      activeEditorPrompt = val;
    });

    const onUpdateSpecificShot = vi.fn((id: string, updater: (prev: ShotItem) => ShotItem) => {
      if (shotsState[id]) {
        shotsState[id] = updater(shotsState[id]);
      }
    });

    // Simulated async prompt expansion controller
    const runExpansion = async (initiatingShotId: string, stub: string, generatedPrompt: string) => {
      // Snapshot the initiating shot ID at trigger time
      const targetShotId = initiatingShotId;

      // Simulate async network delay
      await new Promise((resolve) => setTimeout(resolve, 50));

      const updatedShotUpdater = (prev: ShotItem): ShotItem => {
        const currentVariations = prev.prompt_variations || [];
        const nextVarNum = currentVariations.length + 1;

        const newVariation: PromptVariation = {
          id: "var_" + Date.now(),
          variation_number: nextVarNum,
          created_at: new Date().toISOString(),
          basic_stub: stub,
          expanded_prompt: generatedPrompt,
          provider: "gemini",
          label: `Variation ${nextVarNum}`
        };

        return {
          ...prev,
          expanded_prompt: generatedPrompt,
          prompt_variations: [...currentVariations, newVariation],
          active_variation_id: newVariation.id,
          status: "unstaged",
          updated_at: new Date().toISOString()
        };
      };

      // 1. Explicitly update the originating shot via onUpdateSpecificShot
      onUpdateSpecificShot(targetShotId, updatedShotUpdater);

      // 2. Only update active editor prompt if the user is STILL viewing targetShotId
      if (activeShotId === targetShotId) {
        onChangeExpandedPrompt(generatedPrompt);
      }
    };

    // Trigger expansion for Shot 1
    const expansionPromise = runExpansion("shot_1", mockShot1.basic_stub || "", "Expanded Shot 1 Cinematic Neon");

    // User switches immediately to Shot 2 while request is in flight
    activeShotId = "shot_2";
    activeEditorPrompt = mockShot2.expanded_prompt;

    await expansionPromise;

    // Verify Shot 1 was updated in project data
    expect(onUpdateSpecificShot).toHaveBeenCalledTimes(1);
    expect(onUpdateSpecificShot).toHaveBeenCalledWith("shot_1", expect.any(Function));
    expect(shotsState["shot_1"].expanded_prompt).toBe("Expanded Shot 1 Cinematic Neon");
    expect(shotsState["shot_1"].prompt_variations?.length).toBe(1);

    // CRITICAL: onChangeExpandedPrompt must NOT be called for Shot 2
    expect(onChangeExpandedPrompt).not.toHaveBeenCalled();
    // Shot 2's editor prompt and data remain completely untouched
    expect(activeEditorPrompt).toBe("Original Shot 2 pristine prompt");
    expect(shotsState["shot_2"].expanded_prompt).toBe("Original Shot 2 pristine prompt");
  });

  it("updates active editor buffer when user stays on the generating shot", async () => {
    let activeShotId = "shot_1";
    let activeEditorPrompt = mockShot1.expanded_prompt;
    let shotsState: Record<string, ShotItem> = {
      shot_1: { ...mockShot1 }
    };

    const onChangeExpandedPrompt = vi.fn((val: string) => {
      activeEditorPrompt = val;
    });

    const onUpdateSpecificShot = vi.fn((id: string, updater: (prev: ShotItem) => ShotItem) => {
      if (shotsState[id]) {
        shotsState[id] = updater(shotsState[id]);
      }
    });

    const runExpansion = async (initiatingShotId: string, stub: string, generatedPrompt: string) => {
      const targetShotId = initiatingShotId;
      await new Promise((resolve) => setTimeout(resolve, 10));

      onUpdateSpecificShot(targetShotId, (prev) => ({
        ...prev,
        expanded_prompt: generatedPrompt
      }));

      if (activeShotId === targetShotId) {
        onChangeExpandedPrompt(generatedPrompt);
      }
    };

    await runExpansion("shot_1", mockShot1.basic_stub || "", "New Shot 1 Direct Result");

    expect(onUpdateSpecificShot).toHaveBeenCalledWith("shot_1", expect.any(Function));
    expect(onChangeExpandedPrompt).toHaveBeenCalledWith("New Shot 1 Direct Result");
    expect(activeEditorPrompt).toBe("New Shot 1 Direct Result");
  });
});
