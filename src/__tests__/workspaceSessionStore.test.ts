import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getLastProjectName,
  setLastProjectName,
  clearLastProjectName,
  clearDemoProjectSession,
  getLastActiveSection,
  setLastActiveSection,
  getLastActiveShotId,
  setLastActiveShotId,
  getLastActiveSubject,
  setLastActiveSubject,
  getLastStagingTab,
  setLastStagingTab,
  getLastAssetTab,
  setLastAssetTab,
  getLastConfigTab,
  setLastConfigTab,
  getLastCastTab,
  setLastCastTab
} from "../utils/workspaceSessionStore";

describe("workspaceSessionStore", () => {
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

  describe("project persistence", () => {
    it("persists and retrieves valid project names", () => {
      setLastProjectName("Cyberpunk_Scene_01");
      expect(getLastProjectName()).toBe("cyberpunk_scene_01");
    });

    it("filters out demo project and untitled placeholders", () => {
      setLastProjectName("demo_project");
      expect(getLastProjectName()).toBeNull();

      setLastProjectName("untitled_scene");
      expect(getLastProjectName()).toBeNull();
    });

    it("clears demo project session cleanly", () => {
      mockStorage["shotplanner_last_project"] = "demo_project_sample";
      clearDemoProjectSession();
      expect(mockStorage["shotplanner_last_project"]).toBeUndefined();
    });
  });

  describe("section navigation persistence", () => {
    it("persists and returns valid sections", () => {
      setLastActiveSection("staging");
      expect(getLastActiveSection()).toBe("staging");

      setLastActiveSection("cast");
      expect(getLastActiveSection()).toBe("cast");
    });

    it("falls back to default for invalid sections", () => {
      mockStorage["shotplanner_active_section"] = "non_existent_tab";
      expect(getLastActiveSection("scene")).toBe("scene");
    });
  });

  describe("shot ID persistence", () => {
    it("persists project-specific and global active shot IDs", () => {
      setLastActiveShotId("shot_101", "Project_Alpha");
      expect(getLastActiveShotId("Project_Alpha")).toBe("shot_101");

      // Different project defaults to global fallback or null if clean
      setLastActiveShotId("shot_202", "Project_Beta");
      expect(getLastActiveShotId("Project_Beta")).toBe("shot_202");
      expect(getLastActiveShotId("Project_Alpha")).toBe("shot_101");
    });

    it("clears shot IDs safely", () => {
      setLastActiveShotId("shot_101", "Project_Alpha");
      setLastActiveShotId(null, "Project_Alpha");
      expect(getLastActiveShotId("Project_Alpha")).toBeNull();
    });
  });

  describe("staging subject and sub-tab persistence", () => {
    it("persists and retrieves staging subject", () => {
      setLastActiveSubject("Marcus");
      expect(getLastActiveSubject()).toBe("Marcus");

      setLastActiveSubject(null);
      expect(getLastActiveSubject()).toBeNull();
    });

    it("persists and retrieves staging tab", () => {
      setLastStagingTab("headshots");
      expect(getLastStagingTab()).toBe("headshots");

      setLastStagingTab("sheets");
      expect(getLastStagingTab()).toBe("sheets");
    });
  });

  describe("asset, config, and cast tabs persistence", () => {
    it("persists asset tab", () => {
      setLastAssetTab("video");
      expect(getLastAssetTab()).toBe("video");
    });

    it("persists config tab", () => {
      setLastConfigTab("diagnostics");
      expect(getLastConfigTab()).toBe("diagnostics");
    });

    it("persists cast roster tab", () => {
      setLastCastTab("universe");
      expect(getLastCastTab()).toBe("universe");
    });
  });
});
