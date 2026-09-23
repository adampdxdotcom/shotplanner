import { Router, Request, Response } from "express";
import { getStoredGeminiKey, saveGeminiKey, removeGeminiKey, generateWithGeminiAPI } from "../services/geminiService";
import { getStoredCivitaiKey, saveCivitaiKey, removeCivitaiKey } from "../services/civitaiService";
import { getStoredHuggingFaceToken, saveHuggingFaceToken, removeHuggingFaceToken } from "../services/huggingfaceService";
import { getStoredRunpodApiKey, saveRunpodApiKey, removeRunpodApiKey } from "../services/runpodService";
import { getStoredLLMSettings, saveStoredLLMSettings } from "../services/llmSettingsService";
import { detectVisionCapability } from "../services/visionCaptionService";

const router = Router();

/**
 * Get stored program-level LLM settings
 */
router.get("/llm", (req: Request, res: Response) => {
  const settings = getStoredLLMSettings();
  res.json(settings);
});

/**
 * Save program-level LLM settings
 */
router.post("/llm", (req: Request, res: Response) => {
  const settings = saveStoredLLMSettings(req.body || {});
  res.json({ success: true, settings });
});

router.get("/gemini", (req: Request, res: Response) => {
  const key = getStoredGeminiKey();
  const maskedKey = key && key.length > 8 ? `${key.slice(0, 4)}...${key.slice(-4)}` : key ? "***" : null;
  res.json({ configured: !!key, api_key: key ? key.substring(0, 5) + "..." : null, masked_key: maskedKey });
});

router.post("/gemini", (req: Request, res: Response) => {
  const { api_key } = req.body;
  if (!api_key || typeof api_key !== "string" || !api_key.trim()) {
    removeGeminiKey();
  } else {
    saveGeminiKey(api_key.trim());
  }
  res.json({ success: true });
});

router.delete("/gemini", (req: Request, res: Response) => {
  removeGeminiKey();
  res.json({ success: true, message: "Gemini API key removed and deactivated successfully." });
});

/**
 * Get stored Civitai API key status & masked value
 */
router.get("/civitai", (req: Request, res: Response) => {
  const key = getStoredCivitaiKey();
  const maskedKey = key && key.length > 8 ? `${key.slice(0, 4)}...${key.slice(-4)}` : key ? "***" : null;
  res.json({ configured: !!key, api_key: key ? key.substring(0, 5) + "..." : null, masked_key: maskedKey });
});

/**
 * Save Civitai API key
 */
router.post("/civitai", (req: Request, res: Response) => {
  const { api_key, apiKey } = req.body || {};
  const val = (api_key || apiKey || "").trim();
  if (val) {
    saveCivitaiKey(val);
  } else {
    removeCivitaiKey();
  }
  res.json({ success: true });
});

/**
 * Delete Civitai API key
 */
router.delete("/civitai", (req: Request, res: Response) => {
  removeCivitaiKey();
  res.json({ success: true, message: "Civitai API key removed." });
});

/**
 * Get stored Hugging Face token status & masked value
 */
router.get("/huggingface", (req: Request, res: Response) => {
  const token = getStoredHuggingFaceToken();
  const maskedToken = token && token.length > 8 ? `${token.slice(0, 4)}...${token.slice(-4)}` : token ? "***" : null;
  res.json({ configured: !!token, token: token ? token.substring(0, 5) + "..." : null, masked_token: maskedToken });
});

/**
 * Save Hugging Face token
 */
router.post("/huggingface", (req: Request, res: Response) => {
  const { token, api_token, apiKey } = req.body || {};
  const val = (token || api_token || apiKey || "").trim();
  if (val) {
    saveHuggingFaceToken(val);
  } else {
    removeHuggingFaceToken();
  }
  res.json({ success: true });
});

/**
 * Delete Hugging Face token
 */
router.delete("/huggingface", (req: Request, res: Response) => {
  removeHuggingFaceToken();
  res.json({ success: true, message: "Hugging Face token removed." });
});

/**
 * Get stored RunPod API key status & masked value
 */
router.get("/runpod", (req: Request, res: Response) => {
  const key = getStoredRunpodApiKey();
  const maskedKey = key && key.length > 8 ? `${key.slice(0, 4)}...${key.slice(-4)}` : key ? "***" : null;
  res.json({ configured: !!key, api_key: key || null, masked_key: maskedKey });
});

/**
 * Save RunPod API key
 */
router.post("/runpod", (req: Request, res: Response) => {
  const { runpod_api_key, api_key, apiKey } = req.body || {};
  const val = (runpod_api_key || api_key || apiKey || "").trim();
  if (val) {
    saveRunpodApiKey(val);
  } else {
    removeRunpodApiKey();
  }
  res.json({ success: true });
});

/**
 * Delete RunPod API key
 */
router.delete("/runpod", (req: Request, res: Response) => {
  removeRunpodApiKey();
  res.json({ success: true, message: "RunPod API key removed." });
});

/**
 * Test Local LLM (LM Studio / Ollama / OpenAI-compatible) API endpoint connection
 */
router.post(["/test-lm-studio", "/test-local-llm"], async (req: Request, res: Response) => {
  const { url, endpoint, targetUrl: rawTargetUrl } = req.body || {};
  const inputUrl = url || endpoint || rawTargetUrl || "http://localhost:1234/v1";
  const targetUrl = inputUrl.trim().replace(/\/$/, "");

  let probeUrl = targetUrl;
  if (!probeUrl.endsWith("/models")) {
    if (probeUrl.endsWith("/v1")) {
      probeUrl = `${probeUrl}/models`;
    } else {
      probeUrl = `${probeUrl}/v1/models`;
    }
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const lmRes = await fetch(probeUrl, {
      method: "GET",
      headers: { "Accept": "application/json" },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (lmRes.ok) {
      const data = await lmRes.json().catch(() => ({}));
      const modelsList = Array.isArray(data.data) ? data.data : (Array.isArray(data.models) ? data.models : []);
      const modelNames = modelsList
        .map((m: any) => m.id || m.name || (typeof m === "string" ? m : ""))
        .filter(Boolean);
      const modelsCount = modelNames.length;

      // Auto-detect vision support across available models
      const { hasVision, visionModel } = detectVisionCapability(modelsList.length > 0 ? modelsList : modelNames);

      // Auto-detect backend engine
      const serverHeader = (lmRes.headers.get("server") || "").toLowerCase();
      const isOllama =
        targetUrl.includes("11434") ||
        serverHeader.includes("ollama") ||
        modelNames.some((n: string) => n.includes(":") && !n.includes("@"));

      const isLmStudio = targetUrl.includes("1234") || serverHeader.includes("lmstudio");
      const backendType: "ollama" | "lm_studio" | "generic" = isOllama
        ? "ollama"
        : isLmStudio
        ? "lm_studio"
        : "generic";

      const backendDisplayName = isOllama ? "Ollama" : isLmStudio ? "LM Studio" : "Local LLM";

      return res.json({
        success: true,
        backend: backendType,
        message: isOllama
          ? `Ollama connected (${modelsCount} model${modelsCount === 1 ? "" : "s"} available)`
          : `${backendDisplayName} server responsive at ${targetUrl}`,
        modelsCount,
        models: modelNames,
        modelNames: modelNames.slice(0, 5).join(", "),
        hasVision,
        visionModel,
        probeUrl
      });
    } else {
      return res.status(400).json({
        success: false,
        error: `Server responded with HTTP ${lmRes.status} ${lmRes.statusText}`
      });
    }
  } catch (err: any) {
    const isAbort = err.name === "AbortError";
    const errorMessage = isAbort 
      ? "Connection timed out (5s limit reached)" 
      : (err.message || "Connection refused or endpoint unreachable");

    return res.status(400).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * Test Google Gemini API connection with lightweight verification query
 */
router.post("/test-gemini", async (req: Request, res: Response) => {
  let { api_key, apiKey } = req.body || {};
  let keyToUse = (api_key || apiKey || "").trim();

  if (!keyToUse) {
    keyToUse = getStoredGeminiKey() || "";
  }

  if (!keyToUse) {
    return res.status(400).json({
      success: false,
      error: "No Gemini API key is configured"
    });
  }

  try {
    const result = await generateWithGeminiAPI(keyToUse, "Ping test connection verification");
    if (result && result.text) {
      return res.json({
        success: true,
        message: `Gemini API key verified successfully using ${result.modelUsed}`,
        activeModel: result.modelUsed,
        modelUsed: result.modelUsed
      });
    } else {
      return res.status(400).json({
        success: false,
        error: "Gemini API returned an empty response"
      });
    }
  } catch (err: any) {
    let errMsg = err.message || "Invalid API key or network request failed";
    if (errMsg.toLowerCase().includes("api_key_invalid") || errMsg.toLowerCase().includes("api key not valid") || errMsg.toLowerCase().includes("unauthorized") || errMsg.toLowerCase().includes("403") || errMsg.toLowerCase().includes("401")) {
      errMsg = "Invalid API key provided";
    }
    return res.status(400).json({
      success: false,
      error: errMsg
    });
  }
});

/**
 * Test ComfyUI endpoint connection
 */
router.post("/test-comfyui", async (req: Request, res: Response) => {
  const { url, comfyui_url, comfyui_api_url, token, remote_api_token } = req.body;
  const rawUrl = comfyui_url || url || comfyui_api_url || "http://127.0.0.1:8188";
  const targetUrl = rawUrl.trim().replace(/\/$/, "");
  const authToken = (remote_api_token || token || "").trim();

  console.log(`[ComfyUI Test] Testing reachability for URL: ${targetUrl}`);

  let probeUrl = `${targetUrl}/system_stats`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const headers: Record<string, string> = { "Accept": "application/json" };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    let lmRes = await fetch(probeUrl, {
      method: "GET",
      headers,
      signal: controller.signal
    }).catch(async () => {
      // Fallback probe
      probeUrl = `${targetUrl}/object_info`;
      return await fetch(probeUrl, {
        method: "GET",
        headers,
        signal: controller.signal
      });
    });
    clearTimeout(timeout);

    if (lmRes && lmRes.ok) {
      const data = await lmRes.json().catch(() => ({}));
      
      const systemInfoParts: string[] = [];
      if (data && data.system && data.system.os) {
        systemInfoParts.push(`OS: ${data.system.os}`);
      }
      if (data && data.devices && data.devices.length > 0) {
        const device = data.devices[0];
        let devStr = device.name ? `GPU: ${device.name}` : "GPU detected";
        if (device.vram_total) {
          const vramGB = (device.vram_total / (1024 * 1024 * 1024)).toFixed(1);
          devStr += ` (${vramGB}GB VRAM)`;
        }
        systemInfoParts.push(devStr);
      }

      const systemInfo = systemInfoParts.length > 0 ? systemInfoParts.join(" | ") : `${targetUrl} (Active)`;
      console.log(`[ComfyUI Test] Success (HTTP 200) - Connected to: ${systemInfo}`);

      return res.json({
        success: true,
        message: `ComfyUI server responsive at ${targetUrl}`,
        systemInfo,
        probeUrl,
        system_stats: data
      });
    } else {
      const statusText = lmRes ? `HTTP ${lmRes.status} ${lmRes.statusText}` : "No response";
      const errorMessage = `Server responded with ${statusText}`;
      console.log(`[ComfyUI Test] Failed to connect to ${targetUrl}: ${errorMessage}`);
      return res.status(400).json({
        success: false,
        error: errorMessage
      });
    }
  } catch (err: any) {
    const isAbort = err.name === "AbortError";
    const errorMessage = isAbort 
      ? "Connection timed out (5s limit reached)" 
      : (err.message || "Connection refused or endpoint unreachable");

    console.log(`[ComfyUI Test] Failed to connect to ${targetUrl}: ${errorMessage}`);
    return res.status(400).json({
      success: false,
      error: errorMessage
    });
  }
});

export default router;

