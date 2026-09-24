/**
 * Structured Logger Module
 * Provides standardized log levels, payload sanitization (base64 truncation, secret redaction),
 * and an in-memory ring buffer for diagnostics.
 */

export type LogLevelName = "debug" | "info" | "warn" | "error" | "silent";

export const LOG_LEVELS: Record<LogLevelName, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4
};

export interface LogEntry {
  id: number;
  timestamp: string;
  level: LogLevelName;
  tag: string;
  message: string;
  meta?: any;
}

export interface GetLogsOptions {
  level?: LogLevelName;
  tag?: string;
  limit?: number;
  since?: string;
}

const DEFAULT_BUFFER_SIZE = 500;
const SENSITIVE_KEYS = new Set([
  "apikey",
  "api_key",
  "token",
  "accesstoken",
  "access_token",
  "secret",
  "password",
  "authorization",
  "bearer",
  "runpod_api_key",
  "hf_token",
  "gemini_api_key"
]);

// Determine initial log level from environment
function getInitialLogLevel(): LogLevelName {
  const envLevel = (process.env.LOG_LEVEL || "").trim().toLowerCase() as LogLevelName;
  if (envLevel in LOG_LEVELS) {
    return envLevel;
  }
  return "info";
}

let currentLogLevel: LogLevelName = getInitialLogLevel();
let logSequenceId = 0;
const ringBuffer: LogEntry[] = [];
let maxBufferSize = DEFAULT_BUFFER_SIZE;

/**
 * Format bytes into readable human format
 */
function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Sanitize strings, tokens, base64 payloads, and secrets
 */
export function sanitizeLogValue(val: any, depth = 0, seen = new WeakSet()): any {
  if (val === null || val === undefined) return val;

  // Handle primitives
  if (typeof val === "string") {
    let sanitized = val;

    // Redact base64 Data URIs: data:image/png;base64,...
    sanitized = sanitized.replace(
      /data:([a-zA-Z0-9\/\-+.]+);base64,([A-Za-z0-9+/=]{40,})/g,
      (_match, mime, b64) => {
        const estBytes = Math.round((b64.length * 3) / 4);
        return `[base64 ${mime}: ${formatByteSize(estBytes)}]`;
      }
    );

    // Redact raw long base64 image strings if length > 250 characters
    if (/^[A-Za-z0-9+/]{250,}={0,2}$/.test(sanitized)) {
      const estBytes = Math.round((sanitized.length * 3) / 4);
      return `[base64 string: ${formatByteSize(estBytes)}]`;
    }

    // Redact Bearer tokens: Bearer xxx
    sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9\-_.~+/]+=*/gi, "Bearer ***");

    // Redact known API key patterns
    sanitized = sanitized.replace(/hf_[a-zA-Z0-9]{20,}/g, "hf_***");
    sanitized = sanitized.replace(/rpa_[a-zA-Z0-9]{20,}/g, "rpa_***");
    sanitized = sanitized.replace(/sk-[a-zA-Z0-9]{20,}/g, "sk-***");
    sanitized = sanitized.replace(/AIza[0-9A-Za-z-_]{35}/g, "AIza***");

    // Truncate excessively long strings in log output (e.g. huge JSON dumps)
    if (sanitized.length > 2000 && currentLogLevel !== "debug") {
      sanitized = `${sanitized.slice(0, 2000)}... [truncated ${sanitized.length - 2000} chars]`;
    }

    return sanitized;
  }

  if (typeof val === "number" || typeof val === "boolean") {
    return val;
  }

  // Handle Errors
  if (val instanceof Error) {
    return {
      name: val.name,
      message: sanitizeLogValue(val.message, depth + 1, seen),
      stack: val.stack ? val.stack.split("\n").slice(0, 5).join("\n") : undefined
    };
  }

  // Guard against deep recursion and circular references
  if (typeof val === "object") {
    if (seen.has(val)) return "[Circular Reference]";
    if (depth > 6) return "[Max Depth Reached]";
    seen.add(val);

    if (Array.isArray(val)) {
      const maxArrLen = currentLogLevel === "debug" ? 100 : 20;
      const mapped = val.slice(0, maxArrLen).map(item => sanitizeLogValue(item, depth + 1, seen));
      if (val.length > maxArrLen) {
        mapped.push(`[... ${val.length - maxArrLen} more items]`);
      }
      return mapped;
    }

    const sanitizedObj: Record<string, any> = {};
    for (const [key, propVal] of Object.entries(val)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.has(lowerKey)) {
        sanitizedObj[key] = "***";
      } else {
        sanitizedObj[key] = sanitizeLogValue(propVal, depth + 1, seen);
      }
    }
    return sanitizedObj;
  }

  return String(val);
}

/**
 * Format timestamp ISO without timezone shift confusion
 */
function formatTimestamp(date = new Date()): string {
  return date.toISOString().replace("T", " ").replace("Z", "");
}

/**
 * Push an entry into the fixed-size ring buffer
 */
function pushToBuffer(entry: LogEntry): void {
  ringBuffer.push(entry);
  if (ringBuffer.length > maxBufferSize) {
    ringBuffer.shift();
  }
}

/**
 * Internal core log dispatcher
 */
function dispatchLog(level: LogLevelName, tag: string, message: string, ...meta: any[]): void {
  if (LOG_LEVELS[level] < LOG_LEVELS[currentLogLevel]) {
    return;
  }

  const timestamp = formatTimestamp();
  const sanitizedMeta = meta.length > 0
    ? (meta.length === 1 ? sanitizeLogValue(meta[0]) : meta.map(m => sanitizeLogValue(m)))
    : undefined;

  const entry: LogEntry = {
    id: ++logSequenceId,
    timestamp,
    level,
    tag,
    message: typeof message === "string" ? sanitizeLogValue(message) : String(message),
    meta: sanitizedMeta
  };

  // Keep in circular memory buffer
  pushToBuffer(entry);

  // Format terminal output
  const prefix = `[${timestamp}] [${level.toUpperCase().padEnd(5)}] [${tag}]`;
  const consoleMethod = level === "error" ? console.error : level === "warn" ? console.warn : console.log;

  if (sanitizedMeta !== undefined) {
    consoleMethod(`${prefix} ${entry.message}`, sanitizedMeta);
  } else {
    consoleMethod(`${prefix} ${entry.message}`);
  }
}

/**
 * Central Logger API
 */
export const logger = {
  debug(tag: string, message: string, ...meta: any[]): void {
    dispatchLog("debug", tag, message, ...meta);
  },

  info(tag: string, message: string, ...meta: any[]): void {
    dispatchLog("info", tag, message, ...meta);
  },

  warn(tag: string, message: string, ...meta: any[]): void {
    dispatchLog("warn", tag, message, ...meta);
  },

  error(tag: string, message: string, ...meta: any[]): void {
    dispatchLog("error", tag, message, ...meta);
  },

  /**
   * Set log level programmatically ("debug" | "info" | "warn" | "error" | "silent")
   */
  setLevel(level: LogLevelName): void {
    if (level in LOG_LEVELS) {
      currentLogLevel = level;
    }
  },

  /**
   * Get currently active log level
   */
  getLevel(): LogLevelName {
    return currentLogLevel;
  },

  /**
   * Set the maximum number of recent logs held in memory
   */
  setBufferSize(size: number): void {
    if (size > 0) {
      maxBufferSize = size;
      while (ringBuffer.length > maxBufferSize) {
        ringBuffer.shift();
      }
    }
  },

  /**
   * Retrieve recent logs from the in-memory circular buffer
   */
  getRecentLogs(options: GetLogsOptions = {}): LogEntry[] {
    let filtered = [...ringBuffer];

    if (options.level && options.level in LOG_LEVELS) {
      const minLevelScore = LOG_LEVELS[options.level];
      filtered = filtered.filter(entry => LOG_LEVELS[entry.level] >= minLevelScore);
    }

    if (options.tag) {
      const targetTag = options.tag.toLowerCase();
      filtered = filtered.filter(entry => entry.tag.toLowerCase() === targetTag);
    }

    if (options.since) {
      const sinceDate = new Date(options.since).getTime();
      if (!isNaN(sinceDate)) {
        filtered = filtered.filter(entry => new Date(entry.timestamp).getTime() >= sinceDate);
      }
    }

    if (options.limit && options.limit > 0) {
      filtered = filtered.slice(-options.limit);
    }

    return filtered;
  },

  /**
   * Clear the in-memory buffer
   */
  clearRecentLogs(): void {
    ringBuffer.length = 0;
  },

  /**
   * Returns stats about the current logging buffer
   */
  getBufferStats(): {
    totalEntries: number;
    maxBufferSize: number;
    currentLevel: LogLevelName;
    levelCounts: Record<LogLevelName, number>;
  } {
    const counts: Record<LogLevelName, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      silent: 0
    };

    for (const entry of ringBuffer) {
      counts[entry.level] = (counts[entry.level] || 0) + 1;
    }

    return {
      totalEntries: ringBuffer.length,
      maxBufferSize,
      currentLevel: currentLogLevel,
      levelCounts: counts
    };
  },

  /**
   * Return a sorted list of unique logger tags recorded in the buffer
   */
  getUniqueTags(): string[] {
    const tags = new Set<string>();
    for (const entry of ringBuffer) {
      if (entry.tag) tags.add(entry.tag);
    }
    return Array.from(tags).sort();
  }
};

/**
 * Formats a single log entry into a standardized single/multiline text string
 */
export function formatLogEntryAsText(entry: LogEntry): string {
  let line = `[${entry.timestamp}] [${entry.level.toUpperCase().padEnd(5)}] [${entry.tag}] ${entry.message}`;
  if (entry.meta !== undefined) {
    try {
      const metaStr = typeof entry.meta === "string" ? entry.meta : JSON.stringify(entry.meta);
      line += `\n    ${metaStr}`;
    } catch {
      line += `\n    [Unserializable Meta]`;
    }
  }
  return line;
}

/**
 * Formats a diagnostic text file bundle with system details and chronological logs
 */
export function exportLogsAsText(options: GetLogsOptions = {}): string {
  const logs = logger.getRecentLogs(options);
  const mem = process.memoryUsage();
  const lines: string[] = [
    `# ==============================================================================`,
    `# Director System Diagnostics Log Export`,
    `# Generated: ${new Date().toISOString()}`,
    `# Active Log Level: ${logger.getLevel().toUpperCase()}`,
    `# Log Entries Count: ${logs.length}`,
    `# Node Environment: ${process.env.NODE_ENV || "development"}`,
    `# Node Version: ${process.version} | Platform: ${process.platform} (${process.arch})`,
    `# Memory RSS: ${(mem.rss / (1024 * 1024)).toFixed(1)} MB | Heap: ${(mem.heapUsed / (1024 * 1024)).toFixed(1)} / ${(mem.heapTotal / (1024 * 1024)).toFixed(1)} MB`,
    `# ==============================================================================`,
    ``
  ];

  for (const entry of logs) {
    lines.push(formatLogEntryAsText(entry));
  }

  return lines.join("\n") + "\n";
}

export interface ScopedLogger {
  debug: (message: string, ...meta: any[]) => void;
  info: (message: string, ...meta: any[]) => void;
  warn: (message: string, ...meta: any[]) => void;
  error: (message: string, ...meta: any[]) => void;
}

/**
 * Creates a scoped logger for a specific module or service tag
 * Example:
 * const log = createScopedLogger("VisionCaption");
 * log.info("Model connected", { model: "qwen2.5-vl" });
 */
export function createScopedLogger(tag: string): ScopedLogger {
  return {
    debug: (message: string, ...meta: any[]) => logger.debug(tag, message, ...meta),
    info: (message: string, ...meta: any[]) => logger.info(tag, message, ...meta),
    warn: (message: string, ...meta: any[]) => logger.warn(tag, message, ...meta),
    error: (message: string, ...meta: any[]) => logger.error(tag, message, ...meta)
  };
}
