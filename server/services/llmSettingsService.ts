import fs from "fs";
import { LLM_CONFIG_FILE } from "../config/constants";
import { writeJsonAtomicSync } from "../utils/atomicFs";

export interface StoredLLMSettings {
  lm_studio_url?: string;
  local_model?: string;
  default_llm_provider?: "lm_studio" | "gemini";
  vision_enabled?: boolean;
  auto_caption_enabled?: boolean;
  llm_custom_system_prompt?: string;
  llm_temperature?: number;
  llm_max_tokens?: number;
  updated_at?: string;
}

const DEFAULT_LLM_SETTINGS: StoredLLMSettings = {
  lm_studio_url: "http://localhost:1234/v1",
  local_model: "",
  default_llm_provider: "lm_studio",
  vision_enabled: false,
  auto_caption_enabled: false,
  llm_temperature: 0.45,
  llm_max_tokens: 800
};

export function getStoredLLMSettings(): StoredLLMSettings {
  if (fs.existsSync(LLM_CONFIG_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(LLM_CONFIG_FILE, "utf-8"));
      return {
        ...DEFAULT_LLM_SETTINGS,
        ...data
      };
    } catch (e) {
      console.warn("[LLM Settings] Failed to parse llm_config.json, returning defaults", e);
    }
  }
  return { ...DEFAULT_LLM_SETTINGS };
}

export function saveStoredLLMSettings(settings: Partial<StoredLLMSettings>): StoredLLMSettings {
  const current = getStoredLLMSettings();
  const updated: StoredLLMSettings = {
    ...current,
    ...settings,
    updated_at: new Date().toISOString()
  };
  writeJsonAtomicSync(LLM_CONFIG_FILE, updated);
  return updated;
}
