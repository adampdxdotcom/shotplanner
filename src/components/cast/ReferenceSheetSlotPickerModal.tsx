import React, { useState, useRef, useMemo } from "react";
import { X, Search, UploadCloud, User, Image as ImageIcon, Filter, Check } from "lucide-react";
import { MediaAsset } from "../../types";
import { getAssetMediaUrl } from "../../utils/assetUrl";

export interface ReferenceSheetSlotPickerModalProps {
  isOpen: boolean;
  slotIndex: number | null;
  slotInfo: { label: string; sublabel: string } | null;
  activeSubject: string;
  currentCharacterAssets: MediaAsset[];
  allAssets?: MediaAsset[];
  onSelectAsset: (slotIndex: number, asset: MediaAsset) => void;
  onSelectCustomImage: (slotIndex: number, dataUrl: string, name: string) => void;
  onClose: () => void;
}

export const ReferenceSheetSlotPickerModal: React.FC<ReferenceSheetSlotPickerModalProps> = ({
  isOpen,
  slotIndex,
  slotInfo,
  activeSubject,
  currentCharacterAssets,
  allAssets = [],
  onSelectAsset,
  onSelectCustomImage,
  onClose
}) => {
  const [tab, setTab] = useState<"character" | "all" | "upload">("character");
  const [searchQuery, setSearchQuery] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter image assets only
  const allImageAssets = useMemo(() => {
    return allAssets.filter(a => !a.media_type || a.media_type === "image");
  }, [allAssets]);

  // Search filtered assets
  const filteredAssets = useMemo(() => {
    if (!searchQuery.trim()) return allImageAssets;
    const q = searchQuery.toLowerCase();
    return allImageAssets.filter(a => 
      (a.filename || "").toLowerCase().includes(q) ||
      (a.description || "").toLowerCase().includes(q) ||
      (a.subject_name || "").toLowerCase().includes(q) ||
      (a.type || "").toLowerCase().includes(q)
    );
  }, [allImageAssets, searchQuery]);

  if (!isOpen || slotIndex === null) return null;

  // Handle local file reading
  const handleFile = (file: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        onSelectCustomImage(slotIndex, dataUrl, file.name);
        onClose();
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30 flex items-center justify-center shrink-0">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>Assign Panel {slotIndex + 1}</span>
                {slotInfo && (
                  <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                    ({slotInfo.sublabel || slotInfo.label})
                  </span>
                )}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Choose a reference from character gallery, project assets, or upload a local image
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

        {/* Modal Tabs */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950/60 border-b border-zinc-200 dark:border-zinc-800 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab("character")}
              className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-colors ${
                tab === "character"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Character ({currentCharacterAssets.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setTab("all")}
              className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-colors ${
                tab === "all"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>All Assets ({allImageAssets.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setTab("upload")}
              className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-colors ${
                tab === "upload"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Upload Local</span>
            </button>
          </div>

          {tab === "all" && (
            <div className="relative w-44">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search assets..."
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md pl-8 pr-2 py-1 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 outline-none"
              />
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="p-4 overflow-y-auto max-h-[50vh] min-h-[260px]">
          {/* TAB 1: Character Assets */}
          {tab === "character" && (
            currentCharacterAssets.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {currentCharacterAssets.map((asset) => (
                  <div
                    key={asset.id || asset.filename}
                    onClick={() => {
                      onSelectAsset(slotIndex, asset);
                      onClose();
                    }}
                    className="relative group rounded-xl overflow-hidden aspect-square border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all cursor-pointer shadow-xs bg-zinc-950"
                  >
                    <img
                      src={getAssetMediaUrl(asset.filename, true)}
                      alt={asset.description || asset.filename}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-2">
                      <p className="text-[11px] font-semibold text-white truncate">
                        {asset.type || "Reference"}
                      </p>
                      <p className="text-[9px] text-zinc-400 font-mono truncate">
                        {asset.filename}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-2 text-zinc-500">
                <User className="w-8 h-8 text-zinc-400" />
                <p className="text-xs font-medium">No dedicated assets registered under {activeSubject || "actor"}</p>
                <button
                  type="button"
                  onClick={() => setTab("all")}
                  className="text-xs text-emerald-500 hover:underline cursor-pointer mt-1"
                >
                  Browse all project assets
                </button>
              </div>
            )
          )}

          {/* TAB 2: All Assets */}
          {tab === "all" && (
            filteredAssets.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {filteredAssets.map((asset) => (
                  <div
                    key={asset.id || asset.filename}
                    onClick={() => {
                      onSelectAsset(slotIndex, asset);
                      onClose();
                    }}
                    className="relative group rounded-xl overflow-hidden aspect-square border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all cursor-pointer shadow-xs bg-zinc-950"
                  >
                    <img
                      src={getAssetMediaUrl(asset.filename, true)}
                      alt={asset.description || asset.filename}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-2">
                      <p className="text-[11px] font-semibold text-white truncate">
                        {asset.subject_name || asset.type || "Asset"}
                      </p>
                      <p className="text-[9px] text-zinc-400 font-mono truncate">
                        {asset.filename}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-xs text-zinc-500">
                No matching images found
              </div>
            )
          )}

          {/* TAB 3: Local Upload */}
          {tab === "upload" && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                dragActive
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                  : "border-zinc-300 dark:border-zinc-700 hover:border-emerald-500 bg-zinc-50/50 dark:bg-zinc-950/40 text-zinc-500 dark:text-zinc-400"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <UploadCloud className="w-10 h-10 mb-3 text-emerald-500" />
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                Click to browse or drag and drop image here
              </p>
              <p className="text-[11px] text-zinc-500 mt-1">
                PNG, JPG, WebP supported
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
