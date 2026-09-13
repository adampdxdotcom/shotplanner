import React from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { MediaAsset, CharacterProfile } from "../../types";
import { isLocationEntity } from "../../utils/locationUtils";

interface DeleteCharacterModalProps {
  characterToDelete: string | null;
  characters: Record<string, CharacterProfile>;
  assets: MediaAsset[];
  onClose: () => void;
  onConfirmDelete: (subject: string) => void;
}

export const DeleteCharacterModal: React.FC<DeleteCharacterModalProps> = ({
  characterToDelete,
  characters,
  assets,
  onClose,
  onConfirmDelete,
}) => {
  if (!characterToDelete) return null;

  const isLoc = isLocationEntity(
    characterToDelete,
    characters?.[characterToDelete],
    assets
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-red-950/60 border border-red-900/60 flex items-center justify-center text-red-400 shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <button 
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-200 transition-colors p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <h3 className="text-lg font-bold text-zinc-100 mb-2">
            {isLoc ? "Delete Location Profile" : "Delete Character Profile"}
          </h3>
          <p className="text-sm text-zinc-300 mb-3">
            Are you sure you want to delete <span className="font-semibold text-amber-400">{characterToDelete}</span>?
          </p>
          
          <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 text-xs text-zinc-400 space-y-2 mb-6">
            <p>
              • Deletes the {isLoc ? "location" : "character"} profile and removes it from project subjects.
            </p>
            <p>
              • De-assigns this reference image from all shot input slots and scene framing.
            </p>
            <p className="text-emerald-400 font-medium">
              ✓ All original media files remain safe and accessible in your gallery.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirmDelete(characterToDelete)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-lg shadow-red-950/50 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              {isLoc ? "Delete Location" : "Delete Character"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
