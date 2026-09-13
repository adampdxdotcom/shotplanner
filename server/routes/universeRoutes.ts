import { Router, Request, Response } from "express";
import { universeService } from "../services/universeService";

const router = Router();

// GET all universe characters
router.get("/characters", (_req: Request, res: Response) => {
  try {
    const characters = universeService.getUniverseCharacters();
    res.json({ success: true, characters });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST create or update universe character
router.post("/characters", (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, error: "Character name is required" });
    }

    const updated = universeService.upsertUniverseCharacter(req.body);
    res.json({ success: true, character: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE universe character by name
router.delete("/characters/:name", (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    if (!name) {
      return res.status(400).json({ success: false, error: "Character name is required" });
    }

    const deleted = universeService.deleteUniverseCharacter(name);
    res.json({ success: true, deleted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST promote an asset into the universe media pool
router.post("/characters/promote-asset", (req: Request, res: Response) => {
  try {
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ success: false, error: "Filename is required" });
    }

    const result = universeService.promoteAssetToUniverse(filename);
    if (!result.success) {
      return res.status(404).json(result);
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET all universe reference media assets
router.get("/assets", (_req: Request, res: Response) => {
  try {
    const assets = universeService.getUniverseMediaAssets();
    res.json({ success: true, assets });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
