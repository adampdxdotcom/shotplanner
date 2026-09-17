import { SceneProjectFile } from "../types";

export interface AssistantChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

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
  const response = await fetch("/api/assistant/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server responded with HTTP ${response.status}`);
  }

  return response.json();
}
