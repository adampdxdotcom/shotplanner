import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { safeUnlinkSync, cleanupStaleChunks } from "../../server/utils/fileCleanup";
import { TMP_DIR, ASSETS_DIR } from "../../server/config/constants";

describe("fileCleanup - Temp File and Chunk Upload Hygiene", () => {
  const testTmpFile = path.join(TMP_DIR, `test_clean_${Date.now()}.tmp`);
  const testChunkDir = path.join(TMP_DIR, "chunks");
  const testChunkFile = path.join(testChunkDir, `test_chunk_${Date.now()}.tmp`);

  beforeEach(() => {
    if (!fs.existsSync(TMP_DIR)) {
      fs.mkdirSync(TMP_DIR, { recursive: true });
    }
    if (!fs.existsSync(testChunkDir)) {
      fs.mkdirSync(testChunkDir, { recursive: true });
    }
  });

  afterEach(() => {
    safeUnlinkSync(testTmpFile);
    safeUnlinkSync(testChunkFile);
  });

  it("safely unlinks existing files without throwing exceptions", () => {
    fs.writeFileSync(testTmpFile, "temporary upload content", "utf-8");
    expect(fs.existsSync(testTmpFile)).toBe(true);

    const result = safeUnlinkSync(testTmpFile);
    expect(result).toBe(true);
    expect(fs.existsSync(testTmpFile)).toBe(false);
  });

  it("gracefully returns false when unlinking non-existent or null paths", () => {
    expect(safeUnlinkSync(null)).toBe(false);
    expect(safeUnlinkSync(undefined)).toBe(false);
    expect(safeUnlinkSync("/tmp/non_existent_file_xyz123.tmp")).toBe(false);
  });

  it("identifies and cleans up files older than the specified maxAge", () => {
    fs.writeFileSync(testChunkFile, "old chunk content", "utf-8");
    
    // Set file mtime to 48 hours ago
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    fs.utimesSync(testChunkFile, twoDaysAgo, twoDaysAgo);

    const statsBefore = fs.statSync(testChunkFile);
    expect(Date.now() - statsBefore.mtimeMs).toBeGreaterThan(24 * 60 * 60 * 1000);

    const { cleanedCount } = cleanupStaleChunks(24 * 60 * 60 * 1000);
    expect(cleanedCount).toBeGreaterThanOrEqual(1);
    expect(fs.existsSync(testChunkFile)).toBe(false);
  });
});
