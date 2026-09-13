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

  const handleSetAll = (choice: "keep_local" | "overwrite" | "ingest_as_new") => {
    const updated: Record<string, "keep_local" | "overwrite" | "ingest_as_new"> = {};
    items.forEach(i => {
      updated[i.name] = choice;
    });
    setResolutions(updated);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800/80 bg-zinc-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500/20 to-indigo-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                Universe Ingestion & Conflict Resolution
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {inspectionResult.total_conflicts > 0 ? `${inspectionResult.total_conflicts} Conflicts` : "Ready"}
                </span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Importing <span className="font-semibold text-zinc-200">{archiveFileName}</span> contains {inspectionResult.total_incoming} Universe Character profiles.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Quick Action Bar */}
        <div className="px-5 py-2.5 bg-zinc-950/30 border-b border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span>Bulk Resolution:</span>
            <button
              type="button"
              onClick={() => handleSetAll("keep_local")}
              className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 transition-colors cursor-pointer"
            >
              Keep All Local Masters
            </button>
            <button
              type="button"
              onClick={() => handleSetAll("overwrite")}
              className="px-2 py-1 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 rounded border border-amber-800/40 transition-colors cursor-pointer"
            >
              Overwrite All with Imported
            </button>
            <button
              type="button"
              onClick={() => handleSetAll("ingest_as_new")}
              className="px-2 py-1 bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-300 rounded border border-indigo-800/40 transition-colors cursor-pointer"
            >
              Ingest All as New
            </button>
          </div>
          <span className="text-[11px] text-zinc-500">
            Select an entity to inspect character traits and photos
          </span>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          
          {/* Character List Sidebar */}
          <div className="w-full md:w-72 border-r border-zinc-800/80 overflow-y-auto p-3 space-y-1.5 shrink-0 bg-zinc-950/20">
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
                      ? "bg-zinc-800/90 border-indigo-500/50 shadow-md shadow-indigo-950/20"
                      : "bg-zinc-900/40 border-zinc-800/60 hover:bg-zinc-800/50 text-zinc-400"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-zinc-100 truncate flex items-center gap-1.5">
                      {item.name}
                    </span>
                    {item.status === "new" && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
                        New
                      </span>
                    )}
                    {item.status === "identical" && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                        Match
                      </span>
                    )}
                    {item.status === "different" && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-800/40">
                        Conflict
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-500 text-[10px]">Action:</span>
                    <span className={`text-[10px] font-medium ${
                      currentChoice === "overwrite" ? "text-amber-400" :
                      currentChoice === "ingest_as_new" ? "text-indigo-400" : "text-emerald-400"
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
            <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-zinc-900/50">
              
              {/* Item Top Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
                <div>
                  <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
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
                    onClick={() => setResolutions(prev => ({ ...prev, [selectedItem.name]: "keep_local" }))}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      resolutions[selectedItem.name] === "keep_local"
                        ? "bg-zinc-700 text-white shadow-sm"
                        : "bg-zinc-800/60 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Keep Local
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolutions(prev => ({ ...prev, [selectedItem.name]: "overwrite" }))}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      resolutions[selectedItem.name] === "overwrite"
                        ? "bg-amber-600 text-white shadow-sm"
                        : "bg-zinc-800/60 text-zinc-400 hover:text-amber-300"
                    }`}
                  >
                    Overwrite Local
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolutions(prev => ({ ...prev, [selectedItem.name]: "ingest_as_new" }))}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      resolutions[selectedItem.name] === "ingest_as_new"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-zinc-800/60 text-zinc-400 hover:text-indigo-300"
                    }`}
                  >
                    Ingest As New
                  </button>
                </div>
              </div>

              {/* Side-by-Side Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Local Universe Profile */}
                <div className="p-3.5 rounded-xl bg-zinc-950/40 border border-zinc-800/80 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-xs font-bold text-zinc-300">
                    <span className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-zinc-400" />
                      Local Universe Master
                    </span>
                    {selectedItem.existing ? (
                      <span className="text-[10px] text-zinc-500 font-normal">Active in Universe</span>
                    ) : (
                      <span className="text-[10px] text-zinc-500 font-normal">Not present locally</span>
                    )}
                  </div>

                  {selectedItem.existing ? (
                    <div className="space-y-2.5 text-xs">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-zinc-500 mb-0.5">Notes</div>
                        <div className="p-2 rounded bg-zinc-900 border border-zinc-800/70 text-zinc-300 min-h-[44px] text-xs whitespace-pre-wrap">
                          {selectedItem.existing.notes || <span className="italic text-zinc-500">No notes</span>}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] uppercase font-bold text-zinc-500 mb-0.5">Default Outfit Ref</div>
                        <div className="p-1.5 rounded bg-zinc-900 border border-zinc-800/70 text-zinc-300 text-xs truncate">
                          {selectedItem.existing.default_outfit_ref || selectedItem.existing.scene_outfit_ref || <span className="italic text-zinc-500">None</span>}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-xs text-zinc-500">
                      This character does not exist in your local Universe master.
                    </div>
                  )}
                </div>

                {/* Imported ZIP Profile */}
                <div className="p-3.5 rounded-xl bg-zinc-950/40 border border-zinc-800/80 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-xs font-bold text-amber-400">
                    <span className="flex items-center gap-1.5">
                      <FileCheck className="w-3.5 h-3.5" />
                      Imported from ZIP
                    </span>
                    <span className="text-[10px] text-zinc-400 font-normal">Archive Version</span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-zinc-500 mb-0.5">Notes</div>
                      <div className={`p-2 rounded bg-zinc-900 border text-xs whitespace-pre-wrap min-h-[44px] ${
                        selectedItem.diffs.notes ? "border-amber-500/40 text-amber-200 bg-amber-950/20" : "border-zinc-800/70 text-zinc-300"
                      }`}>
                        {selectedItem.incoming.notes || <span className="italic text-zinc-500">No notes</span>}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] uppercase font-bold text-zinc-500 mb-0.5">Default Outfit Ref</div>
                      <div className={`p-1.5 rounded bg-zinc-900 border text-xs truncate ${
                        selectedItem.diffs.default_outfit_ref ? "border-amber-500/40 text-amber-200 bg-amber-950/20" : "border-zinc-800/70 text-zinc-300"
                      }`}>
                        {selectedItem.incoming.default_outfit_ref || selectedItem.incoming.scene_outfit_ref || <span className="italic text-zinc-500">None</span>}
                      </div>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between shrink-0">
          <div className="text-xs text-zinc-400">
            Selected Action: <span className="font-semibold text-zinc-200">
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
              className="px-3.5 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-indigo-950/30 flex items-center gap-2 transition-all cursor-pointer"
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
