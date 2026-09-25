import { Router, Request, Response } from "express";
import {
  getAllSystemLoras,
  saveSystemLora,
  deleteSystemLora,
  checkRemoteLoraStatus,
  transferLoraToRemote,
  SystemLora
} from "../services/loraService";
import { createScopedLogger } from "../utils/logger";

const log = createScopedLogger("LoraRoute");
const router = Router();

/**
 * GET /api/loras
 * List all registered system-level LoRAs and favorites
 */
router.get("/", (req: Request, res: Response) => {
  try {
    const loras = getAllSystemLoras();
    const query = (req.query.q || req.query.search || "").toString().toLowerCase().trim();
    const baseModel = (req.query.base_model || "").toString().toLowerCase().trim();

    let filtered = loras;
    if (query) {
      filtered = filtered.filter(l =>
        l.name.toLowerCase().includes(query) ||
        l.filename.toLowerCase().includes(query) ||
        (l.trigger_words && l.trigger_words.some(t => t.toLowerCase().includes(query))) ||
        (l.description && l.description.toLowerCase().includes(query))
      );
    }

    if (baseModel) {
      filtered = filtered.filter(l =>
        (l.base_model || "").toLowerCase().includes(baseModel)
      );
    }

    return res.json({
      success: true,
      loras: filtered,
      total_count: loras.length,
      filtered_count: filtered.length
    });
  } catch (err: any) {
    log.error("List LoRAs Error", { error: err?.message || err });
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to retrieve system LoRAs."
    });
  }
});

/**
 * POST /api/loras
 * Register or update a system-level LoRA
 */
router.post("/", (req: Request, res: Response) => {
  try {
    const payload = req.body || {};
    if (!payload.name || !payload.filename) {
      return res.status(400).json({
        success: false,
        error: "LoRA 'name' and 'filename' are required."
      });
    }

    const saved = saveSystemLora(payload);
    return res.json({
      success: true,
      lora: saved,
      message: `Successfully saved system LoRA '${saved.name}'`
    });
  } catch (err: any) {
    log.error("Save LoRA Error", { error: err?.message || err });
    return res.status(400).json({
      success: false,
      error: err.message || "Failed to save system LoRA."
    });
  }
});

/**
 * PUT /api/loras/:id
 * Update an existing system LoRA
 */
router.put("/:id", (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const payload = { ...req.body, id };
    const saved = saveSystemLora(payload);
    return res.json({
      success: true,
      lora: saved,
      message: `Successfully updated system LoRA '${saved.name}'`
    });
  } catch (err: any) {
    log.error("Update LoRA Error", { error: err?.message || err });
    return res.status(400).json({
      success: false,
      error: err.message || "Failed to update system LoRA."
    });
  }
});

/**
 * DELETE /api/loras/:id
 * Remove a system-level LoRA
 */
router.delete("/:id", (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const removed = deleteSystemLora(id);
    return res.json({
      success: true,
      removed,
      id,
      message: removed ? `Removed system LoRA '${id}'` : `System LoRA '${id}' not found`
    });
  } catch (err: any) {
    log.error("Delete LoRA Error", { error: err?.message || err });
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to delete system LoRA."
    });
  }
});

/**
 * POST /api/loras/remote-status
 * Check if LoRAs exist on the remote ComfyUI GPU host in models/loras/
 */
router.post("/remote-status", async (req: Request, res: Response) => {
  try {
    const { creds, filenames } = req.body || {};
    const report = await checkRemoteLoraStatus(creds, filenames);
    return res.json(report);
  } catch (err: any) {
    log.error("Check Remote LoRA Status Error", { error: err?.message || err });
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to probe remote GPU for LoRAs."
    });
  }
});

/**
 * POST /api/loras/transfer-remote
 * Download / transfer a LoRA to remote ComfyUI host models/loras/
 */
router.post("/transfer-remote", async (req: Request, res: Response) => {
  try {
    const options = req.body || {};
    const result = await transferLoraToRemote(options);
    return res.json(result);
  } catch (err: any) {
    log.error("Transfer LoRA Error", { error: err?.message || err });
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to transfer LoRA to remote GPU."
    });
  }
});

export default router;
