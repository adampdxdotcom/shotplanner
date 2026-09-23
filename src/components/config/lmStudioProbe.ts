import { settingsApi } from "../../api";

export interface LocalLlmProbeResult {
  success: boolean;
  message: string;
  backend?: "ollama" | "lm_studio" | "generic";
  models?: string[];
  modelsCount?: number;
}

export async function probeLMStudioConnection(url?: string): Promise<LocalLlmProbeResult> {
  const targetUrl = (url || "http://localhost:1234/v1").trim();

  try {
    const data: any = await settingsApi.testLmStudio(targetUrl);

    if (data && (data.success || data.modelsCount !== undefined)) {
      const backend = data.backend || (targetUrl.includes("11434") ? "ollama" : "lm_studio");
      const models = Array.isArray(data.models) ? data.models : [];
      return {
        success: true,
        message: data.message || `Connected: ${backend === "ollama" ? "Ollama" : "LM Studio"} responsive at ${targetUrl}`,
        backend,
        models,
        modelsCount: data.modelsCount ?? models.length
      };
    } else {
      const errorMsg = data?.error || "Connection refused or endpoint unreachable";
      return { success: false, message: errorMsg };
    }
  } catch (err: any) {
    return { success: false, message: err.message || "Connection refused or endpoint unreachable" };
  }
}

