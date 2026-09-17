import { Router, Request, Response } from "express";
import { expandPrompt, buildDefaultSystemPrompt } from "../services/llm_service";
import { generateVisionCaption } from "../services/visionCaptionService";
import { parseSceneSketch } from "../services/sceneSketchService";

const router = Router();

// Dedicated scene sketch text parser to break raw script beats into structured shots
router.post(["/llm/parse-scene-sketch", "/scene-sketch/parse"], async (req: Request, res: Response) => {
  try {
    const {
      sketch_text,
      sketchText,
      text,
      lm_studio_url,
      lmStudioUrl,
      model,
      provider,
      temperature,
      max_tokens,
      clean_import,
      cleanImport
    } = req.body || {};

    const resolvedText = sketch_text || sketchText || text;

    if (!resolvedText || !resolvedText.trim()) {
      return res.status(400).json({ error: "Missing scene sketch text. Please provide 'sketch_text'." });
    }

    const result = await parseSceneSketch({
      sketch_text: resolvedText,
      lm_studio_url: lm_studio_url || lmStudioUrl,
      model,
      provider,
      temperature,
      max_tokens,
      clean_import: Boolean(clean_import ?? cleanImport)
    });

    res.json(result);
  } catch (err: any) {
    console.error("[Scene Sketch Parse Error]:", err?.message || err);
    res.status(500).json({ error: err.message || "Failed to parse scene sketch into shots." });
  }
});

router.post(["/generate-prompt", "/llm/expand"], async (req: Request, res: Response) => {
  try {
    const result = await expandPrompt(req.body);
    res.json(result);
  } catch (err: any) {
    const status = err.message && err.message.includes("is required") ? 400 : 500;
    res.status(status).json({ error: err.message || "Failed to generate prompt" });
  }
});

// Dedicated vision captioning endpoint for reference assets and thumbnails
router.post(["/llm/caption", "/caption"], async (req: Request, res: Response) => {
  try {
    const { 
      thumbnailPath, 
      thumbnail_path,
      imageBase64, 
      image_base64,
      image,
      contextType, 
      context_type,
      subjectName, 
      subject_name,
      lm_studio_url,
      lmStudioUrl,
      model 
    } = req.body || {};

    const resolvedThumbnailPath = thumbnailPath || thumbnail_path;
    const resolvedImageBase64 = imageBase64 || image_base64 || image;

    if (!resolvedThumbnailPath && !resolvedImageBase64) {
      return res.status(400).json({ 
        error: "Missing image source: provide either 'thumbnailPath' or 'imageBase64'" 
      });
    }

    const result = await generateVisionCaption({
      thumbnailPath: resolvedThumbnailPath,
      imageBase64: resolvedImageBase64,
      contextType: contextType || context_type || "asset",
      subjectName: subjectName || subject_name || "",
      lm_studio_url: lm_studio_url || lmStudioUrl,
      model
    });

    res.json(result);
  } catch (err: any) {
    console.error("[Vision Caption Error]:", err?.message || err);
    res.status(500).json({ 
      error: err?.message || "Failed to generate visual caption" 
    });
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
