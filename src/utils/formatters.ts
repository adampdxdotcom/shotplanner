import { ScenePlanning, SCENE_REFERENCE_DIRECTIVE } from "../types";

export const generateUUID = (): string => {
  if (typeof window !== "undefined" && window.crypto && typeof window.crypto.randomUUID === "function") {
    try {
      return window.crypto.randomUUID();
    } catch {
      // Fallback if randomUUID fails
    }
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const formatShotNumber = (num: number | string): string => {
  const parsed = parseInt(String(num).replace(/[^0-9]/g, ""), 10);
  if (isNaN(parsed)) return "01";
  return String(parsed).padStart(2, "0");
};

export const sanitizeFilenamePart = (part: string): string => {
  if (!part) return "";
  return part.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
};

export const generateSaveVideoPrefix = (sceneName?: string, shotNumber?: string | number, takeNumber?: string | number): string => {
  const sn = sanitizeFilenamePart(sceneName || "Scene");
  const shotNum = formatShotNumber(shotNumber !== undefined && shotNumber !== null ? shotNumber : 1);
  const takePart = takeNumber !== undefined && takeNumber !== null ? `_Take_${takeNumber}` : "";
  return `${sn}_Shot_${shotNum}${takePart}`;
};

export const generatePromptPrefix = (planning?: ScenePlanning | Partial<ScenePlanning> | null): string => {
  if (!planning) return "";
  const parts: string[] = [];
  
  if (planning.scene_name && String(planning.scene_name).trim()) {
    parts.push(String(planning.scene_name).trim());
  }
  
  const rawShot = planning.shot_number !== undefined && planning.shot_number !== null ? String(planning.shot_number).trim() : "";
  const shotNum = formatShotNumber(rawShot || "01");
  parts.push(`Shot ${shotNum}`);
  
  if (planning.shot_type && String(planning.shot_type).trim() && planning.shot_type !== "None") {
    parts.push(String(planning.shot_type).trim());
  }
  
  if (planning.lens_focal_length && String(planning.lens_focal_length).trim() && planning.lens_focal_length !== "None") {
    parts.push(String(planning.lens_focal_length).trim());
  }
  
  if (planning.camera_movement && String(planning.camera_movement).trim() && planning.camera_movement !== "None") {
    parts.push(String(planning.camera_movement).trim());
  }
  
  if (planning.aspect_ratio && String(planning.aspect_ratio).trim() && planning.aspect_ratio !== "None") {
    parts.push(String(planning.aspect_ratio).trim());
  }
  
  return parts.join(" - ");
};

export interface SubjectAssetDefinition {
  filename?: string;
  subject_name?: string;
  description?: string;
  type?: string;
  media_type?: "image" | "video" | "audio" | string;
  slot_index?: number;
}

export const buildSubjectDefinitions = (assets?: SubjectAssetDefinition[]): string => {
  if (!assets || assets.length === 0) return "";
  const lines = ["Global Subject Definitions:"];
  const sorted = [...assets].sort((a, b) => {
    if (a.media_type !== b.media_type) {
      const order: Record<string, number> = { image: 0, video: 1, audio: 2 };
      return (order[a.media_type || "image"] ?? 0) - (order[b.media_type || "image"] ?? 0);
    }
    return (a.slot_index ?? 0) - (b.slot_index ?? 0);
  });

  sorted.forEach((a, idx) => {
    const slotNum = a.slot_index !== undefined ? a.slot_index + 1 : idx + 1;
    const tag = a.media_type === "video" ? `<Video ${slotNum}>` : a.media_type === "audio" ? `<Audio ${slotNum}>` : `<Picture ${slotNum}>`;
    const cat = (a.type || "Reference").toLowerCase();
    const sname = a.subject_name || `Subject ${slotNum}`;
    const desc = (a.description || "Facial features, styling").replace(/\.$/, "");
    if (cat.includes("location") || cat.includes("scene") || cat.includes("environment") || sname.toLowerCase().includes("location")) {
      lines.push(`Location(${tag}): ${desc}.`);
    } else {
      lines.push(`${sname} (${tag}): ${desc}.`);
    }
  });
  return lines.join("\n");
};

export interface PrePromptContextOptions {
  sceneName?: string;
  shotNumber?: string | number;
  shotType?: string;
  lensFocalLength?: string;
  cameraMovement?: string;
  aspectRatio?: string;
  otsAnchorSubject?: string;
  otsFocusSubject?: string;
  otsSide?: string;
  basicStub?: string;
  assets?: SubjectAssetDefinition[];
  customDirectives?: string[];
}

export const computePrePromptContext = (options: PrePromptContextOptions): string => {
  const parts: string[] = [];

  // 1. Scene & Shot Planning Header Prefix
  const prefix = generatePromptPrefix({
    scene_name: options.sceneName,
    shot_number: options.shotNumber,
    shot_type: options.shotType,
    lens_focal_length: options.lensFocalLength,
    camera_movement: options.cameraMovement,
    aspect_ratio: options.aspectRatio
  });
  if (prefix) {
    parts.push(prefix);
  }

  // 2. Global Subject Definitions
  const subjectDefs = buildSubjectDefinitions(options.assets);
  if (subjectDefs) {
    parts.push(subjectDefs);
  }

  // 3. Directives: Framing Directive (if OTS), Scene Ref, Single Subject
  const directives: string[] = [];
  const shotType = options.shotType || "";
  const isOTS = /over-the-shoulder|ots/i.test(shotType);
  const anchor = (options.otsAnchorSubject || "").trim();
  const focus = (options.otsFocusSubject || "").trim();
  const side = (options.otsSide || "").trim();
  const sideSuffix = (side === "Left" || side === "Right") ? ` (positioned on ${side})` : "";

  if (isOTS && (anchor || focus)) {
    if (anchor && focus) {
      directives.push(`Framing: Over-the-shoulder (OTS) angle looking past the shoulder of ${anchor} toward ${focus}${sideSuffix}.`);
    } else if (anchor) {
      directives.push(`Framing: Over-the-shoulder (OTS) angle looking past the shoulder of ${anchor}${sideSuffix}.`);
    } else if (focus) {
      directives.push(`Framing: Over-the-shoulder (OTS) angle looking toward ${focus}${sideSuffix}.`);
    }
  }

  // Scene reference directive
  const hasSceneRef = options.assets && options.assets.length > 0 && options.assets.some(a => {
    const isImage = !a.media_type || a.media_type === "image";
    const typeStr = (a.type || "").toLowerCase();
    const sname = (a.subject_name || "").toLowerCase();
    const fname = (a.filename || "").toLowerCase();
    return isImage && (
      typeStr.includes("scene") ||
      typeStr.includes("location") ||
      typeStr.includes("environment") ||
      sname.includes("location") ||
      fname.startsWith("scene_") ||
      fname.includes("scene_reference")
    );
  });
  if (hasSceneRef) {
    directives.push(SCENE_REFERENCE_DIRECTIVE);
  }

  // Single subject directive
  const nonLocationAssets = (options.assets || []).filter(a => {
    const cat = (a.type || "Reference").toLowerCase();
    const sname = (a.subject_name || "").toLowerCase();
    return !(cat.includes("location") || cat.includes("scene") || cat.includes("environment") || sname.includes("location"));
  });
  const singleSubjectKeywords = /\b(alone|solo|by himself|by herself|one person|single person|just one person)\b/i;
  const isSingle = !isOTS && (nonLocationAssets.length === 1 || singleSubjectKeywords.test(options.basicStub || "") || singleSubjectKeywords.test(prefix));
  if (isSingle) {
    directives.push("There is only one person visible on screen in this shot. All other characters remain strictly off-screen.");
  }

  if (options.customDirectives && options.customDirectives.length > 0) {
    directives.push(...options.customDirectives.filter(Boolean));
  }

  if (directives.length > 0) {
    parts.push(directives.join("\n"));
  }

  // 4. Basic stub / concept preview
  const rawStub = (options.basicStub || "").trim();
  if (rawStub) {
    parts.push(`[Shot ${formatShotNumber(options.shotNumber || "01")}] ${rawStub}`);
  } else {
    parts.push(`[Shot ${formatShotNumber(options.shotNumber || "01")}] (Enter basic prompt stub on the left to complete shot concept...)`);
  }

  // 5. Soundscape / Music footer
  parts.push("overall_soundscape: Soft room ambience, environmental acoustics, and natural Foley effects matching on-screen physical actions.\n\nnon_diegetic_music: N/A");

  return parts.join("\n\n");
};

export const assembleFinalPrompt = (prompt: string, prefix: string, hasSceneRef: boolean): string => {
  if (!prompt || !prompt.trim()) return "";
  let final = prompt;
  if (prefix && !final.startsWith(prefix)) {
    final = prefix + "\n\n" + final;
  }
  if (hasSceneRef && !final.includes(SCENE_REFERENCE_DIRECTIVE)) {
    final = final + "\n\n" + SCENE_REFERENCE_DIRECTIVE;
  }
  return final;
};
