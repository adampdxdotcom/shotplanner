import { describe, it, expect, vi, beforeEach } from "vitest";
import { 
  isBase64DataUrl, 
  dataUrlToBlob, 
  uploadCutoutAsset, 
  uploadMaskAsset, 
  uploadBackgroundAsset,
  uploadBase64ImageAsAsset 
} from "../utils/cutoutAssetUploader";
import { sanitizeActorRecipeForPersistence, sanitizeStagingRecipeForPersistence } from "../utils/recipeSanitizer";
import { assetsApi } from "../api";

describe("Cutout, Mask & Background Asset Uploader (Part 2)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("isBase64DataUrl", () => {
    it("identifies base64 data URLs correctly", () => {
      expect(isBase64DataUrl("data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==")).toBe(true);
      expect(isBase64DataUrl("data:image/jpeg;base64,/9j/4AAQSkZJRg==")).toBe(true);
      expect(isBase64DataUrl("/api/uploads/elena_cutout_123.png")).toBe(false);
      expect(isBase64DataUrl("elena_cutout_123.png")).toBe(false);
      expect(isBase64DataUrl(undefined)).toBe(false);
    });
  });

  describe("dataUrlToBlob", () => {
    it("converts a base64 png string into a valid Blob", () => {
      // 1x1 transparent PNG base64
      const base64Png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const blob = dataUrlToBlob(base64Png);

      expect(blob).not.toBeNull();
      expect(blob?.type).toBe("image/png");
      expect(blob?.size).toBeGreaterThan(0);
    });

    it("returns null for malformed data URLs", () => {
      expect(dataUrlToBlob("invalid-data-string")).toBeNull();
    });
  });

  describe("uploadCutoutAsset", () => {
    it("uploads cutout asset and returns filename and media url", async () => {
      const mockUpload = vi.spyOn(assetsApi, "upload").mockResolvedValue({
        message: "Asset uploaded successfully",
        asset: {
          id: "asset_123",
          filename: "elena_cutout_test_123.png",
          type: "Cutout",
          subject_name: "Elena"
        } as any
      });

      const base64Png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      let callbackFilename = "";
      let callbackUrl = "";

      const result = await uploadCutoutAsset({
        dataUrl: base64Png,
        characterName: "Elena",
        sceneName: "scene01",
        onUploaded: (fname, url) => {
          callbackFilename = fname;
          callbackUrl = url;
        }
      });

      expect(mockUpload).toHaveBeenCalledTimes(1);
      expect(result).not.toBeNull();
      expect(result?.filename).toBe("elena_cutout_test_123.png");
      expect(result?.url).toBe("/api/uploads/elena_cutout_test_123.png");
      expect(callbackFilename).toBe("elena_cutout_test_123.png");
      expect(callbackUrl).toBe("/api/uploads/elena_cutout_test_123.png");
    });
  });

  describe("uploadMaskAsset", () => {
    it("uploads alpha mask asset and returns filename and media url", async () => {
      const mockUpload = vi.spyOn(assetsApi, "upload").mockResolvedValue({
        message: "Mask uploaded successfully",
        asset: {
          id: "mask_456",
          filename: "elena_mask_test_456.png",
          type: "Mask",
          subject_name: "Elena Mask"
        } as any
      });

      const base64Png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      let callbackFilename = "";

      const result = await uploadMaskAsset({
        dataUrl: base64Png,
        characterName: "Elena",
        sceneName: "scene01",
        onUploaded: (fname) => {
          callbackFilename = fname;
        }
      });

      expect(mockUpload).toHaveBeenCalledTimes(1);
      expect(result).not.toBeNull();
      expect(result?.filename).toBe("elena_mask_test_456.png");
      expect(callbackFilename).toBe("elena_mask_test_456.png");
    });
  });

  describe("uploadBackgroundAsset", () => {
    it("uploads background backdrop asset and returns filename and media url", async () => {
      const mockUpload = vi.spyOn(assetsApi, "upload").mockResolvedValue({
        message: "Background uploaded successfully",
        asset: {
          id: "bg_789",
          filename: "warehouse_backdrop_test_789.png",
          type: "Location",
          subject_name: "Warehouse"
        } as any
      });

      const base64Png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      const result = await uploadBackgroundAsset({
        dataUrl: base64Png,
        locationName: "Warehouse",
        sceneName: "scene01"
      });

      expect(mockUpload).toHaveBeenCalledTimes(1);
      expect(result).not.toBeNull();
      expect(result?.filename).toBe("warehouse_backdrop_test_789.png");
      expect(result?.url).toBe("/api/uploads/warehouse_backdrop_test_789.png");
    });
  });

  describe("sanitizeActorRecipeForPersistence with cutout and mask filenames", () => {
    it("strips massive in-memory base64 data URLs while preserving cutoutAssetFilename and maskAssetFilename", () => {
      const actorWithCutoutAndMask = {
        id: "actor_1",
        characterName: "Elena",
        referenceAssetFilename: "elena_raw.png",
        cutoutAssetFilename: "elena_cutout_clean.png",
        maskAssetFilename: "elena_mask_clean.png",
        cutoutDataUrl: "data:image/png;base64," + "A".repeat(10000), // In-memory canvas preview
        maskDataUrl: "data:image/png;base64," + "B".repeat(10000),
        xPercent: 50.123,
        yPercent: 70.456,
        scale: 1.154,
        isFlipped: true,
        zIndex: 2,
        plane: "foreground" as const,
        posture: "Standing Heroic",
        facing: "facing_camera" as const
      };

      const sanitized = sanitizeActorRecipeForPersistence(actorWithCutoutAndMask);

      // Heavy base64 is completely stripped
      expect(sanitized.cutoutDataUrl).toBeUndefined();
      expect(sanitized.maskDataUrl).toBeUndefined();
      expect(sanitized.originalCutoutDataUrl).toBeUndefined();
      // Persistent physical filenames are preserved
      expect(sanitized.cutoutAssetFilename).toBe("elena_cutout_clean.png");
      expect(sanitized.maskAssetFilename).toBe("elena_mask_clean.png");
      expect(sanitized.referenceAssetFilename).toBe("elena_raw.png");
      expect(sanitized.scale).toBe(1.154);
    });
  });

  describe("sanitizeStagingRecipeForPersistence with backgroundAssetFilename", () => {
    it("strips massive background data URLs while preserving backgroundAssetFilename", () => {
      const recipeWithBg = {
        backgroundAssetFilename: "downtown_street.png",
        backgroundUrl: "data:image/png;base64," + "C".repeat(12000),
        aspectRatio: "16:9",
        cameraFraming: "Medium Shot",
        lightingAtmosphere: "Golden Hour Warmth",
        targetSlotIndex: 8,
        actors: []
      };

      const sanitized = sanitizeStagingRecipeForPersistence(recipeWithBg);
      expect(sanitized?.backgroundUrl).toBeUndefined();
      expect(sanitized?.backgroundAssetFilename).toBe("downtown_street.png");
      expect(sanitized?.aspectRatio).toBe("16:9");
    });
  });
});
