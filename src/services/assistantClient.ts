import { SceneProjectFile, AssistantChatMessage } from "../types";
import { llmApi } from "../api";

export type { AssistantChatMessage };

export interface AssistantChatRequest {
  messages: AssistantChatMessage[];
  scene_project?: Partial<SceneProjectFile>;
  active_shot_id?: string;
  active_section?: string;
  lm_studio_url?: string;
  provider?: string;
  model?: string;
}

export interface AssistantChatResponse {
  reply: string;
  model_used: string;
  provider_used: string;
}

/**
 * Sends messages and live project context to the assistant backend.
 */
export async function sendAssistantChatMessage(request: AssistantChatRequest): Promise<AssistantChatResponse> {
  const data = await llmApi.chat(request);
  return data as AssistantChatResponse;
}
