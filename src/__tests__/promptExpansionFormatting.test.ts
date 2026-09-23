import { describe, it, expect } from "vitest";
import { buildSubjectDefinitions, assembleFinalPrompt } from "../utils/formatters";
import { buildSubjectDefinitionsHeader } from "../../server/services/llm_service";
import { assembleFinalPrompt as assembleServerPrompt } from "../../server/utils/formatters";

describe("Prompt Expansion Formatting & Grouping", () => {
  describe("buildSubjectDefinitions & buildSubjectDefinitionsHeader", () => {
    it("groups multiple reference photos under a single subject definition", () => {
      const assets = [
        { slot_index: 0, subject_name: "Billie", description: "headshot facing,", media_type: "image" },
        { slot_index: 1, subject_name: "Billie", description: "headshot 3/4 profile,", media_type: "image" },
        { slot_index: 2, subject_name: "Billie", description: "three panel nude.", media_type: "image" },
        { slot_index: 3, subject_name: "Billie", description: "body reference upper body,", media_type: "image" }
      ];

      const clientResult = buildSubjectDefinitions(assets);
      const serverResult = buildSubjectDefinitionsHeader(assets);

      const expected = "Global Subject Definitions:\nBillie: <Picture 1> (headshot facing), <Picture 2> (headshot 3/4 profile), <Picture 3> (three panel nude), <Picture 4> (body reference upper body).";

      expect(clientResult).toBe(expected);
      expect(serverResult).toBe(expected);
    });

    it("handles multiple different subjects and locations accurately", () => {
      const assets = [
        { slot_index: 0, subject_name: "Billie", description: "Close-up portrait", media_type: "image" },
        { slot_index: 1, subject_name: "Billie", description: "Leather jacket attire", media_type: "image" },
        { slot_index: 2, subject_name: "Marcus", description: "Trench coat", media_type: "image" },
        { slot_index: 3, subject_name: "Downtown Alley", type: "Location", description: "Rainy neon alley", media_type: "image" }
      ];

      const serverResult = buildSubjectDefinitionsHeader(assets);

      expect(serverResult).toContain("Billie: <Picture 1> (Close-up portrait), <Picture 2> (Leather jacket attire).");
      expect(serverResult).toContain("Marcus (<Picture 3>): Trench coat.");
      expect(serverResult).toContain("Location(<Picture 4>): Rainy neon alley.");
    });
  });

  describe("assembleFinalPrompt Footer Deduplication", () => {
    it("does not append a duplicate footer if overall_soundscape already exists in the description", () => {
      const header = "Billie Face - Shot 01 - Close-Up";
      const descWithSoundscape = `integrated_multimodal_description: [Shot 1] Billie (<Picture 1>) sits in the corner.

overall_soundscape:
Custom ambient rain sound and soft footsteps.

non_diegetic_music:
N/A`;

      const assembled = assembleServerPrompt({
        header,
        description: descWithSoundscape
      });

      // Count occurrences of overall_soundscape:
      const occurrences = (assembled.match(/overall_soundscape:/g) || []).length;
      expect(occurrences).toBe(1);
      expect(assembled).toContain("Custom ambient rain sound and soft footsteps.");
    });

    it("appends standard footer if description lacks soundscape", () => {
      const header = "Billie Face - Shot 01 - Close-Up";
      const descWithoutSoundscape = `integrated_multimodal_description: [Shot 1] Billie (<Picture 1>) turns to look at the camera.`;

      const assembled = assembleServerPrompt({
        header,
        description: descWithoutSoundscape
      });

      const occurrences = (assembled.match(/overall_soundscape:/g) || []).length;
      expect(occurrences).toBe(1);
      expect(assembled).toContain("Soft room ambience, environmental acoustics");
    });
  });
});
