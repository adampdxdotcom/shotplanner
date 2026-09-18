import { describe, it, expect } from "vitest";
import { 
  toCanonicalSubjectName, 
  findCanonicalSubject, 
  normalizeProjectCastAndAssets 
} from "../utils/subjectUtils";
import { SceneProjectFile, MediaAsset } from "../types";

describe("subjectUtils", () => {
  describe("toCanonicalSubjectName", () => {
    it("converts all-caps or lowercase names into clean Title Case", () => {
      expect(toCanonicalSubjectName("SARAH CONNOR")).toBe("Sarah Connor");
      expect(toCanonicalSubjectName("john doe")).toBe("John Doe");
      expect(toCanonicalSubjectName("  agent   smith  ")).toBe("Agent Smith");
    });

    it("returns empty string for falsy or empty inputs", () => {
      expect(toCanonicalSubjectName("")).toBe("");
      expect(toCanonicalSubjectName("   ")).toBe("");
    });

    it("handles single-word subject names", () => {
      expect(toCanonicalSubjectName("NEO")).toBe("Neo");
      expect(toCanonicalSubjectName("morpheus")).toBe("Morpheus");
    });
  });

  describe("findCanonicalSubject", () => {
    const registry = ["Sarah Connor", "John Wick", "Ellen Ripley"];

    it("finds matching subject regardless of casing", () => {
      expect(findCanonicalSubject("sarah connor", registry)).toBe("Sarah Connor");
      expect(findCanonicalSubject("JOHN WICK", registry)).toBe("John Wick");
      expect(findCanonicalSubject("  ellen ripley ", registry)).toBe("Ellen Ripley");
    });

    it("returns null if subject does not exist in registry", () => {
      expect(findCanonicalSubject("Luke Skywalker", registry)).toBeNull();
      expect(findCanonicalSubject("", registry)).toBeNull();
    });
  });

  describe("normalizeProjectCastAndAssets", () => {
    it("deduplicates case variations and synchronizes characters and assets", () => {
      const mockAsset: MediaAsset = {
        id: "asset_1",
        filename: "img1.png",
        original_name: "img1.png",
        media_type: "image",
        type: "Headshot",
        subject_name: "sarah connor",
        description: "",
        size_bytes: 1000,
        created_at: Date.now()
      };

      const mockProject: SceneProjectFile = {
        schema_version: "1.0",
        scene_id: "scene_1",
        scene_name: "Test Scene",
        workflow_file: "test.json",
        shared_assets: [],
        subjects: ["sarah connor", "Sarah Connor", "JOHN WICK"],
        characters: {
          "sarah connor": {
            id: "char_1",
            name: "sarah connor",
            notes: "Test notes",
            quick_slots: ["img1.png"],
            scene_outfit_ref: ""
          }
        },
        assets: [mockAsset],
        shots: []
      };

      const normalized = normalizeProjectCastAndAssets(mockProject);
      
      // Should normalize to canonical names
      expect(normalized.subjects).toContain("Sarah Connor");
      expect(normalized.subjects).toContain("John Wick");
      expect(normalized.subjects?.length).toBe(2);

      // Character keys should be canonical
      expect(normalized.characters?.["Sarah Connor"]).toBeDefined();
      expect(normalized.characters?.["sarah connor"]).toBeUndefined();
      expect(normalized.characters?.["Sarah Connor"].name).toBe("Sarah Connor");

      // Asset subject_name should be canonical
      expect(normalized.assets?.[0].subject_name).toBe("Sarah Connor");
    });
  });
});
