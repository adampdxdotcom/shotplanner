import fs from "fs";
import path from "path";
import { getSceneDirectories } from "../../config/constants";
import { TransferFileSummary } from "../../types";
import { writeAtomicSync } from "../../utils/atomicFs";
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
import { transferJobManager } from "../transferJobManager";
import {
  ensureEmptyPngExists,
  normalizeRemoteComfyRoot,
  resolveLocalAssetsForTransfer
} from "./sftpTransferHelper";
import { createScopedLogger } from "../../utils/logger";

const log = createScopedLogger("SceneBatchTransfer");

export interface SceneTransferOptions extends SSHCredentials {
  job_id?: string;
  remote_host?: string;
  remote_comfyui_root?: string;
  workflow_filename?: string;
  shots: {
    shot_number: string | number;
    shot_type?: string;
    camera_movement?: string;
    lens_focal_length?: string;
    aspect_ratio?: string;
    expanded_prompt?: string;
    prompt_node_id?: string;
    node_mappings?: Record<string, string>;
    workflow_filename?: string;
    takes?: any[];
  }[];
  scene_name?: string;
  bypass_missing?: boolean;
  safe_placeholder?: string;
  generation_parameters?: any;
  parameter_overrides?: Record<string, any>;
  parameter_node_mappings?: Record<string, string>;
}

/**
 * Collects and deduplicates assets across all shots in a scene and stages visual workflows via SFTP.
 */
export async function processSceneTransfer(options: SceneTransferOptions) {
  const {
    remote_host,
    remote_comfyui_root = "/workspace/runpod-slim/ComfyUI",
    workflow_filename,
    shots = [],
    scene_name,
    bypass_missing = true,
    safe_placeholder = "empty.png",
    generation_parameters = null,
    parameter_overrides = {},
    parameter_node_mappings = {}
  } = options;

  const targetHost = remote_host || options.host || options.runpod_ip;
  const activeSceneName = sanitizeFilenamePart(scene_name ?? "Untitled_Scene");
  log.info(`Starting batch staging for scene: "${activeSceneName}" (${shots.length} shots) to host: ${targetHost || 'None'}`);

  const { root: cleanRemoteRoot, inputDir: cleanRemoteDir } = normalizeRemoteComfyRoot(remote_comfyui_root);

  // Collect all unique assets across all shots
  const allNodeMappings: Record<string, string> = {};
  shots.forEach(shot => {
    if (shot.node_mappings) {
      Object.assign(allNodeMappings, shot.node_mappings);
    }
  });

  const fileSet = new Set<string>();
  Object.values(allNodeMappings).forEach(fname => {
    if (fname && typeof fname === "string" && fname.trim()) {
      fileSet.add(fname.trim());
    }
  });

  // Always include empty.png for bypass loader
  ensureEmptyPngExists();
  fileSet.add("empty.png");

  const filesToTransfer = Array.from(fileSet);
  const { sftpItems, missingSummary } = resolveLocalAssetsForTransfer(filesToTransfer, cleanRemoteDir);
  const transferredSummary: TransferFileSummary[] = [...missingSummary];

  // 2. Stage Visual Workflow Files for all shots
  const remoteWorkflowPaths: string[] = [];
  const updatedWorkflows: any[] = [];

  for (const shot of shots) {
    const activeWorkflowName = shot.workflow_filename || workflow_filename;

    try {
      const { resolvedFilename, rawWorkflow } = resolveWorkflowTemplate(activeWorkflowName, activeSceneName);
      const activeShotNumber = formatShotNumber(shot.shot_number ?? "1");
      const finalFilename = `${activeSceneName}_Shot_${activeShotNumber}.json`;
      
      const nextTakeNumber = (shot.takes?.length || 0) + 1;
      const resolvedSaveVideoPrefix = generateSaveVideoPrefix(activeSceneName, activeShotNumber, nextTakeNumber);
      const resolvedPromptPrefix = generatePromptPrefix({ 
        scene_name: activeSceneName, 
        shot_number: activeShotNumber, 
        shot_type: shot.shot_type, 
        camera_movement: shot.camera_movement,
        lens_focal_length: shot.lens_focal_length,
        aspect_ratio: shot.aspect_ratio
      });

      // Sanitize node mappings against missing/ghost files
      const sanitizedShotNodeMappings = { ...(shot.node_mappings || {}) };
      const missingFilenames = new Set(missingSummary.map(m => m.filename));
      if (missingFilenames.size > 0 && bypass_missing !== false) {
        for (const [nodeId, fn] of Object.entries(sanitizedShotNodeMappings)) {
          if (fn && typeof fn === "string" && missingFilenames.has(fn.trim())) {
            log.warn(`Ghost/missing asset "${fn}" in shot ${activeShotNumber} substituted with ${safe_placeholder || "empty.png"}`);
            sanitizedShotNodeMappings[nodeId] = safe_placeholder || "empty.png";
          }
        }
      }

      const updatedWorkflowJson = injectAndPrepareWorkflowData(
        rawWorkflow,
        shot.prompt_node_id,
        shot.expanded_prompt || "",
        sanitizedShotNodeMappings,
        bypass_missing,
        safe_placeholder,
        {
          ...parameter_overrides,
          ...(generation_parameters ? { steps: generation_parameters.steps, frames: generation_parameters.frames, megapixels: generation_parameters.megapixels } : {})
        },
        parameter_node_mappings,
        resolvedPromptPrefix,
        resolvedSaveVideoPrefix
      );

      updatedWorkflows.push(updatedWorkflowJson);

      const remoteWorkflowPath = `${cleanRemoteRoot}/user/default/workflows/${finalFilename}`;
      remoteWorkflowPaths.push(remoteWorkflowPath);

      // Save staged workflow version into active scene workflows directory
      const sceneWfDir = getSceneDirectories(activeSceneName).workflows;
      if (!fs.existsSync(sceneWfDir)) {
        fs.mkdirSync(sceneWfDir, { recursive: true });
      }
      const stagedPath = path.join(sceneWfDir, finalFilename);
      const wfContentStr = JSON.stringify(updatedWorkflowJson, null, 2);
      writeAtomicSync(stagedPath, wfContentStr);

      sftpItems.push({
        filename: finalFilename,
        localPath: stagedPath,
        remotePath: remoteWorkflowPath,
        sizeBytes: Buffer.byteLength(wfContentStr)
      });
      log.info(`Prepared shot ${activeShotNumber} workflow JSON -> ${remoteWorkflowPath}`);
    } catch (e: any) {
      log.error(`Failed to prepare staged workflow JSON for shot ${shot.shot_number}`, { error: e.message });
      throw new Error(`Failed to stage shot ${shot.shot_number}: ${e.message}`);
    }
  }

  // 3. Execute SFTP upload if targetHost is provided
  let transferredCount = 0;
  let skippedCount = 0;
  const uploadedFiles: string[] = [];
  const skippedFiles: string[] = [];

  const effectiveJobId = options.job_id || `scene_stage_${Date.now()}`;
  transferJobManager.startJob({
    jobId: effectiveJobId,
    action: "scene",
    sceneName: activeSceneName,
    targetHost,
    totalFiles: sftpItems.length,
    initialFiles: sftpItems.map((item) => ({
      filename: item.filename,
      sizeBytes: item.sizeBytes,
      remotePath: item.remotePath
    }))
  });

  if (targetHost && sftpItems.length > 0) {
    log.info(`Commencing SFTP batch upload of ${sftpItems.length} items (${filesToTransfer.length} assets, ${shots.length} workflows) to ${targetHost}...`);
    try {
      const sftpSummary = await executeSFTPBatchTransfer(options, sftpItems, (ev) => {
        if (ev.stage === "file_start") {
          transferJobManager.updateFileStart(
            ev.filename || "",
            ev.fileIndex || 0,
            ev.totalFiles || sftpItems.length,
            ev.fileTotalBytes || 0
          );
        } else if (ev.stage === "file_progress") {
          transferJobManager.updateFileProgress(
            ev.filename || "",
            ev.fileBytesTransferred || 0,
            ev.fileTotalBytes || 0,
            ev.filePercent || 0,
            ev.totalBytesTransferred || 0,
            ev.totalPercent || 0
          );
        } else if (ev.stage === "file_complete") {
          const item = sftpItems.find((it) => it.filename === ev.filename);
          transferJobManager.updateFileComplete(
            ev.filename || "",
            ev.fileBytesTransferred || 0,
            item?.remotePath || `${cleanRemoteDir}/${ev.filename}`,
            ev.durationMs || 0,
            ev.message
          );
        } else if (ev.stage === "file_error") {
          const item = sftpItems.find((it) => it.filename === ev.filename);
          transferJobManager.updateFileError(
            ev.filename || "",
            item?.remotePath || `${cleanRemoteDir}/${ev.filename}`,
            ev.message || "SFTP upload failed"
          );
        } else if (ev.stage === "connecting" || ev.stage === "preparing_dirs") {
          transferJobManager.updateStepMessage(ev.message || "");
        }
      });

      transferredCount = sftpSummary.transferredCount;
      uploadedFiles.push(...sftpSummary.uploadedFiles);
      skippedFiles.push(...sftpSummary.failedFiles);

      sftpSummary.transferredFiles.forEach(t => {
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
        log.error(`Scene staging failed on ${targetHost}`, { error: errDetail });
        transferJobManager.failJob(errDetail);
        throw new Error(`Scene staging failed on ${targetHost}: ${errDetail}`);
      }
    } catch (err: any) {
      transferJobManager.failJob(err.message || "Failed to stage scene via SFTP");
      throw err;
    }
  } else if (!targetHost) {
    log.info(`No remote host provided. Staged ${sftpItems.length} items locally only.`);
    sftpItems.forEach(item => {
      transferredCount++;
      uploadedFiles.push(item.filename);
      transferredSummary.push({
        filename: item.filename,
        file: item.filename,
        size_bytes: item.sizeBytes || 0,
        status: "transferred",
        remote_path: item.remotePath,
        message: "Prepared locally (No remote SSH host specified)."
      });
      transferJobManager.recordTransferredAsset({
        filename: item.filename,
        size_bytes: item.sizeBytes || 0,
        remote_path: item.remotePath,
        status: "transferred",
        scene_name: activeSceneName
      });
    });
  }

  const statusMessage = `Successfully verified and staged ${shots.length} workflow(s) and ${uploadedFiles.length} file(s) into Remote ComfyUI. Workflows in: ${cleanRemoteRoot}/user/default/workflows/`;
  log.info(statusMessage);

  const finalResult = {
    success: true,
    remote_dir: cleanRemoteDir,
    remote_workflow_paths: remoteWorkflowPaths,
    transferred_count: transferredCount,
    skipped_count: skippedCount,
    total_checked: filesToTransfer.length + shots.length,
    uploaded_files: uploadedFiles,
    transferred_assets: uploadedFiles.filter(f => !f.endsWith('.json')),
    transferred_workflows: uploadedFiles.filter(f => f.endsWith('.json')),
    workflows_created: uploadedFiles.filter(f => f.endsWith('.json')),
    staged_workflows: uploadedFiles.filter(f => f.endsWith('.json')),
    skipped_files: skippedFiles,
    transferred_files: transferredSummary,
    updated_workflows: updatedWorkflows,
    message: statusMessage
  };

  transferJobManager.completeJob(finalResult);
  return finalResult;
}
