import { apiClient, RequestOptions } from "../client";

export interface CivitaiSearchOptions extends RequestOptions {
  query?: string;
  types?: string[];
  baseModels?: string[];
  nsfw?: boolean;
  sort?: string;
  period?: string;
  page?: number;
  limit?: number;
}

export const modelHubApi = {
  /**
   * Search Civitai models via backend proxy.
   */
  searchCivitai(params: Record<string, any>, options?: RequestOptions) {
    return apiClient.get<any>("/api/civitai/models", {
      ...options,
      params,
    });
  },

  /**
   * Fetch Civitai favorites.
   */
  getCivitaiFavorites(options?: RequestOptions) {
    return apiClient.get<any[]>("/api/civitai/favorites", options);
  },

  /**
   * Add Civitai item to favorites.
   */
  addCivitaiFavorite(item: any, options?: RequestOptions) {
    return apiClient.post<{ message: string; favorite: any }>("/api/civitai/favorites", item, options);
  },

  /**
   * Remove Civitai item from favorites.
   */
  removeCivitaiFavorite(modelId: number, options?: RequestOptions) {
    return apiClient.delete<{ message: string }>(`/api/civitai/favorites/${modelId}`, options);
  },

  /**
   * Search HuggingFace models.
   */
  searchHuggingFace(params: Record<string, any>, options?: RequestOptions) {
    return apiClient.get<any>("/api/huggingface/models", {
      ...options,
      params,
    });
  },

  /**
   * Trigger remote SSH download to GPU pod.
   */
  downloadRemote(payload: Record<string, any>, options?: RequestOptions) {
    return apiClient.post<{ success?: boolean; status?: string; message?: string; error?: string }>("/api/model-hub/download-remote", payload, options);
  },
};
