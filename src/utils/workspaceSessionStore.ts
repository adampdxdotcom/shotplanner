/**
 * Workspace Session Store
 * 
 * Provides resilient, safe localStorage persistence for client-side workspace
 * context across browser refreshes and tab reloads (Phase 1):
 * - Active Navigation Section (Scene Hub, Shots, Staging, Cast, Gallery, Config, etc.)
 * - Active Project Name / Slug
 * - Active Shot ID (per-project and global fallback)
 * - Active Staging Subject / Actor
 * - Active Staging Sub-Tab (Staging vs Headshots)
 * - Active Asset Manager Media Tab (Image, Audio, Video)
 */

const STORAGE_KEYS = {
  LAST_PROJECT: "shotplanner_last_project",
  ACTIVE_SECTION: "shotplanner_active_section",
  ACTIVE_SHOT_PREFIX: "shotplanner_active_shot_",
  ACTIVE_SHOT_GLOBAL: "shotplanner_active_shot_global",
  ACTIVE_STAGING_SUBJECT: "shotplanner_active_staging_subject",
  ACTIVE_STAGING_TAB: "shotplanner_active_staging_tab",
  ACTIVE_ASSET_TAB: "shotplanner_active_asset_tab",
  ACTIVE_CONFIG_TAB: "shotplanner_active_config_tab",
  ACTIVE_CAST_TAB: "shotplanner_active_cast_tab",
} as const;

export const VALID_SECTIONS = [
  "scene",
  "assets",
  "staging",
  "workflow",
  "llm",
  "execute",
  "gallery",
  "cast",
  "config"
] as const;

export type NavigationSection = typeof VALID_SECTIONS[number];

const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window === "undefined" || !window.localStorage) return null;
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window === "undefined" || !window.localStorage) return;
      window.localStorage.setItem(key, value);
    } catch {
      // Ignore quota or private mode errors safely
    }
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window === "undefined" || !window.localStorage) return;
      window.localStorage.removeItem(key);
    } catch {
      // Ignore errors safely
    }
  }
};

/**
 * Normalizes project names for key storage
 */
function cleanProjectKey(name?: string): string {
  if (!name) return "";
  return name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_").replace(/\.json$/i, "");
}

// 1. Last Project Name
export function getLastProjectName(): string | null {
  const val = safeStorage.getItem(STORAGE_KEYS.LAST_PROJECT);
  if (!val) return null;
  const clean = cleanProjectKey(val);
  // Never restore or look for demo files/projects
  if (!clean || clean.includes("demo") || clean === "demo_project") {
    safeStorage.removeItem(STORAGE_KEYS.LAST_PROJECT);
    return null;
  }
  return clean;
}

export function setLastProjectName(name: string): void {
  const clean = cleanProjectKey(name);
  if (clean && clean !== "untitled_scene" && !clean.includes("demo")) {
    safeStorage.setItem(STORAGE_KEYS.LAST_PROJECT, clean);
  }
}

export function clearLastProjectName(): void {
  safeStorage.removeItem(STORAGE_KEYS.LAST_PROJECT);
}

export function clearDemoProjectSession(): void {
  const val = safeStorage.getItem(STORAGE_KEYS.LAST_PROJECT);
  if (val && (val.toLowerCase().includes("demo") || val === "demo_project")) {
    safeStorage.removeItem(STORAGE_KEYS.LAST_PROJECT);
  }
}

// 2. Active Section
export function getLastActiveSection(fallback = "scene"): string {
  const val = safeStorage.getItem(STORAGE_KEYS.ACTIVE_SECTION);
  if (val && VALID_SECTIONS.includes(val as NavigationSection)) {
    return val;
  }
  return fallback;
}

export function setLastActiveSection(section: string): void {
  if (section && VALID_SECTIONS.includes(section as NavigationSection)) {
    safeStorage.setItem(STORAGE_KEYS.ACTIVE_SECTION, section);
  }
}

// 3. Active Shot ID
export function getLastActiveShotId(projectName?: string): string | null {
  const clean = cleanProjectKey(projectName);
  if (clean) {
    const projectShot = safeStorage.getItem(`${STORAGE_KEYS.ACTIVE_SHOT_PREFIX}${clean}`);
    if (projectShot) return projectShot;
  }
  return safeStorage.getItem(STORAGE_KEYS.ACTIVE_SHOT_GLOBAL);
}

export function setLastActiveShotId(shotId: string | null, projectName?: string): void {
  if (!shotId) {
    safeStorage.removeItem(STORAGE_KEYS.ACTIVE_SHOT_GLOBAL);
    const clean = cleanProjectKey(projectName);
    if (clean) {
      safeStorage.removeItem(`${STORAGE_KEYS.ACTIVE_SHOT_PREFIX}${clean}`);
    }
    return;
  }

  safeStorage.setItem(STORAGE_KEYS.ACTIVE_SHOT_GLOBAL, shotId);
  const clean = cleanProjectKey(projectName);
  if (clean) {
    safeStorage.setItem(`${STORAGE_KEYS.ACTIVE_SHOT_PREFIX}${clean}`, shotId);
  }
}

// 4. Active Staging Subject
export function getLastActiveSubject(): string | null {
  return safeStorage.getItem(STORAGE_KEYS.ACTIVE_STAGING_SUBJECT);
}

export function setLastActiveSubject(subject: string | null): void {
  if (subject && subject.trim()) {
    safeStorage.setItem(STORAGE_KEYS.ACTIVE_STAGING_SUBJECT, subject.trim());
  } else {
    safeStorage.removeItem(STORAGE_KEYS.ACTIVE_STAGING_SUBJECT);
  }
}

export type StagingWorkspaceTab = "headshots" | "staging" | "sheets" | "first_frame";

// 5. Active Staging Sub-Tab
export function getLastStagingTab(fallback: StagingWorkspaceTab = "staging"): StagingWorkspaceTab {
  const val = safeStorage.getItem(STORAGE_KEYS.ACTIVE_STAGING_TAB);
  if (val === "headshots" || val === "staging" || val === "sheets" || val === "first_frame") {
    return val;
  }
  return fallback;
}

export function setLastStagingTab(tab: StagingWorkspaceTab): void {
  if (tab === "headshots" || tab === "staging" || tab === "sheets" || tab === "first_frame") {
    safeStorage.setItem(STORAGE_KEYS.ACTIVE_STAGING_TAB, tab);
  }
}

// 6. Active Asset Media Tab (image | audio | video | takes)
export function getLastAssetTab(fallback: "image" | "audio" | "video" | "takes" = "image"): "image" | "audio" | "video" | "takes" {
  const val = safeStorage.getItem(STORAGE_KEYS.ACTIVE_ASSET_TAB);
  if (val === "image" || val === "audio" || val === "video" || val === "takes") {
    return val;
  }
  return fallback;
}

export function setLastAssetTab(tab: "image" | "audio" | "video" | "takes"): void {
  if (tab === "image" || tab === "audio" || tab === "video" || tab === "takes") {
    safeStorage.setItem(STORAGE_KEYS.ACTIVE_ASSET_TAB, tab);
  }
}

export type WorkspaceConfigTab = "llm" | "remote" | "models" | "general" | "diagnostics";

// 7. Active Config Tab
export function getLastConfigTab(fallback: WorkspaceConfigTab = "llm"): WorkspaceConfigTab {
  const val = safeStorage.getItem(STORAGE_KEYS.ACTIVE_CONFIG_TAB);
  if (val === "llm" || val === "remote" || val === "models" || val === "general" || val === "diagnostics") {
    return val;
  }
  return fallback;
}

export function setLastConfigTab(tab: WorkspaceConfigTab): void {
  if (tab === "llm" || tab === "remote" || tab === "models" || tab === "general" || valIsValidConfigTab(tab)) {
    safeStorage.setItem(STORAGE_KEYS.ACTIVE_CONFIG_TAB, tab);
  }
}

function valIsValidConfigTab(tab: string): tab is WorkspaceConfigTab {
  return tab === "llm" || tab === "remote" || tab === "models" || tab === "general" || tab === "diagnostics";
}

export type WorkspaceCastTab = "scene" | "universe";

// 8. Active Cast Roster Tab
export function getLastCastTab(fallback: WorkspaceCastTab = "scene"): WorkspaceCastTab {
  const val = safeStorage.getItem(STORAGE_KEYS.ACTIVE_CAST_TAB);
  if (val === "scene" || val === "universe") {
    return val;
  }
  return fallback;
}

export function setLastCastTab(tab: WorkspaceCastTab): void {
  if (tab === "scene" || tab === "universe") {
    safeStorage.setItem(STORAGE_KEYS.ACTIVE_CAST_TAB, tab);
  }
}

