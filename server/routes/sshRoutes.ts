import { Router, Request, Response } from "express";
import { generateEd25519OpenSSH } from "../utils/crypto";
import { processAssetTransfer, processSceneTransfer } from "../services/executionService";
import { testSSHConnection } from "../services/sshService";
import { saveStoredRemoteSettings } from "../services/remoteSettingsService";
import { createScopedLogger } from "../utils/logger";

const log = createScopedLogger("SSHRoute");
const router = Router();

// Generate Ed25519 OpenSSH Keypair
router.post("/generate_keypair", (req: Request, res: Response) => {
  try {
    const keyPair = generateEd25519OpenSSH();
    saveStoredRemoteSettings({
      ssh_private_key: keyPair.private_key,
      ssh_public_key: keyPair.public_key
    });
    res.json(keyPair);
  } catch (err: any) {
    log.error("SSH Key generation failed", { error: err?.message || err });
    res.status(500).json({ error: err.message || "Failed to generate SSH key pair" });
  }
});

// Test SSH connection parameters & ComfyUI input directory readiness
router.post("/test", async (req: Request, res: Response) => {
  try {
    const result = await testSSHConnection(req.body);
    res.json(result);
  } catch (err: any) {
    log.error("SSH Route Test failed", { error: err?.message || err });
    res.json({
      success: false,
      message: err.message || "Failed to establish SSH connection to remote host."
    });
  }
});

// SFTP Asset Transfer & Workflow Staging Handler
export const handleAssetTransfer = async (req: Request, res: Response) => {
  try {
    const result = await processAssetTransfer(req.body);
    return res.json(result);
  } catch (err: any) {
    const status = err.message && err.message.includes("is required") ? 400 : 500;
    return res.status(status).json({ error: err.message || "Failed to transfer assets via SSH." });
  }
};

export const handleSceneTransferController = async (req: Request, res: Response) => {
  try {
    const result = await processSceneTransfer(req.body);
    return res.json(result);
  } catch (err: any) {
    const status = err.message && err.message.includes("is required") ? 400 : 500;
    return res.status(status).json({ error: err.message || "Failed to transfer scene via SSH." });
  }
};

router.post("/transfer", handleAssetTransfer);
router.post("/transfer-scene", handleSceneTransferController);

export default router;
