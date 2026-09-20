import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  MediaAsset, 
  SceneProjectFile, 
  ShotItem, 
  ShotFirstFrame 
} from "../../types";
import { getAssetMediaUrl } from "../../utils/assetUrl";
import { 
  Sparkles, 
  User, 
  Shirt, 
  MapPin, 
  ShieldAlert, 
  ShieldCheck, 
  Check, 
  Layers, 
  Sliders, 
  Upload, 
  FolderOpen, 
  Maximize2, 
  X, 
  Play, 
  RefreshCw, 
  CheckCircle2, 
  ArrowRight, 
  Tv, 
  AlertTriangle,
  Send,
  Camera
} from "lucide-react";

interface MultimodalFrameComposerProps {
  sceneProject?: SceneProjectFile;
  activeShot: ShotItem;
  activeScene: string;
  allAssets?: MediaAsset[];
  assignedFirstFrame?: ShotFirstFrame;
  onAcceptFirstFrame: (firstFrame: ShotFirstFrame) => void;
  onAssetUploaded?: (asset: MediaAsset, targetSlotIndex?: number) => void;
  addToast?: (msg: string, type?: "success" | "error" | "info") => void;
}

interface ReferenceSlotState {
  filename?: string;
  previewUrl?: string;
  label?: string;
  base64?: string;
}

interface CandidateItem {
  id: string;
  index: number;
  base64: string;
  mimeType: string;
  promptUsed: string;
  aspectRatio: string;
}

const CINEMATIC_PRESETS = [
  "Medium close-up shot, dramatic rim lighting",
  "Over-the-shoulder perspective, shallow depth of field",
  "Wide establishing frame, volumetric golden hour haze",
  "Low-angle cinematic heroic framing, high contrast",
  "Moody neo-noir atmosphere, practical neon backlight",
  "Intense eye-level character close-up, soft studio fill"
];

export const MultimodalFrameComposer: React.FC<MultimodalFrameComposerProps> = ({
  sceneProject,
  activeShot,
  activeScene,
  allAssets = [],
  assignedFirstFrame,
  onAcceptFirstFrame,
  onAssetUploaded,
  addToast
}) => {
  // Slots state
  const [actorSlot, setActorSlot] = useState<ReferenceSlotState>({});
  const [wardrobeSlot, setWardrobeSlot] = useState<ReferenceSlotState>({});
  const [locationSlot, setLocationSlot] = useState<ReferenceSlotState>({});

  // Prompt & Parameters
  const [prompt, setPrompt] = useState<string>("");
  const [aspectRatio, setAspectRatio] = useState<string>(activeShot.aspect_ratio || "16:9");
  const [candidateCount, setCandidateCount] = useState<number>(2);

  // Safety & Translation State
  const [isCheckingSafety, setIsCheckingSafety] = useState<boolean>(false);
  const [sanitizedPrompt, setSanitizedPrompt] = useState<string | null>(null);
  const [safetyReplacements, setSafetyReplacements] = useState<string[]>([]);
  const [useSanitized, setUseSanitized] = useState<boolean>(true);

  // Generation & Status
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateItem | null>(null);
  const [activeModalCandidate, setActiveModalCandidate] = useState<CandidateItem | null>(null);
  const [isAccepting, setIsAccepting] = useState<boolean>(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [wasBlockedByFilter, setWasBlockedByFilter] = useState<boolean>(false);
  const [isSendingToComfy, setIsSendingToComfy] = useState<boolean>(false);

  // Asset picker modal state for slots
  const [activePickerSlot, setActivePickerSlot] = useState<"actor" | "wardrobe" | "location" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetSlot, setUploadTargetSlot] = useState<"actor" | "wardrobe" | "location" | null>(null);

  // Auto-bind slots on activeShot / sceneProject changes
  useEffect(() => {
    // 1. Prompt initialization
    const initialPrompt = activeShot.basic_stub || activeShot.expanded_prompt || "";
    setPrompt(initialPrompt);
    setSanitizedPrompt(null);
    setSafetyReplacements([]);
    setGenerationError(null);
    setWasBlockedByFilter(false);

    // 2. Resolve Character / Actor Slot
    const characters = sceneProject?.characters ? Object.values(sceneProject.characters) : [];
    let matchedActorAsset: MediaAsset | undefined;
    let matchedActorFilename: string | undefined;

    // Try finding character matched with shot's assigned characters or subjects
    const shotChar = activeShot.characters?.[0] || activeShot.ots_focus_subject || activeShot.ots_anchor_subject;
    if (shotChar) {
      const charProfile = characters.find(c => c.name.toLowerCase() === shotChar.toLowerCase());
      if (charProfile?.quick_slots?.[0]) {
        matchedActorFilename = charProfile.quick_slots[0];
      }
    }

    if (!matchedActorFilename) {
      // Fallback: look in assets for headshot
      matchedActorAsset = allAssets.find(a => 
        (a.type || "").toLowerCase().includes("headshot") || 
        (a.tags || []).some(t => t.toLowerCase().includes("headshot"))
      );
      if (matchedActorAsset) matchedActorFilename = matchedActorAsset.filename;
    }

    if (matchedActorFilename) {
      setActorSlot({
        filename: matchedActorFilename,
        previewUrl: getAssetMediaUrl(matchedActorFilename),
        label: shotChar || "Assigned Actor"
      });
    }

    // 3. Resolve Wardrobe Slot
    let matchedWardrobeFilename: string | undefined;
    if (shotChar) {
      const charProfile = characters.find(c => c.name.toLowerCase() === shotChar.toLowerCase());
      if (charProfile?.scene_outfit_ref || charProfile?.default_outfit_ref) {
        matchedWardrobeFilename = charProfile.scene_outfit_ref || charProfile.default_outfit_ref;
      }
    }

    if (!matchedWardrobeFilename) {
      const wardrobeAsset = allAssets.find(a => 
        (a.type || "").toLowerCase().includes("wardrobe") || 
        (a.type || "").toLowerCase().includes("body") || 
        (a.tags || []).some(t => t.toLowerCase().includes("outfit") || t.toLowerCase().includes("wardrobe"))
      );
      if (wardrobeAsset) matchedWardrobeFilename = wardrobeAsset.filename;
    }

    if (matchedWardrobeFilename) {
      setWardrobeSlot({
        filename: matchedWardrobeFilename,
        previewUrl: getAssetMediaUrl(matchedWardrobeFilename),
        label: "Scene Wardrobe"
      });
    }

    // 4. Resolve Location Slot
    const stagingBg = sceneProject?.staging_recipe?.backgroundAssetFilename;
    let matchedLocationFilename = stagingBg;

    if (!matchedLocationFilename) {
      const locAsset = allAssets.find(a => 
        (a.type || "").toLowerCase().includes("location") || 
        (a.type || "").toLowerCase().includes("scene") ||
        (a.tags || []).some(t => t.toLowerCase().includes("backdrop") || t.toLowerCase().includes("environment"))
      );
      if (locAsset) matchedLocationFilename = locAsset.filename;
    }

    if (matchedLocationFilename) {
      setLocationSlot({
        filename: matchedLocationFilename,
        previewUrl: getAssetMediaUrl(matchedLocationFilename),
        label: "Staged Environment"
      });
    }
  }, [activeShot.id, sceneProject?.scene_name]);

  // Handle Safety Pre-flight Translation
  const handleTranslateSafety = async () => {
    if (!prompt.trim()) return;
    setIsCheckingSafety(true);
    try {
      const res = await fetch("/api/first-frame/sanitize-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      if (data.sanitizedPrompt) {
        setSanitizedPrompt(data.sanitizedPrompt);
        setSafetyReplacements(data.replacementsApplied || []);
        setUseSanitized(true);
        if (data.isModified) {
          if (addToast) addToast("Rewrote dramatic action into Hollywood stunt & stagecraft vocabulary.", "info");
        } else {
          if (addToast) addToast("Prompt is clean and adheres to standard filming guidelines.", "success");
        }
      }
    } catch (err: any) {
      console.warn("Safety check failed:", err);
    } finally {
      setIsCheckingSafety(false);
    }
  };

  // Handle Multimodal Candidate Generation
  const handleGenerate = async () => {
    const effectivePrompt = (useSanitized && sanitizedPrompt) ? sanitizedPrompt : prompt;
    if (!effectivePrompt.trim()) {
      if (addToast) addToast("Please enter a director staging prompt.", "error");
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    setWasBlockedByFilter(false);
    setCandidates([]);
    setSelectedCandidate(null);

    try {
      const payload = {
        prompt: effectivePrompt,
        actorImage: actorSlot.filename ? { filename: actorSlot.filename } : undefined,
        wardrobeImage: wardrobeSlot.filename ? { filename: wardrobeSlot.filename } : undefined,
        locationImage: locationSlot.filename ? { filename: locationSlot.filename } : undefined,
        aspectRatio,
        candidateCount,
        sceneName: sceneProject?.scene_name || activeScene,
        shotNumber: activeShot.shot_number || 1
      };

      const res = await fetch("/api/first-frame/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Generation failed.");
      }

      if (data.candidates && data.candidates.length > 0) {
        setCandidates(data.candidates);
        setSelectedCandidate(data.candidates[0]);
        if (addToast) addToast(`Generated ${data.candidates.length} Frame 0 candidates!`, "success");
      } else {
        throw new Error("No candidate images were returned.");
      }
    } catch (err: any) {
      console.error("First frame generation error:", err);
      const isBlocked = err.message?.toLowerCase().includes("safety") || err.message?.toLowerCase().includes("blocked");
      setGenerationError(err.message || "Failed to generate candidates.");
      setWasBlockedByFilter(isBlocked);
      if (addToast) addToast(`Generation failed: ${err.message}`, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle Candidate Acceptance
  const handleAcceptCandidate = async (candidate: CandidateItem) => {
    setIsAccepting(true);
    try {
      const res = await fetch("/api/first-frame/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64: candidate.base64,
          sceneName: sceneProject?.scene_name || activeScene,
          shotNumber: activeShot.shot_number || 1,
          aspectRatio: candidate.aspectRatio,
          promptUsed: candidate.promptUsed
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to commit candidate.");
      }

      if (data.asset && onAssetUploaded) {
        onAssetUploaded(data.asset);
      }

      if (addToast) addToast(`Saved start frame to gallery!`, "success");
      setActiveModalCandidate(null);
    } catch (err: any) {
      console.error("Failed to save candidate to gallery:", err);
      if (addToast) addToast(`Failed to save candidate: ${err.message}`, "error");
    } finally {
      setIsAccepting(false);
    }
  };

  // Handle Send to Local ComfyUI Fallback
  const handleSendToLocalComfy = async () => {
    setIsSendingToComfy(true);
    try {
      const payload = {
        sceneName: sceneProject?.scene_name || activeScene,
        shotNumber: activeShot.shot_number || 1,
        prompt: prompt,
        actorFilename: actorSlot.filename,
        wardrobeFilename: wardrobeSlot.filename,
        locationFilename: locationSlot.filename,
        aspectRatio
      };

      const res = await fetch("/api/first-frame/send-to-comfy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to stage to ComfyUI.");
      }

      if (addToast) addToast(`Shot ${activeShot.shot_number} prompt & references staged to local ComfyUI!`, "success");
    } catch (err: any) {
      console.error("Failed to dispatch to ComfyUI:", err);
      if (addToast) addToast(`ComfyUI dispatch error: ${err.message}`, "error");
    } finally {
      setIsSendingToComfy(false);
    }
  };

  // Slot Image Upload Handler
  const handleSlotFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTargetSlot) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("scene_name", sceneProject?.scene_name || activeScene);
    formData.append("type", uploadTargetSlot === "actor" ? "Headshot" : uploadTargetSlot === "wardrobe" ? "Wardrobe" : "Scene Reference");
    formData.append("subject_name", uploadTargetSlot);

    try {
      const res = await fetch("/api/assets/upload", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (data.success && data.asset) {
        if (onAssetUploaded) onAssetUploaded(data.asset);
        const slotData = {
          filename: data.asset.filename,
          previewUrl: getAssetMediaUrl(data.asset.filename),
          label: `Uploaded ${uploadTargetSlot}`
        };

        if (uploadTargetSlot === "actor") setActorSlot(slotData);
        if (uploadTargetSlot === "wardrobe") setWardrobeSlot(slotData);
        if (uploadTargetSlot === "location") setLocationSlot(slotData);

        if (addToast) addToast(`Attached reference for ${uploadTargetSlot}`, "success");
      }
    } catch (err: any) {
      if (addToast) addToast(`Upload failed: ${err.message}`, "error");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploadTargetSlot(null);
    }
  };

  return (
    <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
      {/* HIDDEN FILE INPUT */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleSlotFileUpload}
      />

      {/* SECTION HEADER */}
      <div className="p-3.5 px-4 border-b border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Option 2: Multimodal First Frame Generator (Frame 0 Staging)
          </h3>
        </div>
        <span className="text-[10px] text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded-full border border-zinc-700/50">
          Gemini Flash Image Multimodal Fusion
        </span>
      </div>

      <div className="p-4 flex flex-col gap-5">
        {/* 1. REFERENCE INGESTION PANEL (3 SLOTS) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>Multi-Reference Ingestion Composer</span>
            </span>
            <span className="text-[11px] text-zinc-500">Auto-bound from Scene Staging & Character profiles</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* SLOT 1: ACTOR / HEADSHOT */}
            <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-purple-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-purple-400" />
                  Actor Likeness Slot
                </span>
                {actorSlot.filename && (
                  <button
                    type="button"
                    onClick={() => setActorSlot({})}
                    className="text-[10px] text-zinc-500 hover:text-red-400 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="aspect-video bg-black/50 rounded-md border border-zinc-800/80 relative overflow-hidden flex items-center justify-center">
                {actorSlot.previewUrl || actorSlot.filename ? (
                  <img
                    src={actorSlot.previewUrl || getAssetMediaUrl(actorSlot.filename!)}
                    alt="Actor Reference"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-zinc-600 text-[10px] p-2 text-center">
                    <User className="w-5 h-5 mb-1 opacity-40" />
                    <span>No actor attached</span>
                  </div>
                )}
                {actorSlot.label && (
                  <span className="absolute bottom-1 left-1 bg-black/80 backdrop-blur-xs text-zinc-300 text-[9px] px-1.5 py-0.5 rounded font-medium truncate max-w-[90%]">
                    {actorSlot.label}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActivePickerSlot("actor")}
                  className="flex-1 py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <FolderOpen className="w-3 h-3 text-purple-400" />
                  <span>Choose</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUploadTargetSlot("actor");
                    fileInputRef.current?.click();
                  }}
                  className="py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  title="Upload headshot"
                >
                  <Upload className="w-3 h-3 text-zinc-400" />
                </button>
              </div>
            </div>

            {/* SLOT 2: WARDROBE / OUTFIT */}
            <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5">
                  <Shirt className="w-3.5 h-3.5 text-indigo-400" />
                  Wardrobe Reference Slot
                </span>
                {wardrobeSlot.filename && (
                  <button
                    type="button"
                    onClick={() => setWardrobeSlot({})}
                    className="text-[10px] text-zinc-500 hover:text-red-400 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="aspect-video bg-black/50 rounded-md border border-zinc-800/80 relative overflow-hidden flex items-center justify-center">
                {wardrobeSlot.previewUrl || wardrobeSlot.filename ? (
                  <img
                    src={wardrobeSlot.previewUrl || getAssetMediaUrl(wardrobeSlot.filename!)}
                    alt="Wardrobe Reference"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-zinc-600 text-[10px] p-2 text-center">
                    <Shirt className="w-5 h-5 mb-1 opacity-40" />
                    <span>Optional wardrobe</span>
                  </div>
                )}
                {wardrobeSlot.label && (
                  <span className="absolute bottom-1 left-1 bg-black/80 backdrop-blur-xs text-zinc-300 text-[9px] px-1.5 py-0.5 rounded font-medium truncate max-w-[90%]">
                    {wardrobeSlot.label}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActivePickerSlot("wardrobe")}
                  className="flex-1 py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <FolderOpen className="w-3 h-3 text-indigo-400" />
                  <span>Choose</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUploadTargetSlot("wardrobe");
                    fileInputRef.current?.click();
                  }}
                  className="py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  title="Upload wardrobe ref"
                >
                  <Upload className="w-3 h-3 text-zinc-400" />
                </button>
              </div>
            </div>

            {/* SLOT 3: LOCATION / SCENE */}
            <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  Location Backdrop Slot
                </span>
                {locationSlot.filename && (
                  <button
                    type="button"
                    onClick={() => setLocationSlot({})}
                    className="text-[10px] text-zinc-500 hover:text-red-400 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="aspect-video bg-black/50 rounded-md border border-zinc-800/80 relative overflow-hidden flex items-center justify-center">
                {locationSlot.previewUrl || locationSlot.filename ? (
                  <img
                    src={locationSlot.previewUrl || getAssetMediaUrl(locationSlot.filename!)}
                    alt="Location Reference"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-zinc-600 text-[10px] p-2 text-center">
                    <MapPin className="w-5 h-5 mb-1 opacity-40" />
                    <span>Optional location</span>
                  </div>
                )}
                {locationSlot.label && (
                  <span className="absolute bottom-1 left-1 bg-black/80 backdrop-blur-xs text-zinc-300 text-[9px] px-1.5 py-0.5 rounded font-medium truncate max-w-[90%]">
                    {locationSlot.label}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActivePickerSlot("location")}
                  className="flex-1 py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <FolderOpen className="w-3 h-3 text-amber-400" />
                  <span>Choose</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUploadTargetSlot("location");
                    fileInputRef.current?.click();
                  }}
                  className="py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  title="Upload location ref"
                >
                  <Upload className="w-3 h-3 text-zinc-400" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 2. DIRECTOR STAGING PROMPT & STYLE CHIPS */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-purple-400" />
              <span>Director Staging Prompt & Composition</span>
            </label>
            <button
              type="button"
              onClick={handleTranslateSafety}
              disabled={isCheckingSafety || !prompt.trim()}
              className="text-[11px] text-purple-300 hover:text-purple-200 flex items-center gap-1 px-2 py-0.5 bg-purple-950/40 border border-purple-800/40 rounded cursor-pointer transition-colors"
              title="Inspect prompt and translate violent/intense film action to Hollywood stunt terminology"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
              <span>{isCheckingSafety ? "Checking Safety..." : "Hollywood Stunt Safety Pre-Flight"}</span>
            </button>
          </div>

          <textarea
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              setSanitizedPrompt(null);
            }}
            placeholder="Describe the exact starting keyframe (pose, camera angle, lighting, gaze direction, mood)..."
            rows={3}
            className="w-full bg-zinc-900/90 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500 leading-relaxed resize-y"
          />

          {/* QUICK CINEMATIC PRESET BADGES */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[10px] text-zinc-500 font-medium">Quick Starters:</span>
            {CINEMATIC_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setPrompt(prev => prev ? `${prev}, ${preset}` : preset)}
                className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 hover:border-purple-600/50 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                + {preset.split(",")[0]}
              </button>
            ))}
          </div>

          {/* SAFETY RE-PROMPTING TRANSLATION BANNER */}
          {sanitizedPrompt && (
            <div className="p-3 bg-purple-950/30 border border-purple-800/40 rounded-lg flex flex-col gap-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  <span>Theatrical Safety Re-Prompting Layer Active</span>
                </div>
                <label className="flex items-center gap-1.5 text-[11px] text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useSanitized}
                    onChange={(e) => setUseSanitized(e.target.checked)}
                    className="accent-purple-500 rounded"
                  />
                  <span>Use Translated Stunt Prompt</span>
                </label>
              </div>
              <p className="text-[11px] text-zinc-300 font-mono bg-zinc-900/80 p-2 rounded border border-purple-900/40">
                {sanitizedPrompt}
              </p>
              {safetyReplacements.length > 0 && (
                <div className="flex flex-wrap gap-1 text-[9px] text-purple-300/80">
                  <span className="text-zinc-400">Translations applied:</span>
                  {safetyReplacements.map((rep, idx) => (
                    <span key={idx} className="bg-purple-900/40 px-1.5 py-0.5 rounded">
                      {rep}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. CONTROLS BAR: RATIO, CANDIDATES, & GENERATE BUTTON */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-800/80">
          <div className="flex flex-wrap items-center gap-3">
            {/* ASPECT RATIO */}
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5">
              <span className="text-[10px] text-zinc-400">Ratio:</span>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="bg-transparent text-xs font-semibold text-purple-300 outline-none cursor-pointer"
              >
                <option value="16:9" className="bg-zinc-900 text-zinc-200">16:9 (Cinema Wide)</option>
                <option value="9:16" className="bg-zinc-900 text-zinc-200">9:16 (Vertical)</option>
                <option value="1:1" className="bg-zinc-900 text-zinc-200">1:1 (Square)</option>
                <option value="4:3" className="bg-zinc-900 text-zinc-200">4:3 (Classic TV)</option>
                <option value="21:9" className="bg-zinc-900 text-zinc-200">21:9 (Anamorphic)</option>
              </select>
            </div>

            {/* CANDIDATE COUNT */}
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
              <span className="text-[10px] text-zinc-400 px-1.5">Candidates:</span>
              {[1, 2, 3, 4].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setCandidateCount(num)}
                  className={`w-6 h-6 rounded text-xs font-bold transition-colors cursor-pointer ${
                    candidateCount === num
                      ? "bg-purple-600 text-white shadow-xs"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* GENERATE ACTION BUTTON */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer ${
                isGenerating || !prompt.trim()
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white hover:shadow-purple-500/20"
              }`}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Synthesizing Frame 0...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate Frame 0 Candidates</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 4. ERROR & SAFETY BLOCK NOTIFICATION / LOCAL COMFYUI FALLBACK */}
        {generationError && (
          <div className="p-3.5 bg-red-950/30 border border-red-800/50 rounded-lg flex flex-col gap-2">
            <div className="flex items-start gap-2 text-red-300 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <div>
                <span className="font-bold">{wasBlockedByFilter ? "Commercial API Safety Filter Triggered" : "Generation Error"}</span>
                <p className="text-zinc-400 text-[11px] mt-0.5">{generationError}</p>
              </div>
            </div>

            {/* SEND TO LOCAL COMFYUI FALLBACK BUTTON */}
            <div className="flex items-center justify-between pt-1 border-t border-red-900/40">
              <span className="text-[11px] text-zinc-400">
                Prefer local rendering without API content filtering?
              </span>
              <button
                type="button"
                onClick={handleSendToLocalComfy}
                disabled={isSendingToComfy}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-purple-300 hover:text-white border border-purple-800/40 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Tv className="w-3.5 h-3.5 text-purple-400" />
                <span>{isSendingToComfy ? "Staging..." : "Send to Local ComfyUI"}</span>
              </button>
            </div>
          </div>
        )}

        {/* 5. CANDIDATE APPROVAL GALLERY */}
        {candidates.length > 0 && (
          <div className="flex flex-col gap-3 pt-3 border-t border-zinc-800/80 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Generated Frame 0 Candidates ({candidates.length})</span>
              </span>
              <span className="text-[11px] text-zinc-400">Click a candidate to inspect or accept as First Frame</span>
            </div>

            <div className={`grid gap-3 ${
              candidates.length === 1 ? "grid-cols-1 max-w-lg" : 
              candidates.length === 2 ? "grid-cols-1 sm:grid-cols-2" : 
              "grid-cols-2 sm:grid-cols-2 md:grid-cols-4"
            }`}>
              {candidates.map((cand) => (
                <div
                  key={cand.id}
                  className="group relative bg-zinc-900 border border-zinc-800 hover:border-purple-500 rounded-xl overflow-hidden flex flex-col transition-all shadow-md"
                >
                  <div className="aspect-video bg-black relative flex items-center justify-center overflow-hidden">
                    <img
                      src={`data:${cand.mimeType};base64,${cand.base64}`}
                      alt={`Candidate ${cand.index}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <button
                      type="button"
                      onClick={() => setActiveModalCandidate(cand)}
                      className="absolute top-2 right-2 p-1.5 rounded-md bg-black/70 hover:bg-black text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Zoom Lightbox"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                    <span className="absolute bottom-1.5 left-2 bg-black/80 text-[10px] font-bold text-purple-300 px-1.5 py-0.5 rounded">
                      Option {cand.index}
                    </span>
                  </div>

                  <div className="p-2.5 flex items-center justify-between bg-zinc-950/80 border-t border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setActiveModalCandidate(cand)}
                      className="text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                    >
                      Inspect
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAcceptCandidate(cand)}
                      disabled={isAccepting}
                      className="px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded text-[11px] font-bold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                    >
                      <Check className="w-3 h-3" />
                      <span>{isAccepting ? "Saving..." : "Save to Gallery"}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* LIGHTBOX / FULLSCREEN INSPECTION MODAL */}
      {activeModalCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                Frame 0 Candidate {activeModalCandidate.index} - Shot {activeShot.shot_number}
              </h3>
              <button
                type="button"
                onClick={() => setActiveModalCandidate(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-md bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto flex flex-col items-center justify-center bg-black/60">
              <img
                src={`data:${activeModalCandidate.mimeType};base64,${activeModalCandidate.base64}`}
                alt="Candidate Lightbox"
                className="max-h-[60vh] w-auto object-contain rounded-lg border border-zinc-800 shadow-lg"
              />
              <p className="text-xs text-zinc-400 mt-3 text-center max-w-xl">
                {activeModalCandidate.promptUsed}
              </p>
            </div>

            <div className="p-4 border-t border-zinc-800 flex items-center justify-between bg-zinc-900/60">
              <button
                type="button"
                onClick={() => setActiveModalCandidate(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleAcceptCandidate(activeModalCandidate)}
                disabled={isAccepting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-md cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{isAccepting ? "Saving Asset..." : "Save to Gallery"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ASSET PICKER MODAL FOR REFERENCE SLOTS */}
      {activePickerSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-purple-400" />
                Select {activePickerSlot.toUpperCase()} Reference
              </h3>
              <button
                type="button"
                onClick={() => setActivePickerSlot(null)}
                className="text-xs text-zinc-400 hover:text-white px-2 py-1 bg-zinc-800 rounded-md cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {allAssets
                .filter(a => !a.media_type || a.media_type === "image")
                .map(asset => (
                  <div
                    key={asset.filename}
                    onClick={() => {
                      const slotData = {
                        filename: asset.filename,
                        previewUrl: getAssetMediaUrl(asset.filename),
                        label: asset.subject_name || asset.type
                      };
                      if (activePickerSlot === "actor") setActorSlot(slotData);
                      if (activePickerSlot === "wardrobe") setWardrobeSlot(slotData);
                      if (activePickerSlot === "location") setLocationSlot(slotData);
                      setActivePickerSlot(null);
                    }}
                    className="group relative bg-zinc-900 border border-zinc-800 hover:border-purple-500 rounded-lg overflow-hidden cursor-pointer flex flex-col transition-all"
                  >
                    <div className="aspect-video bg-black flex items-center justify-center overflow-hidden">
                      <img
                        src={getAssetMediaUrl(asset.filename, true)}
                        alt={asset.description || asset.filename}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-2 text-[10px]">
                      <p className="font-semibold text-zinc-200 truncate">{asset.subject_name || asset.type}</p>
                      <p className="text-zinc-500 truncate text-[9px]">{asset.filename}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
