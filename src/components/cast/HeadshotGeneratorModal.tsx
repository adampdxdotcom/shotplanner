import React from "react";
import { MediaAsset, SceneProjectFile, ShotItem, CharacterProfile } from "../../types";
import { AiReferenceStagingStudioModal, AiReferenceStagingStudioModalProps } from "./AiReferenceStagingStudioModal";

export interface HeadshotGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectName: string;
  characterAssets: MediaAsset[];
  activeSceneName: string;
  onAssetSaved: (asset: MediaAsset) => void;
  addToast?: (msg: string, type?: "success" | "error" | "info") => void;
  initialTab?: "headshots" | "staging";
  characters?: Record<string, CharacterProfile>;
  subjects?: string[];
  allAssets?: MediaAsset[];
  sceneProject?: SceneProjectFile;
  activeShotId?: string | null;
  onUpdateShot?: (updater: (prev: ShotItem) => ShotItem) => void;
}

export const HeadshotGeneratorModal: React.FC<HeadshotGeneratorModalProps> = (props) => {
  return (
    <AiReferenceStagingStudioModal
      {...props}
      initialTab={props.initialTab || "headshots"}
    />
  );
};

export { AiReferenceStagingStudioModal };
