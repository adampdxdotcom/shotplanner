import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Terminal,
  RefreshCw,
  Trash2,
  Download,
  Copy,
  Check,
  Search,
  Activity,
  Cpu,
  HardDrive,
  Clock,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  AlertCircle,
  Info,
  Bug,
  Sliders,
  ArrowUpDown
} from "lucide-react";
import {
  diagnosticsApi,
  LogEntry,
  LogLevel,
  SystemHealthInfo,
  BufferStats
} from "../../api/endpoints/diagnostics";
import { copyToClipboard } from "../../utils/clipboard";

interface DiagnosticsTabProps {
  onShowToast?: (text: string, type: "success" | "error" | "info") => void;
}

export const DiagnosticsTab: React.FC<DiagnosticsTabProps> = ({ onShowToast }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [stats, setStats] = useState<BufferStats | null>(null);
  const [health, setHealth] = useState<SystemHealthInfo | null>(null);
  const [activeServerLevel, setActiveServerLevel] = useState<LogLevel>("info");

  // Filters & display options
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<string>("all");
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isAutoRefresh, setIsAutoRefresh] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [expandedLogIds, setExpandedLogIds] = useState<Set<number>>(new Set());

  // Loading & action states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [isChangingLevel, setIsChangingLevel] = useState<boolean>(false);
  const [isPurgingChunks, setIsPurgingChunks] = useState<boolean>(false);
  const [hasCopiedLogs, setHasCopiedLogs] = useState<boolean>(false);
  const [copiedMetaId, setCopiedMetaId] = useState<number | null>(null);

  const autoRefreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch logs and health
  const fetchDiagnostics = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    try {
      const [logsRes, healthRes] = await Promise.all([
        diagnosticsApi.getLogs({
          level: selectedLevelFilter !== "all" ? (selectedLevelFilter as LogLevel) : undefined,
          tag: selectedTagFilter !== "all" ? selectedTagFilter : undefined,
          search: searchTerm.trim() || undefined,
          limit: 300
        }),
        diagnosticsApi.getSystemHealth().catch(() => null)
      ]);

      if (logsRes && logsRes.success) {
        setLogs(logsRes.logs || []);
        if (logsRes.stats) setStats(logsRes.stats);
        if (logsRes.tags) setAvailableTags(logsRes.tags);
        if (logsRes.currentLevel) setActiveServerLevel(logsRes.currentLevel);
      }

      if (healthRes && healthRes.success) {
        setHealth(healthRes);
      }
    } catch (err: any) {
      if (!quiet && onShowToast) {
        onShowToast(`Failed to load diagnostics: ${err.message}`, "error");
      }
    } finally {
      if (!quiet) setIsLoading(false);
    }
  }, [selectedLevelFilter, selectedTagFilter, searchTerm, onShowToast]);

  // Initial load
  useEffect(() => {
    fetchDiagnostics();
  }, [fetchDiagnostics]);

  // Handle auto-refresh interval
  useEffect(() => {
    if (isAutoRefresh) {
      autoRefreshTimerRef.current = setInterval(() => {
        fetchDiagnostics(true);
      }, 3000);
    } else if (autoRefreshTimerRef.current) {
      clearInterval(autoRefreshTimerRef.current);
      autoRefreshTimerRef.current = null;
    }
    return () => {
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
      }
    };
  }, [isAutoRefresh, fetchDiagnostics]);

  // Change active server log level
  const handleLogLevelChange = async (newLevel: LogLevel) => {
    setIsChangingLevel(true);
    try {
      const res = await diagnosticsApi.setLogLevel(newLevel);
      if (res && res.success) {
        setActiveServerLevel(res.currentLevel);
        if (onShowToast) {
          onShowToast(`Server log level changed to ${res.currentLevel.toUpperCase()}`, "success");
        }
        await fetchDiagnostics(true);
      }
    } catch (err: any) {
      if (onShowToast) {
        onShowToast(`Failed to change log level: ${err.message}`, "error");
      }
    } finally {
      setIsChangingLevel(false);
    }
  };

  // Clear logs buffer
  const handleClearLogs = async () => {
    if (!window.confirm("Clear the in-memory diagnostic log buffer?")) return;
    setIsClearing(true);
    try {
      const res = await diagnosticsApi.clearLogs();
      if (res && res.success) {
        setLogs([]);
        setStats(prev => prev ? { ...prev, totalEntries: 0, levelCounts: { debug: 0, info: 0, warn: 0, error: 0, silent: 0 } } : null);
        if (onShowToast) {
          onShowToast("Diagnostic log buffer cleared.", "info");
        }
      }
    } catch (err: any) {
      if (onShowToast) {
        onShowToast(`Failed to clear logs: ${err.message}`, "error");
      }
    } finally {
      setIsClearing(false);
    }
  };

  // Purge temporary chunk uploads
  const handlePurgeTempChunks = async () => {
    setIsPurgingChunks(true);
    try {
      const res = await diagnosticsApi.purgeTempFiles(0);
      if (res && res.success) {
        if (onShowToast) {
          onShowToast(res.message || `Reclaimed ${res.cleanedMB} MB temporary storage.`, "success");
        }
        await fetchDiagnostics(true);
      }
    } catch (err: any) {
      if (onShowToast) {
        onShowToast(`Failed to purge temporary files: ${err.message}`, "error");
      }
    } finally {
      setIsPurgingChunks(false);
    }
  };

  // Toggle expand/collapse metadata for an entry
  const toggleExpand = (id: number) => {
    setExpandedLogIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Copy full logs text
  const handleCopyVisibleLogs = async () => {
    if (logs.length === 0) return;
    const textLines = logs.map(e => {
      let l = `[${e.timestamp}] [${e.level.toUpperCase().padEnd(5)}] [${e.tag}] ${e.message}`;
      if (e.meta !== undefined) {
        try {
          l += `\n    ${typeof e.meta === "string" ? e.meta : JSON.stringify(e.meta, null, 2)}`;
        } catch {
          l += `\n    [Unserializable Meta]`;
        }
      }
      return l;
    }).join("\n");

    const ok = await copyToClipboard(textLines);
    if (ok) {
      setHasCopiedLogs(true);
      if (onShowToast) onShowToast("Diagnostic logs copied to clipboard.", "success");
      setTimeout(() => setHasCopiedLogs(false), 2000);
    }
  };

  // Copy single meta JSON
  const handleCopyMeta = async (id: number, meta: any) => {
    const jsonStr = typeof meta === "string" ? meta : JSON.stringify(meta, null, 2);
    const ok = await copyToClipboard(jsonStr);
    if (ok) {
      setCopiedMetaId(id);
      setTimeout(() => setCopiedMetaId(null), 2000);
    }
  };

  // Trigger file download
  const handleDownloadFile = (format: "txt" | "json") => {
    const url = diagnosticsApi.getExportUrl({
      format,
      level: selectedLevelFilter !== "all" ? (selectedLevelFilter as LogLevel) : undefined,
      tag: selectedTagFilter !== "all" ? selectedTagFilter : undefined,
      search: searchTerm.trim() || undefined
    });
    window.location.href = url;
  };

  // Sort logs
  const displayLogs = [...logs].sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
  });

  // Level style helper
  const getLevelBadge = (level: LogLevel) => {
    switch (level) {
      case "error":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/40">
            <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            ERROR
          </span>
        );
      case "warn":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/40">
            <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            WARN
          </span>
        );
      case "debug":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/40">
            <Bug className="w-3 h-3 text-purple-600 dark:text-purple-400" />
            DEBUG
          </span>
        );
      case "info":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-50 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/40">
            <Info className="w-3 h-3 text-sky-600 dark:text-sky-400" />
            INFO
          </span>
        );
    }
  };

  return (
    <div id="diagnostics-tab" className="space-y-6">
      {/* Header Banner Card */}
      <div className="bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-700/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-2xs">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                System Diagnostics &amp; Real-time Logs
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Structured in-memory ring buffer with credential sanitization, memory telemetry, and instant export.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAutoRefresh(prev => !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                isAutoRefresh
                  ? "bg-emerald-50 dark:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/50"
                  : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
              }`}
              title="Toggle automatic refresh every 3 seconds"
            >
              <Activity className={`w-3.5 h-3.5 ${isAutoRefresh ? "animate-pulse text-emerald-600 dark:text-emerald-400" : "text-zinc-400 dark:text-zinc-500"}`} />
              Auto-Stream {isAutoRefresh ? "ON" : "OFF"}
            </button>

            <button
              type="button"
              onClick={() => fetchDiagnostics()}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-emerald-600 dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400"}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Telemetry Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Node & Platform */}
        <div className="bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3.5 flex items-center gap-3 shadow-xs">
          <div className="p-2 rounded-lg bg-indigo-50 dark:bg-zinc-800/80 text-indigo-600 dark:text-indigo-400">
            <Cpu className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400 truncate">Runtime</div>
            <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
              {health ? `${health.nodeVersion} (${health.platform})` : "Node.js"}
            </div>
          </div>
        </div>

        {/* Memory RSS / Heap */}
        <div className="bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3.5 flex items-center gap-3 shadow-xs">
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-zinc-800/80 text-emerald-600 dark:text-emerald-400">
            <HardDrive className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400 truncate">Memory (RSS / Heap)</div>
            <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
              {health?.memory ? `${health.memory.rssMB} MB / ${health.memory.heapUsedMB} MB` : "Telemetry loading..."}
            </div>
          </div>
        </div>

        {/* Temporary Storage & Chunks */}
        <div className="bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3.5 flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-cyan-50 dark:bg-zinc-800/80 text-cyan-600 dark:text-cyan-400 shrink-0">
              <Trash2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400 truncate">Temp Chunks</div>
              <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                {health?.storage ? `${health.storage.totalTempSizeMB} MB (${health.storage.totalTempFilesCount})` : "0.00 MB"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handlePurgeTempChunks}
            disabled={isPurgingChunks}
            className="px-2 py-1 bg-cyan-50 hover:bg-cyan-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-cyan-700 hover:text-cyan-800 dark:text-cyan-300 dark:hover:text-cyan-200 text-[11px] font-semibold rounded-lg border border-cyan-200 dark:border-zinc-700 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            title="Force purge all temporary upload chunk files and orphaned session fragments"
          >
            {isPurgingChunks ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              "Purge"
            )}
          </button>
        </div>

        {/* Uptime */}
        <div className="bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3.5 flex items-center gap-3 shadow-xs">
          <div className="p-2 rounded-lg bg-amber-50 dark:bg-zinc-800/80 text-amber-600 dark:text-amber-400">
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400 truncate">Uptime</div>
            <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
              {health?.uptimeFormatted || "0s"}
            </div>
          </div>
        </div>

        {/* Server Log Level Controller */}
        <div className="bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3.5 flex items-center justify-between gap-2 shadow-xs">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
              <Sliders className="w-3 h-3 text-purple-600 dark:text-purple-400" />
              Server Level
            </div>
            <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase">
              {activeServerLevel}
            </div>
          </div>
          <select
            value={activeServerLevel}
            disabled={isChangingLevel}
            onChange={(e) => handleLogLevelChange(e.target.value as LogLevel)}
            className="bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-medium rounded-lg px-2 py-1 border border-zinc-300 dark:border-zinc-700 focus:outline-hidden focus:border-indigo-500 cursor-pointer disabled:opacity-50"
          >
            <option value="debug">DEBUG</option>
            <option value="info">INFO</option>
            <option value="warn">WARN</option>
            <option value="error">ERROR</option>
            <option value="silent">SILENT</option>
          </select>
        </div>
      </div>

      {/* Filter and Export Action Bar */}
      <div className="bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <input
              type="text"
              placeholder="Search message, tag, or metadata payload..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-800/90 text-zinc-900 dark:text-zinc-200 pl-9 pr-3 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700/80 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          {/* Level Filter Tabs */}
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-950/80 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-x-auto shrink-0">
            {["all", "error", "warn", "info", "debug"].map((lvl) => {
              const isSelected = selectedLevelFilter === lvl;
              const count =
                lvl === "all"
                  ? stats?.totalEntries || logs.length
                  : stats?.levelCounts?.[lvl as LogLevel] || 0;

              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setSelectedLevelFilter(lvl)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs border border-zinc-200/80 dark:border-transparent"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-900/50"
                  }`}
                >
                  <span>{lvl}</span>
                  <span className={`text-[10px] px-1 rounded-full ${
                    isSelected
                      ? "bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200"
                      : "bg-zinc-200/60 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-500"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Tag Filter Dropdown */}
          <div className="shrink-0 flex items-center gap-2">
            <select
              value={selectedTagFilter}
              onChange={(e) => setSelectedTagFilter(e.target.value)}
              className="bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200 text-xs font-medium rounded-lg px-2.5 py-1.5 border border-zinc-300 dark:border-zinc-700/80 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">All Modules ({availableTags.length})</option>
              {availableTags.map((tag) => (
                <option key={tag} value={tag}>
                  [{tag}]
                </option>
              ))}
            </select>

            {/* Sort Toggle */}
            <button
              type="button"
              onClick={() => setSortOrder(prev => prev === "desc" ? "asc" : "desc")}
              className="p-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-zinc-700 dark:text-zinc-300 rounded-lg border border-zinc-300 dark:border-zinc-700 transition-colors cursor-pointer"
              title={`Sort order: ${sortOrder === "desc" ? "Newest First" : "Oldest First"}`}
            >
              <ArrowUpDown className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Secondary Action Toolbar: Copy, Export, Clear */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800/80">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            Showing <strong className="text-zinc-800 dark:text-zinc-200">{displayLogs.length}</strong> log entries
            {stats && ` (Buffer: ${stats.totalEntries}/${stats.maxBufferSize})`}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyVisibleLogs}
              disabled={displayLogs.length === 0}
              className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-zinc-700 dark:text-zinc-200 text-xs font-semibold rounded-lg border border-zinc-300 dark:border-zinc-700 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
            >
              {hasCopiedLogs ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />}
              {hasCopiedLogs ? "Copied" : "Copy All"}
            </button>

            <button
              type="button"
              onClick={() => handleDownloadFile("txt")}
              disabled={displayLogs.length === 0}
              className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-zinc-700 dark:text-zinc-200 text-xs font-semibold rounded-lg border border-zinc-300 dark:border-zinc-700 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
              title="Download formatted .LOG bundle with system metadata"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              Export .LOG
            </button>

            <button
              type="button"
              onClick={() => handleDownloadFile("json")}
              disabled={displayLogs.length === 0}
              className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-zinc-700 dark:text-zinc-200 text-xs font-semibold rounded-lg border border-zinc-300 dark:border-zinc-700 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
              title="Download raw JSON diagnostics payload"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Export .JSON
            </button>

            <button
              type="button"
              onClick={handleClearLogs}
              disabled={isClearing || (stats?.totalEntries === 0 && logs.length === 0)}
              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-semibold rounded-lg border border-rose-200 dark:border-rose-800/60 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Terminal Log Console */}
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-md font-mono text-xs">
        {/* Terminal Title Bar */}
        <div className="bg-zinc-100/90 dark:bg-zinc-900/90 border-b border-zinc-200 dark:border-zinc-800 px-4 py-2.5 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
            <span className="text-zinc-700 dark:text-zinc-400 font-sans text-xs font-semibold ml-2">
              Console Log Stream
            </span>
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-sans">
            Auto-sanitizing API tokens, passwords &amp; base64 payloads
          </div>
        </div>

        {/* Logs List Container */}
        <div className="max-h-[600px] overflow-y-auto divide-y divide-zinc-200 dark:divide-zinc-850/80 bg-zinc-50/40 dark:bg-zinc-950 p-1">
          {displayLogs.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 dark:text-zinc-400 font-sans">
              <Terminal className="w-8 h-8 text-zinc-400 dark:text-zinc-600 mx-auto mb-2 opacity-50" />
              <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">No diagnostic logs recorded matching current criteria.</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                Server operations, SSH transfers, and generation activities will appear here automatically.
              </p>
            </div>
          ) : (
            displayLogs.map((entry) => {
              const hasMeta = entry.meta !== undefined && entry.meta !== null;
              const isExpanded = expandedLogIds.has(entry.id);

              return (
                <div
                  key={entry.id}
                  className={`p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-900/60 transition-colors ${
                    entry.level === "error"
                      ? "bg-rose-50/70 dark:bg-rose-950/15"
                      : entry.level === "warn"
                      ? "bg-amber-50/70 dark:bg-amber-950/10"
                      : ""
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Expand/collapse icon if meta exists */}
                    {hasMeta ? (
                      <button
                        type="button"
                        onClick={() => toggleExpand(entry.id)}
                        className="p-0.5 text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300 mt-0.5 cursor-pointer"
                        title="Toggle metadata inspection"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                    ) : (
                      <span className="w-4" />
                    )}

                    {/* Timestamp */}
                    <span className="text-zinc-500 dark:text-zinc-400 text-[11px] whitespace-nowrap shrink-0 mt-0.5 select-none">
                      {entry.timestamp}
                    </span>

                    {/* Level Badge */}
                    <div className="shrink-0 mt-0.5">{getLevelBadge(entry.level)}</div>

                    {/* Module Tag */}
                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold whitespace-nowrap shrink-0 mt-0.5 select-none">
                      [{entry.tag}]
                    </span>

                    {/* Main Log Message */}
                    <div className="flex-1 text-zinc-800 dark:text-zinc-200 break-words leading-relaxed font-mono">
                      {entry.message}
                    </div>
                  </div>

                  {/* Collapsible Metadata Block */}
                  {hasMeta && isExpanded && (
                    <div className="mt-2 ml-10 p-3 bg-zinc-100/90 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 text-[11px] relative group">
                      <div className="flex items-center justify-between mb-1.5 text-zinc-500 dark:text-zinc-400 font-sans text-[10px] uppercase tracking-wider font-semibold">
                        <span>Payload Metadata</span>
                        <button
                          type="button"
                          onClick={() => handleCopyMeta(entry.id, entry.meta)}
                          className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 px-1.5 py-0.5 rounded bg-white hover:bg-zinc-200/80 dark:bg-zinc-800 dark:hover:bg-zinc-750 border border-zinc-200 dark:border-transparent transition-colors cursor-pointer"
                        >
                          {copiedMetaId === entry.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy JSON</span>
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="overflow-x-auto text-zinc-800 dark:text-zinc-300 whitespace-pre-wrap leading-tight font-mono">
                        {typeof entry.meta === "string"
                          ? entry.meta
                          : JSON.stringify(entry.meta, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
