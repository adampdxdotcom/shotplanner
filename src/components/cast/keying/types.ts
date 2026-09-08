import { MediaAsset, CharacterProfile } from "../../../types";

export interface KeyingCutoutResult {
  dataUrl: string;
  blobUrl?: string;
  width: number;
  height: number;
  transparentPercentage: number;
}

export interface QuickKeyColor {
  label: string;
  hex: string;
  bgClass: string;
}

export const QUICK_KEY_COLORS: QuickKeyColor[] = [
  { label: "Green Screen", hex: "#00FF00", bgClass: "bg-[#00FF00] text-black" },
  { label: "Blue Screen", hex: "#0000FF", bgClass: "bg-[#0000FF] text-white" },
  { label: "Magenta", hex: "#FF00FF", bgClass: "bg-[#FF00FF] text-white" },
  { label: "White", hex: "#FFFFFF", bgClass: "bg-white text-black" },
  { label: "Black", hex: "#000000", bgClass: "bg-black text-white border border-zinc-700" },
];

export interface ActorPoseKeyingPanelProps {
  characters?: Record<string, CharacterProfile>;
  subjects?: string[];
  allAssets: MediaAsset[];
  activeSceneName?: string;
  defaultCharacter?: string;
  onAssetUploaded?: (asset: MediaAsset) => void;
  onAddPosedActor: (actorData: {
    characterName: string;
    cutoutDataUrl: string;
    referenceAssetFilename?: string;
    posture?: string;
    facing?: "facing_camera" | "turn_left" | "turn_right" | "profile_left" | "profile_right" | "back_camera";
    plane?: "foreground" | "midground" | "background";
  }) => void;
  onClose: () => void;
  addToast?: (msg: string, type?: "success" | "error" | "info") => void;
}
