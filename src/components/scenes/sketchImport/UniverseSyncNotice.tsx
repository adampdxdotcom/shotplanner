import React from "react";
import { Globe } from "lucide-react";
import { UniverseCharacterProfile, MediaAsset } from "../../../types";

interface UniverseSyncNoticeProps {
  charactersToImport: UniverseCharacterProfile[];
  assetsToImport: MediaAsset[];
}

export const UniverseSyncNotice: React.FC<UniverseSyncNoticeProps> = ({
  charactersToImport,
  assetsToImport
}) => {
  if (charactersToImport.length === 0) return null;

  return (
    <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-300 text-xs flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <Globe className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <div>
          <span className="font-bold">Universe Sync Notice:</span> {charactersToImport.length}{" "}
          {charactersToImport.length === 1 ? "character" : "characters"} (
          <span className="font-semibold underline">
            {charactersToImport.map(c => c.name).join(", ")}
          </span>
          ) and {assetsToImport.length} reference{" "}
          {assetsToImport.length === 1 ? "asset" : "assets"} will be imported into this scene.
        </div>
      </div>
      <span className="px-2 py-0.5 rounded-full bg-amber-200/70 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-bold text-[10px] tracking-wide shrink-0">
        AUTO-IMPORT
      </span>
    </div>
  );
};
