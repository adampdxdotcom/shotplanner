import React from "react";
import { FileImage } from "lucide-react";

/**
 * Placeholder displayed when no active shot is selected in the Asset Manager.
 */
export const EmptyShotState: React.FC = () => {
  return (
    <div className="w-full flex flex-col items-center justify-center p-12 bg-white dark:bg-zinc-900/40 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs">
      <FileImage className="w-12 h-12 text-zinc-400 dark:text-zinc-600 mb-4" />
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-300 mb-2">No Shot Selected</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-500 text-center max-w-md">
        Choose an existing shot from the Shot Dossier above or click <strong className="text-indigo-600 dark:text-indigo-400 font-semibold">"+ New Shot"</strong> to stage a new camera setup and assign media assets.
      </p>
    </div>
  );
};
