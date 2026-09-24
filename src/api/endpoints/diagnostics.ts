import { apiClient, RequestOptions } from "../client";

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

export interface LogEntry {
  id: number;
  timestamp: string;
  level: LogLevel;
  tag: string;
  message: string;
  meta?: any;
}

export interface BufferStats {
  totalEntries: number;
  maxBufferSize: number;
  currentLevel: LogLevel;
  levelCounts: Record<LogLevel, number>;
}

export interface DiagnosticsResponse {
  success: boolean;
  logs: LogEntry[];
  stats: BufferStats;
  currentLevel: LogLevel;
  tags: string[];
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

export interface CleanupResult {
  success: boolean;
  cleanedCount: number;
  cleanedBytes: number;
  cleanedMB: string;
  prunedSessions: number;
  storage: TempStorageStats;
  message: string;
}

export interface SystemHealthInfo {
  success: boolean;
  nodeVersion: string;
  platform: string;
  uptimeSeconds: number;
  uptimeFormatted: string;
  memory: {
    rssMB: string;
    heapUsedMB: string;
    heapTotalMB: string;
    externalMB: string;
  };
  storage?: TempStorageStats;
  logging: {
    currentLevel: LogLevel;
    stats: BufferStats;
    availableLevels: LogLevel[];
    tags: string[];
  };
}

export const diagnosticsApi = {
  getLogs(
    params?: {
      level?: LogLevel;
      tag?: string;
      limit?: number;
      search?: string;
      since?: string;
    },
    options?: RequestOptions
  ) {
    return apiClient.get<DiagnosticsResponse>("/api/diagnostics/logs", {
      ...options,
      params
    });
  },

  clearLogs(options?: RequestOptions) {
    return apiClient.post<{ success: boolean; message: string }>("/api/diagnostics/clear", {}, options);
  },

  setLogLevel(level: LogLevel, options?: RequestOptions) {
    return apiClient.post<{ success: boolean; currentLevel: LogLevel }>("/api/diagnostics/level", { level }, options);
  },

  getSystemHealth(options?: RequestOptions) {
    return apiClient.get<SystemHealthInfo>("/api/diagnostics/system", options);
  },

  getStorageStats(options?: RequestOptions) {
    return apiClient.get<{ success: boolean; storage: TempStorageStats }>("/api/diagnostics/storage", options);
  },

  purgeTempFiles(maxAgeMs: number = 0, options?: RequestOptions) {
    return apiClient.post<CleanupResult>("/api/diagnostics/cleanup", { maxAgeMs }, options);
  },

  getExportUrl(params?: { format?: "txt" | "json"; level?: LogLevel; tag?: string; search?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.format) searchParams.append("format", params.format);
    if (params?.level) searchParams.append("level", params.level);
    if (params?.tag) searchParams.append("tag", params.tag);
    if (params?.search) searchParams.append("search", params.search);
    const qs = searchParams.toString();
    return `/api/diagnostics/export${qs ? `?${qs}` : ""}`;
  }
};
