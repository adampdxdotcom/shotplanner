import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { upload, LEGACY_WORKFLOWS_DIR, WORKFLOWS_DIR, formatSceneFolderName, getSceneDirectories, ASSETS_DIR } from "../config/constants";
import { listWorkflows, deleteWorkflow, parseWorkflowData, resolveWorkflowTemplate } from "../services/workflowService";
import { processAssetTransfer, processSceneTransfer } from "../services/executionService";
import { listRemoteWorkflows, fetchRemoteWorkflowJson, syncRemoteWorkflowToLocal, getRemoteComfyObjectInfo } from "../services/remoteComfyService";
import { safeUnlinkSync } from "../utils/fileCleanup";
import { createScopedLogger } from "../utils/logger";

const log = createScopedLogger("WorkflowRoute");
const router = Router();


// Delete workflow JSON file
router.delete("/:filename", (req: Request, res: Response) => {
  try {
    const filename = req.params.filename;
    const sceneName = (req.query.scene_name as string) || (req.query.scene as string) || undefined;
    log.info(`DELETE /api/workflows/${filename} for scene: ${sceneName || "global"}`);
    const result = deleteWorkflow(filename, sceneName);
    res.json({
      success: true,
      message: `Workflow "${result.filename}" deleted successfully.`,
      ...result
    });
  } catch (err: any) {
    log.error("Failed to delete workflow", { error: err?.message || err });
    res.status(400).json({ success: false, error: err.message || "Failed to delete workflow." });
  }
});

router.post("/delete", (req: Request, res: Response) => {
  try {
    const filename = req.body.filename;
    const sceneName = req.body.scene_name || req.body.scene || undefined;
    if (!filename) {
      return res.status(400).json({ success: false, error: "Filename is required" });
    }
    log.info(`POST /api/workflows/delete for ${filename}`);
    const result = deleteWorkflow(filename, sceneName);
    res.json({
      success: true,
      message: `Workflow "${result.filename}" deleted successfully.`,
      ...result
    });
  } catch (err: any) {
    log.error("Failed to delete workflow", { error: err?.message || err });
    res.status(400).json({ success: false, error: err.message || "Failed to delete workflow." });
  }
});

router.get("/", (req: Request, res: Response) => {
  const sceneName = (req.query.scene as string) || undefined;
  const result = listWorkflows(sceneName);
  res.json(result);
});

router.post("/upload", upload.single("file"), (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const originalFilename = req.file.originalname;
    const sceneName = (req.body.scene_name as string) || "scene01";
    const sceneFolder = formatSceneFolderName(sceneName);
    const targetDir = getSceneDirectories(sceneName).workflows;
    
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Also ensure global workflows directory and scene workflows directory exist
    const globalSceneWfDir = path.join(WORKFLOWS_DIR, sceneFolder);
    if (!fs.existsSync(globalSceneWfDir)) {
      fs.mkdirSync(globalSceneWfDir, { recursive: true });
    }
    if (!fs.existsSync(WORKFLOWS_DIR)) {
      fs.mkdirSync(WORKFLOWS_DIR, { recursive: true });
    }

    const target = path.join(targetDir, originalFilename);
    const globalSceneTarget = path.join(globalSceneWfDir, originalFilename);

    fs.copyFileSync(req.file.path, target);
    fs.copyFileSync(req.file.path, globalSceneTarget);

    log.info(`Stored "${originalFilename}" in ${targetDir}`);

    // Immediate local parse so UI responds instantly with parsed metadata
    let parsedInfo: any = null;
    let rawWorkflow: any = null;
    try {
      rawWorkflow = JSON.parse(fs.readFileSync(target, "utf-8"));
      parsedInfo = parseWorkflowData(rawWorkflow);
    } catch (e) {}

    // Respond immediately (<10ms) without waiting for remote SSH transfer
    res.json({ 
      success: true, 
      filename: originalFilename, 
      folder: sceneFolder,
      parsed: parsedInfo ? {
        total_nodes: parsedInfo.totalNodes,
        detected_nodes: parsedInfo.detectedNodes,
        detected_values: parsedInfo.detectedValues
      } : undefined,
      workflow: rawWorkflow
    });

    // Non-blocking background SSH write (one-shot cat pipe, completes in <1s)
    const remoteHost = req.body.remote_host || req.body.host || req.body.runpod_ip;
    if (remoteHost && rawWorkflow) {
      const uploadBody = req.body;
      setImmediate(async () => {
        try {
          const { executeOneShotSSHWrite } = await import("../services/sshService");
          const remoteComfyRoot = uploadBody.remote_comfyui_root || "/workspace/runpod-slim/ComfyUI";
          const remoteDest = `${remoteComfyRoot}/user/default/workflows/${originalFilename}`;
          await executeOneShotSSHWrite(uploadBody, remoteDest, JSON.stringify(rawWorkflow, null, 2));
        } catch (bgErr: any) {
          log.warn("Background SSH Sync Notice", { error: bgErr.message || bgErr });
        }
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  } finally {
    if (req.file?.path) safeUnlinkSync(req.file.path);
  }
});

router.post("/parse", (req: Request, res: Response) => {
  try {
    const { filename, scene_name } = req.body;
    if (!filename) return res.status(400).json({ error: "Filename is required" });

    const cleanFilename = path.basename(filename);
    const resolved = resolveWorkflowTemplate(cleanFilename, scene_name);

    if (!resolved || !resolved.rawWorkflow) {
      return res.status(404).json({ error: `Workflow file '${cleanFilename}' not found for scene '${scene_name || "global"}'.` });
    }

    const workflow = resolved.rawWorkflow;
    const parsed = parseWorkflowData(workflow);
    
    res.json({
      filename: resolved.resolvedFilename || cleanFilename,
      path: resolved.resolvedPath,
      detected_nodes: parsed.detectedNodes,
      detected_values: parsed.detectedValues,
      nodes_info: {
        prompt_nodes: parsed.promptNodes,
        image_loader_nodes: parsed.imageLoaderNodes,
        video_loader_nodes: parsed.videoLoaderNodes,
        audio_loader_nodes: parsed.audioLoaderNodes,
        lora_loader_nodes: parsed.loraLoaderNodes,
        lora_slots: parsed.loraSlots,
        other_nodes: parsed.otherNodes,
        all_nodes: parsed.allNodes || [],
        detected_nodes: parsed.detectedNodes,
        total_nodes: parsed.totalNodes
      },
      raw_json: workflow,
      workflow: workflow,
      raw_workflow: workflow
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Stage single workflow/asset configuration to remote ComfyUI
router.post("/stage", async (req: Request, res: Response) => {
  try {
    log.info(`POST /api/workflow/stage for scene "${req.body.scene_name || 'default'}"`);
    const result = await processAssetTransfer(req.body);
    res.json(result);
  } catch (err: any) {
    log.error("Failed to stage assets", { error: err?.message || err });
    const status = err.message && err.message.includes("is required") ? 400 : 500;
    res.status(status).json({ error: err.message || "Failed to stage assets." });
  }
});

// Stage specific shot to remote ComfyUI
router.post("/stage-shot", async (req: Request, res: Response) => {
  try {
    log.info(`POST /api/workflow/stage-shot for scene "${req.body.scene_name || 'default'}"`);
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
    log.error("Failed to stage shot", { error: err?.message || err });
    const status = err.message && err.message.includes("is required") ? 400 : 500;
    res.status(status).json({ error: err.message || "Failed to stage shot." });
  }
});

// Stage full scene across all shots to remote ComfyUI
router.post("/stage-scene", async (req: Request, res: Response) => {
  try {
    log.info(`POST /api/workflow/stage-scene for scene "${req.body.scene_name || 'default'}" (${req.body.shots?.length || 0} shots)`);
    const result = await processSceneTransfer(req.body);
    res.json(result);
  } catch (err: any) {
    log.error("Failed to stage scene", { error: err?.message || err });
    const status = err.message && err.message.includes("is required") ? 400 : 500;
    res.status(status).json({ error: err.message || "Failed to stage scene." });
  }
});

// Discover workflows available on remote ComfyUI installation (Passive Monitoring)
router.post("/remote-list", async (req: Request, res: Response) => {
  try {
    log.info(`POST /api/workflow/remote-list from host "${req.body.remote_host || req.body.host || 'none'}"`);
    const result = await listRemoteWorkflows(req.body);
    res.json(result);
  } catch (err: any) {
    log.error("Failed to query remote ComfyUI workflows", { error: err?.message || err });
    res.status(500).json({
      success: false,
      workflows: [],
      error: err.message || "Failed to query remote ComfyUI workflows."
    });
  }
});

// Fetch raw remote workflow content
router.post("/remote-get", async (req: Request, res: Response) => {
  try {
    const { remote_path, ...creds } = req.body;
    if (!remote_path) {
      return res.status(400).json({ success: false, error: "remote_path is required" });
    }
    const result = await fetchRemoteWorkflowJson(creds as any, remote_path);
    if (!result.success) {
      return res.status(404).json(result);
    }
    const parsed = parseWorkflowData(result.data);
    res.json({
      success: true,
      data: result.data,
      parsed: {
        detected_nodes: parsed.detectedNodes,
        detected_values: parsed.detectedValues,
        nodes_info: {
          prompt_nodes: parsed.promptNodes,
          image_loader_nodes: parsed.imageLoaderNodes,
          video_loader_nodes: parsed.videoLoaderNodes,
          audio_loader_nodes: parsed.audioLoaderNodes,
          lora_loader_nodes: parsed.loraLoaderNodes,
          lora_slots: parsed.loraSlots,
          all_nodes: parsed.allNodes || [],
          detected_nodes: parsed.detectedNodes,
          total_nodes: parsed.totalNodes
        }
      }
    });
  } catch (err: any) {
    log.error("Failed to fetch remote workflow", { error: err?.message || err });
    res.status(500).json({ success: false, error: err.message || "Failed to fetch remote workflow." });
  }
});

// Sync remote workflow directly to local scene storage & catalog
router.post("/sync-remote", async (req: Request, res: Response) => {
  try {
    const { remote_path, scene_name, ...creds } = req.body;
    if (!remote_path) {
      return res.status(400).json({ success: false, error: "remote_path is required" });
    }
    const result = await syncRemoteWorkflowToLocal(creds as any, remote_path, scene_name || "scene01");
    if (!result.success) {
      return res.status(500).json(result);
    }
    res.json(result);
  } catch (err: any) {
    log.error("Failed to sync remote workflow", { error: err?.message || err });
    res.status(500).json({ success: false, error: err.message || "Failed to sync remote workflow." });
  }
});

// Inspect remote ComfyUI available nodes and embeddings
router.post("/remote-object-info", async (req: Request, res: Response) => {
  try {
    const result = await getRemoteComfyObjectInfo(req.body);
    res.json(result);
  } catch (err: any) {
    log.error("Failed to query ComfyUI object info", { error: err?.message || err });
    res.status(500).json({ success: false, error: err.message || "Failed to query ComfyUI object info." });
  }
});

// Preview shot parameter and media injection
router.post("/preview-shot-injection", async (req: Request, res: Response) => {
  try {
    const { workflow_filename, raw_workflow, shot, project_data } = req.body;
    let workflow = raw_workflow;

    if (!workflow && workflow_filename) {
      const cleanFilename = path.basename(workflow_filename);
      const searchPaths = [
        path.join(WORKFLOWS_DIR, cleanFilename),
        path.join(LEGACY_WORKFLOWS_DIR, cleanFilename),
      ];
      for (const p of searchPaths) {
        if (fs.existsSync(p)) {
          workflow = JSON.parse(fs.readFileSync(p, "utf-8"));
          break;
        }
      }
    }

    if (!workflow) {
      return res.status(400).json({ success: false, error: "Workflow file or raw workflow JSON is required." });
    }

    const { buildShotWorkflow, injectAndPrepareWorkflowData } = await import("../services/workflowService");
    let injected: any = null;

    if (raw_workflow) {
      injected = injectAndPrepareWorkflowData(
        raw_workflow,
        shot?.prompt_node_id,
        shot?.expanded_prompt || shot?.basic_stub || "",
        shot?.node_mappings || {},
        true,
        "empty.png",
        shot?.generation_params || {},
        shot?.parameter_node_mappings || {}
      );
    } else {
      injected = buildShotWorkflow(project_data || {}, shot || {}, project_data?.scene_name);
    }

    const parsed = parseWorkflowData(injected);

    res.json({
      success: true,
      injected_workflow: injected,
      summary: {
        total_nodes: parsed.totalNodes,
        detected_nodes: parsed.detectedNodes,
        detected_values: parsed.detectedValues,
        prompt_nodes_count: parsed.promptNodes.length,
        image_loaders_count: parsed.imageLoaderNodes.length,
        video_loaders_count: parsed.videoLoaderNodes.length,
        audio_loaders_count: parsed.audioLoaderNodes.length
      }
    });
  } catch (err: any) {
    log.error("Failed to preview shot injection", { error: err?.message || err });
    res.status(500).json({ success: false, error: err.message || "Failed to preview shot injection." });
  }
});

export default router;
