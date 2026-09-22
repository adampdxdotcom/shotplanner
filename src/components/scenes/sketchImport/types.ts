import { 
  CharacterProfile, 
  UniverseCharacterProfile, 
  MediaAsset, 
  ParsedSceneSketchShot, 
  ShotItem 
} from "../../../types";

export interface SceneSketchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingShotsCount: number;
  sceneCast: Record<string, CharacterProfile> | CharacterProfile[];
  universeCast: Record<string, UniverseCharacterProfile>;
  universeAssets: MediaAsset[];
  existingSceneAssets: MediaAsset[];
  lmStudioUrl?: string;
  onImportSuccess: (payload: {
    shotsToInsert: Partial<ShotItem>[];
    importMode: "append" | "replace";
    charactersToImport: UniverseCharacterProfile[];
    assetsToImport: MediaAsset[];
    sceneTitle?: string;
  }) => void;
}

export type SketchImportStep = 1 | 2;
export type SketchImportMode = "append" | "replace";
