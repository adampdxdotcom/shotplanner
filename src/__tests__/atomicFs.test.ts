import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  writeAtomicSync,
  writeAtomic,
  writeJsonAtomicSync,
  writeJsonAtomic,
  readJsonWithBackupRecoverySync
} from "../../server/utils/atomicFs";
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

  it("automatically creates a .bak backup file when createBackup option is enabled", () => {
    const backupTarget = path.join(testDir, "scene.json");
    const initialData = { scene: "Cyberpunk Alley", shots: [1, 2] };
    const updatedData = { scene: "Cyberpunk Alley", shots: [1, 2, 3] };

    // Initial write (no backup yet because target didn't exist)
    writeJsonAtomicSync(backupTarget, initialData, 2, { createBackup: true });
    expect(fs.existsSync(backupTarget)).toBe(true);

    // Second write (should preserve initialData as scene.json.bak)
    writeJsonAtomicSync(backupTarget, updatedData, 2, { createBackup: true });
    expect(fs.existsSync(backupTarget)).toBe(true);
    expect(fs.existsSync(`${backupTarget}.bak`)).toBe(true);

    const activeContent = JSON.parse(fs.readFileSync(backupTarget, "utf-8"));
    const backupContent = JSON.parse(fs.readFileSync(`${backupTarget}.bak`, "utf-8"));

    expect(activeContent.shots.length).toBe(3);
    expect(backupContent.shots.length).toBe(2);
  });

  it("self-heals and recovers corrupted primary files using .bak snapshot", () => {
    const targetFile = path.join(testDir, "corrupted_scene.json");
    const validData = { scene: "Helipad", shots: [1, 2, 3] };

    // Create a valid backup
    writeJsonAtomicSync(`${targetFile}.bak`, validData);

    // Corrupt the primary file (e.g. 0-byte or malformed syntax)
    fs.writeFileSync(targetFile, "{ truncated json data ... missing closing brace");

    let recoveryNotified = false;
    const result = readJsonWithBackupRecoverySync(targetFile, {
      onRecovered: (bak, target) => {
        recoveryNotified = true;
        expect(bak).toBe(`${targetFile}.bak`);
        expect(target).toBe(targetFile);
      }
    });

    expect(result).toEqual(validData);
    expect(recoveryNotified).toBe(true);

    // Verify the primary file was restored on disk
    const restoredOnDisk = JSON.parse(fs.readFileSync(targetFile, "utf-8"));
    expect(restoredOnDisk).toEqual(validData);
  });
});
