import { apiClient, RequestOptions } from "../client";
import { AssetRecord } from "../../types";

export const assetsApi = {
  /**
   * Fetch all registered asset records from assets_db.
   */
  getAll(sceneName?: string, options?: RequestOptions) {
    return apiClient.get<AssetRecord[]>("/api/assets", {
      ...options,
      params: sceneName ? { scene_name: sceneName } : undefined,
    });
  },

  /**
   * List assets by scene (alias).
   */
  list(sceneName?: string, options?: RequestOptions) {
    return apiClient.get<{ assets: AssetRecord[] }>("/api/assets", {
      ...options,
      params: sceneName ? { scene_name: sceneName } : undefined,
    });
  },

  /**
   * Upload single or multiple asset files.
   */
  upload(formData: FormData, options?: RequestOptions) {
    return apiClient.upload<{ message: string; asset?: AssetRecord; assets?: AssetRecord[] }>(
      "/api/assets/upload",
      formData,
      options
    );
  },

  /**
   * Update asset metadata tags/notes/character links.
   */
  update(id: string, updates: Partial<AssetRecord>, options?: RequestOptions) {
    return apiClient.post<{ message: string; asset: AssetRecord }>(
      `/api/assets/${id}`,
      updates,
      options
    );
  },

  /**
   * Delete an asset by its ID.
   */
  delete(id: string, options?: RequestOptions) {
    return apiClient.delete<{ message: string }>(`/api/assets/${id}`, options);
  },

  /**
   * Extract video frames into asset library.
   */
  extractFrames(body: { filename: string; numFrames?: number; sceneName?: string }, options?: RequestOptions) {
    return apiClient.post<{ message: string; frames: string[] }>(
      "/api/assets/extract-frames",
      body,
      options
    );
  },

  /**
   * Sync asset records with backend asset store.
   */
  sync(assets: AssetRecord[], options?: RequestOptions) {
    return apiClient.post<{ success: boolean; count?: number }>("/api/assets/sync", { assets }, options);
  },
};
