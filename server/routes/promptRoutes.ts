import { Router, Request, Response } from "express";
import { expandPrompt, buildDefaultSystemPrompt } from "../services/llm_service";

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

router.get(["/llm/template", "/prompt/template"], (req: Request, res: Response) => {
  try {
    const defaultTemplate = buildDefaultSystemPrompt();
    res.json({
      default_system_prompt: defaultTemplate,
      default_temperature: 0.45,
      default_max_tokens: 800,
      supported_variables: [
        { name: "{{LENS}}", description: "Currently selected camera lens (e.g. 50mm standard prime)" },
        { name: "{{ASPECT_RATIO}}", description: "Selected aspect ratio / canvas (e.g. 2.39:1 Anamorphic)" },
        { name: "{{CAMERA_CONSTRAINT}}", description: "Dynamic camera motion rule (e.g. Locked off static vs. Pan)" }
      ]
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to get prompt template" });
  }
});

export default router;
