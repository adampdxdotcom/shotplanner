import React, { useState } from "react";
import { UniverseCharacterProfile } from "../../types";
import { Globe, User, MapPin, X } from "lucide-react";

interface CreateUniverseCharacterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (profile: Partial<UniverseCharacterProfile> & { name: string }) => Promise<void>;
}

export const CreateUniverseCharacterModal: React.FC<CreateUniverseCharacterModalProps> = ({
  isOpen,
  onClose,
  onCreate
}) => {
  const [name, setName] = useState("");
  const [entityType, setEntityType] = useState<"character" | "location">("character");
  const [notes, setNotes] = useState("");
  const [defaultOutfit, setDefaultOutfit] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onCreate({
        name: name.trim(),
        is_location: entityType === "location",
        notes: notes.trim(),
        default_outfit_ref: defaultOutfit.trim(),
        scene_outfit_ref: defaultOutfit.trim(),
        quick_slots: ["", "", "", ""],
        universe_slots: ["", "", "", ""]
      });
      setName("");
      setNotes("");
      setDefaultOutfit("");
      setEntityType("character");
      onClose();
    } catch (err) {
      console.error("Failed to create universe character:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-amber-950/60 border border-amber-800/60 flex items-center justify-center text-amber-400 shrink-0">
              <Globe className="w-6 h-6" />
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-200 transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <h3 className="text-lg font-bold text-zinc-100 mb-1">
            Create Universe {entityType === "location" ? "Location" : "Character"}
          </h3>
          <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
            Register an entity in the global universe roster to maintain identity and consistent appearance across all projects.
          </p>

          {/* Type Selector */}
          <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-lg p-1 mb-4">
            <button
              type="button"
              onClick={() => setEntityType("character")}
              className={`flex-1 py-1.5 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                entityType === "character"
                  ? "bg-amber-950 text-amber-300 border border-amber-700/60 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              Character
            </button>
            <button
              type="button"
              onClick={() => setEntityType("location")}
              className={`flex-1 py-1.5 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                entityType === "location"
                  ? "bg-emerald-950 text-emerald-300 border border-emerald-700/60 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              Location
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                {entityType === "location" ? "Location Name" : "Character / Actor Name"}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={entityType === "location" ? "e.g. Cyber City Rooftop, Victorian Library" : "e.g. Elena Vance, Detective Hayes"}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-200 outline-none focus:border-amber-500/50"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                Canonical Notes & Traits
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={entityType === "location" ? "Architecture, persistent lighting conditions, key landmarks..." : "Age, eye color, distinctive scars, demeanor, lore..."}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-200 outline-none focus:border-amber-500/50 resize-none min-h-[60px]"
              />
            </div>

            {entityType === "character" && (
              <div>
                <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Default Signature Outfit
                </label>
                <input
                  type="text"
                  value={defaultOutfit}
                  onChange={(e) => setDefaultOutfit(e.target.value)}
                  placeholder="e.g. Black trench coat with high collar, dark trousers"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-200 outline-none focus:border-amber-500/50"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim() || isSubmitting}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold rounded-lg transition-colors shadow-lg disabled:opacity-50"
              >
                {isSubmitting ? "Creating..." : "Create Universe Entity"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
