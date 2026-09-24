import fs from "fs";
import path from "path";
import { TMP_DIR, ASSETS_DIR } from "../config/constants";
import { createScopedLogger } from "./logger";

const log = createScopedLogger("FileCleanup");

/**
 * Safely removes a file from disk without throwing exceptions.
 */
export function safeUnlinkSync(filePath?: string | null): boolean {
  if (!filePath) return false;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch (err: any) {
    log.warn(`Non-fatal error deleting file ${filePath}: ${err.message}`);
  }
  return false;
}

/**
 * Purges all temporary chunk files associated with a specific upload_id.
 */
export function purgeUploadSessionChunks(uploadId: string): { purgedCount: number } {
  if (!uploadId || typeof uploadId !== "string") {
    return { purgedCount: 0 };
  }

  let purgedCount = 0;
  const candidateDirs = [
    path.join(TMP_DIR, "chunks"),
    path.join(ASSETS_DIR, "tmp_uploads")
  ];

  for (const dir of candidateDirs) {
    if (!fs.existsSync(dir)) continue;

    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file.startsWith(uploadId)) {
          const fullPath = path.join(dir, file);
          try {
            if (fs.statSync(fullPath).isDirectory()) {
              fs.rmSync(fullPath, { recursive: true, force: true });
            } else {
              fs.unlinkSync(fullPath);
            }
            purgedCount++;
          } catch (e: any) {
            log.warn(`Could not purge chunk file ${fullPath}: ${e.message}`);
          }
        }
      }
    } catch (e: any) {
      log.warn(`Error scanning directory ${dir} for session ${uploadId}: ${e.message}`);
    }
  }

  if (purgedCount > 0) {
    log.debug(`Purged ${purgedCount} temporary chunk(s) for upload session ${uploadId}`);
  }

  return { purgedCount };
}

/**
 * Removes stale chunk upload temporary files and directories older than maxAgeMs (default: 6 hours).
 */
export function cleanupStaleChunks(maxAgeMs: number = 6 * 60 * 60 * 1000): { cleanedCount: number; cleanedBytes: number } {
  let cleanedCount = 0;
  let cleanedBytes = 0;
  const now = Date.now();

  const candidateDirs = [
    path.join(TMP_DIR, "chunks"),
    path.join(ASSETS_DIR, "tmp_uploads"),
    TMP_DIR
  ];

  for (const dir of candidateDirs) {
    if (!fs.existsSync(dir)) continue;

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        // Skip protected directories like 'chunks' itself when scanning TMP_DIR root
        if (dir === TMP_DIR && (entry.name === "chunks" || entry.name === "tmp_uploads")) {
          continue;
        }

        const fullPath = path.join(dir, entry.name);
        try {
          const stats = fs.statSync(fullPath);
          const age = now - stats.mtimeMs;
          if (maxAgeMs <= 0 || age >= maxAgeMs) {
            const size = stats.size || 0;
            if (entry.isDirectory()) {
              fs.rmSync(fullPath, { recursive: true, force: true });
            } else {
              fs.unlinkSync(fullPath);
            }
            cleanedCount++;
            cleanedBytes += size;
          }
        } catch (e) {}
      }
    } catch (e) {}
  }

  if (cleanedCount > 0) {
    const hours = Math.round(maxAgeMs / (1000 * 60 * 60));
    const mb = (cleanedBytes / (1024 * 1024)).toFixed(2);
    log.info(`Pruned ${cleanedCount} stale temporary upload item(s) (${mb} MB) older than ${hours}h.`);
  }

  return { cleanedCount, cleanedBytes };
}

/**
 * Starts an automated background cleanup timer.
 * Runs an immediate cleanup pass, followed by recurring passes on the specified interval.
 */
export function startPeriodicCleanupTask(
  intervalMs: number = 2 * 60 * 60 * 1000,
  maxAgeMs: number = 6 * 60 * 60 * 1000
): NodeJS.Timeout {
  // Immediate initial cleanup pass
  try {
    cleanupStaleChunks(maxAgeMs);
  } catch (err: any) {
    log.warn(`Initial cleanup pass error: ${err.message}`);
  }

  const timer = setInterval(() => {
    try {
      cleanupStaleChunks(maxAgeMs);
    } catch (err: any) {
      log.warn(`Periodic cleanup pass error: ${err.message}`);
    }
  }, intervalMs);

  // unref ensures this timer does not prevent process exit in CLI or tests
  if (timer.unref) {
    timer.unref();
  }

  return timer;
}

export interface TempStorageStats {
  chunksCount: number;
  chunksSizeBytes: number;
  tmpUploadsCount: number;
  tmpUploadsSizeBytes: number;
  totalTempFilesCount: number;
  totalTempSizeBytes: number;
  totalTempSizeMB: string;
}

/**
 * Calculates disk metrics for active temporary chunk directories.
 */
export function getTempStorageStats(): TempStorageStats {
  let chunksCount = 0;
  let chunksSizeBytes = 0;
  let tmpUploadsCount = 0;
  let tmpUploadsSizeBytes = 0;

  const chunksDir = path.join(TMP_DIR, "chunks");
  if (fs.existsSync(chunksDir)) {
    try {
      const entries = fs.readdirSync(chunksDir);
      for (const entry of entries) {
        try {
          const stats = fs.statSync(path.join(chunksDir, entry));
          chunksCount++;
          chunksSizeBytes += stats.size || 0;
        } catch {}
      }
    } catch {}
  }

  const tmpUploadsDir = path.join(ASSETS_DIR, "tmp_uploads");
  if (fs.existsSync(tmpUploadsDir)) {
    try {
      const entries = fs.readdirSync(tmpUploadsDir);
      for (const entry of entries) {
        try {
          const stats = fs.statSync(path.join(tmpUploadsDir, entry));
          tmpUploadsCount++;
          tmpUploadsSizeBytes += stats.size || 0;
        } catch {}
      }
    } catch {}
  }

  const totalTempFilesCount = chunksCount + tmpUploadsCount;
  const totalTempSizeBytes = chunksSizeBytes + tmpUploadsSizeBytes;
  const totalTempSizeMB = (totalTempSizeBytes / (1024 * 1024)).toFixed(2);

  return {
    chunksCount,
    chunksSizeBytes,
    tmpUploadsCount,
    tmpUploadsSizeBytes,
    totalTempFilesCount,
    totalTempSizeBytes,
    totalTempSizeMB
  };
}
