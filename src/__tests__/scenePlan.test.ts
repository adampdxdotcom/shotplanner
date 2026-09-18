import { describe, it, expect } from "vitest";
import { SceneProjectFile, ScenePlanningDetails } from "../types";
import { UpdateScenePlanningAction } from "../types/assistantActions";

describe("scenePlan.test.ts - Scene Plan & Overarching Goal Integration", () => {
  it("allows setting and updating the overarching_goal in scene_planning", () => {
    const mockProject: SceneProjectFile = {
      schema_version: "1.0",
      scene_id: "scene_cyberpunk_alley",
      scene_name: "Alley Ambush",
      workflow_file: "test_workflow.json",
      shared_assets: [],
      shots: [],
      scene_planning: {
        visual_theme: "Neo-Noir",
        overarching_goal: "Elena tracks down the rogue courier, escalating into an ambush."
      }
    };

    expect(mockProject.scene_planning?.overarching_goal).toBe(
      "Elena tracks down the rogue courier, escalating into an ambush."
    );

    // Update the overarching goal
    const updatedPlanning: ScenePlanningDetails = {
      ...(mockProject.scene_planning || {}),
      overarching_goal: "Elena negotiates peace with the courier before patrol arrives."
    };

    expect(updatedPlanning.overarching_goal).toBe(
      "Elena negotiates peace with the courier before patrol arrives."
    );
  });

  it("supports overarching_goal within the update_scene_planning assistant action", () => {
    const action: UpdateScenePlanningAction = {
      type: "update_scene_planning",
      title: "Refine Dramatic Objective",
      changes: {
        overarching_goal: "Build tension steadily as Elena discovers the hacked terminal.",
        lighting_style: "Low key neon green underglow"
      }
    };

    expect(action.type).toBe("update_scene_planning");
    expect(action.changes.overarching_goal).toBe(
      "Build tension steadily as Elena discovers the hacked terminal."
    );
    expect(action.changes.lighting_style).toBe("Low key neon green underglow");
  });
});
