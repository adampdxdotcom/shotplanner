import fs from "fs";
import path from "path";
import { WORKFLOWS_DIR } from "../../config/constants";
import { parseWorkflowData } from "./workflowParser";
import { injectAndPrepareWorkflowData } from "./workflowInjector";

/**
 * Builds a ready-to-execute workflow for a specific shot by inspecting the shot context,
 * loaded assets, parameter mappings, and prompt text.
 */
export function buildShotWorkflow(
  projectData: Record<string, any>,
  shot: Record<string, any>,
  sceneName?: string
): Record<string, any> {
  const effectiveScene =
    sceneName ||
    projectData.scene_name ||
    projectData.scene_planning?.scene_name ||
    "scene01";
  const cleanScene = effectiveScene.replace(/[^a-zA-Z0-9_-]/g, "_");

  const targetWfName =
    shot.workflow_file ||
    shot.workflow_filename ||
    projectData.workflow_file ||
    projectData.selectedWorkflowFile ||
    "default.json";

  // Attempt to load workflow
  let rawWf: any = { nodes: [], links: [] };
  const sceneWfPath = path.join(WORKFLOWS_DIR, cleanScene, targetWfName);
  const rootWfPath = path.join(WORKFLOWS_DIR, targetWfName);

  if (fs.existsSync(sceneWfPath)) {
    try {
      rawWf = JSON.parse(fs.readFileSync(sceneWfPath, "utf-8"));
    } catch {}
  } else if (fs.existsSync(rootWfPath)) {
    try {
      rawWf = JSON.parse(fs.readFileSync(rootWfPath, "utf-8"));
    } catch {}
  }

  const inspected = parseWorkflowData(rawWf);
  const imgLoaders = inspected.imageLoaderNodes || (inspected as any).image_loader_nodes || [];
  const vidLoaders = inspected.videoLoaderNodes || (inspected as any).video_loader_nodes || [];
  const audLoaders = inspected.audioLoaderNodes || (inspected as any).audio_loader_nodes || [];
  const allLoaders = [...imgLoaders, ...vidLoaders, ...audLoaders];
  const promptNodes = inspected.promptNodes || (inspected as any).prompt_nodes || [];
  const detectedNodes = inspected.detectedNodes || (inspected as any).detected_nodes || { steps: null, megapixels: null, frames: null };

  const effectiveMappings: Record<string, string> = {};
  if (projectData.nodeMappings) Object.assign(effectiveMappings, projectData.nodeMappings);
  if (projectData.node_mappings) Object.assign(effectiveMappings, projectData.node_mappings);
  if (shot.node_mappings) Object.assign(effectiveMappings, shot.node_mappings);

  const assignedSlots = shot.assigned_slots || {};
  for (const [slotKey, fn] of Object.entries(assignedSlots)) {
    if (!fn || typeof fn !== "string" || !fn.trim()) continue;
    const cleanFn = fn.trim();
    const slotIdx = parseInt(slotKey, 10);
    if (isNaN(slotIdx)) continue;

    if (slotIdx >= 0 && slotIdx <= 8) {
      if (slotIdx < imgLoaders.length) {
        effectiveMappings[imgLoaders[slotIdx].id] = cleanFn;
      } else if (slotIdx < allLoaders.length) {
        effectiveMappings[allLoaders[slotIdx].id] = cleanFn;
      }
    } else if (slotIdx === 9 || slotIdx === 10) {
      const audIdx = slotIdx - 9;
      if (audIdx < audLoaders.length) {
        effectiveMappings[audLoaders[audIdx].id] = cleanFn;
      } else if (slotIdx < allLoaders.length) {
        effectiveMappings[allLoaders[slotIdx].id] = cleanFn;
      }
    } else if (slotIdx === 11) {
      if (vidLoaders.length > 0) {
        effectiveMappings[vidLoaders[0].id] = cleanFn;
      } else if (slotIdx < allLoaders.length) {
        effectiveMappings[allLoaders[slotIdx].id] = cleanFn;
      }
    } else if (slotIdx < allLoaders.length) {
      effectiveMappings[allLoaders[slotIdx].id] = cleanFn;
    }
  }

  // Shared assets fallback
  const sharedAssets = projectData.shared_assets || [];
  if (Array.isArray(sharedAssets)) {
    sharedAssets.forEach((sa: any) => {
      if (sa && sa.filename) {
        const sIdx = sa.slot_index;
        const saFn = String(sa.filename).trim();
        if (typeof sIdx === "number" && assignedSlots[sIdx] === undefined && assignedSlots[String(sIdx)] === undefined) {
          if (sIdx >= 0 && sIdx <= 8 && sIdx < imgLoaders.length) {
            const nId = imgLoaders[sIdx].id;
            if (!effectiveMappings[nId]) effectiveMappings[nId] = saFn;
          } else if ((sIdx === 9 || sIdx === 10) && sIdx - 9 < audLoaders.length) {
            const nId = audLoaders[sIdx - 9].id;
            if (!effectiveMappings[nId]) effectiveMappings[nId] = saFn;
          } else if (sIdx === 11 && vidLoaders.length > 0) {
            const nId = vidLoaders[0].id;
            if (!effectiveMappings[nId]) effectiveMappings[nId] = saFn;
          }
        }
      }
    });
  }

  const effectivePromptNodeId =
    shot.prompt_node_id ||
    projectData.selectedPromptNodeId ||
    projectData.prompt_node_id ||
    (promptNodes.length > 0 ? promptNodes[0].id : "");

  const effectivePrompt = shot.expanded_prompt || shot.prompt || shot.basic_stub || projectData.expanded_prompt || "";

  const rawParams =
    shot.generation_parameters ||
    shot.generation_params ||
    shot.generationParams ||
    shot.parameter_overrides ||
    projectData.generation_parameters ||
    projectData.generation_params ||
    projectData.generationParams ||
    projectData.parameter_overrides;

  const effectiveParams: Record<string, any> = {};
  const effectiveParamNodes: Record<string, string> = {};

  const explicitParamNodes =
    shot.parameter_node_mappings ||
    shot.parameterNodeMappings ||
    projectData.parameter_node_mappings ||
    projectData.parameterNodeMappings;
  if (explicitParamNodes && typeof explicitParamNodes === "object") {
    Object.entries(explicitParamNodes).forEach(([pk, pn]) => {
      if (pn) effectiveParamNodes[pk] = String(pn);
    });
  } else if (detectedNodes) {
    if (detectedNodes.steps) effectiveParamNodes.steps = detectedNodes.steps;
    if (detectedNodes.megapixels) effectiveParamNodes.megapixels = detectedNodes.megapixels;
    if (detectedNodes.frames) effectiveParamNodes.frames = detectedNodes.frames;
  }

  if (rawParams && typeof rawParams === "object") {
    Object.entries(rawParams).forEach(([pk, pv]: [string, any]) => {
      if (pv && typeof pv === "object") {
        if (pv.value !== undefined && pv.value !== null) effectiveParams[pk] = pv.value;
        if (pv.node_id) effectiveParamNodes[pk] = String(pv.node_id);
      } else if (pv !== undefined && pv !== null) {
        effectiveParams[pk] = pv;
      }
    });
  }

  const shotNum = shot.shot_number ?? 1;
  const shotNumStr = String(shotNum).padStart(2, "0");
  const saveVideoPrefix = shot.save_video_prefix || projectData.save_video_prefix || `${cleanScene}_shot_${shotNumStr}`;
  const bypassMissing = shot.bypass_missing ?? shot.bypassMissing ?? projectData.bypass_missing ?? projectData.bypassMissing ?? true;
  const safePlaceholder = shot.safe_placeholder || projectData.safe_placeholder || "empty.png";
  const aspectRatio = shot.aspect_ratio || projectData.aspect_ratio;

  return injectAndPrepareWorkflowData(
    rawWf,
    effectivePromptNodeId,
    effectivePrompt,
    effectiveMappings,
    Boolean(bypassMissing),
    safePlaceholder,
    effectiveParams,
    effectiveParamNodes,
    "",
    saveVideoPrefix,
    aspectRatio
  );
}
