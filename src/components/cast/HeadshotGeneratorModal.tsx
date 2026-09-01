import React, { useState, useRef } from "react";
import { MediaAsset } from "../../types";
import { X, UploadCloud, Zap, CheckCircle2, Image as ImageIcon } from "lucide-react";
import { getAssetMediaUrl } from "../../utils/assetUrl";
import { motion, AnimatePresence } from "motion/react";

interface HeadshotGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectName: string;
  characterAssets: MediaAsset[];
  activeSceneName: string;
  onAssetSaved: (asset: MediaAsset) => void;
  addToast?: (msg: string, type?: "success" | "error" | "info") => void;
}

const PRESETS = [
  "Facing",
  "3/4 Profile",
  "Full Profile",
  "Cinematic / Mood"
];

export const HeadshotGeneratorModal: React.FC<HeadshotGeneratorModalProps> = ({
  isOpen,
  onClose,
  subjectName,
  characterAssets,
  activeSceneName,
  onAssetSaved,
  addToast
}) => {
  const [selectedSeed, setSelectedSeed] = useState<string | null>(null); // base64 or filename
  const [seedType, setSeedType] = useState<"existing" | "upload" | null>(null);
  const [seedMimeType, setSeedMimeType] = useState<string>("image/png");
  
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "3:4" | "4:3" | "9:16" | "16:9">("1:1");
  const [selectedPresets, setSelectedPresets] = useState<string[]>(["Facing", "3/4 Profile"]);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [candidates, setCandidates] = useState<{ key: string; base64: string }[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      // Extract base64 part
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
    setSeedMimeType("image/png"); // Backend will guess if needed
  };

  const togglePreset = (preset: string) => {
    setSelectedPresets(prev => 
      prev.includes(preset) ? prev.filter(p => p !== preset) : [...prev, preset]
    );
  };

  const toggleAllPresets = () => {
    if (selectedPresets.length === PRESETS.length) {
      setSelectedPresets([]);
    } else {
      setSelectedPresets([...PRESETS]);
    }
  };

  const toggleCandidate = (index: number) => {
    const newSet = new Set(selectedCandidates);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedCandidates(newSet);
  };

  const handleGenerate = async () => {
    if (!selectedSeed || selectedPresets.length === 0) return;
    
    setIsGenerating(true);
    setError(null);
    setCandidates([]);
    setSelectedCandidates(new Set());

    try {
      const payload: any = {
        characterName: subjectName,
        aspectRatio: aspectRatio,
        variationKeys: JSON.stringify(selectedPresets)
      };

      if (seedType === "existing") {
        payload.existingAssetFilename = selectedSeed;
      } else {
        payload.imageBase64 = selectedSeed;
        payload.imageMimeType = seedMimeType;
      }

      const res = await fetch("/api/headshots/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate variations");
      }

      const data = await res.json();
      setCandidates(data.results || []);
      // Auto-select all successful candidates
      setSelectedCandidates(new Set((data.results || []).map((_: any, i: number) => i)));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (selectedCandidates.size === 0) return;
    setIsSaving(true);
    setError(null);

    const selections = Array.from(selectedCandidates).map(idx => candidates[idx]);

    try {
      const res = await fetch("/api/headshots/save-selected", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selections,
          characterName: subjectName,
          sceneName: activeSceneName,
          tags: ["AI Generated"]
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save selected headshots");
      }

      const data = await res.json();
      
      // Pass saved records back to parent
      data.savedAssets.forEach((asset: MediaAsset) => onAssetSaved(asset));
      
      if (addToast) {
        addToast(`Successfully saved ${data.savedAssets.length} headshot variations to ${subjectName}.`, "success");
      }
      
      onClose(); // Close modal on success
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                AI Headshots
                <span className="text-xs font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  Gemini Flash
                </span>
              </h2>
              <p className="text-xs text-zinc-400">Generate studio-quality character portraits for {subjectName}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={isGenerating || isSaving}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-2 rounded-lg hover:bg-zinc-800 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
          {error && (
            <div className="bg-red-950/50 border border-red-900/50 rounded-xl p-4 text-sm text-red-200">
              {error}
            </div>
          )}

          {candidates.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Review Candidates</h3>
                <span className="text-xs font-medium text-zinc-500">{selectedCandidates.size} of {candidates.length} selected</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {candidates.map((candidate, idx) => {
                  const isSelected = selectedCandidates.has(idx);
                  return (
                    <div 
                      key={idx}
                      onClick={() => toggleCandidate(idx)}
                      className={`relative group cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                        isSelected ? "border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]" : "border-zinc-800 hover:border-zinc-600"
                      }`}
                    >
                      <img 
                        src={`data:image/png;base64,${candidate.base64}`} 
                        alt={candidate.key}
                        className="w-full aspect-[2/3] object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-8">
                        <p className="text-xs font-bold text-white shadow-sm">{candidate.key}</p>
                      </div>
                      <div className="absolute top-2 right-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                          isSelected ? "bg-amber-500 text-white" : "bg-black/50 text-white/50 border border-white/20"
                        }`}>
                          <CheckCircle2 className={`w-4 h-4 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column: Seed Image */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">1. Seed Image</h3>
                
                <div className="space-y-4">
                  {/* Select from existing */}
                  {characterAssets.length > 0 && (
                    <div>
                      <label className="text-xs font-semibold text-zinc-500 mb-2 block">Select from References</label>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {characterAssets.map(asset => {
                          const isSelected = seedType === "existing" && selectedSeed === asset.filename;
                          return (
                            <div 
                              key={asset.filename}
                              onClick={() => handleSelectExisting(asset.filename)}
                              className={`w-20 h-20 shrink-0 rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                                isSelected ? "border-amber-500" : "border-zinc-800 hover:border-zinc-600"
                              }`}
                            >
                              <img 
                                src={getAssetMediaUrl(asset.filename, true)} 
                                className="w-full h-full object-cover" 
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Upload new */}
                  <div>
                    <label className="text-xs font-semibold text-zinc-500 mb-2 block">Or Upload New</label>
                    <input 
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className={`h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors ${
                        seedType === "upload" && selectedSeed 
                          ? "border-amber-500/50 bg-amber-500/5" 
                          : "border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 hover:border-zinc-700"
                      }`}
                    >
                      {seedType === "upload" && selectedSeed ? (
                        <>
                          <div className="w-12 h-12 rounded-lg overflow-hidden mb-2">
                            <img src={`data:${seedMimeType};base64,${selectedSeed}`} className="w-full h-full object-cover" />
                          </div>
                          <span className="text-xs font-medium text-amber-500">Image Loaded</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="w-8 h-8 text-zinc-600 mb-2" />
                          <span className="text-sm font-medium text-zinc-400">Click to upload seed image</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Parameters */}
              <div className="space-y-8">
                {/* Aspect Ratio */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">2. Aspect Ratio</h3>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: "1:1", label: "Square (1:1)" },
                      { value: "3:4", label: "Portrait (3:4)" },
                      { value: "2:3", label: "Tall (2:3)" },
                      { value: "16:9", label: "Widescreen (16:9)" }
                    ].map(ar => (
                      <button
                        key={ar.value}
                        onClick={() => setAspectRatio(ar.value as any)}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all border ${
                          aspectRatio === ar.value 
                            ? "bg-zinc-800 text-amber-400 border-amber-500/30" 
                            : "bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-300"
                        }`}
                      >
                        {ar.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Presets */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">3. Variations</h3>
                    <button 
                      onClick={toggleAllPresets}
                      className="text-xs font-medium text-amber-500 hover:text-amber-400"
                    >
                      {selectedPresets.length === PRESETS.length ? "Deselect All" : "Select All"}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {PRESETS.map(preset => {
                      const isSelected = selectedPresets.includes(preset);
                      return (
                        <div 
                          key={preset}
                          onClick={() => togglePreset(preset)}
                          className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all ${
                            isSelected 
                              ? "bg-amber-500/10 border-amber-500/30 text-amber-400" 
                              : "bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                          }`}
                        >
                          <div className={`w-5 h-5 rounded flex items-center justify-center border ${
                            isSelected ? "bg-amber-500 border-amber-500 text-zinc-950" : "bg-zinc-950 border-zinc-700"
                          }`}>
                            <CheckCircle2 className={`w-3.5 h-3.5 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                          </div>
                          <span className="text-sm font-medium">{preset}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isGenerating || isSaving}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          
          {candidates.length > 0 ? (
            <button
              onClick={() => {
                setCandidates([]);
                setSelectedCandidates(new Set());
                setError(null);
              }}
              disabled={isGenerating || isSaving}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              Start Over
            </button>
          ) : null}

          {candidates.length > 0 ? (
            <button
              onClick={handleSave}
              disabled={isSaving || selectedCandidates.size === 0}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <ImageIcon className="w-4 h-4" />
                  Save to Character
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !selectedSeed || selectedPresets.length === 0}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:hover:bg-amber-600"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Generate {selectedPresets.length} Variations
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
