import React from "react";
import { Search, RefreshCw, AlertCircle } from "lucide-react";
import { CivitaiFavorite } from "../../../types";
import { CivitaiFavoritesTray } from "../CivitaiFavoritesTray";

export interface CivitaiLookupCardProps {
  lookupQuery: string;
  setLookupQuery: (val: string) => void;
  lookingUp: boolean;
  onLookupModel: (query?: string) => void;
  lookupError: string | null;
  favorites: CivitaiFavorite[];
  activeVersionId?: number | null;
  onSelectFavorite: (fav: CivitaiFavorite) => void;
  onRemoveFavorite: (versionId: number | string, e: React.MouseEvent) => void;
  loadingFavorites: boolean;
}

export const CivitaiLookupCard: React.FC<CivitaiLookupCardProps> = ({
  lookupQuery,
  setLookupQuery,
  lookingUp,
  onLookupModel,
  lookupError,
  favorites,
  activeVersionId,
  onSelectFavorite,
  onRemoveFavorite,
  loadingFavorites
}) => {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5 text-cyan-400" />
          <span>Civitai Model URL or Model ID</span>
        </label>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            id="input-civitai-standalone-query"
            type="text"
            placeholder="e.g. https://civitai.com/models/133005 or model ID 133005..."
            value={lookupQuery}
            onChange={(e) => setLookupQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onLookupModel();
              }
            }}
            className="flex-1 bg-zinc-950 border-2 border-zinc-700 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
          />
          <button
            id="btn-lookup-civitai-standalone-model"
            type="button"
            onClick={() => onLookupModel()}
            disabled={lookingUp || !lookupQuery.trim()}
            className="px-4 py-2 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-100 border border-zinc-700 hover:border-cyan-500/50 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${lookingUp ? "animate-spin text-cyan-400" : "text-zinc-400"}`} />
            <span>{lookingUp ? "Inspecting..." : "Lookup Model"}</span>
          </button>
        </div>

        {/* Collapsible Saved Favorites Tray */}
        <div className="pt-1">
          <CivitaiFavoritesTray
            favorites={favorites}
            activeVersionId={activeVersionId}
            onSelectFavorite={onSelectFavorite}
            onRemoveFavorite={onRemoveFavorite}
            isLoading={loadingFavorites}
          />
        </div>
      </div>

      {/* Lookup Error Banner */}
      {lookupError && (
        <div className="p-3 rounded-lg border bg-red-950/30 border-red-800/40 text-red-300 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Lookup Failed</p>
            <p className="opacity-90 mt-0.5">{lookupError}</p>
          </div>
        </div>
      )}
    </div>
  );
};
