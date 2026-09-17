import { Router, Request, Response } from "express";
import { executeWorkflow, processAssetTransfer } from "../services/executionService";

const router = Router();

router.post("/execute", async (req: Request, res: Response) => {
  try {
    const result = await executeWorkflow(req.body);
    res.json(result);
  } catch (err: any) {
    const status =
      err.message && (err.message.includes("is required") || err.message.includes("not found")) ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

// Alias for remote ComfyUI shot asset staging
router.post(["/execution/stage-shot", "/stage-shot"], async (req: Request, res: Response) => {
  try {
    console.log(`[Execution Route] POST /api/execution/stage-shot for scene "${req.body.scene_name || 'default'}"`);
    const shot = Array.isArray(req.body.shots) && req.body.shots.length > 0 ? req.body.shots[0] : null;
    const transferOptions = {
      ...req.body,
      node_mappings: shot?.node_mappings || req.body.assigned_slots || req.body.node_mappings || {},
      prompt_node_id: shot?.prompt_node_id || req.body.prompt_node_id,
      expanded_prompt: shot?.expanded_prompt || req.body.expanded_prompt,
      workflow_filename: shot?.workflow_file || shot?.workflow_filename || req.body.workflow_filename,
      shot_number: shot?.shot_number || req.body.shot_number,
      shot_type: shot?.shot_type || req.body.shot_type,
      camera_movement: shot?.camera_movement || req.body.camera_movement,
      lens_focal_length: shot?.lens_focal_length || req.body.lens_focal_length,
      aspect_ratio: shot?.aspect_ratio || req.body.aspect_ratio
    };
    const result = await processAssetTransfer(transferOptions);
    res.json(result);
  } catch (err: any) {
    console.error("[Execution Route /stage-shot ERROR]:", err);
    const status = err.message && err.message.includes("is required") ? 400 : 500;
    res.status(status).json({ error: err.message || "Failed to stage shot." });
  }
});

export default router;
