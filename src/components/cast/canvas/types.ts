import { MediaAsset } from "../../../types";

export interface StagedActorCanvasItem {
  id: string;
  characterName: string;
  cutoutDataUrl?: string;
  originalCutoutDataUrl?: string;
  maskDataUrl?: string;
  referenceAssetFilename?: string;
  xPercent: number; // unconstrained (supports negative space & off-canvas framing)
  yPercent: number; // unconstrained (anchor at feet)
  scale: number; // 0.20 to 3.50+
  isFlipped: boolean;
  zIndex: number;
  plane?: "foreground" | "midground" | "background";
  posture?: string;
  facing?: "facing_camera" | "turn_left" | "turn_right" | "profile_left" | "profile_right" | "back_camera";
}

export interface StagingInteractiveCanvasProps {
  actors: StagedActorCanvasItem[];
  selectedActorId: string | null;
  onSelectActor: (id: string | null) => void;
  onUpdateActor: (id: string, updates: Partial<StagedActorCanvasItem>) => void;
  onRemoveActor: (id: string) => void;
  onReorderActors: (actors: StagedActorCanvasItem[]) => void;
  
  // Environment / Background
  activeLocationAsset?: MediaAsset;
  locationAssets: MediaAsset[];
  customBackgroundUrl?: string;
  onSelectLocationAsset: (assetFilename: string) => void;
  onUploadCustomBackground: (file: File) => void;
  onClearBackground: () => void;

  // Viewport Settings
  aspectRatio: string; // "16:9" | "2.39:1" | "4:3" | "9:16"
  showGrid?: boolean;
  showSafeAreas?: boolean;

  // External Masking Trigger
  activeMaskingActorId?: string | null;
  onSetMaskingActorId?: (id: string | null) => void;
}
