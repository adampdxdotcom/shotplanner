import { AssistantChatMessage, SceneProjectFile } from "../types";

const STORAGE_PREFIX = "shotplanner_assistant_chat_";

const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window === "undefined" || !window.localStorage) return null;
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window === "undefined" || !window.localStorage) return;
      window.localStorage.setItem(key, value);
    } catch {
      // Ignore storage errors safely
    }
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window === "undefined" || !window.localStorage) return;
      window.localStorage.removeItem(key);
    } catch {
      // Ignore storage errors safely
    }
  }
};

/**
 * Builds the default contextual welcome greeting for the given scene project.
 */
export function createInitialAssistantMessage(
  sceneProject?: Partial<SceneProjectFile> | null
): AssistantChatMessage {
  const sceneName = sceneProject?.scene_name || "your active scene";
  const shotCount = sceneProject?.shots?.length || 0;

  return {
    role: "assistant",
    content: `Hello! I am your AI Production Assistant. I have full context of **${sceneName}**, including all **${shotCount} shots**, world planning, cast profiles, and assets.\n\nAsk me for cinematography recommendations, scene lore, lighting setups, dialogue tweaks, or to stage assets and trigger prompt expansions.`
  };
}

/**
 * Retrieves the stored chat history for a specific scene, checking the
 * project file first and localStorage cache as a secondary recovery fallback.
 */
export function getStoredAssistantChat(
  sceneId?: string,
  fallbackProject?: Partial<SceneProjectFile> | null
): AssistantChatMessage[] {
  // 1. Check project file's own embedded history first
  if (
    fallbackProject?.assistant_chat_history &&
    Array.isArray(fallbackProject.assistant_chat_history) &&
    fallbackProject.assistant_chat_history.length > 0
  ) {
    return [...fallbackProject.assistant_chat_history];
  }

  // 2. Check localStorage cache for this scene_id
  if (sceneId) {
    const raw = safeStorage.getItem(`${STORAGE_PREFIX}${sceneId}`);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch {
        // Corrupted cache - fallback to initial message
      }
    }
  }

  // 3. Fallback to fresh contextual greeting
  return [createInitialAssistantMessage(fallbackProject)];
}

/**
 * Saves chat history to the client-side cache keyed by scene ID.
 */
export function saveStoredAssistantChat(
  sceneId: string,
  messages: AssistantChatMessage[]
): void {
  if (!sceneId || !Array.isArray(messages)) return;
  safeStorage.setItem(`${STORAGE_PREFIX}${sceneId}`, JSON.stringify(messages));
}

/**
 * Clears cached conversation for a scene and returns a fresh initial greeting.
 */
export function clearStoredAssistantChat(
  sceneId?: string,
  fallbackProject?: Partial<SceneProjectFile> | null
): AssistantChatMessage[] {
  if (sceneId) {
    safeStorage.removeItem(`${STORAGE_PREFIX}${sceneId}`);
  }
  return [createInitialAssistantMessage(fallbackProject)];
}

/**
 * Trims conversation history down to a rolling window of recent turns (default 16)
 * while preserving chronological order for LLM context limits and token efficiency.
 */
export function getRollingChatWindow<T extends { role: string; content: string }>(
  messages: T[],
  maxTurns = 16
): T[] {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [];
  }
  if (messages.length <= maxTurns) {
    return [...messages];
  }
  return messages.slice(-maxTurns);
}
