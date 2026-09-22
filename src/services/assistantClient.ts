import { SceneProjectFile, AssistantChatMessage } from "../types";
import { llmApi } from "../api";

import { RequestOptions } from "../api";

export type { AssistantChatMessage };

export interface AssistantChatRequest {
  messages: AssistantChatMessage[];
  scene_project?: Partial<SceneProjectFile>;
  active_shot_id?: string;
  active_section?: string;
  lm_studio_url?: string;
  provider?: string;
  model?: string;
  attached_asset_filename?: string;
  attached_asset?: {
    id?: string;
    filename: string;
    subject_name?: string;
    type?: string;
    url?: string;
  };
}

export interface AssistantChatResponse {
  reply: string;
  model_used: string;
  provider_used: string;
}

/**
 * Sends messages and live project context to the assistant backend.
 */
export async function sendAssistantChatMessage(
  request: AssistantChatRequest,
  options?: RequestOptions
): Promise<AssistantChatResponse> {
  const data = await llmApi.chat(request, options);
  return data as AssistantChatResponse;
}
