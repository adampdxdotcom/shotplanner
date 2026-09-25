import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { apiClient } from "../api/client";
import { TransferResult } from "../types";

export interface RecentAssetItem {
  id: string;
  filename: string;
  size_bytes: number;
  remote_path: string;
  status: "transferred" | "verified";
  timestamp: string;
  scene_name?: string;
  shot_number?: string | number;
}

export interface ActiveFileProgress {
  filename: string;
  file?: string;
  size_bytes: number;
  transferred_bytes?: number;
  percent?: number;
  status: "pending" | "transferring" | "transferred" | "failed" | "skipped";
  duration_ms?: number;
  remote_path?: string;
  message?: string;
}

export interface TransferContextType {
  transferState: "idle" | "progress" | "error" | "success";
  isTransferring: boolean;
  progressStep: string;
  progressPercent: number;
  currentFile: string | null;
  currentFilePercent: number;
  currentFileBytes: { transferred: number; total: number } | null;
  fileIndex: number;
  totalFiles: number;
  activeFiles: ActiveFileProgress[];
  transferResult: TransferResult | null;
  error: string | null;
  lastAction: "shot" | "scene" | "execute_shot" | null;
  lastStagedTime: string | null;
  recentAssets: RecentAssetItem[];
  activeJobId: string | null;
  startTransferJob: (jobId: string, action: "shot" | "scene" | "execute_shot", totalFiles?: number) => void;
  setTransferSuccess: (result: any, action: "shot" | "scene" | "execute_shot") => void;
  setTransferError: (errorMsg: string) => void;
  dismissError: () => void;
  fetchRecentAssets: () => Promise<void>;
  clearRecentAssets: () => Promise<void>;
  refreshTransferStatus: () => Promise<void>;
}

const TransferContext = createContext<TransferContextType | null>(null);

const STORAGE_KEY_RECENT_ASSETS = "scene_pilot_recent_transferred_assets";

export const TransferProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [transferState, setTransferState] = useState<"idle" | "progress" | "error" | "success">("idle");
  const [progressStep, setProgressStep] = useState<string>("");
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [currentFilePercent, setCurrentFilePercent] = useState<number>(0);
  const [currentFileBytes, setCurrentFileBytes] = useState<{ transferred: number; total: number } | null>(null);
  const [fileIndex, setFileIndex] = useState<number>(0);
  const [totalFiles, setTotalFiles] = useState<number>(0);
  const [activeFiles, setActiveFiles] = useState<ActiveFileProgress[]>([]);
  const [transferResult, setTransferResult] = useState<TransferResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<"shot" | "scene" | "execute_shot" | null>(null);
  const [lastStagedTime, setLastStagedTime] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const [recentAssets, setRecentAssets] = useState<RecentAssetItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RECENT_ASSETS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const isTransferring = transferState === "progress";

  const fetchRecentAssets = useCallback(async () => {
    try {
      const data: any = await apiClient.get("/api/ssh/recent-assets");
      if (data && data.success && Array.isArray(data.assets)) {
        setRecentAssets(data.assets);
        try {
          localStorage.setItem(STORAGE_KEY_RECENT_ASSETS, JSON.stringify(data.assets));
        } catch {}
      }
    } catch (e) {
      // Keep existing recent assets on fetch error
    }
  }, []);

  const clearRecentAssets = useCallback(async () => {
    try {
      await apiClient.post("/api/ssh/recent-assets/clear", {});
      setRecentAssets([]);
      localStorage.removeItem(STORAGE_KEY_RECENT_ASSETS);
    } catch (e) {
      setRecentAssets([]);
      localStorage.removeItem(STORAGE_KEY_RECENT_ASSETS);
    }
  }, []);

  const refreshTransferStatus = useCallback(async () => {
    try {
      const data: any = await apiClient.get("/api/ssh/transfer-status");
      if (data && data.success) {
        if (data.recentAssets && Array.isArray(data.recentAssets)) {
          setRecentAssets(data.recentAssets);
          try {
            localStorage.setItem(STORAGE_KEY_RECENT_ASSETS, JSON.stringify(data.recentAssets));
          } catch {}
        }

        const job = data.currentJob;
        if (job && job.status === "in_progress") {
          setTransferState("progress");
          setActiveJobId(job.jobId);
          setLastAction(job.action || "shot");
          setProgressStep(job.statusMessage || "Transferring assets...");
          setProgressPercent(job.totalPercent || 0);
          setCurrentFile(job.currentFile || null);
          setCurrentFilePercent(job.filePercent || 0);
          setFileIndex(job.fileIndex || 0);
          setTotalFiles(job.totalFiles || 0);
          if (job.fileTotalBytes > 0) {
            setCurrentFileBytes({
              transferred: job.fileBytesTransferred || 0,
              total: job.fileTotalBytes
            });
          }
          if (Array.isArray(job.activeFiles)) {
            setActiveFiles(job.activeFiles);
          }
        }
      }
    } catch (e) {}
  }, []);

  // Set up live SSE streaming listener
  useEffect(() => {
    fetchRecentAssets();
    refreshTransferStatus();

    let retryTimer: NodeJS.Timeout | null = null;

    const setupSSE = () => {
      try {
        const es = new EventSource("/api/ssh/transfer-stream");
        eventSourceRef.current = es;

        es.onmessage = (event) => {
          if (!event.data || event.data.trim() === ": heartbeat") return;
          try {
            const data = JSON.parse(event.data);

            if (data.type === "sync") {
              if (data.recentAssets && Array.isArray(data.recentAssets)) {
                setRecentAssets(data.recentAssets);
              }
              if (data.job && data.job.status === "in_progress") {
                const j = data.job;
                setTransferState("progress");
                setActiveJobId(j.jobId);
                setProgressStep(j.statusMessage || "Transferring...");
                setProgressPercent(j.totalPercent || 0);
                setCurrentFile(j.currentFile || null);
                setCurrentFilePercent(j.filePercent || 0);
                setFileIndex(j.fileIndex || 0);
                setTotalFiles(j.totalFiles || 0);
                if (Array.isArray(j.activeFiles)) {
                  setActiveFiles(j.activeFiles);
                }
              }
            } else if (data.type === "job_started") {
              const j = data.job;
              setTransferState("progress");
              setActiveJobId(j.jobId);
              setLastAction(j.action || "shot");
              setError(null);
              setProgressStep(j.statusMessage || "Connecting...");
              setProgressPercent(0);
              setCurrentFile(j.currentFile || null);
              setCurrentFilePercent(0);
              setFileIndex(0);
              setTotalFiles(j.totalFiles || 0);
              if (Array.isArray(j.activeFiles)) {
                setActiveFiles(j.activeFiles);
              }
            } else if (data.type === "file_started") {
              const j = data.job;
              const f = data.file;
              setCurrentFile(f.filename);
              setCurrentFilePercent(0);
              setCurrentFileBytes({ transferred: 0, total: f.sizeBytes });
              setFileIndex(f.fileIndex);
              setTotalFiles(f.totalFiles);
              setProgressStep(j?.statusMessage || `[${f.fileIndex + 1}/${f.totalFiles}] Transferring ${f.filename}...`);
              if (j?.totalPercent !== undefined) {
                setProgressPercent(j.totalPercent);
              }
              if (j?.activeFiles) {
                setActiveFiles(j.activeFiles);
              }
            } else if (data.type === "file_progress") {
              const p = data.progress;
              const j = data.job;
              setCurrentFile(p.filename);
              setCurrentFilePercent(p.filePercent);
              setCurrentFileBytes({
                transferred: p.fileBytesTransferred,
                total: p.fileTotalBytes
              });
              setProgressPercent(p.overallPercent);
              setProgressStep(j?.statusMessage || `[${j?.fileIndex + 1}/${j?.totalFiles}] ${p.filename} (${p.filePercent}%)`);
              if (j?.activeFiles) {
                setActiveFiles(j.activeFiles);
              }
            } else if (data.type === "file_completed") {
              const j = data.job;
              if (j) {
                setProgressPercent(j.totalPercent || 0);
                setProgressStep(j.statusMessage || `Transferred ${data.file?.filename}`);
                if (j.activeFiles) {
                  setActiveFiles(j.activeFiles);
                }
              }
              fetchRecentAssets();
            } else if (data.type === "file_failed") {
              const j = data.job;
              if (j?.activeFiles) {
                setActiveFiles(j.activeFiles);
              }
            } else if (data.type === "step_message") {
              setProgressStep(data.message);
            } else if (data.type === "job_completed") {
              setTransferState("success");
              setProgressPercent(100);
              setCurrentFile(null);
              setCurrentFilePercent(100);
              setCurrentFileBytes(null);
              setLastStagedTime(new Date().toLocaleTimeString());
              if (data.result) {
                setTransferResult(data.result);
              }
              if (data.recentAssets) {
                setRecentAssets(data.recentAssets);
              }
              fetchRecentAssets();
            } else if (data.type === "job_failed") {
              setTransferState("error");
              setError(data.error || "Transfer failed");
              setCurrentFile(null);
            } else if (data.type === "recent_assets_cleared") {
              setRecentAssets([]);
            }
          } catch (err) {}
        };

        es.onerror = () => {
          es.close();
          retryTimer = setTimeout(setupSSE, 5000);
        };
      } catch (err) {
        retryTimer = setTimeout(setupSSE, 5000);
      }
    };

    setupSSE();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [fetchRecentAssets, refreshTransferStatus]);

  // Polling fallback while in progress to ensure uninterrupted sync
  useEffect(() => {
    if (transferState !== "progress") return;

    const interval = setInterval(() => {
      refreshTransferStatus();
    }, 2000);

    return () => clearInterval(interval);
  }, [transferState, refreshTransferStatus]);

  const startTransferJob = useCallback((
    jobId: string,
    action: "shot" | "scene" | "execute_shot",
    numFiles: number = 0
  ) => {
    setActiveJobId(jobId);
    setTransferState("progress");
    setLastAction(action);
    setError(null);
    setTransferResult(null);
    setProgressPercent(0);
    setCurrentFilePercent(0);
    setCurrentFileBytes(null);
    setFileIndex(0);
    setTotalFiles(numFiles);
    setProgressStep(
      action === "execute_shot"
        ? "[1/3] Preparing workflow and staging assets..."
        : action === "scene"
        ? `[1/3] Preparing batch staging for scene (${numFiles > 0 ? `${numFiles} files` : 'calculating'})...`
        : "[1/3] Preparing shot workflow JSON..."
    );
  }, []);

  const setTransferSuccess = useCallback((result: any, action: "shot" | "scene" | "execute_shot") => {
    setTransferState("success");
    setTransferResult(result);
    setLastAction(action);
    setProgressPercent(100);
    setCurrentFilePercent(100);
    setCurrentFile(null);
    setCurrentFileBytes(null);
    setLastStagedTime(new Date().toLocaleTimeString());
    setError(null);
    fetchRecentAssets();
  }, [fetchRecentAssets]);

  const setTransferError = useCallback((errorMsg: string) => {
    setTransferState("error");
    setError(errorMsg);
    setCurrentFile(null);
    setCurrentFileBytes(null);
  }, []);

  const dismissError = useCallback(() => {
    setTransferState("idle");
    setError(null);
  }, []);

  return (
    <TransferContext.Provider
      value={{
        transferState,
        isTransferring,
        progressStep,
        progressPercent,
        currentFile,
        currentFilePercent,
        currentFileBytes,
        fileIndex,
        totalFiles,
        activeFiles,
        transferResult,
        error,
        lastAction,
        lastStagedTime,
        recentAssets,
        activeJobId,
        startTransferJob,
        setTransferSuccess,
        setTransferError,
        dismissError,
        fetchRecentAssets,
        clearRecentAssets,
        refreshTransferStatus
      }}
    >
      {children}
    </TransferContext.Provider>
  );
};

export const useTransfer = (): TransferContextType => {
  const context = useContext(TransferContext);
  if (!context) {
    throw new Error("useTransfer must be used within a TransferProvider");
  }
  return context;
};
