import { Router, Request, Response } from "express";
import multer from "multer";
import { generateVariations, saveSelectedVariations, HEADSHOT_TEMPLATES } from "../services/headshotService";
import { assetService } from "../services/assetService";
import fs from "fs";
import path from "path";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Expose templates to the client if they want to display them
router.get("/templates", (req: Request, res: Response) => {
  res.json({ templates: Object.keys(HEADSHOT_TEMPLATES) });
});

router.post("/generate", upload.single("image"), async (req: Request, res: Response) => {
  try {
    const characterName = req.body.characterName;
    const aspectRatio = req.body.aspectRatio || "1:1";
    let variationKeys: string[] = [];
    
    if (Array.isArray(req.body.variationKeys)) {
      variationKeys = req.body.variationKeys;
    } else if (typeof req.body.variationKeys === "string") {
      try {
        variationKeys = JSON.parse(req.body.variationKeys || "[]");
      } catch(e) {
        return res.status(400).json({ error: "Invalid variationKeys format. Must be a JSON array of strings." });
      }
    }

    if (!characterName) {
      return res.status(400).json({ error: "characterName is required" });
    }
    
    if (!variationKeys || variationKeys.length === 0) {
      return res.status(400).json({ error: "At least one variation key is required" });
    }

    let imageBase64 = "";
    let imageMimeType = "image/png";

    if (req.file) {
      imageBase64 = req.file.buffer.toString("base64");
      imageMimeType = req.file.mimetype;
    } else if (req.body.imageBase64) {
      imageBase64 = req.body.imageBase64;
      imageMimeType = req.body.imageMimeType || "image/png";
    } else if (req.body.existingAssetFilename) {
      const assetPath = assetService.getAssetFilePath(req.body.existingAssetFilename);
      if (!assetPath || !fs.existsSync(assetPath)) {
        return res.status(404).json({ error: "Asset not found" });
      }
      const buffer = fs.readFileSync(assetPath);
      imageBase64 = buffer.toString("base64");
      // basic mime type guess
      imageMimeType = assetPath.endsWith(".jpg") || assetPath.endsWith(".jpeg") ? "image/jpeg" : "image/png";
    } else {
      return res.status(400).json({ error: "An image file, imageBase64, or existingAssetFilename is required" });
    }

    const results = await generateVariations(
      imageBase64,
      imageMimeType,
      characterName,
      aspectRatio,
      variationKeys
    );

    res.json({ results });
  } catch (error: any) {
    console.error("Error generating headshots:", error);
    res.status(500).json({ error: error.message || "Failed to generate headshots" });
  }
});

router.post("/save-selected", async (req: Request, res: Response) => {
  try {
    const { selections, characterName, sceneName, activeSceneName, tags } = req.body;
    const targetScene = sceneName || activeSceneName;

    if (!selections || !Array.isArray(selections) || selections.length === 0) {
      return res.status(400).json({ error: "selections array is required" });
    }
    if (!characterName) {
      return res.status(400).json({ error: "characterName is required" });
    }
    if (!targetScene) {
      return res.status(400).json({ error: "sceneName is required" });
    }

    const savedRecords = await saveSelectedVariations(selections, characterName, targetScene, tags);

    res.json({ success: true, savedAssets: savedRecords });
  } catch (error: any) {
    console.error("Error saving selected headshots:", error);
    res.status(500).json({ error: error.message || "Failed to save selected headshots" });
  }
});

export default router;
