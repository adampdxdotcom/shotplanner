import React from "react";
import { User, MapPin, UserPlus } from "lucide-react";
import { SubjectCombobox } from "../../SubjectCombobox";

interface BulkUploadTargetHeaderProps {
  entityMode: "character" | "location";
  onSwitchEntityMode: (mode: "character" | "location") => void;
  bulkSubject: string;
  onSubjectChange: (val: string) => void;
  subjects: string[];
  onRegisterSubject: (name: string) => void;
  disabled?: boolean;
}

export const BulkUploadTargetHeader: React.FC<BulkUploadTargetHeaderProps> = ({
  entityMode,
  onSwitchEntityMode,
  bulkSubject,
  onSubjectChange,
  subjects,
  onRegisterSubject,
  disabled = false
}) => {
  return (
    <div className="bg-zinc-50 dark:bg-zinc-950/90 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <label
          className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
            entityMode === "location"
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-amber-700 dark:text-amber-400"
          }`}
        >
          {entityMode === "location" ? (
            <>
              <MapPin className="w-3.5 h-3.5" />
              Target Location / Environment Name
            </>
          ) : (
            <>
              <UserPlus className="w-3.5 h-3.5" />
              Target Subject / Character Name
            </>
          )}
        </label>

        {/* Context Mode Toggle */}
        <div className="flex items-center gap-1 bg-zinc-200/80 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => onSwitchEntityMode("character")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              entityMode === "character"
                ? "bg-white text-indigo-700 border border-indigo-200 shadow-sm dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-700/60"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
            title="Switch to Character Reference Pack"
          >
            <User className="w-3 h-3" />
            Character
          </button>
          <button
            type="button"
            onClick={() => onSwitchEntityMode("location")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              entityMode === "location"
                ? "bg-white text-emerald-700 border border-emerald-200 shadow-sm dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700/60"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
            title="Switch to Location Reference Slots"
          >
            <MapPin className="w-3 h-3" />
            Location
          </button>
        </div>
      </div>

      <div className="max-w-md">
        <SubjectCombobox
          value={bulkSubject}
          onChange={onSubjectChange}
          subjects={subjects}
          onRegisterSubject={onRegisterSubject}
          placeholder={
            entityMode === "location"
              ? "e.g. Living Room, Rooftop, Neon Alley, Cyber Cafe"
              : "e.g. Jackie, John Doe, Cyberpunk Agent"
          }
          disabled={disabled}
        />
      </div>
    </div>
  );
};
