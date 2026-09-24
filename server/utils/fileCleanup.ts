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
 * Removes stale chunk upload temporary directories older than maxAgeMs (default: 24 hours).
 */
export function cleanupStaleChunks(maxAgeMs: number = 24 * 60 * 60 * 1000): { cleanedCount: number } {
  let cleanedCount = 0;
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
        const fullPath = path.join(dir, entry.name);
        try {
          const stats = fs.statSync(fullPath);
          const age = now - stats.mtimeMs;
          if (age > maxAgeMs) {
            if (entry.isDirectory()) {
              fs.rmSync(fullPath, { recursive: true, force: true });
            } else {
              fs.unlinkSync(fullPath);
            }
            cleanedCount++;
          }
        } catch (e) {}
      }
    } catch (e) {}
  }

  if (cleanedCount > 0) {
    log.info(`Pruned ${cleanedCount} stale temporary upload item(s) older than ${Math.round(maxAgeMs / (1000 * 60 * 60))}h.`);
  }

  return { cleanedCount };
}
