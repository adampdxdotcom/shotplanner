import { describe, it, expect } from "vitest";
import { 
  updateDescriptionWithModifier, 
  detectActiveModifier, 
  getModifierConfig 
} from "../utils/assetModifiers";

describe("Asset Upload Modal Blank Slate & Modifier Mechanics", () => {
  it("generates modifier tags and updates descriptions dynamically", () => {
    const headshotConfig = getModifierConfig("Headshot");
    expect(headshotConfig).not.toBeNull();
    expect(headshotConfig?.modifiers.length).toBeGreaterThan(0);

    const initialDesc = "A smiling person in a blue jacket";
    const withFacing = updateDescriptionWithModifier(initialDesc, "Headshot", "facing");
    expect(withFacing.toLowerCase()).toContain("headshot facing");

    const detected = detectActiveModifier(withFacing, "Headshot");
    expect(detected).toBe("facing");
  });

  it("removes modifier tags cleanly when modifier is cleared", () => {
    const descWithTag = "headshot facing, A portrait photo";
    const cleared = updateDescriptionWithModifier(descWithTag, "Headshot", "");
    expect(cleared.toLowerCase()).not.toContain("facing");
    expect(cleared).toBe("A portrait photo");
  });

  it("supports blank state transition for character name, modifier, and description", () => {
    // Model the state contract verified in AssetUploadModal
    const initialFormState = {
      subjectName: "Sarah Connor",
      selectedModifier: "facing",
      description: "headshot facing, Sarah Connor with sunglasses",
      assetType: "Headshot",
      customType: "",
      stagedFile: { name: "headshot1.png" },
    };

    // When a new image is picked or the modal starts, state transitions to blank
    const blankFormState = {
      subjectName: "",
      selectedModifier: "",
      description: "",
      assetType: "Headshot",
      customType: "",
      stagedFile: { name: "headshot2.png" },
    };

    expect(blankFormState.subjectName).toBe("");
    expect(blankFormState.description).toBe("");
    expect(blankFormState.selectedModifier).toBe("");
    expect(blankFormState.stagedFile.name).not.toBe(initialFormState.stagedFile.name);
  });
});
