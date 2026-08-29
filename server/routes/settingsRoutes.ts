import { Router, Request, Response } from "express";
import { getStoredGeminiKey, saveGeminiKey } from "../services/geminiService";

const router = Router();

router.get("/gemini", (req: Request, res: Response) => {
  const key = getStoredGeminiKey();
  res.json({ configured: !!key, api_key: key ? key.substring(0, 5) + "..." : null });
});

router.post("/gemini", (req: Request, res: Response) => {
  const { api_key } = req.body;
  saveGeminiKey(api_key);
  res.json({ success: true });
});

export default router;
