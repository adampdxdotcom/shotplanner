import React from "react";
import { Users, Plus, Globe } from "lucide-react";
import { MediaAsset, CharacterProfile } from "../../types";
import { SceneCharacterCard } from "./SceneCharacterCard";

interface SceneCastListProps {
  renderedSubjects: string[];
  characters: Record<string, CharacterProfile>;
  assets: MediaAsset[];
  universeCount: number;
  universeCharacters: Record<string, any>;
  pushingToUniverse: Record<string, boolean>;
  onOpenNewCharacterModal: () => void;
  onSwitchToUniverseTab: () => void;
  onUpdateCharacter: (profile: CharacterProfile) => void;
  onOpenSyncDiff: (subject: string) => void;
  onOpenBulkUpload: (subject: string, isLoc: boolean) => void;
  onOpenAssetStudio: (subject: string, isLoc: boolean) => void;
  onRequestDeleteCharacter: (subject: string) => void;
  onOpenLightbox: (asset: MediaAsset) => void;
  onOpenEditAsset: (asset: MediaAsset) => void;
  onDeleteAsset: (asset: MediaAsset) => void;
}

export const SceneCastList: React.FC<SceneCastListProps> = ({
  renderedSubjects,
  characters,
  assets,
  universeCount,
  universeCharacters,
  pushingToUniverse,
  onOpenNewCharacterModal,
  onSwitchToUniverseTab,
  onUpdateCharacter,
  onOpenSyncDiff,
  onOpenBulkUpload,
  onOpenAssetStudio,
  onRequestDeleteCharacter,
  onOpenLightbox,
  onOpenEditAsset,
  onDeleteAsset,
}) => {
  if (renderedSubjects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl bg-zinc-50/60 dark:bg-zinc-900/30">
        <div className="w-16 h-16 bg-zinc-200/80 dark:bg-zinc-800/50 rounded-full flex items-center justify-center mb-4">
          <Users className="w-8 h-8 text-zinc-500 dark:text-zinc-600" />
        </div>
        <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-300 mb-2">No characters in scene</h3>
        <p className="text-zinc-600 dark:text-zinc-500 max-w-md mb-6 text-xs">
          Register characters for this scene, or switch to the Universe Cast tab to pull in characters from your global roster.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenNewCharacterModal}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow"
          >
            <Plus className="w-4 h-4" />
            Add First Scene Character
          </button>
          {universeCount > 0 && (
            <button
              type="button"
              onClick={onSwitchToUniverseTab}
              className="bg-amber-600 hover:bg-amber-500 text-black px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer shadow"
            >
              <Globe className="w-4 h-4" />
              Browse Universe ({universeCount})
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {renderedSubjects.map((subject) => {
        const isInUniverse = !!universeCharacters[subject] || !!characters[subject]?.in_universe;
        const isPushing = !!pushingToUniverse[subject];

        return (
          <SceneCharacterCard
            key={subject}
            subject={subject}
            characters={characters}
            assets={assets}
            isInUniverse={isInUniverse}
            isPushingToUniverse={isPushing}
            onUpdateCharacter={onUpdateCharacter}
            onOpenSyncDiff={onOpenSyncDiff}
            onOpenBulkUpload={onOpenBulkUpload}
            onOpenAssetStudio={onOpenAssetStudio}
            onRequestDeleteCharacter={onRequestDeleteCharacter}
            onOpenLightbox={onOpenLightbox}
            onOpenEditAsset={onOpenEditAsset}
            onDeleteAsset={onDeleteAsset}
          />
        );
      })}
    </div>
  );
};
