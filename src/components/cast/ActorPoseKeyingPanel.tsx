import React, { useState, useEffect, useMemo } from "react";
import { MediaAsset } from "../../types";
import {
  X,
  Sliders,
  RotateCcw,
  Sparkles,
  UserPlus,
  CheckCircle2
} from "lucide-react";
import { getAssetMediaUrl } from "../../utils/assetUrl";
import { useBlobUrlTracker } from "../../hooks/useSafeObjectUrl";
import {
  ActorPoseKeyingPanelProps,
  useChromaKeyEngine,
  KeyingCharacterAssetPicker,
  KeyingDualPreview,
  KeyingParameterControls
} from "./keying";

export type { ActorPoseKeyingPanelProps };

export const ActorPoseKeyingPanel: React.FC<ActorPoseKeyingPanelProps> = ({
  characters = {},
  subjects = [],
  allAssets = [],
  activeSceneName = "Scene_01",
  defaultCharacter,
  onAssetUploaded,
  onAddPosedActor,
  onClose,
  addToast
}) => {
  // Cast list
  const availableCharacters = useMemo(() => {
    const list = new Set<string>();
    if (defaultCharacter) list.add(defaultCharacter);
    subjects.forEach(s => list.add(s));
    Object.keys(characters).forEach(k => list.add(k));
    return Array.from(list);
  }, [defaultCharacter, subjects, characters]);

  // Selected character
  const [selectedCharacter, setSelectedCharacter] = useState<string>(
    defaultCharacter || availableCharacters[0] || "Actor"
  );

  // Filter character reference assets, prioritizing Pose / Body Reference
  const characterAssets = useMemo(() => {
    if (!selectedCharacter) return [];
    const charLower = selectedCharacter.toLowerCase();
    const matches = allAssets.filter(a => (a.subject_name || "").toLowerCase() === charLower);

    return matches.sort((a, b) => {
      const aType = (a.type || "").toLowerCase();
      const bType = (b.type || "").toLowerCase();
      const aDesc = (a.description || "").toLowerCase();
      const bDesc = (b.description || "").toLowerCase();

      const aIsPose = aDesc.includes("pose") || aType.includes("body");
      const bIsPose = bDesc.includes("pose") || bType.includes("body");

      if (aIsPose && !bIsPose) return -1;
      if (!aIsPose && bIsPose) return 1;
      return 0;
    });
  }, [selectedCharacter, allAssets]);

  // Selected asset or uploaded file source for keying
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(characterAssets[0] || null);
  const [customImageSrc, setCustomImageSrc] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Managed object URL tracker to prevent memory leaks from dropped pose files
  const { createTrackedUrl, revokeTrackedUrl, clearAllTrackedUrls } = useBlobUrlTracker("actor-pose-keying");

  // Helper to safely clear custom image source
  const clearCustomImage = () => {
    if (customImageSrc) {
      revokeTrackedUrl(customImageSrc);
      setCustomImageSrc(null);
    }
  };

  // Update selected asset if character changes
  useEffect(() => {
    if (characterAssets.length > 0 && !customImageSrc) {
      setSelectedAsset(characterAssets[0]);
    } else if (characterAssets.length === 0 && !customImageSrc) {
      setSelectedAsset(null);
    }
  }, [selectedCharacter, characterAssets, customImageSrc]);

  // Active source image URL for keying
  const activeImageSource = useMemo(() => {
    if (customImageSrc) return customImageSrc;
    if (selectedAsset) return getAssetMediaUrl(selectedAsset.filename, true);
    return null;
  }, [customImageSrc, selectedAsset]);

  // Chroma-Key Engine hook (handles processing, debouncing, parameters, and auto-detect)
  const {
    keyColor,
    setKeyColor,
    tolerance,
    setTolerance,
    softness,
    setSoftness,
    despill,
    setDespill,
    cutoutResult,
    isProcessing,
    handleAutoDetectColor,
    resetParameters
  } = useChromaKeyEngine({ activeImageSource });

  // Upload New Pose Image on the Fly
  const handleFileDrop = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      if (addToast) addToast("Please provide an image file (PNG, JPG, WebP)", "error");
      return;
    }

    // Immediately create managed local object URL for instant zero-latency preview
    if (customImageSrc) {
      revokeTrackedUrl(customImageSrc);
    }
    const localUrl = createTrackedUrl(file);
    setCustomImageSrc(localUrl);
    setSelectedAsset(null);

    // Also persist via server asset upload
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("subject_name", selectedCharacter);
    formData.append("type", "Body Reference");
    formData.append("description", `Pose reference for staging [Modifier: body reference pose]`);
    if (activeSceneName) {
      formData.append("scene_name", activeSceneName);
    }

    try {
      const res = await fetch("/api/assets/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        const newAsset = data.asset || data;
        if (onAssetUploaded) {
          onAssetUploaded(newAsset);
        }
        setSelectedAsset(newAsset);
        if (addToast) addToast("New pose reference uploaded to character library!", "success");
      }
    } catch (err) {
      console.warn("Server upload notice:", err);
    } finally {
      setIsUploading(false);
    }
  };

  // Confirm and Add Posed Actor to Stage
  const handleConfirmAddToStage = () => {
    if (!cutoutResult) {
      if (addToast) addToast("Please select and key a pose image first", "error");
      return;
    }

    onAddPosedActor({
      characterName: selectedCharacter,
      cutoutDataUrl: cutoutResult.dataUrl,
      referenceAssetFilename: selectedAsset?.filename,
      facing: "facing_camera",
    });

    if (addToast) {
      addToast(`Added ${selectedCharacter} with keyed transparent pose to stage!`, "success");
    }
    onClose();
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-2xl flex flex-col gap-5 text-zinc-200">
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-950/80 border border-indigo-800 flex items-center justify-center text-indigo-400 shadow-inner">
            <UserPlus className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Add Actor Pose & Chroma-Key Inspector
              <span className="text-[10px] font-mono font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                Live Studio
              </span>
            </h3>
            <p className="text-xs text-zinc-400">
              Select or upload an actor pose, key out the background, and stage the transparent cutout in 2D space.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* CHARACTER SELECTOR & GALLERY (STEPS 1 & 2) */}
      <KeyingCharacterAssetPicker
        selectedCharacter={selectedCharacter}
        onSelectCharacter={(char) => {
          setSelectedCharacter(char);
          clearCustomImage();
        }}
        availableCharacters={availableCharacters}
        characterAssets={characterAssets}
        selectedAsset={selectedAsset}
        onSelectAsset={(asset) => {
          setSelectedAsset(asset);
          clearCustomImage();
        }}
        customImageSrc={customImageSrc}
        onFileDrop={handleFileDrop}
        isUploading={isUploading}
      />

      {/* STEP 3: INTERACTIVE KEYING INSPECTOR */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              3. Interactive Chroma-Key Inspector
            </span>
            {isProcessing && (
              <span className="text-[10px] text-amber-400 font-mono animate-pulse">
                Processing pixels...
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (activeImageSource) handleAutoDetectColor(activeImageSource);
              }}
              className="text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 rounded flex items-center gap-1 transition-colors cursor-pointer"
              title="Auto detect background color from corners"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Auto-Detect Key</span>
            </button>

            <button
              type="button"
              onClick={resetParameters}
              className="text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded flex items-center gap-1 transition-colors cursor-pointer"
              title="Reset parameters"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* DUAL PREVIEW COMPARISON (SOURCE vs TRANSPARENT CUTOUT) */}
        <KeyingDualPreview
          activeImageSource={activeImageSource}
          cutoutResult={cutoutResult}
          onSampleColor={(hex) => setKeyColor(hex)}
          addToast={addToast}
        />

        {/* KEYING PARAMETERS CONTROLS */}
        <KeyingParameterControls
          keyColor={keyColor}
          setKeyColor={setKeyColor}
          tolerance={tolerance}
          setTolerance={setTolerance}
          softness={softness}
          setSoftness={setSoftness}
          despill={despill}
          setDespill={setDespill}
        />
      </div>

      {/* FOOTER ACTIONS */}
      <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer border border-zinc-800"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={handleConfirmAddToStage}
          disabled={!cutoutResult}
          className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold px-6 py-2.5 rounded-lg text-xs flex items-center gap-2 transition-all shadow-lg cursor-pointer"
        >
          <CheckCircle2 className="w-4 h-4 text-black stroke-[2.5]" />
          <span>Add Posed Actor to Stage</span>
        </button>
      </div>
    </div>
  );
};
