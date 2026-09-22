import { MediaAsset, SceneProjectFile, ShotItem, ShotFirstFrame } from "../../../types";

export interface MultimodalFrameComposerProps {
  sceneProject?: SceneProjectFile;
  activeShot: ShotItem;
  activeScene: string;
  allAssets?: MediaAsset[];
  assignedFirstFrame?: ShotFirstFrame;
  onAcceptFirstFrame: (firstFrame: ShotFirstFrame) => void;
  onAssetUploaded?: (asset: MediaAsset, targetSlotIndex?: number) => void;
  addToast?: (msg: string, type?: "success" | "error" | "info") => void;
}

export type ComposerSlotType = "actor" | "wardrobe" | "location";

export interface ReferenceSlotState {
  filename?: string;
  previewUrl?: string;
  label?: string;
  base64?: string;
}

export interface CandidateItem {
  id: string;
  index: number;
  base64: string;
  mimeType: string;
  promptUsed: string;
  aspectRatio: string;
}

export const CINEMATIC_PRESETS = [
  "Medium close-up shot, dramatic rim lighting",
  "Over-the-shoulder perspective, shallow depth of field",
  "Wide establishing frame, volumetric golden hour haze",
  "Low-angle cinematic heroic framing, high contrast",
  "Moody neo-noir atmosphere, practical neon backlight",
  "Intense eye-level character close-up, soft studio fill"
];
