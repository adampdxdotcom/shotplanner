import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { MediaAsset, CharacterProfile } from "../../types";
import {
  X,
  UploadCloud,
  Pipette,
  Sliders,
  Check,
  RotateCcw,
  Sparkles,
  User,
  UserPlus,
  Layers,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Eye
} from "lucide-react";
import { getAssetMediaUrl } from "../../utils/assetUrl";
import {
  applyChromaKey,
  autoDetectKeyColor,
  samplePixelColor,
  loadImage,
  rgbToHex,
  parseHexColor
} from "../../utils/chromaKey";

export interface ActorPoseKeyingPanelProps {
  characters?: Record<string, CharacterProfile>;
  subjects?: string[];
  allAssets: MediaAsset[];
  activeSceneName?: string;
  defaultCharacter?: string;
  onAssetUploaded?: (asset: MediaAsset) => void;
  onAddPosedActor: (actorData: {
    characterName: string;
    cutoutDataUrl: string;
    referenceAssetFilename?: string;
    posture: string;
    facing?: "facing_camera" | "turn_left" | "turn_right" | "profile_left" | "profile_right" | "back_camera";
    plane?: "foreground" | "midground" | "background";
  }) => void;
  onClose: () => void;
  addToast?: (msg: string, type?: "success" | "error" | "info") => void;
}

const QUICK_KEY_COLORS = [
  { label: "Green Screen", hex: "#00FF00", bgClass: "bg-[#00FF00] text-black" },
  { label: "Blue Screen", hex: "#0000FF", bgClass: "bg-[#0000FF] text-white" },
  { label: "Magenta", hex: "#FF00FF", bgClass: "bg-[#FF00FF] text-white" },
  { label: "White", hex: "#FFFFFF", bgClass: "bg-white text-black" },
  { label: "Black", hex: "#000000", bgClass: "bg-black text-white border border-zinc-700" },
];

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

    // Sort: Body Reference with "pose" first, then other Body References, then Headshots, then others
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

  // Keying Parameters
  const [keyColor, setKeyColor] = useState<string>("#00FF00");
  const [tolerance, setTolerance] = useState<number>(35); // 0 to 100
  const [softness, setSoftness] = useState<number>(15); // 0 to 100
  const [despill, setDespill] = useState<boolean>(true);
  const [postureName, setPostureName] = useState<string>("Standing Pose");
  const [selectedPlane, setSelectedPlane] = useState<"foreground" | "midground" | "background">("midground");

  // Eyedropper state
  const [isEyedropperActive, setIsEyedropperActive] = useState<boolean>(false);
  const [hoveredColor, setHoveredColor] = useState<string | null>(null);

  // Keyed transparent cutout result
  const [cutoutResult, setCutoutResult] = useState<{
    dataUrl: string;
    width: number;
    height: number;
    transparentPercentage: number;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Uploading state
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourceImageRef = useRef<HTMLImageElement>(null);

  // Auto-detect key color when a new image is loaded
  const handleAutoDetectColor = useCallback(async (imgSrc: string) => {
    try {
      const img = await loadImage(imgSrc);
      const detected = autoDetectKeyColor(img);
      setKeyColor(detected);
    } catch {
      setKeyColor("#00FF00");
    }
  }, []);

  // When activeImageSource changes, trigger auto-detect
  useEffect(() => {
    if (activeImageSource) {
      handleAutoDetectColor(activeImageSource);
    }
  }, [activeImageSource, handleAutoDetectColor]);

  // Real-time Chroma-Key Processing Engine
  useEffect(() => {
    if (!activeImageSource) {
      setCutoutResult(null);
      return;
    }

    let isCancelled = false;
    setIsProcessing(true);

    const timer = setTimeout(async () => {
      try {
        const result = await applyChromaKey({
          source: activeImageSource,
          keyColor,
          tolerance,
          softness,
          despill,
          maxWidth: 1200, // keep processing fast while preserving high resolution
        });
        if (!isCancelled) {
          setCutoutResult(result);
          setIsProcessing(false);
        }
      } catch (err) {
        console.error("Chroma key processing error:", err);
        if (!isCancelled) {
          setIsProcessing(false);
        }
      }
    }, 20); // Fast 20ms debounce for 50fps silky interactive sliding

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [activeImageSource, keyColor, tolerance, softness, despill]);

  // Eyedropper Click & Hover Handlers on Source Image
  const handleSourceImageClick = async (e: React.MouseEvent<HTMLImageElement>) => {
    if (!sourceImageRef.current) return;
    const rect = sourceImageRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert display coordinates to natural image coordinates
    const scaleX = sourceImageRef.current.naturalWidth / rect.width;
    const scaleY = sourceImageRef.current.naturalHeight / rect.height;
    const pixelX = clickX * scaleX;
    const pixelY = clickY * scaleY;

    try {
      const sampled = await samplePixelColor(sourceImageRef.current, pixelX, pixelY);
      setKeyColor(sampled.hex);
      if (isEyedropperActive) {
        setIsEyedropperActive(false);
      }
      if (addToast) {
        addToast(`Key color sampled: ${sampled.hex}`, "info");
      }
    } catch (err) {
      console.warn("Could not sample pixel color:", err);
    }
  };

  const handleSourceImageMouseMove = async (e: React.MouseEvent<HTMLImageElement>) => {
    if (!isEyedropperActive || !sourceImageRef.current) return;
    const rect = sourceImageRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const scaleX = sourceImageRef.current.naturalWidth / rect.width;
    const scaleY = sourceImageRef.current.naturalHeight / rect.height;
    const pixelX = clickX * scaleX;
    const pixelY = clickY * scaleY;

    try {
      const sampled = await samplePixelColor(sourceImageRef.current, pixelX, pixelY);
      setHoveredColor(sampled.hex);
    } catch {
      // ignore
    }
  };

  // Upload New Pose Image on the Fly
  const handleFileDrop = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      if (addToast) addToast("Please provide an image file (PNG, JPG, WebP)", "error");
      return;
    }

    // Immediately create local object URL for instant zero-latency preview
    const localUrl = URL.createObjectURL(file);
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
      // Local URL is still active for immediate staging
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
      posture: postureName.trim() || "Standing Pose",
      facing: "facing_camera",
      plane: selectedPlane,
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

      {/* CHARACTER SELECTOR & GALLERY ROW */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        
        {/* Step 1: Cast Selector */}
        <div className="md:col-span-4 bg-zinc-900/60 border border-zinc-800 rounded-xl p-3.5 flex flex-col gap-3">
          <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-amber-400" />
            1. Select Cast Member
          </label>
          
          <select
            value={selectedCharacter}
            onChange={(e) => {
              setSelectedCharacter(e.target.value);
              setCustomImageSrc(null);
            }}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-amber-400 font-bold outline-none focus:border-amber-500 cursor-pointer"
          >
            {availableCharacters.map(char => (
              <option key={char} value={char}>{char}</option>
            ))}
          </select>

          <div className="text-[11px] text-zinc-400">
            <span>Available References: </span>
            <span className="font-semibold text-zinc-200">{characterAssets.length} image{characterAssets.length === 1 ? "" : "s"}</span>
          </div>

          {/* Quick Dropzone for new Pose Photo */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileDrop(e.dataTransfer.files[0]);
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
                  handleFileDrop(e.target.files[0]);
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
                  onClick={() => setSelectedAsset(null)}
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
                    onClick={() => {
                      setSelectedAsset(asset);
                      setCustomImageSrc(null);
                    }}
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

      {/* ============================================================== */}
      {/* STEP 3: INTERACTIVE KEYING INSPECTOR (SPLIT VIEW & CONTROLS)   */}
      {/* ============================================================== */}
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
              onClick={() => {
                setTolerance(35);
                setSoftness(15);
                setDespill(true);
                setKeyColor("#00FF00");
              }}
              className="text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded flex items-center gap-1 transition-colors cursor-pointer"
              title="Reset parameters"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* DUAL PREVIEW COMPARISON: SOURCE vs KEYED TRANSPARENT CUTOUT */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* LEFT: SOURCE IMAGE WITH EYEDROPPER */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                <span>Source Image</span>
                <span className="text-[10px] font-normal text-zinc-500">(Click to sample key color)</span>
              </label>

              <button
                type="button"
                onClick={() => setIsEyedropperActive(!isEyedropperActive)}
                className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                  isEyedropperActive
                    ? "bg-amber-500 text-black font-bold"
                    : "bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700"
                }`}
              >
                <Pipette className="w-3 h-3" />
                <span>{isEyedropperActive ? "Sampling Active" : "Eyedropper"}</span>
              </button>
            </div>

            <div className="relative aspect-square max-h-80 w-full rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 flex items-center justify-center">
              {activeImageSource ? (
                <>
                  <img
                    ref={sourceImageRef}
                    src={activeImageSource}
                    alt="Source"
                    onClick={handleSourceImageClick}
                    onMouseMove={handleSourceImageMouseMove}
                    className={`max-h-full max-w-full object-contain ${
                      isEyedropperActive ? "cursor-crosshair" : "cursor-pointer"
                    }`}
                    crossOrigin="anonymous"
                  />
                  {/* Floating Eyedropper Magnifier Badge */}
                  {isEyedropperActive && hoveredColor && (
                    <div className="absolute top-2 left-2 pointer-events-none bg-black/85 backdrop-blur border border-zinc-700 px-2 py-1 rounded-md text-[10px] font-mono flex items-center gap-2 shadow-lg">
                      <div
                        className="w-3.5 h-3.5 rounded-full border border-white/40 shadow-inner"
                        style={{ backgroundColor: hoveredColor }}
                      />
                      <span>{hoveredColor}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-xs text-zinc-500">No image selected</div>
              )}
            </div>
          </div>

          {/* RIGHT: TRANSPARENT CUTOUT OVER CHECKERBOARD */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                <span>Transparent Cutout</span>
                <span className="text-[10px] font-normal text-emerald-400">
                  {cutoutResult ? `${cutoutResult.transparentPercentage}% removed` : ""}
                </span>
              </label>

              <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400">
                <span>PNG Alpha</span>
              </div>
            </div>

            {/* HIGH CONTRAST CHECKERBOARD TRANSPARENCY CONTAINER */}
            <div 
              className="relative aspect-square max-h-80 w-full rounded-xl overflow-hidden border border-zinc-800 flex items-center justify-center shadow-inner"
              style={{
                backgroundImage: `conic-gradient(#27272a 90deg, #18181b 90deg 180deg, #27272a 180deg 270deg, #18181b 270deg)`,
                backgroundSize: "16px 16px"
              }}
            >
              {cutoutResult ? (
                <img
                  src={cutoutResult.dataUrl}
                  alt="Keyed Cutout"
                  className="max-h-full max-w-full object-contain filter drop-shadow-md"
                />
              ) : (
                <div className="text-xs text-zinc-500 font-mono">Awaiting keying...</div>
              )}

              {/* Status overlay badge */}
              {cutoutResult && (
                <div className="absolute bottom-2 right-2 pointer-events-none bg-black/80 backdrop-blur border border-zinc-800 px-2 py-0.5 rounded text-[9px] font-mono text-zinc-300">
                  {cutoutResult.width} × {cutoutResult.height} • Clean Cutout
                </div>
              )}
            </div>
          </div>

        </div>

        {/* KEYING PARAMETERS CONTROLS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-zinc-800/80">
          
          {/* Key Color Picker & Quick Palette */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-zinc-300">
              <span>Target Key Color</span>
              <span className="font-mono text-amber-400 font-bold">{keyColor}</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="color"
                value={keyColor}
                onChange={(e) => setKeyColor(e.target.value.toUpperCase())}
                className="w-8 h-8 rounded border border-zinc-700 bg-transparent cursor-pointer p-0 shrink-0"
              />
              <input
                type="text"
                value={keyColor}
                onChange={(e) => setKeyColor(e.target.value)}
                placeholder="#00FF00"
                className="w-24 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs font-mono uppercase text-zinc-200 outline-none"
              />
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1 pt-1">
              {QUICK_KEY_COLORS.map(c => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setKeyColor(c.hex)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-transform active:scale-95 cursor-pointer ${c.bgClass}`}
                  title={c.label}
                >
                  {c.label.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Tolerance Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-zinc-300">
              <span title="Controls color range sensitivity to remove background">
                Tolerance / Threshold
              </span>
              <span className="font-mono text-indigo-400 font-bold">{tolerance}%</span>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              value={tolerance}
              onChange={(e) => setTolerance(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
              <span>Strict (1%)</span>
              <span>Balanced (35%)</span>
              <span>Aggressive (100%)</span>
            </div>
          </div>

          {/* Edge Softness & Despill */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-zinc-300">
              <span title="Feathers transparent edges to eliminate harsh halos">
                Edge Softness (Feather)
              </span>
              <span className="font-mono text-emerald-400 font-bold">{softness}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={softness}
              onChange={(e) => setSoftness(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={despill}
                  onChange={(e) => setDespill(e.target.checked)}
                  className="rounded border-zinc-700 text-indigo-600 focus:ring-0"
                />
                <span>Despill Edge Fringing</span>
              </label>

              <span className="text-[10px] text-zinc-500 font-mono">
                Removes green halos
              </span>
            </div>
          </div>

        </div>

        {/* STAGING METADATA (STANCE & PLANE) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-zinc-800">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Actor Stance / Pose Description
            </label>
            <input
              type="text"
              value={postureName}
              onChange={(e) => setPostureName(e.target.value)}
              placeholder="e.g. Standing Heroic, Walking Forward, Reaching..."
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Initial Depth Plane
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(["foreground", "midground", "background"] as const).map(plane => (
                <button
                  key={plane}
                  type="button"
                  onClick={() => setSelectedPlane(plane)}
                  className={`py-1.5 text-xs font-medium rounded-lg capitalize border transition-colors cursor-pointer ${
                    selectedPlane === plane
                      ? "bg-indigo-600 text-white border-indigo-500 font-bold"
                      : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200"
                  }`}
                >
                  {plane}
                </button>
              ))}
            </div>
          </div>
        </div>

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
