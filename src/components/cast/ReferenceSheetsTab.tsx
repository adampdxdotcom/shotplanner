import React, { useState, useEffect, useMemo } from "react";
import { 
  LayoutGrid, Columns3, Grid2X2, Grid3X3, Image as ImageIcon, 
  Sparkles, User, Trash2, Wand2, Download, RefreshCw, Layers, 
  Paintbrush, Eye, Check, Loader2 
} from "lucide-react";
import { MediaAsset } from "../../types";
import { getAssetMediaUrl } from "../../utils/assetUrl";
import { AssetUploadModal } from "../AssetUploadModal";
import { ReferenceSheetPreviewModal } from "./ReferenceSheetPreviewModal";
import { 
  renderReferenceSheetToBlob, 
  downloadReferenceSheetBlob 
} from "../../utils/referenceSheetRenderer";

export type SheetLayoutPreset = "3-panel" | "4-panel" | "9-panel";

export interface ReferenceSheetsTabProps {
  activeSubject: string;
  activeScene?: string;
  currentCharacterAssets: MediaAsset[];
  allAssets?: MediaAsset[];
  characters?: Record<string, any>;
  subjects?: string[];
  onAssetSaved?: (asset: MediaAsset) => void;
  addToast?: (message: string, type?: "success" | "error" | "info") => void;
}

interface PanelSlotConfig {
  id: number;
  label: string;
  sublabel: string;
}

interface AssignedSlotData {
  asset?: MediaAsset;
  url: string;
  name?: string;
}

const LAYOUT_CONFIGS: Record<SheetLayoutPreset, {
  name: string;
  aspectRatioLabel: string;
  aspectClass: string;
  gridClass: string;
  slots: PanelSlotConfig[];
  description: string;
}> = {
  "3-panel": {
    name: "3-Panel Turnaround",
    aspectRatioLabel: "16:9 Widescreen",
    aspectClass: "aspect-video",
    gridClass: "grid grid-cols-3 gap-3",
    description: "Three vertical panels arranged side-by-side. Optimal for character turnarounds, full-body poses, or 3-angle model conditioning.",
    slots: [
      { id: 1, label: "Panel 1", sublabel: "Left Profile / 3/4" },
      { id: 2, label: "Panel 2", sublabel: "Frontal / Center" },
      { id: 3, label: "Panel 3", sublabel: "Right Profile / 3/4" }
    ]
  },
  "4-panel": {
    name: "4-Panel Quad",
    aspectRatioLabel: "1:1 Square",
    aspectClass: "aspect-square",
    gridClass: "grid grid-cols-2 grid-rows-2 gap-3",
    description: "A balanced 2×2 quad grid. Perfect for standard headshot packages: Facing, 3/4 dramatic, profile silhouette, and emotive expression.",
    slots: [
      { id: 1, label: "Panel 1", sublabel: "Front Facing" },
      { id: 2, label: "Panel 2", sublabel: "3/4 Angle" },
      { id: 3, label: "Panel 3", sublabel: "Full Profile" },
      { id: 4, label: "Panel 4", sublabel: "Expression / Action" }
    ]
  },
  "9-panel": {
    name: "9-Panel Matrix",
    aspectRatioLabel: "1:1 Square",
    aspectClass: "aspect-square",
    gridClass: "grid grid-cols-3 grid-rows-3 gap-2",
    description: "A 3×3 director contact matrix. Comprehensive coverage for extensive facial expressions, lighting variations, costume details, and props.",
    slots: [
      { id: 1, label: "Panel 1", sublabel: "Neutral Front" },
      { id: 2, label: "Panel 2", sublabel: "Slight 3/4" },
      { id: 3, label: "Panel 3", sublabel: "Full 3/4" },
      { id: 4, label: "Panel 4", sublabel: "Profile Left" },
      { id: 5, label: "Panel 5", sublabel: "Hero / Close" },
      { id: 6, label: "Panel 6", sublabel: "Profile Right" },
      { id: 7, label: "Panel 7", sublabel: "Looking Up" },
      { id: 8, label: "Panel 8", sublabel: "Emotive / Mood" },
      { id: 9, label: "Panel 9", sublabel: "Looking Down" }
    ]
  }
};

export const ReferenceSheetsTab: React.FC<ReferenceSheetsTabProps> = ({
  activeSubject,
  activeScene,
  currentCharacterAssets,
  allAssets = [],
  characters = {},
  subjects = [],
  onAssetSaved,
  addToast
}) => {
  const [selectedLayout, setSelectedLayout] = useState<SheetLayoutPreset>("3-panel");
  const [sheetName, setSheetName] = useState<string>(
    activeSubject ? `${activeSubject} Reference Sheet` : "Character Reference Sheet"
  );

  const effectiveSubjects = useMemo(() => {
    const list = subjects.length > 0 ? [...subjects] : [];
    if (activeSubject && !list.includes(activeSubject)) {
      list.push(activeSubject);
    }
    return list;
  }, [subjects, activeSubject]);

  // Styling and composition options
  const [theme, setTheme] = useState<"studio-dark" | "neutral-charcoal" | "slate-navy" | "studio-white">("studio-dark");
  const [fitMode, setFitMode] = useState<"cover" | "contain">("cover");
  const [showLabels, setShowLabels] = useState(true);

  // Assigned slots state: slot index => assigned data
  const [assignedSlots, setAssignedSlots] = useState<Record<number, AssignedSlotData>>({});

  // Slot modal state
  const [pickerSlotIndex, setPickerSlotIndex] = useState<number | null>(null);

  // Generation & Preview modal state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSheet, setGeneratedSheet] = useState<{
    blob: Blob;
    dataUrl: string;
    width: number;
    height: number;
  } | null>(null);

  const activeConfig = LAYOUT_CONFIGS[selectedLayout];

  // Update sheet name when activeSubject changes if untouched
  useEffect(() => {
    if (activeSubject) {
      setSheetName(`${activeSubject} Reference Sheet`);
    }
  }, [activeSubject]);

  // Handle slot assignment from modal
  const handleAssignAsset = (slotIdx: number, asset: MediaAsset) => {
    const url = getAssetMediaUrl(asset.filename);
    setAssignedSlots(prev => ({
      ...prev,
      [slotIdx]: { asset, url, name: asset.subject_name || asset.filename }
    }));
    if (addToast) addToast(`Assigned ${asset.subject_name || "asset"} to slot ${slotIdx + 1}`, "success");
  };

  const handleAssignCustomImage = (slotIdx: number, dataUrl: string, name: string) => {
    setAssignedSlots(prev => ({
      ...prev,
      [slotIdx]: { url: dataUrl, name }
    }));
    if (addToast) addToast(`Assigned uploaded image to slot ${slotIdx + 1}`, "success");
  };

  // Remove single slot
  const handleClearSlot = (slotIdx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setAssignedSlots(prev => {
      const next = { ...prev };
      delete next[slotIdx];
      return next;
    });
  };

  // Clear all slots
  const handleClearAll = () => {
    setAssignedSlots({});
    if (addToast) addToast("Cleared all reference sheet slots", "info");
  };

  // Quick auto-fill empty slots using current character assets
  const handleAutoFill = () => {
    if (currentCharacterAssets.length === 0) {
      if (addToast) addToast(`No assets found for ${activeSubject || "selected character"}`, "info");
      return;
    }
    const newAssigned = { ...assignedSlots };
    let assetIdx = 0;

    activeConfig.slots.forEach((slot, i) => {
      if (!newAssigned[i] && assetIdx < currentCharacterAssets.length) {
        const a = currentCharacterAssets[assetIdx];
        newAssigned[i] = {
          asset: a,
          url: getAssetMediaUrl(a.filename),
          name: a.subject_name || a.filename
        };
        assetIdx++;
      }
    });

    setAssignedSlots(newAssigned);
    if (addToast) addToast(`Populated ${assetIdx} reference slots for ${activeSubject}`, "success");
  };

  // Direct drop file handler for any slot
  const handleSlotDrop = (slotIdx: number, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        handleAssignCustomImage(slotIdx, dataUrl, file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  // Count assigned slots
  const assignedCount = Object.keys(assignedSlots).length;

  // Render and stitch composite reference sheet
  const handleGenerateSheet = async () => {
    if (assignedCount === 0) {
      if (addToast) addToast("Please assign at least one reference panel before stitching", "info");
      return;
    }

    try {
      setIsGenerating(true);
      const slotRenderList = activeConfig.slots.map((slot, idx) => ({
        slotIndex: idx,
        label: slot.label,
        sublabel: slot.sublabel,
        imageUrl: assignedSlots[idx]?.url
      }));

      const result = await renderReferenceSheetToBlob({
        layout: selectedLayout,
        slots: slotRenderList,
        theme,
        fitMode,
        showLabels,
        characterName: activeSubject,
        sheetTitle: sheetName
      });

      setGeneratedSheet(result);
      if (addToast) addToast("Reference sheet stitched successfully!", "success");
    } catch (err: any) {
      console.error("Composite generation failed:", err);
      if (addToast) addToast("Failed to stitch reference sheet: " + err.message, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div id="reference-sheets-tab" className="flex flex-col gap-6 text-zinc-900 dark:text-zinc-100">
      {/* TOP HEADER & ACTOR CONTEXT */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30 flex items-center justify-center shrink-0">
                <LayoutGrid className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">
                Reference Sheet Assembler
              </h2>
              <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-full">
                Interactive Studio
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Assemble multi-angle character turnarounds and costume references into unified sheets for high-consistency conditioning.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-3 py-2 rounded-lg text-xs">
            <User className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="text-zinc-500 dark:text-zinc-400">Actor Context:</span>
            {activeSubject ? (
              <span className="font-bold text-amber-600 dark:text-amber-400">{activeSubject}</span>
            ) : (
              <span className="italic text-zinc-400 dark:text-zinc-500">Pick in Header</span>
            )}
          </div>
        </div>

        {/* LAYOUT SELECTOR & SHEET NAME */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/80">
          <div className="lg:col-span-8 flex flex-col gap-2">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Layout Preset &amp; Aspect Ratio
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(["3-panel", "4-panel", "9-panel"] as const).map(preset => {
                const config = LAYOUT_CONFIGS[preset];
                const active = selectedLayout === preset;
                const Icon = preset === "3-panel" ? Columns3 : preset === "4-panel" ? Grid2X2 : Grid3X3;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setSelectedLayout(preset)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 shadow-xs ${
                      active
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 dark:border-emerald-500/80 ring-1 ring-emerald-500"
                        : "bg-white dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${active ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400"}`} />
                        <span className="text-xs font-bold">{config.name}</span>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        {preset === "3-panel" ? "16:9" : "1:1"}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
                      {config.description.split(".")[0]}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col justify-between gap-2">
            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Reference Sheet Label
              </label>
              <input
                type="text"
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
                placeholder="e.g. Detective Turnaround Sheet"
                className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 outline-none transition-colors"
              />
              <span className="block mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                Asset identifier saved to character library
              </span>
            </div>

            {/* STYLING CONTROLS */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-zinc-500">Theme:</span>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as any)}
                  className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded text-[11px] px-2 py-1 outline-none text-zinc-800 dark:text-zinc-200"
                >
                  <option value="studio-dark">Studio Dark</option>
                  <option value="neutral-charcoal">Neutral Charcoal</option>
                  <option value="slate-navy">Slate Navy</option>
                  <option value="studio-white">Studio White</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-zinc-500">Fit:</span>
                <button
                  type="button"
                  onClick={() => setFitMode(fitMode === "cover" ? "contain" : "cover")}
                  className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 capitalize cursor-pointer"
                >
                  {fitMode}
                </button>
                <label className="flex items-center gap-1 text-[11px] text-zinc-500 cursor-pointer ml-1">
                  <input
                    type="checkbox"
                    checked={showLabels}
                    onChange={(e) => setShowLabels(e.target.checked)}
                    className="rounded accent-emerald-500 w-3.5 h-3.5"
                  />
                  <span>Labels</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* COMPOSITE CANVAS & INTERACTIVE SLOTS */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs flex flex-col items-center gap-6">
        <div className="w-full flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
              Sheet Canvas Preview
            </span>
            <span className="text-[11px] text-zinc-500 font-mono">
              ({activeConfig.aspectRatioLabel} • {assignedCount}/{activeConfig.slots.length} Filled)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAutoFill}
              disabled={currentCharacterAssets.length === 0}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Automatically populate empty slots from character headshots"
            >
              <Wand2 className="w-3.5 h-3.5 text-amber-500" />
              <span>Auto-Fill from Cast</span>
            </button>

            {assignedCount > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Aspect Ratio Container */}
        <div className="w-full flex justify-center">
          <div 
            className={`w-full ${
              selectedLayout === "3-panel" ? "max-w-4xl" : "max-w-xl"
            } ${activeConfig.aspectClass} bg-zinc-950 rounded-xl p-3 border-2 border-dashed border-zinc-300 dark:border-zinc-800 relative shadow-inner overflow-hidden flex flex-col`}
          >
            <div className={`w-full h-full ${activeConfig.gridClass}`}>
              {activeConfig.slots.map((slot, idx) => {
                const assigned = assignedSlots[idx];
                return (
                  <div
                    key={slot.id}
                    onClick={() => setPickerSlotIndex(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleSlotDrop(idx, e)}
                    className={`relative rounded-lg border-2 overflow-hidden flex flex-col items-center justify-center text-center transition-all cursor-pointer group select-none ${
                      assigned
                        ? "border-emerald-500/80 bg-zinc-900"
                        : "border-dashed border-zinc-800 hover:border-emerald-500/60 bg-zinc-900/60 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {assigned ? (
                      <>
                        <img
                          src={assigned.url}
                          alt={slot.label}
                          className={`w-full h-full ${fitMode === "cover" ? "object-cover" : "object-contain"} transition-transform duration-200 group-hover:scale-102`}
                        />

                        {/* Top action overlay on hover */}
                        <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 p-1 rounded-md backdrop-blur-xs">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPickerSlotIndex(idx);
                            }}
                            className="p-1 text-zinc-300 hover:text-white rounded hover:bg-zinc-700"
                            title="Replace image"
                          >
                            <RefreshCw className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleClearSlot(idx, e)}
                            className="p-1 text-red-400 hover:text-red-200 rounded hover:bg-zinc-700"
                            title="Remove image"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Bottom label overlay */}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-1.5 text-left">
                          <p className="text-[10px] font-bold text-white truncate">
                            {slot.label}: {slot.sublabel}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="p-3 flex flex-col items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 group-hover:bg-emerald-600/30 border border-zinc-700 group-hover:border-emerald-500/60 flex items-center justify-center mb-1.5 transition-colors">
                          <ImageIcon className="w-4 h-4 text-zinc-400 group-hover:text-emerald-400" />
                        </div>
                        <span className="text-xs font-bold tracking-tight">
                          {slot.label}
                        </span>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium line-clamp-1 mt-0.5">
                          {slot.sublabel}
                        </span>
                        <span className="mt-2 text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-black/40 text-zinc-500 group-hover:text-emerald-400 group-hover:bg-emerald-950/60 transition-colors">
                          + Assign Image
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="w-full flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <Sparkles className="w-4 h-4 text-emerald-500" />
            <span>
              {assignedCount === 0
                ? "Click any panel or drag images from your desk to assign."
                : `${assignedCount} panel${assignedCount === 1 ? "" : "s"} ready. Click below to stitch high-res sheet.`}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleGenerateSheet}
              disabled={isGenerating || assignedCount === 0}
              className="px-5 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-all flex items-center gap-2 shadow-xs cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Stitching High-Res Canvas...</span>
                </>
              ) : (
                <>
                  <LayoutGrid className="w-4 h-4" />
                  <span>Generate Reference Sheet</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* SLOT ASSET PICKER / UPLOAD MODAL */}
      <AssetUploadModal
        isOpen={pickerSlotIndex !== null}
        activeTab="image"
        uploadModalSlot={pickerSlotIndex !== null ? { type: "image", index: pickerSlotIndex } : null}
        libraryAssets={allAssets.length > 0 ? allAssets : currentCharacterAssets}
        subjects={effectiveSubjects}
        characters={characters}
        sceneName={activeScene}
        onClose={() => setPickerSlotIndex(null)}
        onAssetUploaded={(asset, slotIdx) => {
          handleAssignAsset(slotIdx, asset);
          if (onAssetSaved) {
            onAssetSaved(asset);
          }
          setPickerSlotIndex(null);
        }}
      />

      {/* RENDERED COMPOSITE PREVIEW & EXPORT MODAL */}
      <ReferenceSheetPreviewModal
        isOpen={generatedSheet !== null}
        onClose={() => setGeneratedSheet(null)}
        sheetData={generatedSheet}
        sheetTitle={sheetName}
        activeSubject={activeSubject}
        activeScene={activeScene}
        layoutPreset={activeConfig.name}
        onAssetSaved={onAssetSaved}
        addToast={addToast}
      />
    </div>
  );
};
