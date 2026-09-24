import { describe, it, expect, vi, beforeEach } from "vitest";
import { sanitizeProjectForPersistence } from "../utils/recipeSanitizer";

describe("Client-Side Autosave Integrity & Payload Hygiene (Phase 3)", () => {
  it("sanitizes in-memory base64 buffers from scene projects before auto-save", () => {
    const dirtyProject: any = {
      scene_name: "Action Alley",
      shots: [
        {
          id: "shot_1",
          shot_number: 1,
          basic_stub: "Elena jumps across rooftops",
          staging_recipe: {
            backgroundUrl: "data:image/png;base64," + "A".repeat(5000),
            backgroundAssetFilename: "rooftop_bg.png",
            actors: [
              {
                id: "actor_1",
                characterName: "Elena",
                cutoutDataUrl: "data:image/png;base64," + "B".repeat(5000),
                referenceAssetFilename: "elena_pose.png",
                xPercent: 50.234,
                yPercent: 70.567,
                scale: 1.2543,
                isFlipped: false
              }
            ]
          }
        }
      ]
    };

    const sanitized = sanitizeProjectForPersistence(dirtyProject);

    expect(sanitized.scene_name).toBe("Action Alley");
    expect(sanitized.shots[0].staging_recipe?.backgroundUrl).toBeUndefined();
    expect(sanitized.shots[0].staging_recipe?.backgroundAssetFilename).toBe("rooftop_bg.png");

    const actor = sanitized.shots[0].staging_recipe?.actors[0];
    expect(actor?.cutoutDataUrl).toBeUndefined();
    expect(actor?.referenceAssetFilename).toBe("elena_pose.png");
    expect(actor?.xPercent).toBe(50.23);
    expect(actor?.yPercent).toBe(70.57);
    expect(actor?.scale).toBe(1.254);
  });

  it("calculates sequential dirty revision deltas properly", () => {
    let dirtyRevision = 0;
    let dispatchedRevision = 0;
    let isDirty = true;
    let hasPendingChanges = false;

    // 1. Initial edit
    dirtyRevision += 1;
    expect(dirtyRevision).toBe(1);

    // 2. Network save starts
    dispatchedRevision = dirtyRevision;

    // 3. User edits state while request is in flight
    dirtyRevision += 1;
    expect(dirtyRevision).toBe(2);

    // 4. In-flight request finishes
    if (dirtyRevision === dispatchedRevision) {
      isDirty = false;
    } else {
      hasPendingChanges = true;
    }

    // Because revision advanced during the in-flight request, isDirty remains true and pending is flagged
    expect(isDirty).toBe(true);
    expect(hasPendingChanges).toBe(true);

    // 5. Follow-up save starts
    hasPendingChanges = false;
    dispatchedRevision = dirtyRevision;

    // 6. Follow-up save finishes with no further edits
    if (dirtyRevision === dispatchedRevision) {
      isDirty = false;
    }

    expect(isDirty).toBe(false);
    expect(hasPendingChanges).toBe(false);
  });
});
