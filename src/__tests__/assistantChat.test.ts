import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createInitialAssistantMessage,
  getStoredAssistantChat,
  saveStoredAssistantChat,
  clearStoredAssistantChat,
  getRollingChatWindow
} from "../utils/assistantChatStore";
import { SceneProjectFile, AssistantChatMessage } from "../types";

describe("assistantChat.test.ts - Production Assistant Per-Scene Memory & Rolling Window", () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    const localStorageMock = {
      getItem: vi.fn((key: string) => mockStorage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        mockStorage = {};
      })
    };
    vi.stubGlobal("localStorage", localStorageMock);
    vi.stubGlobal("window", { localStorage: localStorageMock });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const createMockScene = (id: string, name: string): SceneProjectFile => ({
    schema_version: "1.0",
    scene_id: id,
    scene_name: name,
    workflow_file: "standard_production_workflow.json",
    shared_assets: [],
    scene_planning: {
      visual_theme: "Cinematic Neo-Noir",
      lighting_style: "Chiaroscuro rim light",
      camera_gear: "ARRI Alexa Mini LF",
      environment_description: "Rainy city alley",
      audio_style: "Industrial ambient",
      custom_instructions: ""
    },
    shots: [
      {
        id: `${id}_shot_1`,
        shot_number: 1,
        shot_name: "Establishing Wide",
        characters: ["Protagonist"],
        shot_type: "Wide Shot",
        camera_movement: "Slow Push In",
        aspect_ratio: "16:9",
        lens_focal_length: "35mm",
        basic_stub: "Protagonist steps into frame under rain",
        expanded_prompt: "",
        assigned_slots: {},
        status: "unstaged",
        updated_at: "2026-09-18T08:00:00.000Z"
      }
    ]
  });

  describe("1. Rolling Window Context Slicer (getRollingChatWindow)", () => {
    it("preserves alternating turn orders when slicing conversation history", () => {
      const fullConversation: AssistantChatMessage[] = [
        { role: "assistant", content: "Welcome to Scene 1" },
        { role: "user", content: "Recommend a camera movement" },
        { role: "assistant", content: "Try a slow push in" },
        { role: "user", content: "What lens works best?" },
        { role: "assistant", content: "A 35mm anamorphic prime" },
        { role: "user", content: "Can we add rim lighting?" },
        { role: "assistant", content: "Yes, warm amber rim lighting" },
        { role: "user", content: "How about Elena's outfit?" },
        { role: "assistant", content: "Tactical dark trenchcoat" },
        { role: "user", content: "Let's stage shot 1" },
        { role: "assistant", content: "Shot 1 assets ready to stage" }
      ];

      const windowSize = 4;
      const windowed = getRollingChatWindow(fullConversation, windowSize);

      expect(windowed).toHaveLength(4);
      // Turn order preservation check
      expect(windowed[0]).toEqual({ role: "user", content: "How about Elena's outfit?" });
      expect(windowed[1]).toEqual({ role: "assistant", content: "Tactical dark trenchcoat" });
      expect(windowed[2]).toEqual({ role: "user", content: "Let's stage shot 1" });
      expect(windowed[3]).toEqual({ role: "assistant", content: "Shot 1 assets ready to stage" });
    });

    it("caps token payload safely across arbitrary window sizes", () => {
      const messages: AssistantChatMessage[] = Array.from({ length: 100 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Dialogue turn #${i + 1}`
      }));

      const window16 = getRollingChatWindow(messages, 16);
      expect(window16).toHaveLength(16);
      expect(window16[0].content).toBe("Dialogue turn #85");
      expect(window16[15].content).toBe("Dialogue turn #100");

      const window8 = getRollingChatWindow(messages, 8);
      expect(window8).toHaveLength(8);
      expect(window8[0].content).toBe("Dialogue turn #93");
      expect(window8[7].content).toBe("Dialogue turn #100");
    });
  });

  describe("2. Per-Scene Isolation & Switching", () => {
    it("switches scene threads without mutating previous scene histories", () => {
      const sceneAlley = createMockScene("scene_alley", "Rainy Alley");
      const sceneRooftop = createMockScene("scene_rooftop", "Helipad Rooftop");
      const sceneDiner = createMockScene("scene_diner", "Midnight Diner");

      // Populate conversations for each scene
      const alleyHistory: AssistantChatMessage[] = [
        { role: "assistant", content: "Welcome to Rainy Alley" },
        { role: "user", content: "Focus on Elena in the rain" }
      ];
      const rooftopHistory: AssistantChatMessage[] = [
        { role: "assistant", content: "Welcome to Helipad Rooftop" },
        { role: "user", content: "Focus on helicopter spotlight" }
      ];
      const dinerHistory: AssistantChatMessage[] = [
        { role: "assistant", content: "Welcome to Midnight Diner" },
        { role: "user", content: "Focus on neon reflections in diner coffee cup" }
      ];

      saveStoredAssistantChat(sceneAlley.scene_id, alleyHistory);
      saveStoredAssistantChat(sceneRooftop.scene_id, rooftopHistory);
      saveStoredAssistantChat(sceneDiner.scene_id, dinerHistory);

      // Verify retrieval for each scene returns its own isolated history
      const loadedAlley = getStoredAssistantChat(sceneAlley.scene_id, sceneAlley);
      const loadedRooftop = getStoredAssistantChat(sceneRooftop.scene_id, sceneRooftop);
      const loadedDiner = getStoredAssistantChat(sceneDiner.scene_id, sceneDiner);

      expect(loadedAlley).toHaveLength(2);
      expect(loadedAlley[1].content).toBe("Focus on Elena in the rain");

      expect(loadedRooftop).toHaveLength(2);
      expect(loadedRooftop[1].content).toBe("Focus on helicopter spotlight");

      expect(loadedDiner).toHaveLength(2);
      expect(loadedDiner[1].content).toBe("Focus on neon reflections in diner coffee cup");

      // Mutate alley history and verify rooftop and diner remain completely untouched
      const updatedAlley: AssistantChatMessage[] = [
        ...alleyHistory,
        { role: "assistant", content: "Elena trenchcoat equipped" }
      ];
      saveStoredAssistantChat(sceneAlley.scene_id, updatedAlley);

      const reloadedRooftop = getStoredAssistantChat(sceneRooftop.scene_id, sceneRooftop);
      expect(reloadedRooftop).toHaveLength(2);
      expect(reloadedRooftop[1].content).toBe("Focus on helicopter spotlight");
    });
  });

  describe("3. Clear & Reset Logic", () => {
    it("clears conversation for the specified scene without affecting other scenes", () => {
      const sceneAlley = createMockScene("scene_alley", "Rainy Alley");
      const sceneRooftop = createMockScene("scene_rooftop", "Helipad Rooftop");

      saveStoredAssistantChat(sceneAlley.scene_id, [
        { role: "user", content: "Alley conversation to be cleared" }
      ]);
      saveStoredAssistantChat(sceneRooftop.scene_id, [
        { role: "user", content: "Rooftop conversation that must stay" }
      ]);

      // Reset Alley
      const freshAlleyGreeting = clearStoredAssistantChat(sceneAlley.scene_id, sceneAlley);
      expect(freshAlleyGreeting).toHaveLength(1);
      expect(freshAlleyGreeting[0].role).toBe("assistant");
      expect(freshAlleyGreeting[0].content).toContain("Rainy Alley");

      // Verify Alley is reset
      const reloadedAlley = getStoredAssistantChat(sceneAlley.scene_id, sceneAlley);
      expect(reloadedAlley).toHaveLength(1);
      expect(reloadedAlley[0].content).toContain("Rainy Alley");

      // Verify Rooftop is still intact
      const reloadedRooftop = getStoredAssistantChat(sceneRooftop.scene_id, sceneRooftop);
      expect(reloadedRooftop).toHaveLength(1);
      expect(reloadedRooftop[0].content).toBe("Rooftop conversation that must stay");
    });
  });

  describe("4. Embedded Project File Round-Trip", () => {
    it("prefers embedded assistant_chat_history from scene_project.json when available", () => {
      const sceneWithEmbeddedChat: SceneProjectFile = {
        ...createMockScene("scene_vault", "Bank Vault Infiltration"),
        assistant_chat_history: [
          { role: "assistant", content: "Welcome to Vault" },
          { role: "user", content: "What is the security system lore?" },
          { role: "assistant", content: "Thermal sensors on grid 4." }
        ]
      };

      // Even if localStorage has old data, the embedded project file takes precedence
      saveStoredAssistantChat("scene_vault", [
        { role: "user", content: "Stale local storage message" }
      ]);

      const loaded = getStoredAssistantChat("scene_vault", sceneWithEmbeddedChat);
      expect(loaded).toHaveLength(3);
      expect(loaded[1].content).toBe("What is the security system lore?");
      expect(loaded[2].content).toBe("Thermal sensors on grid 4.");
    });
  });
});
