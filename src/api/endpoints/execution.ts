import { apiClient, RequestOptions } from "../client";
import { ComfyQueueStatus, ComfySystemStats } from "../../types";

export interface ComfySyncHistoryPayload {
  scene_name: string;
  comfyui_api_url: string;
  remote_api_token?: string;
  prompt_id?: string;
  max_prompts?: number;
}

export const executionApi = {
  /**
   * Queue a generation prompt to ComfyUI.
   */
  queue(payload: any, options?: RequestOptions) {
    return apiClient.post<{ prompt_id: string; number?: number }>("/api/queue", payload, options);
  },

  /**
   * Interrupt current ComfyUI generation.
   */
  interrupt(payload?: { comfyui_api_url?: string; remote_api_token?: string }, options?: RequestOptions) {
    return apiClient.post<{ success: boolean; message?: string }>("/api/comfy/interrupt", payload || {}, options);
  },

  /**
   * Check legacy ComfyUI queue status.
   */
  getStatus(options?: RequestOptions) {
    return apiClient.get<{ exec_info?: { queue_remaining: number }; running?: boolean }>("/api/queue/status", options);
  },

  /**
   * Get live ComfyUI queue status.
   */
  getComfyQueue(params: { comfyui_api_url: string; remote_api_token?: string }, options?: RequestOptions) {
    return apiClient.get<ComfyQueueStatus>("/api/comfy/queue", { ...options, params });
  },

  /**
   * Get live ComfyUI hardware system stats.
   */
  getComfySystemStats(params: { comfyui_api_url: string; remote_api_token?: string }, options?: RequestOptions) {
    return apiClient.get<ComfySystemStats>("/api/comfy/system-stats", { ...options, params });
  },

  /**
   * Delete a single pending job from the ComfyUI queue.
   */
  deleteComfyJob(payload: { prompt_id: string; comfyui_api_url: string; remote_api_token?: string }, options?: RequestOptions) {
    return apiClient.post<{ success: boolean; message?: string }>("/api/comfy/delete-job", payload, options);
  },

  /**
   * Clear all pending jobs from the ComfyUI queue.
   */
  clearComfyQueue(payload: { comfyui_api_url: string; remote_api_token?: string }, options?: RequestOptions) {
    return apiClient.post<{ success: boolean; message?: string }>("/api/comfy/clear-queue", payload, options);
  },

  /**
   * Ingest completed outputs from ComfyUI history.
   */
  syncHistory(payload: ComfySyncHistoryPayload, options?: RequestOptions) {
    return apiClient.post<{ success: boolean; ingested_count: number }>("/api/outputs/sync-history", payload, options);
  },

  /**
   * Fetch generation history for a specific prompt ID.
   */
  getHistory(promptId: string, options?: RequestOptions) {
    return apiClient.get<Record<string, any>>(`/api/history/${encodeURIComponent(promptId)}`, options);
  },
};
