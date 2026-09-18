import React from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { MissingPhotoAnalysis } from "./useShotPromptContext";

interface MissingReferenceAlertProps {
  missingPhotoInfo: MissingPhotoAnalysis | null;
  onAutoAssignCharacterPhotos: (charName: string) => void;
}

/**
 * Banner alerting the user when a shot has no reference photos attached,
 * offering 1-click auto-linking if character photos are available.
 */
export const MissingReferenceAlert: React.FC<MissingReferenceAlertProps> = ({
  missingPhotoInfo,
  onAutoAssignCharacterPhotos
}) => {
  if (!missingPhotoInfo?.isMissingAllReferences) {
    return null;
  }

  return (
    <div className="mt-3 p-3 rounded-lg border border-amber-300 dark:border-amber-500/40 bg-amber-50/90 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 text-xs space-y-2">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1 flex-1 min-w-0">
          <p className="font-semibold text-[11.5px]">Reference Photos Required</p>
          {missingPhotoInfo.charactersWithoutPhotos.length > 0 ? (
            <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
              Character <strong>{missingPhotoInfo.charactersWithoutPhotos.map((c) => c.name).join(", ")}</strong> has no reference photos configured in slots 1–4 on their character card. Please assign reference photos in the Cast or Asset Manager tabs before expanding the prompt.
            </p>
          ) : missingPhotoInfo.charactersWithPhotosUnassigned.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                Reference photos exist on the character card for <strong>{missingPhotoInfo.charactersWithPhotosUnassigned.map((c) => c.name).join(", ")}</strong>, but are not linked to this shot yet.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {missingPhotoInfo.charactersWithPhotosUnassigned.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => onAutoAssignCharacterPhotos(c.name)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[10.5px] transition-colors cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Link {c.name}&apos;s Photos to Shot</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
              No reference assets are assigned to this shot. Prompt expansion builds prompt conditioning with reference photo tags (<span className="font-mono">&lt;Picture 1&gt;</span>). Please assign at least one reference photo.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
