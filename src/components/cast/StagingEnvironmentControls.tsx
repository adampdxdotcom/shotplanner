import React from "react";
import { Image as ImageIcon, MonitorPlay, SunMedium, LayoutGrid, Maximize, FileImage, MapPin } from "lucide-react";
import { MediaAsset } from "../../types";

export interface StagingEnvironmentControlsProps {
  locationAssets: MediaAsset[];
  selectedLocationFilename: string;
  setSelectedLocationFilename: (filename: string) => void;
  customLocationName: string;
  setCustomLocationName: (name: string) => void;
  selectedAtmosphere: string;
  setSelectedAtmosphere: (atm: string) => void;
  viewportRatio: string;
  setViewportRatio: (ratio: string) => void;
  showGrid: boolean;
  setShowGrid: (show: boolean) => void;
  showSafeAreas: boolean;
  setShowSafeAreas: (show: boolean) => void;
  onClearBackground: () => void;
}

const LIGHTING_ATMOSPHERES = [
  { id: "golden_hour", label: "Golden Hour Warmth" },
  { id: "overcast", label: "Cool Overcast / Diffused" },
  { id: "noir", label: "Moody High-Contrast Noir" },
  { id: "cyberpunk", label: "Cyberpunk Neon Glow" },
  { id: "interior_warm", label: "Interior Practical Lighting" },
  { id: "studio", label: "Clean Studio Lighting" }
];

export const StagingEnvironmentControls: React.FC<StagingEnvironmentControlsProps> = ({
  locationAssets,
  selectedLocationFilename,
  setSelectedLocationFilename,
  customLocationName,
  setCustomLocationName,
  selectedAtmosphere,
  setSelectedAtmosphere,
  viewportRatio,
  setViewportRatio,
  showGrid,
  setShowGrid,
  showSafeAreas,
  setShowSafeAreas,
  onClearBackground
}) => {
  return (
    <div className="w-full bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <MonitorPlay className="w-4 h-4 text-zinc-400" />
        <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          Environment & Viewport Settings
        </h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Background Select */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5" />
            Background Asset
          </label>
          <div className="flex items-center gap-2">
            <select
              value={selectedLocationFilename}
              onChange={(e) => setSelectedLocationFilename(e.target.value)}
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500/50"
            >
              <option value="">(None - Transparent)</option>
              {locationAssets.map(asset => (
                <option key={asset.id || asset.filename} value={asset.filename}>
                  {asset.subject || asset.filename}
                </option>
              ))}
            </select>
            {selectedLocationFilename && (
              <button
                type="button"
                onClick={onClearBackground}
                className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-red-400 hover:bg-zinc-700 transition-colors"
                title="Clear Background"
              >
                <FileImage className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Custom Location Name */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            Location Description
          </label>
          <input
            type="text"
            value={customLocationName}
            onChange={(e) => setCustomLocationName(e.target.value)}
            placeholder="e.g. Abandoned Warehouse"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50"
          />
        </div>

        {/* Lighting/Atmosphere */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5">
            <SunMedium className="w-3.5 h-3.5" />
            Atmosphere
          </label>
          <select
            value={selectedAtmosphere}
            onChange={(e) => setSelectedAtmosphere(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500/50"
          >
            {LIGHTING_ATMOSPHERES.map(atm => (
              <option key={atm.id} value={atm.id}>{atm.label}</option>
            ))}
          </select>
        </div>

        {/* Viewport & Overlays */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5">
            <Maximize className="w-3.5 h-3.5" />
            Viewport Ratio
          </label>
          <div className="flex items-center gap-2">
            <select
              value={viewportRatio}
              onChange={(e) => setViewportRatio(e.target.value)}
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500/50"
            >
              <option value="16:9">16:9 (Landscape)</option>
              <option value="21:9">21:9 (Cinematic)</option>
              <option value="4:3">4:3 (Classic)</option>
              <option value="1:1">1:1 (Square)</option>
              <option value="9:16">9:16 (Vertical)</option>
            </select>
            <button
              type="button"
              onClick={() => setShowGrid(!showGrid)}
              className={`p-1.5 rounded-lg border transition-colors ${showGrid ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}
              title="Toggle Rule of Thirds Grid"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
