import { apiClient, RequestOptions } from "../client";
import { SceneProjectFile, ShotItem } from "../../types";

export interface ProjectSummary {
  name: string;
  filename: string;
  updated_at?: string;
  shot_count?: number;
  scene_id?: string;
}

export const projectsApi = {
  /**
   * List all saved scene projects.
   */
  list(options?: RequestOptions) {
    return apiClient.get<{ projects: Array<string | { filename: string; updated_at?: string }> }>("/api/projects", options);
  },

  /**
   * Load project data by filename.
   */
  get(filename: string, options?: RequestOptions) {
    return apiClient.get<SceneProjectFile>(`/api/projects/${encodeURIComponent(filename)}`, options);
  },

  /**
   * Save project data.
   */
  save(filename: string, data: SceneProjectFile, options?: RequestOptions) {
    return apiClient.post<{ success: boolean; filename: string }>(
      "/api/projects",
      { filename, data },
      options
    );
  },

  /**
   * Delete a project file.
   */
  delete(filename: string, options?: RequestOptions) {
    return apiClient.delete<{ success: boolean }>(`/api/projects/${encodeURIComponent(filename)}`, options);
  },

  /**
   * Inspect project ZIP package for Universe assets before import.
   */
  inspectZip(formData: FormData, options?: RequestOptions) {
    return apiClient.upload<any>("/api/projects/inspect-zip", formData, options);
  },

  /**
   * Complete project import with resolved universe conflict choices.
   */
  importProject(payload: { temp_file_path?: string; universe_resolutions?: any }, options?: RequestOptions) {
    return apiClient.post<{ success: boolean; filename: string }>("/api/projects/import", payload, options);
  },

  /**
   * Get takes summary for project.
   */
  getTakesSummary(projectName: string, options?: RequestOptions) {
    return apiClient.get<any>(`/api/projects/${encodeURIComponent(projectName)}/takes-summary`, options);
  },

  /**
   * Sync universe assets across projects.
   */
  syncAssets(options?: RequestOptions) {
    return apiClient.post<{ message: string }>("/api/assets/sync", {}, options);
  },
};
