import fs from "fs";
import path from "path";
import { getSceneDirectories } from "../../config/constants";
import { ScenePlanningDTO, TransferFileSummary } from "../../types";
import {
  generatePromptPrefix,
  generateSaveVideoPrefix,
  sanitizeFilenamePart,
  formatShotNumber
} from "../../utils/formatters";
import {
  injectAndPrepareWorkflowData,
  resolveWorkflowTemplate
} from "../workflowService";
import { executeSFTPBatchTransfer, SSHCredentials, TransferItem } from "../sshService";
import {
  ensureEmptyPngExists,
  normalizeRemoteComfyRoot,
  resolveLocalAssetsForTransfer
} from "./sftpTransferHelper";

export interface AssetTransferOptions extends SSHCredentials {
  take_number?: string | number;
  remote_host?: string;
  ssh_port?: number;
  ssh_username?: string;
  ssh_password?: string;
  ssh_key_path?: string;
  ssh_private_key?: string;
  remote_comfyui_root?: string;
  workflow_filename?: string;
  output_workflow_filename?: string;
  prompt_node_id?: string;
  expanded_prompt?: string;
  prompt_prefix?: string;
  save_video_prefix?: string;
  scene_name?: string;
  shot_number?: string | number;
  shot_type?: string;
  camera_movement?: string;
  lens_focal_length?: string;
  aspect_ratio?: string;
  scene_planning?: ScenePlanningDTO;
  planning?: ScenePlanningDTO;
  node_mappings?: Record<string, string>;
  filenames?: string[];
  bypass_missing?: boolean;
  safe_placeholder?: string;
  generation_parameters?: any;
  parameter_overrides?: Record<string, any>;
  parameter_node_mappings?: Record<string, string>;
}

/**
 * Handles asset resolution, visual workflow AST preparation, and single-shot SFTP transfer to remote ComfyUI.
 */
export async function processAssetTransfer(options: AssetTransferOptions) {
  const {
    remote_host,
    remote_comfyui_root = "/workspace/runpod-slim/ComfyUI",
    workflow_filename,
    output_workflow_filename,
    prompt_node_id,
    expanded_prompt,
    prompt_prefix = "",
    save_video_prefix = "",
    scene_name,
    shot_number,
    shot_type,
    camera_movement,
    lens_focal_length,
    aspect_ratio,
    scene_planning,
    planning,
    node_mappings = {},
    filenames = [],
    bypass_missing = true,
    safe_placeholder = "empty.png",
    generation_parameters = null,
    parameter_overrides = {},
    parameter_node_mappings = {}
  } = options;

  const targetHost = remote_host || options.host || options.runpod_ip;
  console.log(`[SSH Staging] Initiating asset staging for scene: "${scene_name || 'default'}" (Host: ${targetHost || 'None'})`);

  const resolvedSaveVideoPrefix =
    save_video_prefix ||
    generateSaveVideoPrefix(
      scene_name ?? scene_planning?.scene_name ?? planning?.scene_name,
      shot_number ?? scene_planning?.shot_number ?? planning?.shot_number,
      options.take_number
    );

  const resolvedPromptPrefix =
    (prompt_prefix || "").trim() ||
    generatePromptPrefix(scene_planning || planning || { 
      scene_name, 
      shot_number, 
      shot_type, 
      camera_movement,
      lens_focal_length,
      aspect_ratio
    });

  if (!targetHost) {
    throw new Error("Remote GPU Host / IP is required for remote transfer.");
  }

  // 1. Collect ONLY assigned slot assets across all active input slots
  const fileSet = new Set<string>();
  Object.values(node_mappings).forEach((f: any) => {
    if (f && typeof f === "string" && f.trim()) {
      fileSet.add(f.trim());
    }
  });

  if (Array.isArray(filenames) && filenames.length > 0) {
    filenames.forEach((f) => {
      if (f && typeof f === "string" && f.trim()) {
        fileSet.add(f.trim());
      }
    });
  }

  // Always ensure empty.png is present for unassigned loaders
  ensureEmptyPngExists();
  fileSet.add("empty.png");

  const { root: cleanRemoteRoot, inputDir: cleanRemoteDir } = normalizeRemoteComfyRoot(remote_comfyui_root);
  const { sftpItems, missingSummary } = resolveLocalAssetsForTransfer(Array.from(fileSet), cleanRemoteDir);
  const transferredSummary: TransferFileSummary[] = [...missingSummary];

  // 2. Stage Visual Workflow File
  let stagedWorkflowFilename: string | undefined = undefined;
  let remoteWorkflowPath: string | undefined = undefined;
  let updatedWorkflowJson: any = null;
  let baseTemplateUsed: string = workflow_filename || "minimax_video_workflow.json";

  const activeSceneName = sanitizeFilenamePart(
    scene_name ?? scene_planning?.scene_name ?? planning?.scene_name ?? "Untitled_Scene"
  );

  try {
    const { resolvedFilename, rawWorkflow } = resolveWorkflowTemplate(workflow_filename, activeSceneName);
    baseTemplateUsed = resolvedFilename;

    updatedWorkflowJson = injectAndPrepareWorkflowData(
      rawWorkflow,
      prompt_node_id,
      expanded_prompt || "",
      node_mappings,
      bypass_missing,
      safe_placeholder,
      {
        ...parameter_overrides,
        ...(generation_parameters
          ? {
              steps: generation_parameters.steps,
              frames: generation_parameters.frames,
              megapixels: generation_parameters.megapixels
            }
          : {})
      },
      parameter_node_mappings,
      resolvedPromptPrefix,
      resolvedSaveVideoPrefix
    );

    // Determine final filename and remote path
    const activeShotNum = shot_number ?? scene_planning?.shot_number ?? planning?.shot_number;
    const defaultShotFilename =
      activeShotNum !== undefined && activeShotNum !== null && activeShotNum !== ""
        ? `${activeSceneName}_Shot_${formatShotNumber(activeShotNum)}.json`
        : (workflow_filename && !["default.json", "default"].includes(workflow_filename) ? workflow_filename : `${activeSceneName}_workflow.json`);

    const finalFilename = output_workflow_filename || defaultShotFilename;
    remoteWorkflowPath = `${cleanRemoteRoot}/user/default/workflows/${finalFilename}`;

    // Save staged workflow version into active scene workflows directory locally
    const sceneWfDir = getSceneDirectories(activeSceneName).workflows;
    if (!fs.existsSync(sceneWfDir)) {
      fs.mkdirSync(sceneWfDir, { recursive: true });
    }
    const stagedPath = path.join(sceneWfDir, finalFilename);
    const wfContentStr = JSON.stringify(updatedWorkflowJson, null, 2);
    fs.writeFileSync(stagedPath, wfContentStr);
    stagedWorkflowFilename = finalFilename;

    // Add workflow JSON to remote transfer queue
    sftpItems.push({
      filename: finalFilename,
      localPath: stagedPath,
      remotePath: remoteWorkflowPath,
      sizeBytes: Buffer.byteLength(wfContentStr)
    });
    console.log(`[SSH Staging] Prepared workflow JSON "${finalFilename}" (from template "${resolvedFilename}") for remote staging at ${remoteWorkflowPath}`);
  } catch (wfErr: any) {
    console.error("[SSH Staging ERROR] Failed to resolve and prepare workflow JSON:", wfErr.message);
    throw new Error(`Failed to stage workflow: ${wfErr.message}`);
  }

  // 3. Perform real SFTP file transfers to remote ComfyUI instance
  let transferredCount = 0;
  let skippedCount = 0;
  const uploadedFiles: string[] = [];
  const skippedFiles: string[] = [];

  if (sftpItems.length > 0) {
    console.log(`[SSH Staging] Starting SFTP transfer of ${sftpItems.length} file(s) to ${targetHost}...`);
    const sftpSummary = await executeSFTPBatchTransfer(options, sftpItems);

    transferredCount = sftpSummary.transferredCount;
    uploadedFiles.push(...sftpSummary.uploadedFiles);
    skippedFiles.push(...sftpSummary.failedFiles);

    sftpSummary.transferredFiles.forEach((t) => {
      transferredSummary.push({
        filename: t.filename,
        file: t.filename,
        size_bytes: t.size_bytes,
        status: t.status as any,
        remote_path: t.remote_path,
        message: t.message
      });
    });

    if (!sftpSummary.success || sftpSummary.failedCount > 0) {
      const errDetail = sftpSummary.error || `Failed files: ${sftpSummary.failedFiles.join(", ")}`;
      console.error(`[SSH Staging Failed] ${errDetail}`);
      throw new Error(`Remote staging failed on ${targetHost}: ${errDetail}`);
    }
  }

  const statusMessage = `Successfully verified and staged workflow '${stagedWorkflowFilename}' + ${uploadedFiles.length} file(s) into Remote ComfyUI. Workflow at: ${remoteWorkflowPath}`;
  console.log(`[SSH Staging Complete] ${statusMessage}`);

  const effectiveStagedFilename = stagedWorkflowFilename || output_workflow_filename || workflow_filename;
  return {
    success: true,
    remote_dir: cleanRemoteDir,
    remote_workflow_path: remoteWorkflowPath,
    remote_workflow_paths: remoteWorkflowPath ? [remoteWorkflowPath] : [],
    staged_workflow_filename: effectiveStagedFilename,
    staged_workflow_filenames: effectiveStagedFilename ? [effectiveStagedFilename] : [],
    base_template_used: baseTemplateUsed,
    save_video_prefix: resolvedSaveVideoPrefix,
    transferred_count: transferredCount,
    skipped_count: skippedCount,
    total_checked: fileSet.size + (stagedWorkflowFilename ? 1 : 0),
    uploaded_files: uploadedFiles,
    skipped_files: skippedFiles,
    transferred_files: transferredSummary,
    updated_workflow_json: updatedWorkflowJson,
    message: statusMessage
  };
}
