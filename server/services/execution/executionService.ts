import path from "path";
import { ExecutionStepLog, ScenePlanningDTO } from "../../types";
import {
  generatePromptPrefix,
  generateSaveVideoPrefix,
  sanitizeFilenamePart,
  formatShotNumber
} from "../../utils/formatters";
import {
  injectAndPrepareWorkflowData,
  parseWorkflowData,
  convertWorkflowToApiPrompt,
  resolveWorkflowTemplate
} from "../workflowService";
import { queuePromptToRemoteComfy } from "../remoteComfyService";
import { processAssetTransfer, AssetTransferOptions } from "./shotStagingService";

export { processAssetTransfer } from "./shotStagingService";
export type { AssetTransferOptions } from "./shotStagingService";
export { processSceneTransfer } from "./sceneBatchTransferService";
export type { SceneTransferOptions } from "./sceneBatchTransferService";

export interface ExecuteWorkflowOptions {
  take_number?: string | number;
  remote_host?: string;
  ssh_port?: number;
  ssh_username?: string;
  ssh_password?: string;
  ssh_key_path?: string;
  ssh_private_key?: string;
  remote_comfyui_root?: string;
  comfyui_api_url?: string;
  remote_api_token?: string;
  workflow_filename: string;
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
  bypass_missing?: boolean;
  safe_placeholder?: string;
  parameter_overrides?: Record<string, any>;
  parameter_node_mappings?: Record<string, string>;
  generation_parameters?: any;
  dry_run_only?: boolean;
  client_id?: string;
  stage_assets_first?: boolean;
}

/**
 * Orchestrates ComfyUI workflow resolution, parameter injection, optional SFTP staging, and prompt execution.
 */
export async function executeWorkflow(options: ExecuteWorkflowOptions) {
  const {
    remote_host,
    ssh_port = 22,
    ssh_username = "root",
    remote_comfyui_root = "/workspace/runpod-slim/ComfyUI",
    comfyui_api_url = "http://127.0.0.1:8188",
    remote_api_token,
    workflow_filename,
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
    bypass_missing = true,
    safe_placeholder = "empty.png",
    parameter_overrides = {},
    parameter_node_mappings = {},
    generation_parameters = null,
    dry_run_only = false,
    client_id = "comfyui-bridge-session",
    stage_assets_first = false
  } = options;

  const cleanScene = sanitizeFilenamePart(scene_name ?? scene_planning?.scene_name ?? planning?.scene_name ?? "Scene");
  const rawShotNum = shot_number ?? scene_planning?.shot_number ?? planning?.shot_number ?? "1";
  const formattedShot = formatShotNumber(rawShotNum);

  const calculatedTake = options.take_number ?? (
    (options.planning as any)?.takes?.length ? Math.max(...(options.planning as any).takes.map((t: any) => t.take_number || 0)) + 1 : 1
  );

  const resolvedSaveVideoPrefix =
    save_video_prefix ||
    generateSaveVideoPrefix(
      cleanScene,
      formattedShot,
      calculatedTake
    );

  const expectedVideoFilename = `${cleanScene}_Shot_${formattedShot}_Take_${calculatedTake}.mp4`;

  const resolvedPromptPrefix =
    (prompt_prefix || "").trim() ||
    generatePromptPrefix(scene_planning || planning || { 
      scene_name: cleanScene, 
      shot_number: formattedShot, 
      shot_type, 
      camera_movement,
      lens_focal_length,
      aspect_ratio
    });

  // Robust workflow resolution: check explicit filename, monitored_workflow, or conventional shot workflow
  let resolvedWorkflowFilename = (
    workflow_filename ||
    (options as any).monitored_workflow ||
    (options as any).workflow_file ||
    `${cleanScene}_Shot_${formattedShot}.json`
  );

  // If path was passed (e.g. /workspace/.../nina_doll_Shot_07.json), extract basename
  if (resolvedWorkflowFilename.includes("/")) {
    resolvedWorkflowFilename = path.basename(resolvedWorkflowFilename);
  }

  // Resolve template using resilient workflow resolver
  const { resolvedFilename, rawWorkflow: workflow } = resolveWorkflowTemplate(
    resolvedWorkflowFilename,
    cleanScene
  );
  resolvedWorkflowFilename = resolvedFilename;

  const modifiedWf = injectAndPrepareWorkflowData(
    workflow,
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

  // Convert to ComfyUI API Prompt format for direct execution
  const apiPrompt = convertWorkflowToApiPrompt(modifiedWf);

  const stepsLog: ExecutionStepLog[] = [];
  const parsedOriginal = parseWorkflowData(workflow);

  // Step B: Load selected workflow
  stepsLog.push({
    step: "B",
    title: "Workflow Loaded",
    status: "success",
    detail: `Parsed '${resolvedWorkflowFilename}' (${parsedOriginal.totalNodes} nodes). Prepared API prompt graph.`
  });

  // Step C: Summary
  stepsLog.push({
    step: "C",
    title: "Prompt, Assets & Parameters Injected",
    status: "success",
    detail: `Injected expanded prompt into Node #${prompt_node_id || "Auto"}, mapped ${
      Object.keys(node_mappings).length
    } active asset slot(s). ${
      resolvedSaveVideoPrefix ? `SaveVideo filename prefix set to '${resolvedSaveVideoPrefix}'.` : ""
    }`
  });

  // If Dry Run requested, return immediately
  if (dry_run_only) {
    return {
      success: true,
      dry_run: true,
      take_number: calculatedTake,
      expected_video_filename: expectedVideoFilename,
      steps: stepsLog,
      modified_workflow: modifiedWf,
      api_prompt: apiPrompt
    };
  }

  // Step A: Optional SFTP transfer (ONLY if explicitly requested via stage_assets_first)
  let transferResult: any = null;
  const targetHost = remote_host || (options as any).host || (options as any).runpod_ip;
  if (stage_assets_first && targetHost) {
    try {
      transferResult = await processAssetTransfer(options);
      const mappedFiles = Array.from(new Set(Object.values(node_mappings).filter(Boolean) as string[]));
      stepsLog.push({
        step: "A",
        title: "SSH Asset Sync (Staged)",
        status: "success",
        detail: `Auto-staged ${mappedFiles.length} assigned asset file(s) into ${remote_comfyui_root}.`
      });
    } catch (err: any) {
      stepsLog.push({
        step: "A",
        title: "SSH Asset Sync (Staged)",
        status: "error",
        detail: `Asset staging failed: ${err.message}`
      });
    }
  } else {
    stepsLog.push({
      step: "A",
      title: "Asset Check",
      status: "info",
      detail: "Direct workflow dispatch mode active (skipping upload sequence)."
    });
  }

  // Step D: ComfyUI /prompt Dispatch via Multi-Transport (HTTP + SSH Bridge)
  const queueResult = await queuePromptToRemoteComfy(
    {
      host: targetHost,
      port: ssh_port,
      username: ssh_username,
      password: options.ssh_password,
      keyPath: options.ssh_key_path,
      privateKey: options.ssh_private_key,
      remote_comfyui_root: remote_comfyui_root,
      comfyui_api_url,
      remote_api_token
    },
    apiPrompt,
    client_id,
    {
      scene_name: cleanScene,
      shot_number: formattedShot,
      take_number: calculatedTake,
      workflow_file: resolvedWorkflowFilename
    }
  );

  if (queueResult.success) {
    stepsLog.push({
      step: "D",
      title: "ComfyUI Execution Triggered",
      status: "success",
      detail: `Successfully queued in ComfyUI (${queueResult.dispatch_method})! Prompt ID: ${queueResult.prompt_id}${queueResult.number ? ` (Queue #${queueResult.number})` : ""}`
    });

    const synthesizedWfFilename = options.output_workflow_filename || `${cleanScene}_Shot_${formattedShot}.json`;
    const cleanRoot = remote_comfyui_root.replace(/\/$/, "");
    const expectedRemoteWfPath = `${cleanRoot}/user/default/workflows/${synthesizedWfFilename}`;

    return {
      success: true,
      prompt_id: queueResult.prompt_id,
      queue_number: queueResult.number,
      take_number: calculatedTake,
      expected_video_filename: expectedVideoFilename,
      steps: stepsLog,
      modified_workflow: modifiedWf,
      api_prompt: apiPrompt,
      dispatch_method: queueResult.dispatch_method,
      remote_dir: transferResult?.remote_dir || `${cleanRoot}/input`,
      remote_workflow_path: transferResult?.remote_workflow_path || expectedRemoteWfPath,
      remote_workflow_paths: transferResult?.remote_workflow_paths || [expectedRemoteWfPath],
      staged_workflow_filename: transferResult?.staged_workflow_filename || synthesizedWfFilename,
      staged_workflow_filenames: transferResult?.staged_workflow_filenames || [synthesizedWfFilename],
      base_template_used: resolvedWorkflowFilename,
      uploaded_files: transferResult?.uploaded_files || []
    };
  } else {
    stepsLog.push({
      step: "D",
      title: "ComfyUI Execution Failed",
      status: "error",
      detail: queueResult.error || "Failed to submit prompt to ComfyUI."
    });

    throw new Error(queueResult.error || "Failed to trigger workflow execution in ComfyUI.");
  }
}
