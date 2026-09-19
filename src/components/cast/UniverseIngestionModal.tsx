import React, { useState } from "react";
import { 
  Globe, 
  X, 
  Check, 
  AlertTriangle, 
  Sparkles, 
  FileCheck, 
  ArrowRight, 
  ChevronRight, 
  Layers, 
  Info,
  Loader2
} from "lucide-react";
import { UniverseInspectionItem, UniverseInspectionResult } from "../../types";

interface UniverseIngestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  inspectionResult: UniverseInspectionResult | null;
  tempFilePath: string | null;
  archiveFileName?: string;
  onConfirmImport: (resolutions: Record<string, "keep_local" | "overwrite" | "ingest_as_new">) => Promise<void>;
}

export const UniverseIngestionModal: React.FC<UniverseIngestionModalProps> = ({
  isOpen,
  onClose,
  inspectionResult,
  tempFilePath,
  archiveFileName = "archive.zip",
  onConfirmImport
}) => {
  const [resolutions, setResolutions] = useState<Record<string, "keep_local" | "overwrite" | "ingest_as_new">>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedItemName, setSelectedItemName] = useState<string | null>(null);
  const [applyToAll, setApplyToAll] = useState(false);

  // Initialize resolutions default: overwrite for new, keep_local for conflicts unless user selects otherwise
  React.useEffect(() => {
    if (inspectionResult?.items) {
      const initial: Record<string, "keep_local" | "overwrite" | "ingest_as_new"> = {};
      inspectionResult.items.forEach(item => {
        if (item.status === "new") {
          initial[item.name] = "overwrite"; // Ingest as new universe master
        } else if (item.status === "different") {
          initial[item.name] = "keep_local"; // Safe default
        } else {
          initial[item.name] = "keep_local";
        }
      });
      setResolutions(initial);
      if (inspectionResult.items.length > 0) {
        setSelectedItemName(inspectionResult.items[0].name);
      }
    }
  }, [inspectionResult]);

  if (!isOpen || !inspectionResult) return null;

  const items = inspectionResult.items || [];
  const selectedItem = items.find(i => i.name === selectedItemName) || items[0];

  const handleSetResolution = (charName: string, value: "keep_local" | "overwrite" | "ingest_as_new") => {
    if (applyToAll) {
      const updated: Record<string, "keep_local" | "overwrite" | "ingest_as_new"> = {};
      items.forEach(i => {
        updated[i.name] = value;
      });
      setResolutions(updated);
    } else {
      setResolutions(prev => ({ ...prev, [charName]: value }));
    }
  };

  const handleToggleApplyToAll = (checked: boolean) => {
    setApplyToAll(checked);
    if (checked && selectedItem) {
      const currentVal = resolutions[selectedItem.name] || "keep_local";
      const updated: Record<string, "keep_local" | "overwrite" | "ingest_as_new"> = {};
      items.forEach(i => {
        updated[i.name] = currentVal;
      });
      setResolutions(updated);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onConfirmImport(resolutions);
      onClose();
    } catch (err) {
      console.error("Failed to complete universe ingestion:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-zinc-800">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-200 bg-zinc-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                Universe Ingestion & Conflict Resolution
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  {inspectionResult.total_conflicts > 0 ? `${inspectionResult.total_conflicts} Conflicts` : "Ready"}
                </span>
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Importing <span className="font-semibold text-zinc-700">{archiveFileName}</span> contains {inspectionResult.total_incoming} Universe Character profiles.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Quick Action Bar */}
        <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between text-xs text-zinc-600">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={applyToAll}
              onChange={(e) => handleToggleApplyToAll(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-zinc-700 font-semibold text-xs">Apply selection to all characters</span>
          </label>
          <span className="text-[11px] text-zinc-400 font-medium">
            Select an entity to inspect character traits and photos
          </span>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          
          {/* Character List Sidebar */}
          <div className="w-full md:w-72 border-r border-zinc-200 overflow-y-auto p-3 space-y-1.5 shrink-0 bg-zinc-50/20">
            {items.map((item) => {
              const currentChoice = resolutions[item.name] || "keep_local";
              const isSelected = selectedItem?.name === item.name;

              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setSelectedItemName(item.name)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all flex flex-col gap-1 cursor-pointer ${
                    isSelected
                      ? "bg-blue-50 border-blue-400 shadow-xs"
                      : "bg-white border-zinc-200 hover:bg-zinc-100/60 text-zinc-600"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-semibold text-xs truncate flex items-center gap-1.5 ${isSelected ? "text-blue-900" : "text-zinc-800"}`}>
                      {item.name}
                    </span>
                    {item.status === "new" && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        New
                      </span>
                    )}
                    {item.status === "identical" && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 border border-zinc-200">
                        Match
                      </span>
                    )}
                    {item.status === "different" && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                        Conflict
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400 text-[10px]">Action:</span>
                    <span className={`text-[10px] font-semibold ${
                      currentChoice === "overwrite" ? "text-amber-600" :
                      currentChoice === "ingest_as_new" ? "text-blue-600" : "text-emerald-600"
                    }`}>
                      {currentChoice === "keep_local" ? "Keep Local Master" :
                       currentChoice === "overwrite" ? "Overwrite Local" : "Ingest as New"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Conflict Inspection Detail Panel */}
          {selectedItem && (
            <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-white">
              
              {/* Item Top Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200">
                <div>
                  <h3 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
                    <span>{selectedItem.name}</span>
                    <span className="text-xs font-normal text-zinc-400">
                      ({selectedItem.status === "new" ? "New Character" : selectedItem.status === "identical" ? "Exact Match" : "Has Attribute Differences"})
                    </span>
                  </h3>
                </div>

                {/* Decision Selector for Selected Item */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSetResolution(selectedItem.name, "keep_local")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      resolutions[selectedItem.name] === "keep_local"
                        ? "bg-zinc-100 border-zinc-300 text-zinc-800 shadow-xs"
                        : "bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                    }`}
                  >
                    Keep Local
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetResolution(selectedItem.name, "overwrite")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      resolutions[selectedItem.name] === "overwrite"
                        ? "bg-amber-500 border-amber-600 text-white shadow-xs"
                        : "bg-white border-zinc-200 text-zinc-500 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200"
                    }`}
                  >
                    Overwrite Local
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetResolution(selectedItem.name, "ingest_as_new")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      resolutions[selectedItem.name] === "ingest_as_new"
                        ? "bg-blue-600 border-blue-700 text-white shadow-xs"
                        : "bg-white border-zinc-200 text-zinc-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                    }`}
                  >
                    Ingest As New
                  </button>
                </div>
              </div>

              {/* Side-by-Side Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Local Universe Profile */}
                <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-200 text-xs font-bold text-zinc-700">
                    <span className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-zinc-400" />
                      Local Universe Master
                    </span>
                    {selectedItem.existing ? (
                      <span className="text-[10px] text-zinc-400 font-normal">Active in Universe</span>
                    ) : (
                      <span className="text-[10px] text-zinc-400 font-normal">Not present locally</span>
                    )}
                  </div>

                  {selectedItem.existing ? (
                    <div className="space-y-2.5 text-xs">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-zinc-400 mb-0.5">Notes</div>
                        <div className="p-2 rounded bg-white border border-zinc-200 text-zinc-700 min-h-[44px] text-xs whitespace-pre-wrap">
                          {selectedItem.existing.notes || <span className="italic text-zinc-400">No notes</span>}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] uppercase font-bold text-zinc-400 mb-0.5">Default Outfit Ref</div>
                        <div className="p-1.5 rounded bg-white border border-zinc-200 text-zinc-700 text-xs truncate">
                          {selectedItem.existing.default_outfit_ref || selectedItem.existing.scene_outfit_ref || <span className="italic text-zinc-400">None</span>}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-xs text-zinc-400">
                      This character does not exist in your local Universe master.
                    </div>
                  )}
                </div>

                {/* Imported ZIP Profile */}
                <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-200 text-xs font-bold text-amber-600">
                    <span className="flex items-center gap-1.5">
                      <FileCheck className="w-3.5 h-3.5 text-amber-500" />
                      Imported from ZIP
                    </span>
                    <span className="text-[10px] text-zinc-400 font-normal">Archive Version</span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-zinc-400 mb-0.5">Notes</div>
                      <div className={`p-2 rounded bg-white border text-xs whitespace-pre-wrap min-h-[44px] ${
                        selectedItem.diffs.notes ? "border-amber-300 text-amber-800 bg-amber-50/30" : "border-zinc-200 text-zinc-700"
                      }`}>
                        {selectedItem.incoming.notes || <span className="italic text-zinc-400">No notes</span>}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] uppercase font-bold text-zinc-400 mb-0.5">Default Outfit Ref</div>
                      <div className={`p-1.5 rounded bg-white border text-xs truncate ${
                        selectedItem.diffs.default_outfit_ref ? "border-amber-300 text-amber-800 bg-amber-50/30" : "border-zinc-200 text-zinc-700"
                      }`}>
                        {selectedItem.incoming.default_outfit_ref || selectedItem.incoming.scene_outfit_ref || <span className="italic text-zinc-400">None</span>}
                      </div>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-200 bg-zinc-50/80 flex items-center justify-between shrink-0">
          <div className="text-xs text-zinc-500">
            Selected Action: <span className="font-semibold text-zinc-700">
              {Object.values(resolutions).filter(r => r === "overwrite").length} overwrite,{" "}
              {Object.values(resolutions).filter(r => r === "ingest_as_new").length} as new,{" "}
              {Object.values(resolutions).filter(r => r === "keep_local").length} keep local
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-2 text-xs font-semibold text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Ingesting Universe & Loading Scene...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Apply Resolutions & Import Scene</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
