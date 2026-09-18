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

  it("safely sanitizes downstream system messages for Jinja chat template compliance", () => {
    // Simulates conversation messages where action application injected a system feedback message
    const rawConversation = [
      { role: "assistant", content: "I can help with Shot 5." },
      { role: "user", content: "Please add Shot 5." },
      { role: "assistant", content: "Shot 5 proposed." },
      { role: "system", content: "User applied proposed changes to Shot #5" },
      { role: "user", content: "Please add Nina to Shot 5." }
    ];

    const systemPrompt = "You are a cinematic assistant.";

    const sanitizedForLlm = [
      { role: "system" as const, content: systemPrompt },
      ...rawConversation.map((m) => {
        if (m.role === "assistant") {
          return { role: "assistant" as const, content: m.content };
        }
        if (m.role === "system") {
          return { role: "user" as const, content: `[System Notice]: ${m.content}` };
        }
        return { role: "user" as const, content: m.content };
      })
    ];

    // Verify ONLY index 0 is role: "system"
    expect(sanitizedForLlm[0].role).toBe("system");
    const nonInitialSystemMsgs = sanitizedForLlm.slice(1).filter((m) => m.role === "system");
    expect(nonInitialSystemMsgs).toHaveLength(0);

    // Verify the feedback message was preserved with user role and notice prefix
    const convertedNotice = sanitizedForLlm.find((m) =>
      m.content.includes("User applied proposed changes to Shot #5")
    );
    expect(convertedNotice?.role).toBe("user");
    expect(convertedNotice?.content).toBe(
      "[System Notice]: User applied proposed changes to Shot #5"
    );
  });
});
