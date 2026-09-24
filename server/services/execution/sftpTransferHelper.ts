import fs from "fs";
import path from "path";
import { EMPTY_1X1_PNG_BUFFER, UPLOADS_DIR } from "../../config/constants";
import { assetService } from "../assetService";
import { TransferItem } from "../sshService";
import { TransferFileSummary } from "../../types";
import { createScopedLogger } from "../../utils/logger";

const log = createScopedLogger("SFTPHelper");

/**
 * Ensures the 1x1 transparent PNG exists locally for unassigned node bypasses.
 */
export function ensureEmptyPngExists(): string {
  const emptyPath = path.join(UPLOADS_DIR, "empty.png");
  if (!fs.existsSync(emptyPath)) {
    fs.writeFileSync(emptyPath, EMPTY_1X1_PNG_BUFFER);
  }
  return emptyPath;
}

/**
 * Resolves local file paths for given asset filenames and builds SFTP transfer items.
 */
export function resolveLocalAssetsForTransfer(
  filenames: string[],
  cleanRemoteDir: string
): { sftpItems: TransferItem[]; missingSummary: TransferFileSummary[] } {
  const sftpItems: TransferItem[] = [];
  const missingSummary: TransferFileSummary[] = [];

  for (const fname of filenames) {
    let localPath: string | null = null;
    if (fname === "empty.png") {
      localPath = ensureEmptyPngExists();
    } else {
      localPath = assetService.getAssetFilePath(fname);
      if (!localPath) {
        const directUploadPath = path.join(UPLOADS_DIR, fname);
        if (fs.existsSync(directUploadPath)) {
          localPath = directUploadPath;
        }
      }
    }

    if (!localPath || !fs.existsSync(localPath)) {
      log.warn(`Asset "${fname}" not found locally. Marking as missing.`);
      missingSummary.push({
        filename: fname,
        file: fname,
        size_bytes: 0,
        status: "missing_locally",
        remote_path: `${cleanRemoteDir}/${fname}`,
        message: "Local file not found"
      });
      continue;
    }

    const stats = fs.statSync(localPath);
    sftpItems.push({
      filename: fname,
      localPath,
      remotePath: `${cleanRemoteDir}/${fname}`,
      sizeBytes: stats.size
    });
  }

  return { sftpItems, missingSummary };
}

/**
 * Normalizes remote ComfyUI root directory paths.
 */
export function normalizeRemoteComfyRoot(remoteComfyRoot?: string): { root: string; inputDir: string } {
  const cleanRoot = (remoteComfyRoot || "/workspace/runpod-slim/ComfyUI")
    .replace(/\/input\/?$/, "")
    .replace(/\/+$/, "");
  return {
    root: cleanRoot,
    inputDir: `${cleanRoot}/input`
  };
}
