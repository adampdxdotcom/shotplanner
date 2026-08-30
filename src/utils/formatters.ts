import { SCENE_REFERENCE_DIRECTIVE } from "../types";

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

export function generatePromptPrefix(plan?: { scene_name?: string; shot_number?: string | number; shot_type?: string; camera_movement?: string } | null): string {
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

export interface MandatoryHeaderOptions {
  promptPrefix?: string;
  subjectDefinitions?: string;
  isSceneRefPresent?: boolean;
  isSingleSubject?: boolean;
  customDirectives?: string[];
}

export function buildMandatoryHeader(options: MandatoryHeaderOptions): string {
  const parts: string[] = [];
  const cleanPrefix = (options.promptPrefix || "").trim();
  if (cleanPrefix) {
    parts.push(cleanPrefix);
  }
  const defs = (options.subjectDefinitions || "").trim();
  if (defs) {
    parts.push(defs);
  }
  const directives: string[] = [];
  if (options.isSceneRefPresent) {
    directives.push(SCENE_REFERENCE_DIRECTIVE);
  }
  if (options.isSingleSubject) {
    directives.push("There is only one person visible on screen in this shot. All other characters remain strictly off-screen.");
  }
  if (options.customDirectives && options.customDirectives.length > 0) {
    directives.push(...options.customDirectives.filter(Boolean));
  }
  if (directives.length > 0) {
    parts.push(directives.join("\n"));
  }
  return parts.join("\n\n");
}

export interface MandatoryFooterOptions {
  soundscape?: string;
  music?: string;
}

export function buildMandatoryFooter(options?: MandatoryFooterOptions): string {
  const soundscape = options?.soundscape || "Soft room ambience, environmental acoustics, and natural Foley effects matching on-screen physical actions.";
  const music = options?.music || "N/A";
  return `overall_soundscape: ${soundscape}\n\nnon_diegetic_music: ${music}`;
}

export interface AssembleFinalPromptParams {
  header?: string;
  promptPrefix?: string;
  subjectDefinitions?: string;
  directives?: string[];
  isSceneRefPresent?: boolean;
  isSingleSubject?: boolean;
  description: string;
  soundscape?: string;
  music?: string;
  footer?: string;
}

/**
 * Clean assembly line prompt builder (no regex parsing).
 */
export function assembleFinalPrompt(
  descriptionOrParams: string | AssembleFinalPromptParams,
  promptPrefix: string = "",
  isSceneRefPresent: boolean = false,
  isSingleSubject: boolean = false,
  subjectDefinitions: string = ""
): string {
  let header = "";
  let description = "";
  let footer = "";

  if (typeof descriptionOrParams === "object" && descriptionOrParams !== null) {
    const opts = descriptionOrParams;
    header = opts.header || buildMandatoryHeader({
      promptPrefix: opts.promptPrefix,
      subjectDefinitions: opts.subjectDefinitions,
      isSceneRefPresent: opts.isSceneRefPresent,
      isSingleSubject: opts.isSingleSubject,
      customDirectives: opts.directives
    });
    description = opts.description || "";
    footer = opts.footer || buildMandatoryFooter({
      soundscape: opts.soundscape,
      music: opts.music
    });
  } else {
    const rawText = String(descriptionOrParams || "").trim();
    header = buildMandatoryHeader({
      promptPrefix,
      subjectDefinitions,
      isSceneRefPresent,
      isSingleSubject
    });
    description = rawText;
    footer = buildMandatoryFooter();
  }

  let cleanDesc = description.trim();

  // Strip duplicate headers/footers if raw input was pre-assembled
  if (header && cleanDesc.startsWith(header)) {
    cleanDesc = cleanDesc.substring(header.length).trim();
  }
  if (footer && cleanDesc.endsWith(footer)) {
    cleanDesc = cleanDesc.substring(0, cleanDesc.length - footer.length).trim();
  }

  // Ensure standard integrated_multimodal_description label is present
  if (cleanDesc && !cleanDesc.toLowerCase().startsWith("integrated_multimodal_description:")) {
    cleanDesc = `integrated_multimodal_description: ${cleanDesc}`;
  }

  const sections: string[] = [];
  if (header) sections.push(header);
  if (cleanDesc) sections.push(cleanDesc);
  if (footer) sections.push(footer);

  return sections.join("\n\n");
}
