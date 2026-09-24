import { Router, Request, Response } from "express";
import {
  logger,
  LogLevelName,
  LOG_LEVELS,
  exportLogsAsText,
  formatLogEntryAsText,
  createScopedLogger
} from "../utils/logger";
import { getTempStorageStats, cleanupStaleChunks } from "../utils/fileCleanup";
import { assetService } from "../services/assetService";

const log = createScopedLogger("DiagnosticRoute");
const router = Router();

/**
 * Filter logs by search term across message and meta
 */
function filterLogsBySearch(logs: any[], search?: string) {
  if (!search || !search.trim()) return logs;
  const q = search.trim().toLowerCase();
  return logs.filter((entry) => {
    if (entry.message && entry.message.toLowerCase().includes(q)) return true;
    if (entry.tag && entry.tag.toLowerCase().includes(q)) return true;
    if (entry.meta) {
      try {
        const metaStr = typeof entry.meta === "string" ? entry.meta : JSON.stringify(entry.meta);
        if (metaStr.toLowerCase().includes(q)) return true;
      } catch {
        // Ignore JSON stringify issues
      }
    }
    return false;
  });
}

/**
 * GET /api/diagnostics/logs
 * Retrieve live ring buffer logs with filtering
 */
router.get("/logs", (req: Request, res: Response) => {
  try {
    const level = (req.query.level as LogLevelName) || undefined;
    const tag = (req.query.tag as string) || undefined;
    const limit = req.query.limit ? Math.min(Math.max(1, parseInt(req.query.limit as string, 10)), 1000) : 200;
    const since = (req.query.since as string) || undefined;
    const search = (req.query.search as string) || undefined;

    let entries = logger.getRecentLogs({ level, tag, limit: limit * 2, since });
    entries = filterLogsBySearch(entries, search);

    if (entries.length > limit) {
      entries = entries.slice(-limit);
    }

    const stats = logger.getBufferStats();
    const tags = logger.getUniqueTags();

    res.json({
      success: true,
      logs: entries,
      stats,
      currentLevel: logger.getLevel(),
      tags
    });
  } catch (err: any) {
    log.error("Failed to retrieve diagnostic logs", { error: err });
    res.status(500).json({ success: false, error: err.message || "Failed to retrieve logs" });
  }
});

/**
 * GET /api/diagnostics/export
 * Export log bundle as downloadable .txt or .json
 */
router.get("/export", (req: Request, res: Response) => {
  try {
    const format = (req.query.format as string)?.toLowerCase() === "json" ? "json" : "txt";
    const level = (req.query.level as LogLevelName) || undefined;
    const tag = (req.query.tag as string) || undefined;
    const search = (req.query.search as string) || undefined;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    let entries = logger.getRecentLogs({ level, tag, limit: 1000 });
    entries = filterLogsBySearch(entries, search);

    if (format === "json") {
      const mem = process.memoryUsage();
      const payload = {
        exportTimestamp: new Date().toISOString(),
        system: {
          node: process.version,
          platform: process.platform,
          arch: process.arch,
          uptimeSeconds: Math.round(process.uptime()),
          memory: {
            rssMB: (mem.rss / 1048576).toFixed(1),
            heapUsedMB: (mem.heapUsed / 1048576).toFixed(1),
            heapTotalMB: (mem.heapTotal / 1048576).toFixed(1)
          },
          env: process.env.NODE_ENV || "development"
        },
        stats: logger.getBufferStats(),
        activeLogLevel: logger.getLevel(),
        logsCount: entries.length,
        logs: entries
      };

      res.setHeader("Content-Disposition", `attachment; filename="director-diagnostics-${timestamp}.json"`);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.send(JSON.stringify(payload, null, 2));
    }

    // Default plain text log format
    const textOutput = exportLogsAsText({ level, tag });
    res.setHeader("Content-Disposition", `attachment; filename="director-diagnostics-${timestamp}.log"`);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(textOutput);
  } catch (err: any) {
    log.error("Failed to export diagnostic logs", { error: err });
    res.status(500).json({ success: false, error: err.message || "Failed to export logs" });
  }
});

/**
 * POST /api/diagnostics/clear
 * Clear ring buffer
 */
router.post("/clear", (_req: Request, res: Response) => {
  try {
    logger.clearRecentLogs();
    log.info("Diagnostic log ring buffer cleared by user request");
    res.json({ success: true, message: "Logs cleared successfully." });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to clear logs" });
  }
});

/**
 * POST /api/diagnostics/level
 * Set logging level dynamically
 */
router.post("/level", (req: Request, res: Response) => {
  try {
    const { level } = req.body;
    if (!level || !(level in LOG_LEVELS)) {
      return res.status(400).json({
        success: false,
        error: `Invalid level '${level}'. Supported levels: ${Object.keys(LOG_LEVELS).join(", ")}`
      });
    }

    logger.setLevel(level as LogLevelName);
    log.info(`Log level changed to '${level}'`);
    res.json({ success: true, currentLevel: logger.getLevel() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to set log level" });
  }
});

/**
 * GET /api/diagnostics/system
 * System telemetry & health diagnostics
 */
router.get("/system", (_req: Request, res: Response) => {
  try {
    const mem = process.memoryUsage();
    const uptimeSec = Math.round(process.uptime());
    const hours = Math.floor(uptimeSec / 3600);
    const mins = Math.floor((uptimeSec % 3600) / 60);
    const secs = uptimeSec % 60;
    const storage = getTempStorageStats();

    res.json({
      success: true,
      nodeVersion: process.version,
      platform: `${process.platform} (${process.arch})`,
      uptimeSeconds: uptimeSec,
      uptimeFormatted: `${hours}h ${mins}m ${secs}s`,
      memory: {
        rssMB: (mem.rss / 1048576).toFixed(1),
        heapUsedMB: (mem.heapUsed / 1048576).toFixed(1),
        heapTotalMB: (mem.heapTotal / 1048576).toFixed(1),
        externalMB: (mem.external / 1048576).toFixed(1)
      },
      storage,
      logging: {
        currentLevel: logger.getLevel(),
        stats: logger.getBufferStats(),
        availableLevels: ["debug", "info", "warn", "error", "silent"],
        tags: logger.getUniqueTags()
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to retrieve system info" });
  }
});

/**
 * GET /api/diagnostics/storage
 * Direct endpoint for storage and temporary chunk statistics
 */
router.get("/storage", (_req: Request, res: Response) => {
  try {
    const stats = getTempStorageStats();
    res.json({ success: true, storage: stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to retrieve storage stats" });
  }
});

/**
 * POST /api/diagnostics/cleanup
 * Manually trigger purging of orphaned temporary chunks and expired upload sessions
 */
router.post("/cleanup", (req: Request, res: Response) => {
  try {
    const maxAgeMs = req.body.maxAgeMs !== undefined ? Number(req.body.maxAgeMs) : 0;
    const { cleanedCount, cleanedBytes } = cleanupStaleChunks(maxAgeMs);
    const prunedSessions = assetService.pruneExpiredUploadSessions(maxAgeMs);

    const mb = (cleanedBytes / (1024 * 1024)).toFixed(2);
    log.info(`Manual cleanup executed: purged ${cleanedCount} temporary file(s) (${mb} MB), evicted ${prunedSessions} session(s).`);

    res.json({
      success: true,
      cleanedCount,
      cleanedBytes,
      cleanedMB: mb,
      prunedSessions,
      storage: getTempStorageStats(),
      message: `Reclaimed ${mb} MB across ${cleanedCount} temporary file(s).`
    });
  } catch (err: any) {
    log.error(`Manual temporary file cleanup error: ${err?.message || err}`);
    res.status(500).json({ success: false, error: err.message || "Failed to execute cleanup" });
  }
});

export default router;
