import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { ASSETS_DIR, LEGACY_UPLOADS_DIR, initDirectories } from "./server/config/constants";
import assetRoutes, { serveAssetFile, serveThumbnailFile } from "./server/routes/assetRoutes";
import executionRoutes from "./server/routes/executionRoutes";
import projectRoutes from "./server/routes/projectRoutes";
import promptRoutes from "./server/routes/promptRoutes";
import settingsRoutes from "./server/routes/settingsRoutes";
import sshRoutes, { handleAssetTransfer, handleSceneTransferController } from "./server/routes/sshRoutes";
import workflowRoutes from "./server/routes/workflowRoutes";

import outputRoutes from "./server/routes/outputRoutes";
import headshotRoutes from "./server/routes/headshotRoutes";
import civitaiRoutes from "./server/routes/civitaiRoutes";
import modelHubRoutes from "./server/routes/modelHubRoutes";

// Re-export utility functions for external consumers
export {
  assembleFinalPrompt,
  formatShotNumber,
  generatePromptPrefix,
  generateSaveVideoPrefix,
  hasSceneReferencePhoto,
  sanitizeFilenamePart,
  sanitizeSlug
} from "./server/utils/formatters";

// Initialize runtime filesystem directories
initDirectories();

const app = express();
const PORT = 3000;

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Body parser middlewares
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Domain API routes
app.use("/api/settings", settingsRoutes);
app.use("/api/civitai", civitaiRoutes);
app.use("/api/model-hub", modelHubRoutes);
app.use("/api/workflows", workflowRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/ssh", sshRoutes);
app.use("/api", promptRoutes);
app.use("/api", executionRoutes);
app.use("/api", outputRoutes);
app.use("/api/headshots", headshotRoutes);

// Compatibility aliases for remote sync and staging
app.post("/api/assets/sync_remote", handleAssetTransfer);
app.post("/api/workflow/stage", handleAssetTransfer);
app.post("/api/workflow/stage-shot", handleSceneTransferController);
app.post("/api/workflow/stage-single", handleSceneTransferController);
app.post("/api/workflow/stage-scene", handleSceneTransferController);

// Direct thumbnail serving fallback routes
app.get([
  "/api/uploads/thumb/:filename",
  "/uploads/thumb/:filename",
  "/api/assets/thumb/:filename",
  "/assets/thumb/:filename"
], serveThumbnailFile);

// Direct file serving fallback routes
app.get([
  "/api/uploads/:filename",
  "/uploads/:filename",
  "/assets/uploads/:filename"
], serveAssetFile);

// Static asset directories
app.use("/assets/uploads", express.static(LEGACY_UPLOADS_DIR));
app.use("/uploads", express.static(LEGACY_UPLOADS_DIR));
app.use("/api/uploads", express.static(LEGACY_UPLOADS_DIR));
app.use("/assets", express.static(ASSETS_DIR));
app.use("/user_assets", express.static(ASSETS_DIR));

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error("Server error:", err);
  res.status(500).json({ error: err?.message || "Internal server error" });
});

// Application bootstrap and Vite frontend integration
async function startServer() {
  try {
    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa"
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req: Request, res: Response) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
