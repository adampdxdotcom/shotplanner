import { Router, Request, Response } from "express";
import { chatWithAssistant } from "../services/assistantService";
import { getStoredGeminiKey } from "../services/geminiService";

const router = Router();

/**
 * POST /api/assistant/chat
 * Handles conversational queries with the Production Assistant, injecting live project context.
 */
router.post("/chat", async (req: Request, res: Response) => {
  try {
    const {
      messages,
      scene_project,
      active_shot_id,
      active_section,
      lm_studio_url,
      provider,
      model,
      temperature,
      max_tokens
    } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Missing required 'messages' array in request body." });
    }

    const effectiveLmStudioUrl = lm_studio_url || "http://localhost:1234/v1";
    const effectiveProvider = provider || (getStoredGeminiKey() ? "gemini" : "local");

    const result = await chatWithAssistant({
      messages,
      scene_project,
      active_shot_id,
      active_section,
      lm_studio_url: effectiveLmStudioUrl,
      provider: effectiveProvider,
      model,
      temperature,
      max_tokens
    });

    res.json(result);
  } catch (err: any) {
    console.error("[Assistant Chat Error]:", err?.message || err);
    res.status(500).json({ error: err?.message || "Failed to process assistant chat request." });
  }
});

export default router;
