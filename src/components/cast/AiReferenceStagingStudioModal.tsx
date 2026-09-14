import React, { useEffect } from "react";
import { MediaAsset, SceneProjectFile, ShotItem, CharacterProfile } from "../../types";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { StagingSection } from "../StagingSection";
import { StagedActor } from "../staging/types";
import { purgeManagedBlobUrls } from "../../utils/blobRegistry";

export type { StagedActor };

export interface AiReferenceStagingStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "headshots" | "staging";
  subjectName?: string;
  characterAssets?: MediaAsset[];
  activeSceneName: string;
  config?: any;
  onAssetSaved?: (asset: MediaAsset) => void;
  addToast?: (msg: string, type?: "success" | "error" | "info") => void;
  characters?: Record<string, CharacterProfile>;
  subjects?: string[];
  allAssets?: MediaAsset[];
  sceneProject?: SceneProjectFile;
  activeShotId?: string | null;
  onUpdateShot?: (updater: (prev: ShotItem) => ShotItem) => void;
  onSelectShot?: (id: string | null) => void;
  onUpdateProject?: (updater: (prev: SceneProjectFile) => SceneProjectFile) => void;
}

export const AiReferenceStagingStudioModal: React.FC<AiReferenceStagingStudioModalProps> = ({
  isOpen,
  onClose,
  initialTab = "headshots",
  subjectName = "",
  characterAssets = [],
  activeSceneName,
  config,
  onAssetSaved,
  addToast,
  characters = {},
  subjects = [],
  allAssets = [],
  sceneProject,
  activeShotId,
  onUpdateShot,
  onSelectShot,
  onUpdateProject
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      purgeManagedBlobUrls("actor-pose-keying");
      purgeManagedBlobUrls("staging-preview");
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        id="staging-studio-modal-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6"
      >
        <motion.div
          id="staging-studio-modal-card"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          className="modal-dialog-surface relative w-full max-w-6xl max-h-[92vh] flex flex-col bg-zinc-950 border-2 border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Modal Header Close Button */}
          <div className="absolute top-4 right-4 z-20">
            <button
              id="btn-close-staging-studio-modal"
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700/80 transition-colors cursor-pointer shadow-md"
              title="Close Staging Studio Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Scrollable Body hosting canonical StagingSection */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <StagingSection
              sceneProject={sceneProject}
              activeShotId={activeShotId}
              onSelectShot={onSelectShot}
              assets={allAssets.length > 0 ? allAssets : characterAssets}
              characters={characters}
              subjects={subjects.length > 0 ? subjects : (subjectName ? [subjectName] : [])}
              activeSceneName={activeSceneName}
              config={config}
              onUpdateProject={onUpdateProject || (() => {})}
              onUpdateShot={onUpdateShot}
              onAssetUploaded={onAssetSaved}
              addToast={addToast}
              initialTab={initialTab}
              initialSubject={subjectName}
            />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
