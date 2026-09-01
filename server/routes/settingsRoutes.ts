import { Router, Request, Response } from "express";
import { getStoredGeminiKey, saveGeminiKey, generateWithGeminiAPI } from "../services/geminiService";

const router = Router();

router.get("/gemini", (req: Request, res: Response) => {
  const key = getStoredGeminiKey();
  const maskedKey = key && key.length > 8 ? `${key.slice(0, 4)}...${key.slice(-4)}` : key ? "***" : null;
  res.json({ configured: !!key, api_key: key ? key.substring(0, 5) + "..." : null, masked_key: maskedKey });
});

router.post("/gemini", (req: Request, res: Response) => {
  const { api_key } = req.body;
  saveGeminiKey(api_key);
  res.json({ success: true });
});

/**
 * Test LM Studio local API endpoint connection
 */
router.post("/test-lm-studio", async (req: Request, res: Response) => {
  const { url } = req.body;
  const targetUrl = (url || "http://localhost:1234/v1").trim().replace(/\/$/, "");

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
      const modelsCount = Array.isArray(data.data) ? data.data.length : undefined;
      const modelNames = Array.isArray(data.data) && data.data.length > 0 
        ? data.data.map((m: any) => m.id || m.name).slice(0, 2).join(", ")
        : null;

      return res.json({
        success: true,
        message: `LM Studio server responsive at ${targetUrl}`,
        modelsCount,
        modelNames,
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
  let { api_key } = req.body;
  if (!api_key || !api_key.trim()) {
    api_key = getStoredGeminiKey();
  }

  if (!api_key || !api_key.trim()) {
    return res.status(400).json({
      success: false,
      error: "No Gemini API key provided or configured"
    });
  }

  try {
    const result = await generateWithGeminiAPI(api_key.trim(), "Ping test connection verification");
    if (result && result.text) {
      return res.json({
        success: true,
        message: `Gemini API key verified successfully using ${result.modelUsed}`,
        modelUsed: result.modelUsed
      });
    } else {
      return res.status(400).json({
        success: false,
        error: "Gemini API returned empty response"
      });
    }
  } catch (err: any) {
    let errMsg = err.message || "Invalid API key or network request failed";
    if (errMsg.toLowerCase().includes("api_key_invalid") || errMsg.toLowerCase().includes("api key not valid") || errMsg.toLowerCase().includes("unauthorized")) {
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
  const { url, token } = req.body;
  const targetUrl = (url || "http://127.0.0.1:8188").trim().replace(/\/$/, "");

  let probeUrl = `${targetUrl}/system_stats`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const headers: Record<string, string> = { "Accept": "application/json" };
    if (token && token.trim()) {
      headers["Authorization"] = `Bearer ${token.trim()}`;
    }

    const lmRes = await fetch(probeUrl, {
      method: "GET",
      headers,
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (lmRes.ok) {
      const data = await lmRes.json().catch(() => ({}));
      
      let systemInfo = "";
      if (data && data.system && data.system.os) {
        systemInfo = `OS: ${data.system.os}`;
      }
      if (data && data.devices && data.devices.length > 0) {
        const device = data.devices[0];
        if (device.name) {
          systemInfo += systemInfo ? ` | GPU: ${device.name}` : `GPU: ${device.name}`;
        }
        if (device.vram_total) {
          const vramGB = (device.vram_total / (1024 * 1024 * 1024)).toFixed(1);
          systemInfo += ` (${vramGB}GB VRAM)`;
        }
      }

      return res.json({
        success: true,
        message: `ComfyUI server responsive at ${targetUrl}`,
        systemInfo,
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

export default router;

