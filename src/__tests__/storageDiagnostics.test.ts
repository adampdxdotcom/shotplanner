import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { TMP_DIR, ASSETS_DIR } from "../../server/config/constants";
import { getTempStorageStats, cleanupStaleChunks, safeUnlinkSync } from "../../server/utils/fileCleanup";
import { diagnosticsApi } from "../api/endpoints/diagnostics";

describe("Storage Diagnostics & On-Demand Purge (Phase 3)", () => {
  const chunksDir = path.join(TMP_DIR, "chunks");
  const tmpUploadsDir = path.join(ASSETS_DIR, "tmp_uploads");
  const testChunkFile = path.join(chunksDir, `diag_test_${Date.now()}.tmp`);

  beforeEach(() => {
    if (!fs.existsSync(chunksDir)) {
      fs.mkdirSync(chunksDir, { recursive: true });
    }
    if (!fs.existsSync(tmpUploadsDir)) {
      fs.mkdirSync(tmpUploadsDir, { recursive: true });
    }
    fs.writeFileSync(testChunkFile, "diagnostic chunk dummy bytes", "utf-8");
  });

  afterEach(() => {
    safeUnlinkSync(testChunkFile);
  });

  it("getTempStorageStats accurately counts files and bytes in temporary directories", () => {
    const stats = getTempStorageStats();
    expect(stats.chunksCount).toBeGreaterThanOrEqual(1);
    expect(stats.chunksSizeBytes).toBeGreaterThan(0);
    expect(Number(stats.totalTempSizeMB)).toBeGreaterThanOrEqual(0);
    expect(stats.totalTempFilesCount).toBe(stats.chunksCount + stats.tmpUploadsCount);
  });

  it("cleanupStaleChunks with maxAge=0 purges all existing temporary chunk files immediately", () => {
    expect(fs.existsSync(testChunkFile)).toBe(true);

    const { cleanedCount, cleanedBytes } = cleanupStaleChunks(0);
    expect(cleanedCount).toBeGreaterThanOrEqual(1);
    expect(cleanedBytes).toBeGreaterThan(0);
    expect(fs.existsSync(testChunkFile)).toBe(false);
  });

  it("diagnosticsApi exposes getStorageStats and purgeTempFiles client methods", () => {
    expect(typeof diagnosticsApi.getStorageStats).toBe("function");
    expect(typeof diagnosticsApi.purgeTempFiles).toBe("function");
  });
});
