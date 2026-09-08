import React, { useRef, useState } from "react";
import { MediaAsset } from "../../../types";
import { User, UploadCloud, Image as ImageIcon, AlertCircle } from "lucide-react";
import { getAssetMediaUrl } from "../../../utils/assetUrl";

interface KeyingCharacterAssetPickerProps {
  selectedCharacter: string;
  onSelectCharacter: (char: string) => void;
  availableCharacters: string[];
  characterAssets: MediaAsset[];
  selectedAsset: MediaAsset | null;
  onSelectAsset: (asset: MediaAsset | null) => void;
  customImageSrc: string | null;
  onFileDrop: (file: File) => void;
  isUploading: boolean;
}

export const KeyingCharacterAssetPicker: React.FC<KeyingCharacterAssetPickerProps> = ({
  selectedCharacter,
  onSelectCharacter,
  availableCharacters,
  characterAssets,
  selectedAsset,
  onSelectAsset,
  customImageSrc,
  onFileDrop,
  isUploading
}) => {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
      {/* Step 1: Cast Selector */}
      <div className="md:col-span-4 bg-zinc-900/60 border border-zinc-800 rounded-xl p-3.5 flex flex-col gap-3">
        <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-amber-400" />
          1. Select Cast Member
        </label>

        <select
          value={selectedCharacter}
          onChange={(e) => onSelectCharacter(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-amber-400 font-bold outline-none focus:border-amber-500 cursor-pointer"
        >
          {availableCharacters.map(char => (
            <option key={char} value={char}>{char}</option>
          ))}
        </select>

        <div className="text-[11px] text-zinc-400">
          <span>Available References: </span>
          <span className="font-semibold text-zinc-200">
            {characterAssets.length} image{characterAssets.length === 1 ? "" : "s"}
          </span>
        </div>

        {/* Quick Dropzone for new Pose Photo */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              onFileDrop(e.dataTransfer.files[0]);
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-1.5 ${
            dragActive 
              ? "border-indigo-500 bg-indigo-950/30 text-indigo-300" 
              : "border-zinc-800 hover:border-zinc-700 bg-zinc-950/60 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onFileDrop(e.target.files[0]);
              }
            }}
          />
          <UploadCloud className="w-5 h-5 text-indigo-400" />
          <div className="text-xs font-medium">
            {isUploading ? "Uploading Pose..." : "Drop new pose photo or click"}
          </div>
          <div className="text-[10px] text-zinc-500">Green screen, studio, or plain backdrop</div>
        </div>
      </div>

      {/* Step 2: Reference Pose Gallery */}
      <div className="md:col-span-8 bg-zinc-900/60 border border-zinc-800 rounded-xl p-3.5 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
            2. Choose Reference Pose
          </label>
          <span className="text-[10px] text-zinc-500 font-mono">
            Prioritizing Body & Pose references
          </span>
        </div>

        {characterAssets.length === 0 && !customImageSrc ? (
          <div className="h-36 flex flex-col items-center justify-center text-center p-4 border border-dashed border-zinc-800 rounded-lg text-zinc-500 text-xs gap-2">
            <AlertCircle className="w-6 h-6 text-zinc-600" />
            <span>No existing references found for {selectedCharacter}.</span>
            <span>Upload a photo using the dropzone on the left to start keying!</span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-800">
            {/* Custom uploaded item indicator if active */}
            {customImageSrc && (
              <div
                onClick={() => onSelectAsset(null)}
                className={`relative shrink-0 w-24 h-24 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                  !selectedAsset ? "border-amber-400 ring-2 ring-amber-400/40" : "border-zinc-800 opacity-60"
                }`}
              >
                <img src={customImageSrc} alt="Custom upload" className="w-full h-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 bg-black/80 px-1 py-0.5 text-[9px] text-amber-400 font-bold text-center truncate">
                  Uploaded Pose
                </div>
              </div>
            )}

            {/* Character assets */}
            {characterAssets.map((asset) => {
              const isSelected = selectedAsset?.filename === asset.filename && !customImageSrc;
              const isPoseTag = (asset.description || "").toLowerCase().includes("pose") || (asset.type || "").toLowerCase().includes("body");

              return (
                <div
                  key={asset.filename}
                  onClick={() => onSelectAsset(asset)}
                  className={`relative shrink-0 w-24 h-24 rounded-lg overflow-hidden border-2 cursor-pointer transition-all group ${
                    isSelected
                      ? "border-amber-400 ring-2 ring-amber-400/40"
                      : "border-zinc-800 hover:border-zinc-700 opacity-70 hover:opacity-100"
                  }`}
                >
                  <img
                    src={getAssetMediaUrl(asset.filename, true)}
                    alt={asset.description || asset.filename}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  
                  {/* Badge */}
                  <div className="absolute top-1 left-1">
                    {isPoseTag ? (
                      <span className="bg-indigo-600 text-white text-[8px] font-bold px-1 py-0.5 rounded shadow">
                        Pose
                      </span>
                    ) : (
                      <span className="bg-zinc-900/80 text-zinc-300 text-[8px] px-1 py-0.5 rounded">
                        {asset.type || "Ref"}
                      </span>
                    )}
                  </div>

                  <div className="absolute inset-x-0 bottom-0 bg-black/80 px-1 py-0.5 text-[9px] text-zinc-300 text-center truncate">
                    {asset.description || asset.filename}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
