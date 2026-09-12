import React, { useState } from "react";
import { SlidersHorizontal, UploadCloud } from "lucide-react";
import { getModifierConfig, updateDescriptionWithModifier } from "../../../utils/assetModifiers";

interface BulkUploadGeneralDropzoneProps {
  entityMode: "character" | "location";
  bulkAssetType: string;
  setBulkAssetType: (type: string) => void;
  bulkModifier: string;
  setBulkModifier: (mod: string) => void;
  bulkDescription: string;
  setBulkDescription: (desc: string) => void;
  onFilesAdded: (files: File[]) => void;
  disabled?: boolean;
}

export const BulkUploadGeneralDropzone: React.FC<BulkUploadGeneralDropzoneProps> = ({
  entityMode,
  bulkAssetType,
  setBulkAssetType,
  bulkModifier,
  setBulkModifier,
  bulkDescription,
  setBulkDescription,
  onFilesAdded,
  disabled = false
}) => {
  const [dragActive, setDragActive] = useState(false);
  const modifierConfig = getModifierConfig(bulkAssetType);

  const handleModifierChange = (modValue: string) => {
    setBulkModifier(modValue);
    const updated = updateDescriptionWithModifier(bulkDescription, "Headshot", modValue);
    setBulkDescription(updated);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesAdded(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesAdded(Array.from(e.target.files));
    }
    if (e.target) e.target.value = "";
  };

  return (
    <div className="bg-zinc-50 dark:bg-zinc-950/90 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
          <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
          Additional Media & General Batch Dropzone
        </h4>
        <span className="text-[10px] text-zinc-500">
          For miscellaneous props, scenes, audio, and videos
        </span>
      </div>

      {/* Batch Defaults */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
            Default Semantic Type
          </label>
          <select
            value={bulkAssetType}
            onChange={(e) => setBulkAssetType(e.target.value)}
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 focus:border-amber-500 rounded-lg px-2.5 py-2 text-xs text-zinc-900 dark:text-zinc-200 outline-none shadow-sm"
            disabled={disabled}
          >
            <option value="Headshot">Headshot</option>
            <option value="Body Reference">Body Reference</option>
            <option value="Scene Reference">Scene Reference</option>
            <option value="Object Reference">Object Reference</option>
            <option value="Style Reference">Style Reference</option>
            <option value="Voiceover Audio">Voiceover Audio</option>
            <option value="Soundtrack / BGM">Soundtrack / BGM</option>
            <option value="SFX / Ambient">SFX / Ambient</option>
            <option value="Motion Reference Video">Motion Reference Video</option>
          </select>
        </div>

        {modifierConfig ? (
          <div>
            <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Companion Modifier
            </label>
            <select
              value={bulkModifier}
              onChange={(e) => handleModifierChange(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 focus:border-amber-500 rounded-lg px-2.5 py-2 text-xs text-zinc-900 dark:text-zinc-200 outline-none shadow-sm"
              disabled={disabled}
            >
              <option value="">None (Standard)</option>
              {modifierConfig.modifiers.map((mod) => (
                <option key={mod.id} value={mod.modifier}>
                  {mod.label} ({mod.modifier})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 dark:text-zinc-500 mb-1">
              Companion Modifier
            </label>
            <div className="w-full bg-zinc-100 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-2 text-xs text-zinc-400 dark:text-zinc-500 cursor-not-allowed">
              Only active for Headshot, Body & Scene Reference
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
          Default Prompt Description
        </label>
        <textarea
          value={bulkDescription}
          onChange={(e) => setBulkDescription(e.target.value)}
          placeholder={
            entityMode === "location"
              ? "Brief prompt description applied to batch files (e.g. scene reference, wide establishing angle, ambient daylight)..."
              : "Brief prompt description applied to batch files (e.g. moody tavern lighting, 8k portrait, cinematic outfit)..."
          }
          rows={2}
          className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-zinc-200 outline-none resize-none placeholder-zinc-400 dark:placeholder-zinc-600 shadow-sm"
          disabled={disabled}
        />
      </div>

      {/* General Dropzone */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all ${
          dragActive
            ? "border-amber-500 bg-amber-500/10"
            : "border-zinc-300 dark:border-zinc-800 bg-zinc-100/60 dark:bg-zinc-900/40 hover:bg-zinc-200/50 dark:hover:bg-zinc-900/70 hover:border-zinc-400 dark:hover:border-zinc-700"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="relative z-10 flex flex-col items-center space-y-2.5">
          <div className="p-2.5 bg-white dark:bg-zinc-800/80 rounded-full border border-zinc-200 dark:border-zinc-700/60 shadow-sm">
            <UploadCloud className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              Drag and drop general batch files here
            </p>
            <p className="text-[11px] text-zinc-500">
              Images, audio files, and video clips
            </p>
          </div>
          <div>
            <label className="cursor-pointer inline-flex items-center justify-center px-3.5 py-1.5 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 rounded-lg transition-colors border border-zinc-300 dark:border-zinc-700 shadow-sm">
              <span>Browse Files</span>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                disabled={disabled}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
