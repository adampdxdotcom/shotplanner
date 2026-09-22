import { apiClient, RequestOptions } from "../client";

export interface GeneratePromptPayload {
  basicStub: string;
  expandedPrompt?: string;
  provider?: string;
  planningContext?: any;
  promptPrefix?: string;
  characterContext?: any;
  lmStudioUrl?: string;
  geminiApiKey?: string;
  systemInstruction?: string;
  mode?: "expand" | "plan" | "general" | "character";
  temperature?: number;
}

export const llmApi = {
  /**
   * Send prompt expansion or scene plan generation request to LLM.
   */
  generatePrompt(payload: GeneratePromptPayload, options?: RequestOptions) {
    return apiClient.post<{ expanded_prompt?: string; plan?: any; response?: string; error?: string }>(
      "/api/generate-prompt",
      payload,
      options
    );
  },

  /**
   * Test connection to an LM Studio endpoint.
   */
  testLmStudio(url: string, options?: RequestOptions) {
    return apiClient.post<{ status: string; models?: any[]; error?: string }>(
      "/api/settings/test-lm-studio",
      { url },
      options
    );
  },

  /**
   * Generate a vision caption from image/thumbnail.
   */
  generateCaption(payload: {
    thumbnailPath?: string;
    imageBase64?: string;
    contextType?: string;
    subjectName?: string;
    lm_studio_url?: string;
  }, options?: RequestOptions) {
    return apiClient.post<{ success: boolean; caption: string; words_count?: number; error?: string }>(
      "/api/llm/caption",
      payload,
      options
    );
  },

  /**
   * Parse unstructured scene sketch into structured shot list.
   */
  parseSceneSketch(payload: any, options?: RequestOptions) {
    return apiClient.post<any>("/api/llm/parse-scene-sketch", payload, options);
  },

  /**
   * Chat with Assistant AI.
   */
  chat(payload: any, options?: RequestOptions) {
    return apiClient.post<any>("/api/assistant/chat", payload, options);
  },
};
