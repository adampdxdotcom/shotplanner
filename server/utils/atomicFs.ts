import fs from "fs";
import path from "path";
import crypto from "crypto";

/**
 * Atomic File System Utility
 * Prevents file corruption, truncated writes, and zero-byte reads during crashes
 * by writing content to an adjacent temporary file, calling fsync to flush dirty OS pages to physical disk,
 * and performing an atomic POSIX rename with optional automatic .bak rotation.
 */

export interface AtomicWriteOptions {
  createBackup?: boolean;
  backupExtension?: string;
  mode?: number;
  flush?: boolean;
}

/**
 * Generate a unique temporary filepath in the same directory as the target.
 * Keeping the temp file in the same directory guarantees it resides on the same 
 * filesystem partition, ensuring atomic POSIX rename operations without EXDEV errors.
 */
function getTempFilePath(targetPath: string): string {
  const dir = path.dirname(targetPath);
  const randomSuffix = crypto.randomBytes(6).toString("hex");
  return path.join(dir, `.${path.basename(targetPath)}.${process.pid}.${Date.now()}.${randomSuffix}.tmp`);
}

/**
 * Synchronously writes data to a file atomically with fsync and optional backup rotation.
 */
export function writeAtomicSync(
  targetPath: string,
  data: string | NodeJS.ArrayBufferView,
  options?: AtomicWriteOptions
): void {
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // If backup rotation is requested and target exists, preserve the current good copy
  if (options?.createBackup && fs.existsSync(targetPath)) {
    try {
      const backupExt = options.backupExtension || ".bak";
      const backupPath = `${targetPath}${backupExt}`;
      fs.copyFileSync(targetPath, backupPath);
    } catch (_) {
      // Ignore non-fatal backup creation errors and proceed with atomic write
    }
  }

  const tempPath = getTempFilePath(targetPath);
  let fd: number | null = null;

  try {
    fd = fs.openSync(tempPath, "w", options?.mode);
    
    if (typeof data === "string") {
      fs.writeFileSync(fd, data);
    } else {
      fs.writeSync(fd, data as any);
    }

    // Flush dirty OS write-cache pages to physical storage before renaming
    if (options?.flush !== false) {
      fs.fsyncSync(fd);
    }

    fs.closeSync(fd);
    fd = null;

    fs.renameSync(tempPath, targetPath);
  } catch (err) {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch (_) {}
    }
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch (_) {}
    }
    throw err;
  }
}

/**
 * Asynchronously writes data to a file atomically with fsync and optional backup rotation.
 */
export async function writeAtomic(
  targetPath: string,
  data: string | NodeJS.ArrayBufferView,
  options?: AtomicWriteOptions
): Promise<void> {
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true });
  }

  if (options?.createBackup && fs.existsSync(targetPath)) {
    try {
      const backupExt = options.backupExtension || ".bak";
      const backupPath = `${targetPath}${backupExt}`;
      await fs.promises.copyFile(targetPath, backupPath);
    } catch (_) {}
  }

  const tempPath = getTempFilePath(targetPath);
  let fileHandle: fs.promises.FileHandle | null = null;

  try {
    fileHandle = await fs.promises.open(tempPath, "w", options?.mode);
    
    if (typeof data === "string") {
      await fileHandle.writeFile(data);
    } else {
      await fileHandle.write(data as any);
    }

    if (options?.flush !== false) {
      await fileHandle.sync();
    }

    await fileHandle.close();
    fileHandle = null;

    await fs.promises.rename(tempPath, targetPath);
  } catch (err) {
    if (fileHandle !== null) {
      try {
        await fileHandle.close();
      } catch (_) {}
    }
    if (fs.existsSync(tempPath)) {
      try {
        await fs.promises.unlink(tempPath);
      } catch (_) {}
    }
    throw err;
  }
}

/**
 * Safely serializes an object to JSON and writes it atomically with optional backup.
 */
export function writeJsonAtomicSync(
  targetPath: string,
  data: any,
  indent: number = 2,
  options?: AtomicWriteOptions
): void {
  const jsonStr = JSON.stringify(data, null, indent);
  writeAtomicSync(targetPath, jsonStr, options);
}

/**
 * Asynchronously serializes an object to JSON and writes it atomically with optional backup.
 */
export async function writeJsonAtomic(
  targetPath: string,
  data: any,
  indent: number = 2,
  options?: AtomicWriteOptions
): Promise<void> {
  const jsonStr = JSON.stringify(data, null, indent);
  await writeAtomic(targetPath, jsonStr, options);
}

/**
 * Reads a JSON file with automatic fallback to .bak if primary file is corrupted or empty.
 * Restores the primary file on successful backup recovery.
 */
export function readJsonWithBackupRecoverySync<T = any>(
  targetPath: string,
  options?: {
    backupExtension?: string;
    onRecovered?: (backupPath: string, targetPath: string) => void;
    onError?: (err: Error) => void;
  }
): T | null {
  if (!fs.existsSync(targetPath)) return null;

  let parsed: T | null = null;
  let hasValidPrimary = false;

  try {
    const raw = fs.readFileSync(targetPath, "utf-8");
    if (raw && raw.trim().length > 0) {
      parsed = JSON.parse(raw);
      hasValidPrimary = true;
    }
  } catch (err: any) {
    if (options?.onError) {
      options.onError(err);
    }
  }

  if (hasValidPrimary && parsed !== null) {
    return parsed;
  }

  // Attempt backup recovery
  const backupExt = options?.backupExtension || ".bak";
  const backupPath = `${targetPath}${backupExt}`;

  if (fs.existsSync(backupPath)) {
    try {
      const backupRaw = fs.readFileSync(backupPath, "utf-8");
      if (backupRaw && backupRaw.trim().length > 0) {
        const recoveredData = JSON.parse(backupRaw);
        // Restore primary file atomically from backup snapshot
        writeJsonAtomicSync(targetPath, recoveredData, 2, { createBackup: false });
        if (options?.onRecovered) {
          options.onRecovered(backupPath, targetPath);
        }
        return recoveredData;
      }
    } catch (_) {}
  }

  return null;
}
