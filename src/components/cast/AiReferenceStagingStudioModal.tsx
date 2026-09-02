import React, { useState, useRef, useMemo, useEffect } from "react";
import { MediaAsset, SceneProjectFile, ShotItem, CharacterProfile, StagingLayerRecipe, sanitizeSlug } from "../../types";
import { 
  X, 
  UploadCloud, 
  Zap, 
  CheckCircle2, 
  Image as ImageIcon,
  Layers,
  Clapperboard,
  Camera,
  User,
  Copy,
  Check,
  Move,
  Sparkles,
  Grid,
  Eye,
  Sliders,
  ChevronRight,
  Plus,
  Trash2,
  Maximize2,
  UserPlus,
  Pipette,
  Save,
  Loader2,
  FlipHorizontal,
  ArrowUp,
  ArrowDown,
  Compass,
  Eraser,
  MapPin,
  RefreshCw
} from "lucide-react";
import { getAssetMediaUrl } from "../../utils/assetUrl";
import { copyToClipboard } from "../../utils/clipboard";
import { motion, AnimatePresence } from "motion/react";
import { ActorPoseKeyingPanel } from "./ActorPoseKeyingPanel";
import { StagingInteractiveCanvas, StagedActorCanvasItem } from "./StagingInteractiveCanvas";

import { StagingEnvironmentControls } from "./StagingEnvironmentControls";
import { StagingActorInspector } from "./StagingActorInspector";
import { StagingCompositeSavePanel } from "./StagingCompositeSavePanel";
import { useCompositeExporter } from "../../hooks/useCompositeExporter";

import { HeadshotGeneratorTab } from "./HeadshotGeneratorTab";
import { renderCompositeToBlob } from "../../utils/compositeCanvasExport";

export interface StagedActor extends StagedActorCanvasItem {
  horizontalPercent: number; // 15 to 85, kept in sync with xPercent
  scaleModifier?: number;
}

export interface AiReferenceStagingStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "headshots" | "staging";
  subjectName?: string;
  characterAssets?: MediaAsset[];
  activeSceneName: string;
  onAssetSaved?: (asset: MediaAsset) => void;
  addToast?: (msg: string, type?: "success" | "error" | "info") => void;
  characters?: Record<string, CharacterProfile>;
  subjects?: string[];
  allAssets?: MediaAsset[];
  sceneProject?: SceneProjectFile;
  activeShotId?: string | null;
  onUpdateShot?: (updater: (prev: ShotItem) => ShotItem) => void;
  onSelectShot?: (id: string | null) => void;
  onUpdateProject?: (updater: (prev: SceneProjectFile) => SceneProjectFile) => void;
}

const LIGHTING_ATMOSPHERES = [
  { id: "golden_hour", label: "Golden Hour Warmth", desc: "Warm directional sunlight with amber rim glow" },
  { id: "overcast", label: "Cool Overcast / Diffused", desc: "Soft shadowless cinematic overcast daylight" },
  { id: "noir", label: "Moody High-Contrast Noir", desc: "Hard directional key with deep cinematic shadows" },
  { id: "cyberpunk", label: "Cyberpunk Neon Glow", desc: "Vibrant dual-color cyan and magenta rim highlights" },
  { id: "interior_warm", label: "Interior Practical Lighting", desc: "Warm cozy practical lamps and motivated ambient glow" },
  { id: "silhouette", label: "Dramatic Silhouette", desc: "Bright backlit backdrop with high-contrast outlines" }
];

const ASPECT_RATIOS = [
  { id: "16:9", label: "16:9 Widescreen", ratioClass: "aspect-video" },
  { id: "2.39:1", label: "2.39:1 Anamorphic Scope", ratioClass: "aspect-[2.39/1]" },
  { id: "4:3", label: "4:3 Classic", ratioClass: "aspect-[4/3]" },
  { id: "9:16", label: "9:16 Vertical", ratioClass: "aspect-[9/16]" }
];

export const AiReferenceStagingStudioModal: React.FC<AiReferenceStagingStudioModalProps> = ({
  isOpen,
  onClose,
  initialTab = "headshots",
  subjectName = "",
  characterAssets = [],
  activeSceneName,
  onAssetSaved,
  addToast,
  characters = {},
  subjects = [],
  allAssets = [],
  sceneProject,
  activeShotId,
  onUpdateShot,
  onUpdateProject
}) => {
  // Studio Active Tab state
  const [activeTab, setActiveTab] = useState<"headshots" | "staging">(initialTab);

  // Active character context (preserved across tabs)
  const [activeSubject, setActiveSubject] = useState<string>(subjectName || subjects[0] || Object.keys(characters)[0] || "");
  const [activeScene, setActiveScene] = useState<string>(activeSceneName || sceneProject?.scene_name || "Scene_01");

  // Synchronize when opened with new props
  useEffect(() => {
    if (isOpen) {
      if (initialTab) setActiveTab(initialTab);
      if (subjectName) {
        setActiveSubject(subjectName);
      } else if (!activeSubject && subjects.length > 0) {
        setActiveSubject(subjects[0]);
      }
      if (activeSceneName) setActiveScene(activeSceneName);
    }
  }, [isOpen, initialTab, subjectName, activeSceneName]);

  // Derived assets for active character
  const currentCharacterAssets = useMemo(() => {
    if (!activeSubject) return characterAssets;
    const fromAll = allAssets.filter(a => (a.subject_name || "").toLowerCase() === activeSubject.toLowerCase());
    return fromAll.length > 0 ? fromAll : characterAssets;
  }, [activeSubject, allAssets, characterAssets]);

  // ==========================================
  // TAB 2: SCENE STAGING & BLOCKING STATE
  // ==========================================

  // Location / Environment picker
  const [selectedLocationFilename, setSelectedLocationFilename] = useState<string>("");
  const [customLocationName, setCustomLocationName] = useState<string>("");
  const [selectedAtmosphere, setSelectedAtmosphere] = useState<string>("golden_hour");
  const [cameraFraming, setCameraFraming] = useState<string>("Medium Wide Shot");

  // Viewport display settings
  const [viewportRatio, setViewportRatio] = useState<string>("16:9");
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showSafeAreas, setShowSafeAreas] = useState<boolean>(true);

  // Staged actors list
  const [stagedActors, setStagedActors] = useState<StagedActor[]>([]);
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  const [activeMaskingActorId, setActiveMaskingActorId] = useState<string | null>(null);

  const [customBackgroundUrl, setCustomBackgroundUrl] = useState<string | undefined>(undefined);

  // Location-first Reference Save Panel state
  const [compositeRefName, setCompositeRefName] = useState<string>("");
  const [hasUserEditedRefName, setHasUserEditedRefName] = useState<boolean>(false);
  const [assignToShotSlot, setAssignToShotSlot] = useState<boolean>(false);
  const [targetSlotIndex, setTargetSlotIndex] = useState<number>(8); // default to Slot 9 (index 8)




  // Active shot
  const activeShot = useMemo(() => {
    if (!sceneProject || !activeShotId) return null;
    return sceneProject.shots.find(s => s.id === activeShotId) || null;
  }, [sceneProject, activeShotId]);

  // Selected actor index derived for backward compatibility
  const selectedActorIndex = useMemo(() => {
    const idx = stagedActors.findIndex(a => a.id === selectedActorId);
    return idx >= 0 ? idx : -1;
  }, [stagedActors, selectedActorId]);

  // Rehydrate staging layout recipe from activeShot or project
  useEffect(() => {
    if (!isOpen) return;

    if (activeShot?.staging_recipe) {
      const recipe = activeShot.staging_recipe;
      if (recipe.backgroundAssetFilename) {
        setSelectedLocationFilename(recipe.backgroundAssetFilename);
      }
      if (recipe.backgroundUrl) {
        setCustomBackgroundUrl(recipe.backgroundUrl);
      }
      if (recipe.aspectRatio) {
        setViewportRatio(recipe.aspectRatio);
      }
      if (recipe.cameraFraming) {
        setCameraFraming(recipe.cameraFraming);
      }
      if (recipe.lightingAtmosphere) {
        setSelectedAtmosphere(recipe.lightingAtmosphere);
      }
      if (recipe.targetSlotIndex !== undefined) {
        setTargetSlotIndex(recipe.targetSlotIndex);
      }
      if (recipe.actors && recipe.actors.length > 0) {
        const loaded: StagedActor[] = recipe.actors.map((a, idx) => ({
          id: a.id || `actor-${idx}-${Date.now()}`,
          characterName: a.characterName,
          plane: a.plane || (a.yPercent <= 48 ? "background" : a.yPercent >= 76 ? "foreground" : "midground"),
          horizontalPercent: Math.round(a.xPercent),
          xPercent: a.xPercent,
          yPercent: a.yPercent,
          scale: a.scale || 1.0,
          isFlipped: !!a.isFlipped,
          zIndex: a.zIndex || idx + 1,
          facing: a.facing || "facing_camera",
          posture: a.posture || "Standing Heroic",
          referenceAssetFilename: a.referenceAssetFilename,
          cutoutDataUrl: a.cutoutDataUrl,
          originalCutoutDataUrl: a.originalCutoutDataUrl,
          maskDataUrl: a.maskDataUrl
        }));
        setStagedActors(loaded);
        setSelectedActorId(loaded[0]?.id || null);
        return;
      } else {
        setStagedActors([]);
        setSelectedActorId(null);
      }
    } else {
      setStagedActors([]);
      setSelectedActorId(null);
    }

    if (activeShot?.assigned_slots && activeShot.assigned_slots[8]) {
      setSelectedLocationFilename(activeShot.assigned_slots[8]);
    }
  }, [isOpen, activeShotId, activeShot]);

  // Chroma-Key Pose Inspector Modal State
  const [isPoseKeyingOpen, setIsPoseKeyingOpen] = useState<boolean>(false);
  const [keyingTargetSubject, setKeyingTargetSubject] = useState<string>(activeSubject || "");

  // Filter location assets
  const locationAssets = useMemo(() => {
    return allAssets.filter(a => {
      const type = (a.type || "").toLowerCase();
      const desc = (a.description || "").toLowerCase();
      const filename = (a.filename || "").toLowerCase();
      return (
        type.includes("scene") ||
        type.includes("location") ||
        desc.includes("location") ||
        desc.includes("environment") ||
        filename.includes("scene") ||
        filename.includes("env")
      );
    });
  }, [allAssets]);

  // Selected location asset
  const activeLocationAsset = useMemo(() => {
    return allAssets.find(a => a.filename === selectedLocationFilename) || locationAssets[0];
  }, [allAssets, selectedLocationFilename, locationAssets]);

  // Derived default environment reference name (e.g. "Couch 3/4" or "Living Room")
  const defaultEnvironmentName = useMemo(() => {
    if (customLocationName.trim()) {
      return customLocationName.trim();
    }
    if (activeLocationAsset) {
      if (activeLocationAsset.subject_name && !["subject", "unknown", "scene", "default"].includes(activeLocationAsset.subject_name.toLowerCase())) {
        return activeLocationAsset.subject_name;
      }
      if (activeLocationAsset.description && activeLocationAsset.description.trim()) {
        const descWords = activeLocationAsset.description.trim().split(" ");
        if (descWords.length <= 4) {
          return activeLocationAsset.description.trim();
        }
      }
      const clean = activeLocationAsset.filename
        .replace(/\.[^.]+$/, "")
        .replace(/^(scene_location_reference_|character_staging_reference_|scene_reference_|location_reference_|scene_|env_)/i, "")
        .replace(/_\d+$/, "")
        .replace(/[_-]/g, " ")
        .trim();
      if (clean) {
        return clean.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      }
    }
    return "Living Room";
  }, [customLocationName, activeLocationAsset]);

  const { isExportingComposite, handleSaveCompositeReference } = useCompositeExporter({
    stagedActors,
    customBackgroundUrl,
    activeLocationAsset,
    viewportRatio,
    compositeRefName,
    defaultEnvironmentName,
    activeScene,
    assignToShotSlot,
    targetSlotIndex,
    cameraFraming,
    selectedAtmosphere,
    onAssetSaved,
    onUpdateShot,
    addToast
  });


  // Synchronize composite reference name if user hasn't explicitly edited it
  useEffect(() => {
    if (!hasUserEditedRefName && defaultEnvironmentName) {
      setCompositeRefName(defaultEnvironmentName);
    }
  }, [defaultEnvironmentName, hasUserEditedRefName]);

  // Reset or re-init when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (!hasUserEditedRefName && defaultEnvironmentName) {
        setCompositeRefName(defaultEnvironmentName);
      }
    } else {
      setHasUserEditedRefName(false);
      setAssignToShotSlot(false);
    }
  }, [isOpen, defaultEnvironmentName, hasUserEditedRefName]);

  // All available characters in project
  const availableCharacters = useMemo(() => {
    const list = new Set<string>();
    if (activeSubject) list.add(activeSubject);
    subjects.forEach(s => list.add(s));
    Object.keys(characters).forEach(k => list.add(k));
    return Array.from(list);
  }, [activeSubject, subjects, characters]);

  // Handle adding an actor to the stage (simple text token)
  const handleAddActorToStage = (charName: string) => {
    const existing = stagedActors.find(a => a.characterName.toLowerCase() === charName.toLowerCase());
    if (existing) {
      setSelectedActorId(existing.id);
      return;
    }
    const offset = (stagedActors.length * 20 + 30) % 70 + 15;
    const isFg = stagedActors.length % 2 !== 0;
    const newActor: StagedActor = {
      id: `actor-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      characterName: charName,
      plane: isFg ? "foreground" : "midground",
      horizontalPercent: offset,
      xPercent: offset,
      yPercent: isFg ? 88 : 65,
      scale: isFg ? 1.15 : 0.95,
      isFlipped: false,
      zIndex: stagedActors.length + 1,
      facing: "facing_camera",
      posture: "Standing Heroic"
    };
    setStagedActors(prev => [...prev, newActor]);
    setSelectedActorId(newActor.id);
  };

  // Handle adding or updating an actor with a keyed transparent pose cutout
  const handleAddPosedActorToStage = (actorData: {
    characterName: string;
    cutoutDataUrl: string;
    referenceAssetFilename?: string;
    posture?: string;
    facing?: "facing_camera" | "turn_left" | "turn_right" | "profile_left" | "profile_right" | "back_camera";
    plane?: "foreground" | "midground" | "background";
  }) => {
    const existingIndex = stagedActors.findIndex(
      a => a.characterName.toLowerCase() === actorData.characterName.toLowerCase()
    );

    const targetPlane = actorData.plane || (existingIndex >= 0 ? stagedActors[existingIndex].plane : "foreground");
    const defaultY = targetPlane === "background" ? 42 : targetPlane === "midground" ? 65 : 88;
    const defaultScale = targetPlane === "background" ? 0.7 : targetPlane === "midground" ? 0.95 : 1.15;

    if (existingIndex >= 0) {
      const existingId = stagedActors[existingIndex].id;
      setStagedActors(prev => {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          cutoutDataUrl: actorData.cutoutDataUrl,
          referenceAssetFilename: actorData.referenceAssetFilename || next[existingIndex].referenceAssetFilename,
          posture: actorData.posture || next[existingIndex].posture,
          plane: targetPlane,
          facing: actorData.facing || next[existingIndex].facing,
          isFlipped: actorData.facing === "profile_left" || actorData.facing === "turn_left"
        };
        return next;
      });
      setSelectedActorId(existingId);
    } else {
      const offset = (stagedActors.length * 20 + 30) % 70 + 15;
      const newActor: StagedActor = {
        id: `actor-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        characterName: actorData.characterName,
        plane: targetPlane,
        horizontalPercent: offset,
        xPercent: offset,
        yPercent: defaultY,
        scale: defaultScale,
        isFlipped: actorData.facing === "profile_left" || actorData.facing === "turn_left",
        zIndex: stagedActors.length + 1,
        facing: actorData.facing || "facing_camera",
        posture: actorData.posture || "Custom Keyed Pose",
        referenceAssetFilename: actorData.referenceAssetFilename,
        cutoutDataUrl: actorData.cutoutDataUrl,
      };
      setStagedActors(prev => [...prev, newActor]);
      setSelectedActorId(newActor.id);
    }
  };

  const handleRemoveActorFromStage = (index: number) => {
    const actorToRemove = stagedActors[index];
    if (actorToRemove) {
      handleRemoveActor(actorToRemove.id);
    }
  };

  const updateSelectedActor = (updater: Partial<StagedActor>) => {
    if (!selectedActorId) return;
    handleUpdateActor(selectedActorId, updater);
  };

  const handleUpdateActor = (id: string, updates: Partial<StagedActor>) => {
    setStagedActors(prev => prev.map(actor => {
      if (actor.id !== id) return actor;
      const nextX = updates.xPercent !== undefined ? updates.xPercent : (updates.horizontalPercent !== undefined ? updates.horizontalPercent : actor.xPercent);
      const nextH = updates.horizontalPercent !== undefined ? updates.horizontalPercent : (updates.xPercent !== undefined ? Math.round(updates.xPercent) : actor.horizontalPercent);
      return {
        ...actor,
        ...updates,
        horizontalPercent: nextH,
        xPercent: nextX
      };
    }));
  };

  const handleRemoveActor = (id: string) => {
    setStagedActors(prev => {
      const next = prev.filter(a => a.id !== id);
      if (selectedActorId === id) {
        setSelectedActorId(next[0]?.id || null);
      }
      return next;
    });
  };

  const handleReorderActors = (reordered: StagedActorCanvasItem[]) => {
    setStagedActors(prev => {
      return reordered.map((item, idx) => {
        const found = prev.find(p => p.id === item.id);
        return found ? { ...found, ...item, zIndex: idx + 1 } : (item as StagedActor);
      });
    });
  };

  const handleUploadCustomBackground = async (file: File) => {
    try {
      const formData = new FormData();
      const cleanScene = activeScene.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_") || "scene";
      const filename = `scene_reference_${cleanScene}_loc_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      formData.append("file", file, filename);
      formData.append("type", "Scene Reference");
      formData.append("scene_name", activeScene);
      formData.append("description", `Location reference environment for ${activeScene}`);
      formData.append("tags", JSON.stringify(["Scene Reference", "Location", "Environment"]));
      formData.append("subject_name", activeScene);

      const res = await fetch("/api/assets/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.asset) {
          if (onAssetSaved) onAssetSaved(data.asset);
          setSelectedLocationFilename(data.asset.filename);
          setCustomBackgroundUrl(undefined);
          if (addToast) addToast(`Room photo uploaded as location reference: ${data.asset.filename}`, "success");
          return;
        }
      }
    } catch (err) {
      console.warn("Could not upload environment to server, reading as data URL:", err);
    }

    // Fallback to local Data URL
    const reader = new FileReader();
    reader.onload = () => {
      setCustomBackgroundUrl(reader.result as string);
      setSelectedLocationFilename("");
    };
    reader.readAsDataURL(file);
    if (addToast) addToast("Room photo loaded into stage background.", "info");
  };

  const handleClearBackground = () => {
    setSelectedLocationFilename("");
    setCustomBackgroundUrl(undefined);
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-6xl max-h-[94vh] overflow-hidden shadow-2xl flex flex-col">
        
        {/* TOP HEADER WITH UNIFIED TITLE & CHARACTER/SCENE SELECTOR */}
        <div className="px-5 py-3.5 border-b border-zinc-800/90 bg-zinc-900/70 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-indigo-600/20 border border-zinc-700 flex items-center justify-center shadow-inner">
              <Clapperboard className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  AI Reference & Staging Studio
                </h2>
                <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">
                  Director's Suite
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400">
                <span>Scene:</span>
                <span className="font-mono text-zinc-200 bg-zinc-800/80 px-1.5 py-0.5 rounded border border-zinc-700/60">
                  {activeScene}
                </span>
                <span className="text-zinc-600">•</span>
                <span>Active Character:</span>
                <select
                  value={activeSubject}
                  onChange={(e) => setActiveSubject(e.target.value)}
                  className="bg-zinc-900 text-amber-400 font-semibold border border-zinc-700 rounded px-1.5 py-0.5 outline-none cursor-pointer text-xs"
                >
                  {availableCharacters.map(char => (
                    <option key={char} value={char}>{char}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              title="Close Studio"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TOP TAB SELECTOR BAR (2 WORKSPACE TABS) */}
        <div className="px-5 bg-zinc-900/95 border-b border-zinc-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("headshots")}
              className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                activeTab === "headshots"
                  ? "border-amber-500 text-amber-300 bg-zinc-800/40"
                  : "border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40"
              }`}
            >
              <Zap className={`w-4 h-4 ${activeTab === "headshots" ? "text-amber-400" : "text-zinc-500"}`} />
              <span>AI Headshots</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded font-mono">
                Variations
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("staging")}
              className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                activeTab === "staging"
                  ? "border-indigo-500 text-indigo-300 bg-zinc-800/40"
                  : "border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40"
              }`}
            >
              <Layers className={`w-4 h-4 ${activeTab === "staging" ? "text-indigo-400" : "text-zinc-500"}`} />
              <span>Scene Staging & Blocking</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded font-mono">
                Canvas Stage
              </span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-500">
            {activeTab === "headshots" ? (
              <span>Gemini 3.1 Flash Image • Photorealistic Multi-Angle Headshots</span>
            ) : (
              <span>Director's 2D Blocking Stage • Multi-Actor Spatial Layout</span>
            )}
          </div>
        </div>

        {/* WORKSPACE BODY */}
        <div className="flex-1 overflow-y-auto min-h-0 bg-zinc-950">
          
          {/* ========================================== */}
          {/* TAB 1: AI HEADSHOTS WORKSPACE               */}
          {/* ========================================== */}
          {activeTab === "headshots" && (
            <HeadshotGeneratorTab
              activeSubject={activeSubject}
              activeScene={activeScene}
              currentCharacterAssets={currentCharacterAssets}
              onAssetSaved={onAssetSaved}
              addToast={addToast}
              onClose={onClose}
            />
          )}
          {/* ========================================== */}
          {/* TAB 2: SCENE STAGING & BLOCKING WORKSPACE   */}
          {/* ========================================== */}
          {activeTab === "staging" && (
            <div className="p-5 flex flex-col gap-6">
              
                            <StagingEnvironmentControls
                locationAssets={locationAssets}
                selectedLocationFilename={selectedLocationFilename}
                setSelectedLocationFilename={setSelectedLocationFilename}
                customLocationName={customLocationName}
                setCustomLocationName={setCustomLocationName}
                selectedAtmosphere={selectedAtmosphere}
                setSelectedAtmosphere={setSelectedAtmosphere}
                viewportRatio={viewportRatio}
                setViewportRatio={setViewportRatio}
                showGrid={showGrid}
                setShowGrid={setShowGrid}
                showSafeAreas={showSafeAreas}
                setShowSafeAreas={setShowSafeAreas}
                onClearBackground={handleClearBackground}
              />

              {/* DIRECTOR'S CANVAS VIEWPORT (FULL WIDTH) */}
              <div className="w-full flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Clapperboard className="w-3.5 h-3.5 text-indigo-400" />
                      Director's 2D Stage Viewport ({viewportRatio})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setKeyingTargetSubject(activeSubject || stagedActors[selectedActorIndex]?.characterName || "");
                        setIsPoseKeyingOpen(true);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Add Actor Pose</span>
                    </button>
                  </div>
                </div>

                {/* Interactive 2D Staging Canvas with Drag, Scale, Flip, and Layer controls */}
                <StagingInteractiveCanvas
                  actors={stagedActors}
                  selectedActorId={selectedActorId}
                  onSelectActor={(id) => setSelectedActorId(id)}
                  onUpdateActor={handleUpdateActor}
                  onRemoveActor={handleRemoveActor}
                  onReorderActors={handleReorderActors}
                  activeLocationAsset={activeLocationAsset}
                  locationAssets={locationAssets}
                  customBackgroundUrl={customBackgroundUrl}
                  onSelectLocationAsset={(filename) => {
                    setSelectedLocationFilename(filename);
                    setCustomBackgroundUrl(undefined);
                  }}
                  onUploadCustomBackground={handleUploadCustomBackground}
                  onClearBackground={handleClearBackground}
                  aspectRatio={viewportRatio}
                  showGrid={showGrid}
                  showSafeAreas={showSafeAreas}
                  activeMaskingActorId={activeMaskingActorId}
                  onSetMaskingActorId={setActiveMaskingActorId}
                />
              </div>

                            {/* ACTOR BLOCKING CONTROLS (HORIZONTAL SECTION BELOW VIEWPORT) */}
              <StagingActorInspector
                stagedActors={stagedActors}
                selectedActorIndex={selectedActorIndex}
                availableCharacters={availableCharacters}
                activeSubject={activeSubject || ""}
                activeMaskingActorId={activeMaskingActorId}
                updateSelectedActor={updateSelectedActor}
                handleAddActorToStage={handleAddActorToStage}
                handleRemoveActorFromStage={handleRemoveActorFromStage}
                onSetMaskingActorId={setActiveMaskingActorId}
                onOpenPoseInspector={(subject) => {
                  setKeyingTargetSubject(subject);
                  setIsPoseKeyingOpen(true);
                }}
              />

              {/* LOCATION-FIRST REFERENCE SAVE PANEL */}
              <StagingCompositeSavePanel
                defaultEnvironmentName={defaultEnvironmentName}
                compositeRefName={compositeRefName}
                setHasUserEditedRefName={setHasUserEditedRefName}
                setCompositeRefName={setCompositeRefName}
                assignToShotSlot={assignToShotSlot}
                setAssignToShotSlot={setAssignToShotSlot}
                targetSlotIndex={targetSlotIndex}
                setTargetSlotIndex={setTargetSlotIndex}
                activeShot={activeShot}
                handleSaveCompositeReference={handleSaveCompositeReference}
                isExportingComposite={isExportingComposite}
              />
            </div>
          )}

        </div>
      </div>

      {/* Chroma-Key Actor Pose Inspector Overlay Modal */}
      {isPoseKeyingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto">
            <ActorPoseKeyingPanel
              characters={characters}
              subjects={availableCharacters}
              allAssets={allAssets}
              activeSceneName={activeScene}
              defaultCharacter={keyingTargetSubject}
              onAssetUploaded={onAssetSaved}
              onAddPosedActor={handleAddPosedActorToStage}
              onClose={() => setIsPoseKeyingOpen(false)}
              addToast={addToast}
            />
          </div>
        </div>
      )}
    </div>
  );
};
