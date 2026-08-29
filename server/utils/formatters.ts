import { SCENE_REFERENCE_DIRECTIVE } from "../config/constants";
import { ScenePlanningDTO } from "../types";

export function formatShotNumber(raw: string | number): string {
  const str = String(raw !== undefined && raw !== null ? raw : "").trim().replace(/^shot\s*/i, "");
  if (!str) return "01";
  const num = parseInt(str, 10);
  if (!isNaN(num)) {
    return num.toString().padStart(2, "0");
  }
  return str;
}

export function sanitizeFilenamePart(str: string): string {
  if (!str) return "";
  return str
    .replace(/[/\\:*?"<>|']/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function sanitizeSlug(str: string): string {
  return str.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_").replace(/_+/g, "_");
}

export function generateSaveVideoPrefix(sceneName?: string, shotNumber?: string | number): string {
  const sanitizedScene = sanitizeFilenamePart(sceneName || "");
  const rawShot = shotNumber !== undefined && shotNumber !== null ? String(shotNumber).trim() : "";
  const paddedShot = rawShot ? formatShotNumber(rawShot) : "";

  if (sanitizedScene && paddedShot) {
    return `video/${sanitizedScene}_Shot_${paddedShot}_`;
  }
  if (sanitizedScene) {
    return `video/${sanitizedScene}_`;
  }
  if (paddedShot) {
    return `video/Shot_${paddedShot}_`;
  }
  return "";
}

export function generatePromptPrefix(plan?: ScenePlanningDTO | null): string {
  if (!plan) return "";
  const parts: string[] = [];
  
  if (plan.scene_name && String(plan.scene_name).trim()) {
    parts.push(String(plan.scene_name).trim());
  }
  
  const rawShot = plan.shot_number !== undefined && plan.shot_number !== null ? String(plan.shot_number).trim() : "";
  const shotNum = formatShotNumber(rawShot || "01");
  parts.push(`Shot ${shotNum}`);
  
  if (plan.shot_type && String(plan.shot_type).trim()) {
    parts.push(String(plan.shot_type).trim());
  }
  
  if (plan.camera_movement && String(plan.camera_movement).trim()) {
    parts.push(String(plan.camera_movement).trim());
  }
  
  return parts.join(" - ");
}

export function assembleFinalPrompt(
  expandedPrompt: string,
  promptPrefix: string,
  isSceneRefPresent: boolean = false,
  isSingleSubject: boolean = false
): string {
  let prompt = (expandedPrompt || "").trim();
  const cleanPrefix = (promptPrefix || "").trim().replace(/\.+$/, "");
  
  const sceneDirective = SCENE_REFERENCE_DIRECTIVE;
  const singleSubjectDirective = "There is only one person visible on screen in this shot. All other characters remain strictly off-screen.";

  // Strip prefix if it exists at the start
  if (cleanPrefix && prompt.startsWith(cleanPrefix)) {
    prompt = prompt.substring(cleanPrefix.length).trim();
  }

  // Strip directives from the body so they don't appear twice
  if (prompt.includes(sceneDirective)) {
    prompt = prompt.replace(new RegExp(sceneDirective, 'g'), '').trim();
  }
  if (prompt.includes(singleSubjectDirective)) {
    prompt = prompt.replace(new RegExp(singleSubjectDirective, 'g'), '').trim();
  }

  // Identify Global Subject Definitions
  let defs = "";
  let body = prompt;
  
  const globalSubjIndex = prompt.toLowerCase().indexOf("global subject definitions:");
  if (globalSubjIndex !== -1) {
    const imdIndex = prompt.toLowerCase().indexOf("integrated_multimodal_description:");
    
    let endOfDefs = imdIndex;
    const align1 = prompt.toLowerCase().indexOf("for the target video,");
    const align2 = prompt.toLowerCase().indexOf("how the reference pictures align");
    
    if (align1 !== -1 && align1 > globalSubjIndex && (endOfDefs === -1 || align1 < endOfDefs)) {
      endOfDefs = align1;
    }
    if (align2 !== -1 && align2 > globalSubjIndex && (endOfDefs === -1 || align2 < endOfDefs)) {
      endOfDefs = align2;
    }
    
    if (endOfDefs !== -1) {
      defs = prompt.substring(globalSubjIndex, endOfDefs).trim();
      body = prompt.substring(endOfDefs).trim();
    } else {
      const parts = prompt.split(/\n\s*\n/);
      if (parts[0].toLowerCase().includes("global subject definitions:")) {
        defs = parts[0].trim();
        body = parts.slice(1).join("\n\n").trim();
      }
    }
  }

  const parts = [];

  if (cleanPrefix) parts.push(cleanPrefix);
  if (defs) parts.push(defs);

  const directives = [];
  if (isSceneRefPresent) directives.push(sceneDirective);
  if (isSingleSubject) directives.push(singleSubjectDirective);

  if (directives.length > 0) parts.push(directives.join("\n"));
  
  if (body) parts.push(body);

  return parts.join("\n\n");
}

export function hasSceneReferencePhoto(assets: any[]): boolean {
  if (!assets || !Array.isArray(assets)) return false;
  return assets.some((a) => {
    if (!a) return false;
    const isImage = !a.media_type || a.media_type === "image";
    const typeStr = (a.type || "").toLowerCase();
    const sname = (a.subject_name || "").toLowerCase();
    const fname = (a.filename || "").toLowerCase();
    return (
      isImage &&
      (typeStr === "scene reference" ||
        typeStr.includes("scene") ||
        typeStr.includes("location") ||
        typeStr.includes("environment") ||
        sname.includes("location") ||
        fname.startsWith("scene_") ||
        fname.includes("scene_reference"))
    );
  });
}
