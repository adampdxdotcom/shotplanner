import { Router, Request, Response } from "express";
import { expandPrompt } from "../services/llm_service";

const router = Router();

router.post(["/generate-prompt", "/llm/expand"], async (req: Request, res: Response) => {
  try {
    const result = await expandPrompt(req.body);
    res.json(result);
  } catch (err: any) {
    const status = err.message && err.message.includes("is required") ? 400 : 500;
    res.status(status).json({ error: err.message || "Failed to generate prompt" });
  }
});

export default router;
