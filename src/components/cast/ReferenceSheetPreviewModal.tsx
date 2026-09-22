import React, { useState } from "react";
import { X, Download, Save, CheckCircle2, Loader2, Sparkles, LayoutGrid } from "lucide-react";
import { MediaAsset, sanitizeSlug } from "../../types";
import { downloadReferenceSheetBlob } from "../../utils/referenceSheetRenderer";
import { assetsApi } from "../../api";

export interface ReferenceSheetPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheetData: { blob: Blob; dataUrl: string; width: number; height: number } | null;
  sheetTitle: string;
  activeSubject: string;
  activeScene?: string;
  layoutPreset: string;
  onAssetSaved?: (asset: MediaAsset) => void;
  addToast?: (msg: string, type?: "success" | "error" | "info") => void;
}

export const ReferenceSheetPreviewModal: React.FC<ReferenceSheetPreviewModalProps> = ({
  isOpen,
  onClose,
  sheetData,
  sheetTitle,
  activeSubject,
  activeScene,
  layoutPreset,
  onAssetSaved,
  addToast
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  if (!isOpen || !sheetData) return null;

  // Format estimated file size
  const sizeMb = (sheetData.blob.size / (1024 * 1024)).toFixed(2);

  const cleanSubject = sanitizeSlug(activeSubject || "character") || "character";
  const defaultFilename = `refsheet_${cleanSubject}_${Date.now()}.png`;

  // Download directly to user machine
  const handleDownload = () => {
    downloadReferenceSheetBlob(sheetData.blob, defaultFilename);
    if (addToast) addToast("Reference sheet downloaded successfully.", "success");
  };

  // Upload to backend asset store
  const handleSaveToLibrary = async () => {
    try {
      setIsSaving(true);
      const formData = new FormData();
      formData.append("file", sheetData.blob, defaultFilename);
      formData.append("type", "Reference Sheet");
      formData.append("subject_name", activeSubject || "");
      formData.append("scene_name", activeScene || "");
      formData.append("description", `Composite reference sheet (${layoutPreset}) for ${activeSubject || "actor"}`);
      formData.append("tags", JSON.stringify(["Reference Sheet", layoutPreset, "Model Reference", activeSubject]));

      const data: any = await assetsApi.upload(formData);

      if (data && (data.success || data.asset)) {
        if (onAssetSaved && data.asset) onAssetSaved(data.asset);
        setHasSaved(true);
        if (addToast) addToast(`Saved reference sheet to ${activeSubject || "library"}!`, "success");
      } else {
        throw new Error(data?.error || "Failed to persist reference sheet.");
      }
    } catch (err: any) {
      console.error("Save error:", err);
      if (addToast) addToast(err.message || "Failed to save reference sheet", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <LayoutGrid className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>{sheetTitle || "Character Reference Sheet"}</span>
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                  {sheetData.width} × {sheetData.height}
                </span>
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Rendered composite image • {sizeMb} MB • Ready for conditioning
              </p>
            </div>
          </div>

          <button 
            type="button" 
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sheet Preview Stage */}
        <div className="p-4 overflow-auto flex items-center justify-center bg-zinc-950 min-h-[380px] max-h-[60vh]">
          <img
            src={sheetData.dataUrl}
            alt={sheetTitle}
            className="max-w-full max-h-[55vh] object-contain rounded-lg shadow-lg border border-zinc-800"
          />
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-950">
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>High-resolution lossless PNG composite stitched across {layoutPreset}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownload}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PNG</span>
            </button>

            <button
              type="button"
              onClick={handleSaveToLibrary}
              disabled={isSaving || hasSaved}
              className={`px-4 py-2 text-xs font-semibold rounded-lg text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                hasSaved
                  ? "bg-emerald-600 cursor-default"
                  : "bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : hasSaved ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Saved to Library</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save to Character Assets</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
