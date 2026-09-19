import { useState, useEffect, useCallback, useRef } from "react";
import { ComfyQueueStatus, ComfySystemStats } from "../types";

interface UseComfyQueueOptions {
  apiUrl: string;
  authToken?: string;
  autoPollIntervalMs?: number; // default 3000ms when queue active, 10000ms when idle
  enabled?: boolean;
  onShowToast?: (msg: string, type: "success" | "error" | "info") => void;
}

export function useComfyQueue({
  apiUrl,
  authToken,
  autoPollIntervalMs,
  enabled = true,
  onShowToast
}: UseComfyQueueOptions) {
  const [queueStatus, setQueueStatus] = useState<ComfyQueueStatus>({
    success: false,
    is_executing: false,
    queue_remaining: 0,
    running: [],
    pending: []
  });

  const [systemStats, setSystemStats] = useState<ComfySystemStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isInterrupting, setIsInterrupting] = useState<boolean>(false);
  const [deletingPromptId, setDeletingPromptId] = useState<string | null>(null);
  const [isClearingQueue, setIsClearingQueue] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Fetch live queue status from /api/comfy/queue
   */
  const refreshQueue = useCallback(async (quiet: boolean = false) => {
    if (!enabled || !apiUrl) return;
    if (!quiet) setIsLoading(true);

    try {
      const queryParams = new URLSearchParams({
        comfyui_api_url: apiUrl
      });
      if (authToken) {
        queryParams.append("remote_api_token", authToken);
      }

      const res = await fetch(`/api/comfy/queue?${queryParams.toString()}`);
      if (!res.ok) {
        throw new Error(`Queue fetch returned HTTP ${res.status}`);
      }

      const data: ComfyQueueStatus = await res.json();
      setQueueStatus(data);
      setLastRefreshedAt(Date.now());
    } catch (err: any) {
      setQueueStatus(prev => ({
        ...prev,
        success: false,
        error: err.message || "Failed to reach ComfyUI queue"
      }));
    } finally {
      if (!quiet) setIsLoading(false);
    }
  }, [apiUrl, authToken, enabled]);

  /**
   * Fetch hardware VRAM stats from /api/comfy/system-stats
   */
  const refreshSystemStats = useCallback(async () => {
    if (!enabled || !apiUrl) return;

    try {
      const queryParams = new URLSearchParams({
        comfyui_api_url: apiUrl
      });
      if (authToken) {
        queryParams.append("remote_api_token", authToken);
      }

      const res = await fetch(`/api/comfy/system-stats?${queryParams.toString()}`);
      if (!res.ok) return;

      const data: ComfySystemStats = await res.json();
      if (data.success) {
        setSystemStats(data);
      }
    } catch {
      // Soft fail for system stats
    }
  }, [apiUrl, authToken, enabled]);

  /**
   * Interrupt active job execution
   */
  const interruptExecution = useCallback(async () => {
    if (!apiUrl) return false;
    setIsInterrupting(true);

    try {
      const res = await fetch("/api/comfy/interrupt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comfyui_api_url: apiUrl,
          remote_api_token: authToken
        })
      });

      const data = await res.json();
      if (data.success) {
        onShowToast?.("🛑 Execution interrupted on ComfyUI", "info");
        await refreshQueue(true);
        return true;
      } else {
        onShowToast?.(`Failed to interrupt: ${data.message || "Unknown error"}`, "error");
        return false;
      }
    } catch (err: any) {
      onShowToast?.(`Interrupt error: ${err.message}`, "error");
      return false;
    } finally {
      setIsInterrupting(false);
    }
  }, [apiUrl, authToken, onShowToast, refreshQueue]);

  /**
   * Remove a single job from the pending queue
   */
  const deleteJob = useCallback(async (promptId: string) => {
    if (!apiUrl || !promptId) return false;
    setDeletingPromptId(promptId);

    try {
      const res = await fetch("/api/comfy/delete-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt_id: promptId,
          comfyui_api_url: apiUrl,
          remote_api_token: authToken
        })
      });

      const data = await res.json();
      if (data.success) {
        onShowToast?.(`Removed job ${promptId.slice(0, 8)}... from queue`, "info");
        await refreshQueue(true);
        return true;
      } else {
        onShowToast?.(`Failed to delete job: ${data.message || "Unknown error"}`, "error");
        return false;
      }
    } catch (err: any) {
      onShowToast?.(`Error removing job: ${err.message}`, "error");
      return false;
    } finally {
      setDeletingPromptId(null);
    }
  }, [apiUrl, authToken, onShowToast, refreshQueue]);

  /**
   * Clear all pending jobs from the queue
   */
  const clearPendingQueue = useCallback(async () => {
    if (!apiUrl) return false;
    setIsClearingQueue(true);

    try {
      const res = await fetch("/api/comfy/clear-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comfyui_api_url: apiUrl,
          remote_api_token: authToken
        })
      });

      const data = await res.json();
      if (data.success) {
        onShowToast?.("Pending queue cleared", "info");
        await refreshQueue(true);
        return true;
      } else {
        onShowToast?.(`Failed to clear queue: ${data.message || "Unknown error"}`, "error");
        return false;
      }
    } catch (err: any) {
      onShowToast?.(`Error clearing queue: ${err.message}`, "error");
      return false;
    } finally {
      setIsClearingQueue(false);
    }
  }, [apiUrl, authToken, onShowToast, refreshQueue]);

  // Initial and adaptive polling
  useEffect(() => {
    if (!enabled || !apiUrl) return;

    // Run initial fetch
    refreshQueue(true);
    refreshSystemStats();

    // Determine poll interval based on queue activity
    const interval = autoPollIntervalMs || (queueStatus.queue_remaining > 0 ? 3000 : 8000);

    pollTimerRef.current = setInterval(() => {
      refreshQueue(true);
      // Poll stats every 2 cycles
      if (Math.random() > 0.5) {
        refreshSystemStats();
      }
    }, interval);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [apiUrl, authToken, enabled, queueStatus.queue_remaining, autoPollIntervalMs, refreshQueue, refreshSystemStats]);

  return {
    queueStatus,
    systemStats,
    isLoading,
    isInterrupting,
    deletingPromptId,
    isClearingQueue,
    lastRefreshedAt,
    refreshQueue,
    refreshSystemStats,
    interruptExecution,
    deleteJob,
    clearPendingQueue
  };
}
