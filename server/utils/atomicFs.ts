import fs from "fs";
import path from "path";
import crypto from "crypto";

/**
 * Atomic File System Utility
 * Prevents file corruption and zero-byte reads during crashes by writing 
 * content to an adjacent temporary file before performing an atomic rename.
 */

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
 * Synchronously writes data to a file atomically.
 */
export function writeAtomicSync(targetPath: string, data: string | NodeJS.ArrayBufferView): void {
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tempPath = getTempFilePath(targetPath);

  try {
    fs.writeFileSync(tempPath, data as any);
    fs.renameSync(tempPath, targetPath);
  } catch (err) {
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch (_) {}
    }
    throw err;
  }
}

/**
 * Asynchronously writes data to a file atomically.
 */
export async function writeAtomic(targetPath: string, data: string | NodeJS.ArrayBufferView): Promise<void> {
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true });
  }

  const tempPath = getTempFilePath(targetPath);

  try {
    await fs.promises.writeFile(tempPath, data as any);
    await fs.promises.rename(tempPath, targetPath);
  } catch (err) {
    if (fs.existsSync(tempPath)) {
      try {
        await fs.promises.unlink(tempPath);
      } catch (_) {}
    }
    throw err;
  }
}

/**
 * Safely serializes an object to JSON and writes it atomically.
 */
export function writeJsonAtomicSync(targetPath: string, data: any, indent: number = 2): void {
  const jsonStr = JSON.stringify(data, null, indent);
  writeAtomicSync(targetPath, jsonStr);
}

/**
 * Asynchronously serializes an object to JSON and writes it atomically.
 */
export async function writeJsonAtomic(targetPath: string, data: any, indent: number = 2): Promise<void> {
  const jsonStr = JSON.stringify(data, null, indent);
  await writeAtomic(targetPath, jsonStr);
}
