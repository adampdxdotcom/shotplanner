import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import { 
  safeUnlinkSync, 
  cleanupStaleChunks, 
  purgeUploadSessionChunks, 
  startPeriodicCleanupTask 
} from "../../server/utils/fileCleanup";
import { TMP_DIR, ASSETS_DIR } from "../../server/config/constants";
import { assetService } from "../../server/services/assetService";

describe("fileCleanup - Temp File and Chunk Upload Hygiene (Phase 1)", () => {
  const testTmpFile = path.join(TMP_DIR, `test_clean_${Date.now()}.tmp`);
  const testChunkDir = path.join(TMP_DIR, "chunks");
  const testChunkFile = path.join(testChunkDir, `test_chunk_${Date.now()}.tmp`);
  const sessionUploadId = `upload_sess_${Date.now()}`;
  const sessionChunk0 = path.join(testChunkDir, `${sessionUploadId}_0`);
  const sessionChunk1 = path.join(testChunkDir, `${sessionUploadId}_1`);

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
    safeUnlinkSync(sessionChunk0);
    safeUnlinkSync(sessionChunk1);
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

    const { cleanedCount, cleanedBytes } = cleanupStaleChunks(24 * 60 * 60 * 1000);
    expect(cleanedCount).toBeGreaterThanOrEqual(1);
    expect(cleanedBytes).toBeGreaterThan(0);
    expect(fs.existsSync(testChunkFile)).toBe(false);
  });

  it("purges all temporary chunk files for a specific upload_id session", () => {
    fs.writeFileSync(sessionChunk0, "chunk part 0", "utf-8");
    fs.writeFileSync(sessionChunk1, "chunk part 1", "utf-8");

    expect(fs.existsSync(sessionChunk0)).toBe(true);
    expect(fs.existsSync(sessionChunk1)).toBe(true);

    const { purgedCount } = purgeUploadSessionChunks(sessionUploadId);
    expect(purgedCount).toBe(2);
    expect(fs.existsSync(sessionChunk0)).toBe(false);
    expect(fs.existsSync(sessionChunk1)).toBe(false);
  });

  it("starts periodic background sweeper task without blocking process exit", () => {
    const timer = startPeriodicCleanupTask(60000, 3600000);
    expect(timer).toBeDefined();
    clearInterval(timer);
  });

  it("assetService.abortChunkUpload cleanly aborts and removes session chunk files", () => {
    fs.writeFileSync(sessionChunk0, "chunk 0", "utf-8");
    fs.writeFileSync(sessionChunk1, "chunk 1", "utf-8");

    const aborted = assetService.abortChunkUpload(sessionUploadId);
    expect(aborted).toBe(false); // was not in in-memory map yet, but disk chunks are purged
    expect(fs.existsSync(sessionChunk0)).toBe(false);
    expect(fs.existsSync(sessionChunk1)).toBe(false);
  });
});
