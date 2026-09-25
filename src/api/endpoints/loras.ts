import { apiClient, RequestOptions } from "../client";
import { SystemLora, RemoteLoraStatusReport, TransferLoraResult } from "../../types";

export const lorasApi = {
  /**
   * Get all registered system LoRAs and favorites
   */
  listLoras(params?: { search?: string; base_model?: string }, options?: RequestOptions) {
    return apiClient.get<{ success: boolean; loras: SystemLora[]; total_count: number; filtered_count: number }>(
      "/api/loras",
      {
        ...options,
        params
      }
    );
  },

  /**
   * Add / Register a new system LoRA
   */
  saveLora(lora: Partial<SystemLora> & { name: string; filename: string }, options?: RequestOptions) {
    return apiClient.post<{ success: boolean; lora: SystemLora; message: string }>(
      "/api/loras",
      lora,
      options
    );
  },

  /**
   * Update an existing system LoRA
   */
  updateLora(id: string, lora: Partial<SystemLora>, options?: RequestOptions) {
    return apiClient.put<{ success: boolean; lora: SystemLora; message: string }>(
      `/api/loras/${id}`,
      lora,
      options
    );
  },

  /**
   * Delete a system LoRA
   */
  deleteLora(id: string, options?: RequestOptions) {
    return apiClient.delete<{ success: boolean; removed: boolean; id: string; message: string }>(
      `/api/loras/${id}`,
      options
    );
  },

  /**
   * Check remote GPU status for LoRAs (probes models/loras/ on ComfyUI remote instance)
   */
  checkRemoteStatus(payload?: { filenames?: string[]; creds?: Record<string, any> }, options?: RequestOptions) {
    return apiClient.post<RemoteLoraStatusReport>(
      "/api/loras/remote-status",
      payload || {},
      options
    );
  },

  /**
   * Transfer / Download LoRA directly onto remote GPU ComfyUI instance
   */
  transferRemote(payload: { lora_id?: string; filename?: string; download_url?: string; destination_folder?: string; creds?: Record<string, any> }, options?: RequestOptions) {
    return apiClient.post<TransferLoraResult>(
      "/api/loras/transfer-remote",
      payload,
      options
    );
  },

  /**
   * Search Civitai models (LoRAs, etc.)
   */
  searchCivitai(params?: { query?: string; base_model?: string; type?: string; sort?: string; page?: number; limit?: number }, options?: RequestOptions) {
    return apiClient.get<{ success: boolean; items: any[]; metadata?: any }>(
      "/api/civitai/search",
      {
        ...options,
        params
      }
    );
  }
};

