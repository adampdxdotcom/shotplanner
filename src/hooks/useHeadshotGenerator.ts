import { useState } from "react";
import { MediaAsset } from "../types";

export interface HeadshotCandidate {
  key: string;
  base64: string;
}

export interface UseHeadshotGeneratorProps {
  activeSubject: string;
  activeScene: string;
  aspectRatio: string;
  selectedPresets: string[];
  seedType: "existing" | "upload" | null;
  selectedSeed: string | null;
  seedMimeType: string | null;
  onAssetSaved?: (asset: MediaAsset) => void;
  addToast?: (msg: string, type: "success" | "error" | "info") => void;
  onClose: () => void;
}

export function useHeadshotGenerator({
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
}: UseHeadshotGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [headshotError, setHeadshotError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<HeadshotCandidate[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<number>>(new Set());

  const handleGenerateHeadshots = async () => {
    if (!selectedSeed || selectedPresets.length === 0) return;
    setIsGenerating(true);
    setHeadshotError(null);
    setCandidates([]);
    setSelectedCandidates(new Set());

    try {
      const payload: any = {
        characterName: activeSubject,
        aspectRatio: aspectRatio,
        sceneName: activeScene,
        activeSceneName: activeScene,
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
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error || `HTTP ${res.status}: Failed to generate variations`);
      }

      const data = await res.json();
      const generatedList = data.results || data.candidates || [];
      setCandidates(generatedList);
      setSelectedCandidates(new Set(generatedList.map((_: any, i: number) => i)));
    } catch (err: any) {
      setHeadshotError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveHeadshots = async () => {
    if (selectedCandidates.size === 0) return;
    setIsSaving(true);
    setHeadshotError(null);

    const selections = Array.from(selectedCandidates).map(idx => candidates[idx]);

    try {
      const res = await fetch("/api/headshots/save-selected", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selections,
          characterName: activeSubject,
          sceneName: activeScene,
          activeSceneName: activeScene,
          tags: ["AI Generated"]
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error || "Failed to save selected headshots");
      }

      const data = await res.json();
      const savedList: MediaAsset[] = data.savedAssets || data.savedRecords || data.assets || [];
      savedList.forEach((asset: MediaAsset) => {
        if (onAssetSaved) onAssetSaved(asset);
      });

      if (addToast) {
        addToast(`Successfully saved ${savedList.length} headshot variation${savedList.length === 1 ? '' : 's'} to ${activeSubject}.`, "success");
      }
      onClose();
    } catch (err: any) {
      setHeadshotError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCandidate = (idx: number) => {
    const next = new Set(selectedCandidates);
    if (next.has(idx)) {
      next.delete(idx);
    } else {
      next.add(idx);
    }
    setSelectedCandidates(next);
  };

  return {
    isGenerating,
    isSaving,
    headshotError,
    setHeadshotError,
    candidates,
    selectedCandidates,
    toggleCandidate,
    handleGenerateHeadshots,
    handleSaveHeadshots
  };
}
