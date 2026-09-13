import React, { useState } from "react";
import { Users, X, User, MapPin } from "lucide-react";

interface RegisterCharacterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (name: string, entityType: "character" | "location") => void;
}

export const RegisterCharacterModal: React.FC<RegisterCharacterModalProps> = ({
  isOpen,
  onClose,
  onRegister,
}) => {
  const [newCharacterName, setNewCharacterName] = useState("");
  const [newEntityType, setNewEntityType] = useState<"character" | "location">("character");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCharacterName.trim();
    if (trimmed) {
      onRegister(trimmed, newEntityType);
      setNewCharacterName("");
      setNewEntityType("character");
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-950/60 border border-indigo-900/60 flex items-center justify-center text-indigo-400 shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <button 
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-200 transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <h3 className="text-lg font-bold text-zinc-100 mb-2">
            {newEntityType === "location" ? "Register New Location" : "Register New Character"}
          </h3>
          <p className="text-sm text-zinc-400 mb-4">
            {newEntityType === "location"
              ? "Create a new location profile to organize scene references and environment context."
              : "Create a new character profile to organize their reference assets and scene context."}
          </p>

          {/* Entity Type Toggle */}
          <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-lg p-1 mb-5">
            <button
              type="button"
              onClick={() => setNewEntityType("character")}
              className={`flex-1 py-1.5 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                newEntityType === "character"
                  ? "bg-indigo-950 text-indigo-300 border border-indigo-700/60 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              Character
            </button>
            <button
              type="button"
              onClick={() => setNewEntityType("location")}
              className={`flex-1 py-1.5 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                newEntityType === "location"
                  ? "bg-emerald-950 text-emerald-300 border border-emerald-700/60 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              Location
            </button>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label htmlFor="charName" className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">
                {newEntityType === "location" ? "Location Name" : "Character Name"}
              </label>
              <input
                id="charName"
                type="text"
                value={newCharacterName}
                onChange={e => setNewCharacterName(e.target.value)}
                placeholder={newEntityType === "location" ? "e.g. Living Room, Rooftop Bar" : "e.g. John Doe, Cyberpunk Agent"}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 outline-none focus:border-indigo-500/50"
                autoFocus
              />
            </div>
            
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newCharacterName.trim()}
                className={`flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg disabled:opacity-50 cursor-pointer ${
                  newEntityType === "location"
                    ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/50 disabled:hover:bg-emerald-600"
                    : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-950/50 disabled:hover:bg-indigo-600"
                }`}
              >
                Register
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
