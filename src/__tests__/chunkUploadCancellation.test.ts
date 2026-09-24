import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { TMP_DIR } from "../../server/config/constants";
import { assetService } from "../../server/services/assetService";
import { safeUnlinkSync } from "../../server/utils/fileCleanup";
import { assetsApi } from "../api";

describe("Chunk Upload Cancellation & Abort Endpoint (Phase 2)", () => {
  const uploadId = `cancel_test_${Date.now()}`;
  const chunkDir = path.join(TMP_DIR, "chunks");
  const chunk0 = path.join(chunkDir, `${uploadId}_0`);
  const chunk1 = path.join(chunkDir, `${uploadId}_1`);

  beforeEach(() => {
    if (!fs.existsSync(chunkDir)) {
      fs.mkdirSync(chunkDir, { recursive: true });
    }
    fs.writeFileSync(chunk0, "test chunk payload 0", "utf-8");
    fs.writeFileSync(chunk1, "test chunk payload 1", "utf-8");
  });

  afterEach(() => {
    safeUnlinkSync(chunk0);
    safeUnlinkSync(chunk1);
  });

  it("purges all temporary chunk files on disk when abortChunkUpload is invoked", () => {
    expect(fs.existsSync(chunk0)).toBe(true);
    expect(fs.existsSync(chunk1)).toBe(true);

    assetService.abortChunkUpload(uploadId);

    expect(fs.existsSync(chunk0)).toBe(false);
    expect(fs.existsSync(chunk1)).toBe(false);
  });

  it("handles repeated abort calls gracefully without throwing errors", () => {
    assetService.abortChunkUpload(uploadId);
    expect(() => assetService.abortChunkUpload(uploadId)).not.toThrow();
  });

  it("assetsApi exposes abortChunkUpload helper method", () => {
    expect(typeof assetsApi.abortChunkUpload).toBe("function");
  });
});
