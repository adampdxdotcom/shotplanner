import { apiClient, RequestOptions } from "../client";
import { SceneProjectFile, ShotItem } from "../../types";

export interface SceneSummary {
  name: string;
  updated_at?: string;
  shot_count?: number;
  scene_id?: string;
}

export const scenesApi = {
  /**
   * List all available scene projects.
   */
  list(options?: RequestOptions) {
    return apiClient.get<{ scenes: string[] | SceneSummary[] }>("/api/scenes", options);
  },

  /**
   * Get single scene project data.
   */
  get(sceneName: string, options?: RequestOptions) {
    return apiClient.get<SceneProjectFile>(`/api/scenes/${encodeURIComponent(sceneName)}`, options);
  },

  /**
   * Save scene project data.
   */
  save(sceneName: string, data: SceneProjectFile, options?: RequestOptions) {
    return apiClient.post<{ message: string; filename: string }>(
      `/api/scenes/${encodeURIComponent(sceneName)}`,
      data,
      options
    );
  },

  /**
   * Delete a scene project and its directory.
   */
  delete(sceneName: string, options?: RequestOptions) {
    return apiClient.delete<{ message: string }>(`/api/scenes/${encodeURIComponent(sceneName)}`, options);
  },

  /**
   * Transfer shot configuration to staging.
   */
  transferShot(body: { shot: ShotItem; project: SceneProjectFile }, options?: RequestOptions) {
    return apiClient.post<{ status: string; staged_shot?: any }>(
      "/api/scenes/transfer-shot",
      body,
      options
    );
  },

  /**
   * Transfer all shots in a scene.
   */
  transferAllShots(project: SceneProjectFile, options?: RequestOptions) {
    return apiClient.post<{ status: string; count: number }>(
      "/api/scenes/transfer-scene",
      { project },
      options
    );
  },

  /**
   * Export project as zip archive.
   */
  getExportZipUrl(sceneName: string) {
    return `/api/scenes/${encodeURIComponent(sceneName)}/export`;
  },
};
