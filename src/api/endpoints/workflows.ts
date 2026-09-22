import { apiClient, RequestOptions } from "../client";
import { WorkflowItem, ParsedWorkflowData } from "../../types";

export const workflowsApi = {
  /**
   * List available workflows (optionally filtered by scene).
   */
  list(sceneName?: string, options?: RequestOptions) {
    return apiClient.get<WorkflowItem[]>("/api/workflows", {
      ...options,
      params: sceneName ? { scene_name: sceneName } : undefined,
    });
  },

  /**
   * Parse a specific workflow JSON file into node bindings and parameters.
   */
  parse(filename: string, sceneName?: string, options?: RequestOptions) {
    return apiClient.get<ParsedWorkflowData>(`/api/workflows/${encodeURIComponent(filename)}`, {
      ...options,
      params: sceneName ? { scene_name: sceneName } : undefined,
    });
  },

  /**
   * Upload a new workflow JSON.
   */
  upload(formData: FormData, options?: RequestOptions) {
    return apiClient.upload<{ message: string; filename: string }>("/api/workflows/upload", formData, options);
  },

  /**
   * Delete a workflow file.
   */
  delete(filename: string, sceneName?: string, options?: RequestOptions) {
    return apiClient.delete<{ message: string }>(`/api/workflows/${encodeURIComponent(filename)}`, {
      ...options,
      params: sceneName ? { scene_name: sceneName } : undefined,
    });
  },
};
