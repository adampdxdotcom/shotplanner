import { apiClient, RequestOptions } from "../client";

export const settingsApi = {
  // --- Gemini Settings ---
  getGeminiSettings(options?: RequestOptions) {
    return apiClient.get<{ api_key?: string; configured?: boolean }>("/api/settings/gemini", options);
  },
  getGeminiKey(options?: RequestOptions) {
    return apiClient.get<{ api_key: string }>("/api/settings/gemini", options);
  },
  saveGeminiKey(apiKey: string, options?: RequestOptions) {
    return apiClient.post<{ message: string }>("/api/settings/gemini", { api_key: apiKey }, options);
  },
  deleteGeminiKey(options?: RequestOptions) {
    return apiClient.delete<{ message: string }>("/api/settings/gemini", options);
  },
  testGemini(apiKey?: string, options?: RequestOptions) {
    return apiClient.post<{ status: string; models?: string[]; error?: string }>(
      "/api/settings/test-gemini",
      { api_key: apiKey },
      options
    );
  },

  // --- Civitai Settings ---
  getCivitaiKey(options?: RequestOptions) {
    return apiClient.get<{ api_key: string; has_key: boolean }>("/api/settings/civitai", options);
  },
  saveCivitaiKey(apiKey: string, options?: RequestOptions) {
    return apiClient.post<{ message: string }>("/api/settings/civitai", { api_key: apiKey }, options);
  },
  deleteCivitaiKey(options?: RequestOptions) {
    return apiClient.delete<{ message: string }>("/api/settings/civitai", options);
  },

  // --- HuggingFace Settings ---
  getHuggingFaceToken(options?: RequestOptions) {
    return apiClient.get<{ api_token: string; has_token: boolean }>("/api/settings/huggingface", options);
  },
  saveHuggingFaceToken(apiToken: string, options?: RequestOptions) {
    return apiClient.post<{ message: string }>("/api/settings/huggingface", { api_token: apiToken }, options);
  },
  deleteHuggingFaceToken(options?: RequestOptions) {
    return apiClient.delete<{ message: string }>("/api/settings/huggingface", options);
  },

  // --- RunPod / Remote Comfy Settings ---
  getRunpodKey(options?: RequestOptions) {
    return apiClient.get<{ api_key: string }>("/api/settings/runpod", options);
  },
  saveRunpodKey(apiKey: string, options?: RequestOptions) {
    return apiClient.post<{ message: string }>("/api/settings/runpod", { api_key: apiKey }, options);
  },
  deleteRunpodKey(options?: RequestOptions) {
    return apiClient.delete<{ message: string }>("/api/settings/runpod", options);
  },
  testComfyUI(payload: { comfyui_url?: string; url?: string; comfyui_api_url?: string; token?: string; remote_api_token?: string }, options?: RequestOptions) {
    return apiClient.post<{ success: boolean; status?: string; message?: string; systemInfo?: any; error?: string }>(
      "/api/settings/test-comfyui",
      payload,
      options
    );
  },
  testLmStudio(url: string, options?: RequestOptions) {
    return apiClient.post<{ success: boolean; modelsCount?: number; error?: string }>(
      "/api/settings/test-lm-studio",
      { url },
      options
    );
  },
  testSsh(payload: Record<string, any>, options?: RequestOptions) {
    return apiClient.post<{ success: boolean; message?: string; error?: string }>(
      "/api/ssh/test",
      payload,
      options
    );
  },
  generateSshKeyPair(options?: RequestOptions) {
    return apiClient.post<{ success: boolean; private_key: string; public_key: string }>(
      "/api/ssh/generate_keypair",
      {},
      options
    );
  },
  getRunpodPods(runpodApiKey: string, options?: RequestOptions) {
    return apiClient.post<{ success: boolean; pods?: any[]; error?: string }>(
      "/api/runpod/pods",
      { runpod_api_key: runpodApiKey },
      options
    );
  },
  addRunpodKey(payloadOrKey: { runpod_api_key: string; public_key: string } | string, publicKey?: string, options?: RequestOptions) {
    const payload = typeof payloadOrKey === "string" 
      ? { runpod_api_key: payloadOrKey, public_key: publicKey || "" } 
      : payloadOrKey;
    return apiClient.post<{ success: boolean; error?: string }>(
      "/api/runpod/add-key",
      payload,
      options
    );
  },
};
