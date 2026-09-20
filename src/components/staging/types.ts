import React from "react";
import { MediaAsset, SceneProjectFile, ShotItem, CharacterProfile, StagingLayerRecipe } from "../../types";
import { StagedActorCanvasItem } from "../cast/StagingInteractiveCanvas";

export interface StagedActor extends StagedActorCanvasItem {
  horizontalPercent: number; // 15 to 85, kept in sync with xPercent
  scaleModifier?: number;
}

export interface StagingStudioProps {
  sceneProject?: SceneProjectFile;
  activeShotId?: string | null;
  onSelectShot?: (id: string | null) => void;
  assets?: MediaAsset[];
  characters?: Record<string, CharacterProfile>;
  subjects?: string[];
  activeSceneName?: string;
  onUpdateProject?: React.Dispatch<React.SetStateAction<SceneProjectFile>> | ((updater: (prev: SceneProjectFile) => SceneProjectFile) => void);
  onUpdateShot?: (updater: (prev: ShotItem) => ShotItem) => void;
  onAssetUploaded?: (asset: MediaAsset, targetSlotIndex?: number) => void;
  addToast?: (msg: string, type?: "success" | "error" | "info") => void;
  initialTab?: "headshots" | "staging" | "sheets" | "first_frame";
  initialSubject?: string;
}

export interface LightingAtmosphereOption {
  id: string;
  label: string;
  desc: string;
}

export interface AspectRatioOption {
  id: string;
  label: string;
  ratioClass: string;
}

export const LIGHTING_ATMOSPHERES: LightingAtmosphereOption[] = [
  { id: "golden_hour", label: "Golden Hour Warmth", desc: "Warm directional sunlight with amber rim glow" },
  { id: "overcast", label: "Cool Overcast / Diffused", desc: "Soft shadowless cinematic overcast daylight" },
  { id: "noir", label: "Moody High-Contrast Noir", desc: "Hard directional key with deep cinematic shadows" },
  { id: "cyberpunk", label: "Cyberpunk Neon Glow", desc: "Vibrant dual-color cyan and magenta rim highlights" },
  { id: "interior_warm", label: "Interior Practical Lighting", desc: "Warm cozy practical lamps and motivated ambient glow" },
  { id: "silhouette", label: "Dramatic Silhouette", desc: "Bright backlit backdrop with high-contrast outlines" }
];

export const ASPECT_RATIOS: AspectRatioOption[] = [
  { id: "16:9", label: "16:9 Widescreen", ratioClass: "aspect-video" },
  { id: "2.39:1", label: "2.39:1 Anamorphic Scope", ratioClass: "aspect-[2.39/1]" },
  { id: "3:2", label: "3:2 Landscape", ratioClass: "aspect-[3/2]" },
  { id: "4:3", label: "4:3 Classic", ratioClass: "aspect-[4/3]" },
  { id: "1:1", label: "1:1 Square", ratioClass: "aspect-square" },
  { id: "2:3", label: "2:3 Portrait", ratioClass: "aspect-[2/3]" },
  { id: "9:16", label: "9:16 Vertical", ratioClass: "aspect-[9/16]" }
];
