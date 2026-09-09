import React, { useState, useRef } from "react";
import { Zap, X, UploadCloud, CheckCircle2, Check } from "lucide-react";
import { MediaAsset } from "../../types";
import { useHeadshotGenerator } from "../../hooks/useHeadshotGenerator";

const HEADSHOT_PRESETS = [
  "Facing",
  "3/4 Profile",
  "Full Profile",
  "Cinematic / Mood"
];

export interface HeadshotGeneratorTabProps {
  activeSubject: string;
  activeScene: string;
  currentCharacterAssets: MediaAsset[];
  onAssetSaved?: (asset: MediaAsset) => void;
  addToast?: (message: string, type: "success" | "error" | "info") => void;
  onClose: () => void;
}

export const HeadshotGeneratorTab: React.FC<HeadshotGeneratorTabProps> = ({
  activeSubject,
  activeScene,
  currentCharacterAssets,
  onAssetSaved,
  addToast,
  onClose
}) => {
  const [selectedSeed, setSelectedSeed] = useState<string | null>(null);
  const [seedType, setSeedType] = useState<"existing" | "upload" | null>(null);
  const [seedMimeType, setSeedMimeType] = useState<string>("image/png");
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "2:3" | "3:4" | "4:3" | "9:16" | "16:9">("1:1");
  const [selectedPresets, setSelectedPresets] = useState<string[]>(["Facing", "3/4 Profile"]);
  const {
    isGenerating,
    isSaving,
    headshotError,
    setHeadshotError,
    candidates,
    selectedCandidates,
    toggleCandidate,
    handleGenerateHeadshots,
    handleSaveHeadshots
  } = useHeadshotGenerator({
    activeSubject,
    activeScene,
    aspectRatio,
    selectedPresets,
    seedType,
    selectedSeed,
    seedMimeType,
    onAssetSaved,
    addToast,
    onClose
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      const b64 = result.split(",")[1];
      setSelectedSeed(b64);
      setSeedType("upload");
      setSeedMimeType(file.type);
    };
    reader.readAsDataURL(file);
  };

  const handleSelectExisting = (filename: string) => {
    setSelectedSeed(filename);
    setSeedType("existing");
    setSeedMimeType("image/png");
  };

  const togglePreset = (preset: string) => {
    setSelectedPresets(prev => 
      prev.includes(preset) ? prev.filter(p => p !== preset) : [...prev, preset]
    );
  };

  const toggleAllPresets = () => {
    if (selectedPresets.length === HEADSHOT_PRESETS.length) {
      setSelectedPresets([]);
    } else {
      setSelectedPresets([...HEADSHOT_PRESETS]);
    }
  };


  

  return (
    <div className="p-5 space-y-6">
      {headshotError && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl p-3 text-sm text-red-700 dark:text-red-300 flex items-center justify-between shadow-2xs">
          <span>{headshotError}</span>
          <button onClick={() => setHeadshotError(null)} className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Seed Selection Section */}
      <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-200 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 flex items-center justify-center text-xs font-bold">
              1
            </span>
            Select Base Reference (Seed) for {activeSubject || "Selected Actor"}
          </h3>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
            {currentCharacterAssets.length} reference asset{currentCharacterAssets.length === 1 ? "" : "s"} found
          </span>
        </div>

        {/* Upload or Grid Picker */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {/* Upload Card */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl aspect-square flex flex-col items-center justify-center p-3 text-center cursor-pointer transition-all group relative ${
              seedType === "upload" 
                ? "border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-300 shadow-2xs" 
                : "border-zinc-300 hover:border-amber-500/60 bg-slate-50/80 hover:bg-amber-50/30 text-zinc-600 hover:text-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-700 dark:bg-zinc-900/30 dark:hover:bg-zinc-900/50 dark:text-zinc-400 dark:hover:text-zinc-200 shadow-2xs"
            }`}
          >
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <UploadCloud className={`w-5 h-5 mb-2 transition-colors ${
              seedType === "upload" 
                ? "text-amber-600 dark:text-amber-400" 
                : "text-zinc-400 group-hover:text-amber-600 dark:text-zinc-500 dark:group-hover:text-zinc-300"
            }`} />
            <span className={`text-[10px] font-semibold transition-colors ${
              seedType === "upload" 
                ? "text-amber-800 dark:text-amber-300 font-bold" 
                : "text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-200"
            }`}>
              {seedType === "upload" ? "Custom File Selected" : "Upload Image"}
            </span>
            {seedType === "upload" && (
              <div className="absolute top-1.5 right-1.5 bg-amber-500 text-black p-0.5 rounded-full shadow">
                <CheckCircle2 className="w-3.5 h-3.5 fill-black text-amber-500" />
              </div>
            )}
          </div>

          {/* Existing Assets */}
          {currentCharacterAssets.map((asset, i) => {
            const isSelected = seedType === "existing" && selectedSeed === asset.filename;
            return (
              <div
                key={asset.id || i}
                onClick={() => handleSelectExisting(asset.filename)}
                className={`relative rounded-xl overflow-hidden aspect-square border-2 transition-all cursor-pointer group shadow-2xs ${
                  isSelected 
                    ? "border-amber-500 ring-2 ring-amber-500/40" 
                    : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                }`}
              >
                <img
                  src={`/api/assets/${asset.filename}`}
                  alt={asset.description || asset.filename}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-1.5">
                  <p className="text-[10px] text-white font-medium truncate">{asset.type || "Reference"}</p>
                </div>
                {isSelected && (
                  <div className="absolute top-1.5 right-1.5 bg-amber-500 text-black p-0.5 rounded-full shadow">
                    <CheckCircle2 className="w-3.5 h-3.5 fill-black text-amber-500" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Generation Controls */}
      <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-4 shadow-2xs">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-200 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 flex items-center justify-center text-xs font-bold">
              2
            </span>
            Angle &amp; Composition Presets
          </h3>
          <button
            type="button"
            onClick={toggleAllPresets}
            className="text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 font-semibold cursor-pointer"
          >
            {selectedPresets.length === HEADSHOT_PRESETS.length ? "Deselect All" : "Select All"}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {HEADSHOT_PRESETS.map(preset => {
            const active = selectedPresets.includes(preset);
            return (
              <button
                key={preset}
                type="button"
                onClick={() => togglePreset(preset)}
                className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  active 
                    ? "bg-amber-50/90 border-amber-400 text-amber-950 dark:bg-amber-950/30 dark:border-amber-500/50 dark:text-amber-300 ring-1 ring-amber-400/40 shadow-xs" 
                    : "bg-slate-50/70 border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-100/60 dark:bg-zinc-900/60 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-900 shadow-2xs"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold ${active ? "text-amber-950 dark:text-amber-300" : "text-zinc-800 dark:text-zinc-200"}`}>{preset}</span>
                  {active && (
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                  )}
                </div>
                <span className={`text-[10px] mt-1 ${active ? "text-amber-800/80 dark:text-amber-400/80" : "text-zinc-500 dark:text-zinc-400"}`}>
                  {preset === "Facing" && "Direct forward look"}
                  {preset === "3/4 Profile" && "Classic dramatic turn"}
                  {preset === "Full Profile" && "90 degree silhouette"}
                  {preset === "Cinematic / Mood" && "Atmospheric key lighting"}
                </span>
              </button>
            );
          })}
        </div>

        {/* Aspect Ratio Selector */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-zinc-200 dark:border-zinc-800/80">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Aspect Ratio:</span>
            {(["1:1", "2:3", "3:4", "4:3", "9:16", "16:9"] as const).map(ratio => (
              <button
                key={ratio}
                type="button"
                onClick={() => setAspectRatio(ratio)}
                className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors cursor-pointer ${
                  aspectRatio === ratio 
                    ? "bg-amber-500 text-black font-bold shadow-xs" 
                    : "bg-slate-100 hover:bg-slate-200 text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 dark:border-transparent"
                }`}
              >
                {ratio}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleGenerateHeadshots}
            disabled={isGenerating || !selectedSeed || selectedPresets.length === 0}
            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold px-5 py-2 rounded-lg text-xs flex items-center gap-2 transition-all shadow-xs cursor-pointer"
          >
            <Zap className="w-4 h-4 fill-black text-black" />
            {isGenerating ? "Synthesizing Headshots..." : `Generate ${selectedPresets.length} Variations`}
          </button>
        </div>
      </div>

      {/* Candidate Variations Review */}
      {candidates.length > 0 && (
        <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-200">Generated Variations</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Select the candidates you want to ingest into {activeSubject}'s reference library</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                {selectedCandidates.size} of {candidates.length} selected
              </span>
              <button
                type="button"
                onClick={handleSaveHeadshots}
                disabled={isSaving || selectedCandidates.size === 0}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer shadow-xs"
              >
                {isSaving ? "Saving to Cast..." : `Save Selected (${selectedCandidates.size})`}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {candidates.map((cand, idx) => {
              const isSelected = selectedCandidates.has(idx);
              return (
                <div
                  key={idx}
                  onClick={() => toggleCandidate(idx)}
                  className={`relative rounded-xl aspect-square overflow-hidden border-2 cursor-pointer transition-all group shadow-2xs ${
                    isSelected 
                      ? "border-amber-500 ring-2 ring-amber-500/40" 
                      : "border-zinc-200 dark:border-zinc-800 opacity-70 hover:opacity-100"
                  }`}
                >
                  <img
                    src={`data:image/png;base64,${cand.base64}`}
                    alt={cand.key}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      isSelected ? "bg-amber-500 text-black font-bold" : "bg-black/60 border border-zinc-600 text-white"
                    }`}>
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-black/80 px-2 py-1 text-[10px] text-zinc-300 font-mono text-center">
                    {cand.key}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
