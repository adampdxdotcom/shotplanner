import { Router, Request, Response } from "express";
import { 
  sanitizeSafetyPrompt, 
  generateMultimodalFirstFrame, 
  commitFirstFrameCandidate 
} from "../services/firstFrameService";
import { processAssetTransfer } from "../services/executionService";
import { createScopedLogger } from "../utils/logger";

const log = createScopedLogger("FirstFrameRoute");
const router = Router();

/**
 * Pre-flight safety prompt check / Hollywood stunt translation
 */
router.post("/sanitize-prompt", async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    const result = await sanitizeSafetyPrompt(prompt || "");
    res.json(result);
  } catch (err: any) {
    log.error("Failed to sanitize prompt", { error: err?.message || err });
    res.status(500).json({ error: err.message || "Failed to sanitize prompt." });
  }
});

/**
 * Multimodal generation of Frame 0 candidates using Gemini Flash Image
 */
router.post("/generate", async (req: Request, res: Response) => {
  try {
    const { 
      prompt, 
      actorImage, 
      wardrobeImage, 
      locationImage, 
      aspectRatio, 
      candidateCount, 
      sceneName, 
      shotNumber 
    } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: "Director staging prompt is required for First Frame generation." });
    }

    log.info(`Generating first frame candidates for shot ${shotNumber || 1} in scene ${sceneName || "scene01"}`);

    const result = await generateMultimodalFirstFrame({
      prompt,
      actorImage,
      wardrobeImage,
      locationImage,
      aspectRatio: aspectRatio || "16:9",
      candidateCount: candidateCount ? parseInt(String(candidateCount)) : 2,
      sceneName: sceneName || "scene01",
      shotNumber: shotNumber ? parseInt(String(shotNumber)) : 1
    });

    res.json(result);
  } catch (err: any) {
    log.error("Failed to generate first frame candidates", { error: err?.message || err });
    res.status(500).json({ 
      error: err.message || "Failed to generate first frame candidates.",
      blockedByFilter: err.message?.toLowerCase().includes("safety") || err.message?.toLowerCase().includes("blocked")
    });
  }
});

/**
 * Commits chosen candidate to scene assets and returns FirstFrame definition
 */
router.post("/accept", async (req: Request, res: Response) => {
  try {
    const { base64, sceneName, shotNumber, aspectRatio, promptUsed } = req.body;

    if (!base64) {
      return res.status(400).json({ error: "Candidate base64 image data is required." });
    }

    const saved = await commitFirstFrameCandidate({
      base64,
      sceneName: sceneName || "scene01",
      shotNumber: shotNumber ? parseInt(String(shotNumber)) : 1,
      aspectRatio: aspectRatio || "16:9",
      promptUsed
    });

    res.json({
      success: true,
      asset: saved.asset,
      first_frame: {
        source: "generated_staging",
        asset_filename: saved.filename,
        aspect_ratio: aspectRatio || "16:9",
        locked: true,
        updated_at: new Date().toISOString(),
        notes: `Generated from director staging prompt: ${(promptUsed || "").slice(0, 80)}`
      }
    });
  } catch (err: any) {
    log.error("Failed to accept and save first frame candidate", { error: err?.message || err });
    res.status(500).json({ error: err.message || "Failed to accept and save first frame candidate." });
  }
});

/**
 * Local Fallback: Routes references and prompt directly to ComfyUI staging/queue
 */
router.post("/send-to-comfy", async (req: Request, res: Response) => {
  try {
    const { 
      sceneName, 
      shotNumber, 
      prompt, 
      actorFilename, 
      wardrobeFilename, 
      locationFilename, 
      aspectRatio 
    } = req.body;

    const nodeMappings: Record<string, string> = {};
    if (actorFilename) nodeMappings["actor_reference"] = actorFilename;
    if (wardrobeFilename) nodeMappings["wardrobe_reference"] = wardrobeFilename;
    if (locationFilename) nodeMappings["location_reference"] = locationFilename;

    const transferResult = await processAssetTransfer({
      scene_name: sceneName || "scene01",
      shot_number: shotNumber || 1,
      expanded_prompt: prompt,
      node_mappings: nodeMappings,
      aspect_ratio: aspectRatio || "16:9"
    });

    res.json({
      success: true,
      message: `Shot ${shotNumber} references and prompt staged to local ComfyUI.`,
      result: transferResult
    });
  } catch (err: any) {
    log.error("Failed to stage to local ComfyUI", { error: err?.message || err });
    res.status(500).json({ error: err.message || "Failed to stage to local ComfyUI." });
  }
});

export default router;
