import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createInitialAssistantMessage,
  getStoredAssistantChat,
  saveStoredAssistantChat,
  clearStoredAssistantChat,
  getRollingChatWindow
} from "../utils/assistantChatStore";
import { SceneProjectFile, AssistantChatMessage } from "../types";

describe("assistantChatStore - Per-Scene Assistant Memory", () => {
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

  const mockProjectA: SceneProjectFile = {
    schema_version: "1.0",
    scene_id: "scene_cyberpunk_alley",
    scene_name: "Neon Alley Investigation",
    workflow_file: "test_workflow.json",
    shared_assets: [],
    scene_planning: {
      visual_theme: "Cyberpunk",
      lighting_style: "Neon ambient",
      camera_gear: "Anamorphic",
      environment_description: "Wet street",
      audio_style: "Synth",
      custom_instructions: ""
    },
    shots: [
      {
        id: "shot_1",
        shot_number: 1,
        shot_name: "Establishing wide",
        characters: ["Elena"],
        shot_type: "Wide Shot",
        camera_movement: "Pan Left",
        aspect_ratio: "16:9",
        lens_focal_length: "24mm",
        basic_stub: "Elena steps into the alley",
        expanded_prompt: "",
        assigned_slots: {},
        status: "unstaged",
        updated_at: "2026-09-18T08:00:00.000Z"
      }
    ]
  };

  const mockProjectB: SceneProjectFile = {
    schema_version: "1.0",
    scene_id: "scene_orbital_station",
    scene_name: "Orbital Command Deck",
    workflow_file: "test_workflow.json",
    shared_assets: [],
    scene_planning: {
      visual_theme: "Hard Sci-Fi",
      lighting_style: "Stark fluorescent",
      camera_gear: "Spherical",
      environment_description: "Command bridge",
      audio_style: "Quiet hum",
      custom_instructions: ""
    },
    shots: []
  };

  it("creates a tailored initial greeting with scene name and shot count", () => {
    const greetingA = createInitialAssistantMessage(mockProjectA);
    expect(greetingA.role).toBe("assistant");
    expect(greetingA.content).toContain("Neon Alley Investigation");
    expect(greetingA.content).toContain("1 shots");

    const greetingB = createInitialAssistantMessage(mockProjectB);
    expect(greetingB.content).toContain("Orbital Command Deck");
    expect(greetingB.content).toContain("0 shots");
  });

  it("retrieves chat history embedded in the scene project file", () => {
    const projectWithHistory: SceneProjectFile = {
      ...mockProjectA,
      assistant_chat_history: [
        { role: "assistant", content: "Initial greeting" },
        { role: "user", content: "Can you recommend a lens for shot 1?" },
        { role: "assistant", content: "I recommend a 24mm wide lens." }
      ]
    };

    const loaded = getStoredAssistantChat(projectWithHistory.scene_id, projectWithHistory);
    expect(loaded).toHaveLength(3);
    expect(loaded[1].content).toBe("Can you recommend a lens for shot 1?");
  });

  it("swaps between distinct scene chat threads without cross-contamination", () => {
    const historyA: AssistantChatMessage[] = [
      { role: "user", content: "Focus on Elena's trenchcoat" }
    ];
    const historyB: AssistantChatMessage[] = [
      { role: "user", content: "Check orbital docking clamp" }
    ];

    saveStoredAssistantChat("scene_cyberpunk_alley", historyA);
    saveStoredAssistantChat("scene_orbital_station", historyB);

    const loadedA = getStoredAssistantChat("scene_cyberpunk_alley", mockProjectA);
    const loadedB = getStoredAssistantChat("scene_orbital_station", mockProjectB);

    expect(loadedA[0].content).toBe("Focus on Elena's trenchcoat");
    expect(loadedB[0].content).toBe("Check orbital docking clamp");
  });

  it("clears cached conversation and returns fresh greeting on reset", () => {
    saveStoredAssistantChat("scene_cyberpunk_alley", [
      { role: "user", content: "Old conversation" }
    ]);

    const resetMsgs = clearStoredAssistantChat("scene_cyberpunk_alley", mockProjectA);
    expect(resetMsgs).toHaveLength(1);
    expect(resetMsgs[0].role).toBe("assistant");
    expect(resetMsgs[0].content).toContain("Neon Alley Investigation");

    const afterReset = getStoredAssistantChat("scene_cyberpunk_alley", mockProjectA);
    expect(afterReset[0].content).toContain("Neon Alley Investigation");
  });

  describe("getRollingChatWindow", () => {
    it("returns empty array when given empty or non-array input", () => {
      expect(getRollingChatWindow([])).toEqual([]);
      expect(getRollingChatWindow(null as any)).toEqual([]);
    });

    it("returns all messages when count is less than or equal to maxTurns", () => {
      const msgs: AssistantChatMessage[] = [
        { role: "assistant", content: "Hello" },
        { role: "user", content: "Hi" }
      ];
      expect(getRollingChatWindow(msgs, 16)).toHaveLength(2);
      expect(getRollingChatWindow(msgs, 2)).toHaveLength(2);
    });

    it("slices precisely down to the most recent maxTurns messages", () => {
      const msgs: AssistantChatMessage[] = Array.from({ length: 30 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Message #${i + 1}`
      }));

      const windowed = getRollingChatWindow(msgs, 16);
      expect(windowed).toHaveLength(16);
      // The first item should be Message #15 (index 14)
      expect(windowed[0].content).toBe("Message #15");
      // The last item should be Message #30 (index 29)
      expect(windowed[15].content).toBe("Message #30");
    });
  });
});
