import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { writeAtomicSync, writeAtomic, writeJsonAtomicSync, writeJsonAtomic } from "../../server/utils/atomicFs";
import { TMP_DIR } from "../../server/config/constants";

describe("atomicFs - Atomic File Writing Utility", () => {
  const testDir = path.join(TMP_DIR, "atomic_tests");
  const testSyncFile = path.join(testDir, "test_sync.json");
  const testAsyncFile = path.join(testDir, "test_async.json");
  const testRawFile = path.join(testDir, "test_raw.txt");

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch (_) {}
  });

  it("writes string and buffer data atomically (sync)", () => {
    writeAtomicSync(testRawFile, "Hello Atomic World");
    expect(fs.existsSync(testRawFile)).toBe(true);
    expect(fs.readFileSync(testRawFile, "utf-8")).toBe("Hello Atomic World");
  });

  it("writes JSON objects atomically (sync)", () => {
    const data = { app: "SceneForge", version: 1, active: true };
    writeJsonAtomicSync(testSyncFile, data);

    expect(fs.existsSync(testSyncFile)).toBe(true);
    const content = JSON.parse(fs.readFileSync(testSyncFile, "utf-8"));
    expect(content).toEqual(data);
  });

  it("writes JSON objects atomically (async)", async () => {
    const data = { asyncTest: true, items: [1, 2, 3] };
    await writeJsonAtomic(testAsyncFile, data);

    expect(fs.existsSync(testAsyncFile)).toBe(true);
    const content = JSON.parse(fs.readFileSync(testAsyncFile, "utf-8"));
    expect(content).toEqual(data);
  });

  it("overwrites existing files cleanly without leaving temporary files behind", () => {
    writeJsonAtomicSync(testSyncFile, { step: 1 });
    writeJsonAtomicSync(testSyncFile, { step: 2 });

    const content = JSON.parse(fs.readFileSync(testSyncFile, "utf-8"));
    expect(content.step).toBe(2);

    // Verify no stray .tmp files exist in the test directory
    const files = fs.readdirSync(testDir);
    const tmpFiles = files.filter(f => f.includes(".tmp"));
    expect(tmpFiles.length).toBe(0);
  });

  it("creates parent directories automatically if they do not exist", () => {
    const deepFile = path.join(testDir, "nested", "level2", "atomic.json");
    writeJsonAtomicSync(deepFile, { nested: true });

    expect(fs.existsSync(deepFile)).toBe(true);
    const content = JSON.parse(fs.readFileSync(deepFile, "utf-8"));
    expect(content.nested).toBe(true);
  });
});
