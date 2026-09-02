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

const HEADSHOT_PRESETS = [
  "Facing",
  "3/4 Profile",
  "Full Profile",
  "Cinematic / Mood"
];

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
  // TAB 1: AI HEADSHOTS STATE & HANDLERS
  // ==========================================
  const [selectedSeed, setSelectedSeed] = useState<string | null>(null);
  const [seedType, setSeedType] = useState<"existing" | "upload" | null>(null);
  const [seedMimeType, setSeedMimeType] = useState<string>("image/png");
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "3:4" | "4:3" | "9:16" | "16:9">("1:1");
  const [selectedPresets, setSelectedPresets] = useState<string[]>(["Facing", "3/4 Profile"]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [candidates, setCandidates] = useState<{ key: string; base64: string }[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [headshotError, setHeadshotError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
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
    setSeedMimeType("image/png");
  };

  const togglePreset = (preset: string) => {
    setSelectedPresets(prev => 
      prev.includes(preset) ? prev.filter(p => p !== preset) : [...prev, preset]
    );
  };

  const toggleAllPresets = () => {
    if (selectedPresets.length === HEADSHOT_PRESETS.length) {
      setSelectedPresets([]);
    } else {
      setSelectedPresets([...HEADSHOT_PRESETS]);
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
  const [compositeDescription, setCompositeDescription] = useState<string>("");
  const [assignToShotSlot, setAssignToShotSlot] = useState<boolean>(false);
  const [targetSlotIndex, setTargetSlotIndex] = useState<number>(8); // default to Slot 9 (index 8)
  const [isExportingComposite, setIsExportingComposite] = useState<boolean>(false);

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

  // Requirement 2: Composite Export and Asset Ingestion
  const handleSaveCompositeReference = async () => {
    try {
      setIsExportingComposite(true);

      const effectiveBgUrl = customBackgroundUrl || (activeLocationAsset ? getAssetMediaUrl(activeLocationAsset.filename, true) : undefined);

      const exportActors = stagedActors.map(actor => ({
        id: actor.id,
        characterName: actor.characterName,
        cutoutDataUrl: actor.cutoutDataUrl,
        originalCutoutDataUrl: actor.originalCutoutDataUrl,
        maskDataUrl: actor.maskDataUrl,
        fallbackUrl: actor.referenceAssetFilename ? getAssetMediaUrl(actor.referenceAssetFilename, true) : undefined,
        xPercent: actor.xPercent,
        yPercent: actor.yPercent,
        scale: actor.scale,
        isFlipped: actor.isFlipped,
        zIndex: actor.zIndex
      }));

      // Flatten composite canvas to high-res Blob
      const blob = await renderCompositeToBlob({
        backgroundUrl: effectiveBgUrl,
        actors: exportActors,
        aspectRatio: viewportRatio
      });

      const effectiveRefName = (compositeRefName && compositeRefName.trim()) || defaultEnvironmentName || "Location Reference";
      const cleanRefName = sanitizeSlug(effectiveRefName) || "location_ref";
      const timeStamp = Math.floor(Date.now() / 1000);
      const filename = `scene_reference_${cleanRefName}_${timeStamp}.png`;

      const finalDescription = compositeDescription.trim();

      const formData = new FormData();
      formData.append("file", blob, filename);
      formData.append("type", "Scene Reference");
      formData.append("subject_name", effectiveRefName);
      formData.append("scene_name", activeScene);
      formData.append("description", finalDescription);
      formData.append("tags", JSON.stringify(["Scene Reference", "Composite Staging", "Director Staging", viewportRatio]));
      if (assignToShotSlot) {
        formData.append("slot_index", String(targetSlotIndex));
      }

      // Upload flattened composite to backend asset endpoint
      const res = await fetch("/api/assets/upload", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        throw new Error(`Upload failed with status ${res.status}`);
      }

      const data = await res.json();
      if (!data.success || !data.asset) {
        throw new Error(data.error || "Server failed to return created composite asset.");
      }

      const newAsset: MediaAsset = data.asset;

      // Register new composite asset into project asset list and gallery
      if (onAssetSaved) {
        onAssetSaved(newAsset);
      }

      // Save composite layer recipe metadata
      const recipe: StagingLayerRecipe = {
        backgroundAssetFilename: activeLocationAsset?.filename,
        backgroundUrl: customBackgroundUrl,
        actors: stagedActors.map(a => ({
          id: a.id,
          characterName: a.characterName,
          cutoutDataUrl: a.cutoutDataUrl,
          originalCutoutDataUrl: a.originalCutoutDataUrl,
          maskDataUrl: a.maskDataUrl,
          referenceAssetFilename: a.referenceAssetFilename,
          xPercent: a.xPercent,
          yPercent: a.yPercent,
          scale: a.scale,
          isFlipped: a.isFlipped,
          zIndex: a.zIndex,
          plane: a.plane,
          posture: a.posture,
          facing: a.facing
        })),
        aspectRatio: viewportRatio,
        cameraFraming: cameraFraming,
        lightingAtmosphere: selectedAtmosphere,
        compositeAssetFilename: newAsset.filename,
        targetSlotIndex: assignToShotSlot ? targetSlotIndex : undefined,
        updatedAt: new Date().toISOString()
      };

      // Assign to target reference slot on the active shot ONLY IF assignToShotSlot is true
      if (assignToShotSlot && onUpdateShot) {
        onUpdateShot(prev => {
          const nextSlots = { ...(prev.assigned_slots || {}) };
          nextSlots[targetSlotIndex] = newAsset.filename;
          return {
            ...prev,
            assigned_slots: nextSlots,
            staging_recipe: recipe,
            status: "unstaged",
            updated_at: new Date().toISOString()
          };
        });
      }

      // Update project state and flag as dirty
      if (onUpdateProject) {
        onUpdateProject(prev => {
          const prevAssets = prev.assets ? [...prev.assets] : [];
          const existingIdx = prevAssets.findIndex(a => a.filename === newAsset.filename);
          const nextAssetsUpdated = existingIdx !== -1
            ? prevAssets.map((a, i) => i === existingIdx ? newAsset : a)
            : [...prevAssets, newAsset];

          let nextShots = prev.shots ? [...prev.shots] : [];
          if (assignToShotSlot) {
            const shotIdToUpdate = activeShotId || (nextShots.length > 0 ? nextShots[0].id : null);
            if (shotIdToUpdate) {
              const sIdx = nextShots.findIndex(s => s.id === shotIdToUpdate);
              if (sIdx !== -1) {
                const nextSlots = { ...(nextShots[sIdx].assigned_slots || {}) };
                nextSlots[targetSlotIndex] = newAsset.filename;
                nextShots[sIdx] = {
                  ...nextShots[sIdx],
                  assigned_slots: nextSlots,
                  staging_recipe: recipe,
                  status: "unstaged",
                  updated_at: new Date().toISOString()
                };
              }
            }
          }

          return {
            ...prev,
            assets: nextAssetsUpdated,
            staging_recipe: recipe,
            shots: nextShots
          };
        });
      }

      if (addToast) {
        if (assignToShotSlot) {
          addToast(`Composite reference "${effectiveRefName}" saved to gallery and assigned to Shot Slot ${targetSlotIndex + 1}!`, "success");
        } else {
          addToast(`Composite reference "${effectiveRefName}" saved to reference gallery!`, "success");
        }
      }
    } catch (err: any) {
      console.error("Failed to save composite reference:", err);
      if (addToast) {
        addToast(`Error saving composite: ${err.message}`, "error");
      }
    } finally {
      setIsExportingComposite(false);
    }
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
            <div className="p-5 space-y-6">
              {headshotError && (
                <div className="bg-red-950/40 border border-red-800/60 rounded-xl p-3 text-sm text-red-300 flex items-center justify-between">
                  <span>{headshotError}</span>
                  <button onClick={() => setHeadshotError(null)} className="text-red-400 hover:text-red-200">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Seed Selection Section */}
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center text-xs">
                      1
                    </span>
                    Select Base Reference (Seed) for {activeSubject}
                  </h3>
                  <span className="text-xs text-zinc-400 font-mono">
                    {currentCharacterAssets.length} reference asset{currentCharacterAssets.length === 1 ? "" : "s"} found
                  </span>
                </div>

                {/* Upload or Grid Picker */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {/* Upload Card */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl aspect-square flex flex-col items-center justify-center p-3 text-center cursor-pointer transition-all ${
                      seedType === "upload" 
                        ? "border-amber-500 bg-amber-500/10" 
                        : "border-zinc-800 hover:border-zinc-700 bg-zinc-900/30"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <UploadCloud className={`w-6 h-6 mb-1 ${seedType === "upload" ? "text-amber-400" : "text-zinc-500"}`} />
                    <span className="text-[11px] font-medium text-zinc-300">Upload New</span>
                    <span className="text-[9px] text-zinc-500">JPG, PNG</span>
                  </div>

                  {/* Character Reference Assets Grid */}
                  {currentCharacterAssets.map(asset => {
                    const isSelected = seedType === "existing" && selectedSeed === asset.filename;
                    return (
                      <div
                        key={asset.filename}
                        onClick={() => handleSelectExisting(asset.filename)}
                        className={`relative rounded-xl aspect-square overflow-hidden border-2 cursor-pointer transition-all group ${
                          isSelected 
                            ? "border-amber-500 ring-2 ring-amber-500/40" 
                            : "border-zinc-800 hover:border-zinc-700"
                        }`}
                      >
                        <img
                          src={getAssetMediaUrl(asset.filename, true)}
                          alt={asset.description || asset.filename}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-1.5">
                          <p className="text-[10px] text-white font-medium truncate">{asset.type || "Reference"}</p>
                        </div>
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 bg-amber-500 text-black p-0.5 rounded-full shadow">
                            <CheckCircle2 className="w-3.5 h-3.5 fill-black text-amber-500" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Generation Controls */}
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center text-xs">
                      2
                    </span>
                    Angle & Composition Presets
                  </h3>
                  <button
                    type="button"
                    onClick={toggleAllPresets}
                    className="text-xs text-amber-400 hover:text-amber-300 font-medium cursor-pointer"
                  >
                    {selectedPresets.length === HEADSHOT_PRESETS.length ? "Deselect All" : "Select All"}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {HEADSHOT_PRESETS.map(preset => {
                    const active = selectedPresets.includes(preset);
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => togglePreset(preset)}
                        className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-colors cursor-pointer ${
                          active 
                            ? "bg-amber-950/20 border-amber-600/40 text-amber-300" 
                            : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                        }`}
                      >
                        <span className="text-xs font-semibold">{preset}</span>
                        <span className="text-[10px] text-zinc-500 mt-1">
                          {preset === "Facing" && "Direct forward look"}
                          {preset === "3/4 Profile" && "Classic dramatic turn"}
                          {preset === "Full Profile" && "90 degree silhouette"}
                          {preset === "Cinematic / Mood" && "Atmospheric key lighting"}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Aspect Ratio Selector */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-zinc-800/80">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-400">Aspect Ratio:</span>
                    {(["1:1", "3:4", "4:3", "9:16", "16:9"] as const).map(ratio => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setAspectRatio(ratio)}
                        className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors cursor-pointer ${
                          aspectRatio === ratio 
                            ? "bg-amber-500 text-black font-bold" 
                            : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateHeadshots}
                    disabled={isGenerating || !selectedSeed || selectedPresets.length === 0}
                    className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold px-5 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors shadow cursor-pointer"
                  >
                    <Zap className="w-4 h-4 fill-black text-black" />
                    {isGenerating ? "Synthesizing Headshots..." : `Generate ${selectedPresets.length} Variations`}
                  </button>
                </div>
              </div>

              {/* Candidate Variations Review */}
              {candidates.length > 0 && (
                <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-200">Generated Variations</h3>
                      <p className="text-xs text-zinc-400">Select the candidates you want to ingest into {activeSubject}'s reference library</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-zinc-400 font-mono">
                        {selectedCandidates.size} of {candidates.length} selected
                      </span>
                      <button
                        type="button"
                        onClick={handleSaveHeadshots}
                        disabled={isSaving || selectedCandidates.size === 0}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer shadow"
                      >
                        {isSaving ? "Saving to Cast..." : `Save Selected (${selectedCandidates.size})`}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {candidates.map((cand, idx) => {
                      const isSelected = selectedCandidates.has(idx);
                      return (
                        <div
                          key={idx}
                          onClick={() => toggleCandidate(idx)}
                          className={`relative rounded-xl aspect-square overflow-hidden border-2 cursor-pointer transition-all group ${
                            isSelected 
                              ? "border-amber-500 ring-2 ring-amber-500/40" 
                              : "border-zinc-800 opacity-60 hover:opacity-100"
                          }`}
                        >
                          <img
                            src={`data:image/png;base64,${cand.base64}`}
                            alt={cand.key}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2 right-2">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                              isSelected ? "bg-amber-500 text-black font-bold" : "bg-black/60 border border-zinc-600"
                            }`}>
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                          </div>
                          <div className="absolute inset-x-0 bottom-0 bg-black/80 px-2 py-1 text-[10px] text-zinc-300 font-mono text-center">
                            {cand.key}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================== */}
          {/* TAB 2: SCENE STAGING & BLOCKING WORKSPACE   */}
          {/* ========================================== */}
          {activeTab === "staging" && (
            <div className="p-5 flex flex-col gap-6">
              
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
              <div className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-4 shadow-sm">
                {/* Header Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                      <Sliders className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                          Actor Blocking Controls
                        </h4>
                        {stagedActors[selectedActorIndex] && (
                          <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            {stagedActors[selectedActorIndex].characterName}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        Spatial positioning, scale, floor anchor, and layer masking
                      </p>
                    </div>
                  </div>

                  {/* Cast Quick-Add Buttons & Pose Inspector */}
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="text-[11px] font-medium text-zinc-400">Add Cast:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {availableCharacters.map(char => {
                        const isStaged = stagedActors.some(a => a.characterName.toLowerCase() === char.toLowerCase());
                        return (
                          <button
                            key={char}
                            type="button"
                            onClick={() => handleAddActorToStage(char)}
                            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                              isStaged 
                                ? "bg-zinc-800 text-zinc-300 border border-zinc-700" 
                                : "bg-indigo-950/60 text-indigo-300 border border-indigo-800/60 hover:bg-indigo-900"
                            }`}
                          >
                            <Plus className="w-3 h-3" />
                            {char}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setKeyingTargetSubject(activeSubject || "");
                        setIsPoseKeyingOpen(true);
                      }}
                      className="px-2.5 py-1 bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-800/80 text-indigo-300 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>Pose Inspector</span>
                    </button>
                  </div>
                </div>

                {stagedActors[selectedActorIndex] ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
                    {/* Col 1: Figure Representation & Live Masking */}
                    <div className="space-y-3 bg-zinc-950/50 border border-zinc-800/80 rounded-xl p-3.5 flex flex-col justify-between h-full">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-zinc-300">Figure Representation</span>
                          {stagedActors[selectedActorIndex].cutoutDataUrl ? (
                            <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 rounded">
                              Transparent Cutout Active
                            </span>
                          ) : (
                            <span className="text-[10px] text-zinc-500 font-mono">Headshot Token</span>
                          )}
                        </div>

                        {stagedActors[selectedActorIndex].cutoutDataUrl ? (
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-800">
                            <div className="flex items-center gap-2.5">
                              <div 
                                className="w-10 h-10 rounded border border-zinc-700 overflow-hidden flex items-center justify-center shrink-0"
                                style={{
                                  backgroundImage: `conic-gradient(#27272a 90deg, #18181b 90deg 180deg, #27272a 180deg 270deg, #18181b 270deg)`,
                                  backgroundSize: "8px 8px"
                                }}
                              >
                                <img 
                                  src={stagedActors[selectedActorIndex].cutoutDataUrl} 
                                  alt="Cutout thumbnail" 
                                  className="h-full w-full object-contain"
                                />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-zinc-200 truncate">
                                  {stagedActors[selectedActorIndex].posture || "Custom Pose"}
                                </div>
                                <div className="text-[10px] text-zinc-400 truncate">
                                  Keyed chroma background
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setKeyingTargetSubject(stagedActors[selectedActorIndex].characterName);
                                  setIsPoseKeyingOpen(true);
                                }}
                                className="text-xs text-indigo-300 hover:text-white bg-indigo-950/70 border border-indigo-800/80 px-2 py-1 rounded transition-colors cursor-pointer"
                              >
                                Re-Key
                              </button>
                              <button
                                type="button"
                                onClick={() => updateSelectedActor({ cutoutDataUrl: undefined })}
                                className="text-xs text-zinc-500 hover:text-red-400 p-1 rounded transition-colors cursor-pointer"
                                title="Remove cutout and use circular token"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setKeyingTargetSubject(stagedActors[selectedActorIndex].characterName);
                              setIsPoseKeyingOpen(true);
                            }}
                            className="w-full py-1.5 text-xs text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer font-medium"
                          >
                            <Pipette className="w-3.5 h-3.5 text-amber-400" />
                            <span>Chroma-Key Pose from Reference</span>
                          </button>
                        )}
                      </div>

                      {/* Live In-Place Actor Mask / Eraser Brush */}
                      <div className="pt-2 border-t border-zinc-800 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
                            <Eraser className="w-3.5 h-3.5 text-indigo-400" />
                            Layer Mask / Eraser
                          </span>
                          {stagedActors[selectedActorIndex].maskDataUrl && (
                            <span className="text-[9px] font-semibold text-indigo-300 bg-indigo-950/80 border border-indigo-800/80 px-1.5 py-0.5 rounded">
                              Masked
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const currActor = stagedActors[selectedActorIndex];
                              if (activeMaskingActorId === currActor.id) {
                                setActiveMaskingActorId(null);
                              } else {
                                setActiveMaskingActorId(currActor.id);
                              }
                            }}
                            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm ${
                              activeMaskingActorId === stagedActors[selectedActorIndex].id
                                ? "bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400"
                                : "bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 border border-indigo-700/60"
                            }`}
                          >
                            <Eraser className="w-3.5 h-3.5" />
                            <span>
                              {activeMaskingActorId === stagedActors[selectedActorIndex].id
                                ? "Done Masking"
                                : "Erase on Stage"}
                            </span>
                          </button>
                          {stagedActors[selectedActorIndex].maskDataUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                const currActor = stagedActors[selectedActorIndex];
                                const orig = currActor.originalCutoutDataUrl || currActor.cutoutDataUrl;
                                updateSelectedActor({
                                  cutoutDataUrl: orig,
                                  maskDataUrl: undefined
                                });
                              }}
                              className="py-1.5 px-2.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 transition-colors cursor-pointer"
                              title="Reset all mask modifications and restore the complete actor cutout"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Col 2: Scale Factor */}
                    <div className="space-y-3 bg-zinc-950/50 border border-zinc-800/80 rounded-xl p-3.5 flex flex-col justify-between h-full">
                      <div>
                        <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400 mb-1">
                          <span>Scale</span>
                          <span className="font-mono text-zinc-200 font-semibold">
                            {Math.round((stagedActors[selectedActorIndex].scale || 1.0) * 100)}% ({((stagedActors[selectedActorIndex].scale || 1.0)).toFixed(2)}x)
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.20"
                          max="3.50"
                          step="0.05"
                          value={stagedActors[selectedActorIndex].scale || 1.0}
                          onChange={(e) => updateSelectedActor({ scale: Number(e.target.value) })}
                          className="w-full accent-indigo-500 cursor-pointer"
                        />
                        <div className="flex justify-between gap-1 text-[9px] text-zinc-500 font-mono mt-1">
                          {[
                            { label: "50%", scale: 0.5 },
                            { label: "100%", scale: 1.0 },
                            { label: "150%", scale: 1.5 },
                            { label: "225%", scale: 2.25 },
                            { label: "350%", scale: 3.5 }
                          ].map((preset) => (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => updateSelectedActor({ scale: preset.scale })}
                              className="px-1.5 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 rounded transition-colors"
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Quick remove from stage */}
                      {stagedActors.length > 0 && stagedActors[selectedActorIndex] && (
                        <button
                          type="button"
                          onClick={() => handleRemoveActorFromStage(selectedActorIndex)}
                          className="w-full py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 border border-red-900/40 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove {stagedActors[selectedActorIndex].characterName}</span>
                        </button>
                      )}
                    </div>

                    {/* Col 3: Stage Position (X-Axis) & Floor Anchor (Y-Axis) */}
                    <div className="space-y-3 bg-zinc-950/50 border border-zinc-800/80 rounded-xl p-3.5 flex flex-col justify-between h-full">
                      {/* Horizontal Placement Slider */}
                      <div>
                        <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400 mb-1">
                          <span>Stage Position (X-Axis)</span>
                          <span className="font-mono text-zinc-300">
                            {Math.round(stagedActors[selectedActorIndex].xPercent)}%
                            {stagedActors[selectedActorIndex].xPercent < 0 ? (
                              <span className="text-amber-400 text-[10px] ml-1">(Off-L)</span>
                            ) : stagedActors[selectedActorIndex].xPercent > 100 ? (
                              <span className="text-amber-400 text-[10px] ml-1">(Off-R)</span>
                            ) : null}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-40"
                          max="140"
                          step="1"
                          value={Math.round(stagedActors[selectedActorIndex].xPercent)}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            updateSelectedActor({ xPercent: val, horizontalPercent: val });
                          }}
                          className="w-full accent-indigo-500 cursor-pointer"
                        />
                        <div className="flex justify-between gap-1 text-[9px] text-zinc-500 font-mono mt-1">
                          {[
                            { label: "Off-L", val: -20 },
                            { label: "L (20%)", val: 20 },
                            { label: "Center", val: 50 },
                            { label: "R (80%)", val: 80 },
                            { label: "Off-R", val: 120 }
                          ].map((preset) => (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => updateSelectedActor({ xPercent: preset.val, horizontalPercent: preset.val })}
                              className="px-1.5 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 rounded transition-colors"
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Vertical Floor Anchor Slider */}
                      <div>
                        <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400 mb-1">
                          <span>Floor Anchor (Y-Axis)</span>
                          <span className="font-mono text-zinc-300">
                            {Math.round(stagedActors[selectedActorIndex].yPercent)}%
                            {stagedActors[selectedActorIndex].yPercent > 100 ? (
                              <span className="text-amber-400 text-[10px] ml-1">(Bleed)</span>
                            ) : null}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-20"
                          max="130"
                          step="1"
                          value={Math.round(stagedActors[selectedActorIndex].yPercent)}
                          onChange={(e) => updateSelectedActor({ yPercent: Number(e.target.value) })}
                          className="w-full accent-indigo-500 cursor-pointer"
                        />
                        <div className="flex justify-between gap-1 text-[9px] text-zinc-500 font-mono mt-1">
                          {[
                            { label: "Deep (42%)", val: 42 },
                            { label: "Mid (65%)", val: 65 },
                            { label: "Fg (88%)", val: 88 },
                            { label: "Bleed", val: 115 }
                          ].map((preset) => (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => updateSelectedActor({ yPercent: preset.val })}
                              className="px-1.5 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 rounded transition-colors"
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Quick Center on Stage Button */}
                      <button
                        type="button"
                        onClick={() => updateSelectedActor({ xPercent: 50, horizontalPercent: 50, yPercent: 85, scale: 1.0 })}
                        className="w-full py-1 text-xs text-indigo-300 hover:text-white bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-800/50 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                      >
                        <Compass className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Center on Stage</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 px-4 bg-zinc-950/40 border border-zinc-800/60 rounded-xl space-y-1.5">
                    <User className="w-5 h-5 text-zinc-600 mx-auto" />
                    <p className="text-xs font-medium text-zinc-400">No actors currently on stage</p>
                    <p className="text-[11px] text-zinc-500">Select a character above or open Pose Inspector to stage an actor.</p>
                  </div>
                )}
              </div>

              {/* LOCATION-FIRST REFERENCE SAVE PANEL */}
              <div className="bg-gradient-to-br from-zinc-900/90 via-zinc-900/60 to-zinc-950 border border-zinc-800 rounded-xl p-5 space-y-4 shadow-xl">
                {/* Header with contextual location info */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                        <span>Save Composite Reference to Gallery</span>
                      </h4>
                      <p className="text-xs text-zinc-400">
                        Flattens 2D staging layout & environment into a persistent scene reference asset.
                      </p>
                    </div>
                  </div>

                  {/* Active background environment badge */}
                  <div className="flex items-center gap-2 text-xs bg-zinc-950/80 border border-zinc-800 px-2.5 py-1 rounded-lg">
                    <span className="text-zinc-500">Stage Background:</span>
                    <span className="font-semibold text-zinc-200 truncate max-w-[200px]" title={defaultEnvironmentName}>
                      {defaultEnvironmentName}
                    </span>
                  </div>
                </div>

                {/* Form fields: Location/Reference Name */}
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Location / Reference Name
                    </label>
                    <input
                      type="text"
                      value={compositeRefName}
                      onChange={(e) => {
                        setHasUserEditedRefName(true);
                        setCompositeRefName(e.target.value);
                      }}
                      placeholder="e.g. Couch 3/4 or Living Room"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 transition-colors"
                    />
                    <span className="block mt-1 text-[11px] text-zinc-500">
                      Asset subject identifier for gallery organization (avoids phantom characters)
                    </span>
                  </div>
                </div>

                {/* Bottom Action Bar: Optional Slot Assignment & Save Action Button */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-zinc-800/60">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none group">
                      <input
                        type="checkbox"
                        checked={assignToShotSlot}
                        onChange={(e) => setAssignToShotSlot(e.target.checked)}
                        className="w-4 h-4 rounded border-zinc-700 bg-zinc-950 text-amber-500 focus:ring-amber-500/40 cursor-pointer accent-amber-500"
                      />
                      <span className="text-xs font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors">
                        Also assign to active shot input slot
                        {activeShot && (
                          <span className="ml-1.5 text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                            Shot {activeShot.shot_number.toString().padStart(2, "0")}
                          </span>
                        )}
                      </span>
                    </label>

                    {assignToShotSlot && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500 font-medium">Slot:</span>
                        <select
                          value={targetSlotIndex}
                          onChange={(e) => setTargetSlotIndex(Number(e.target.value))}
                          className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-amber-400 font-semibold focus:outline-none focus:border-amber-500/60 cursor-pointer"
                        >
                          <option value={8}>Slot 9 (Location / Staging Ref) - Default</option>
                          <option value={0}>Slot 1 (Subject / Primary Ref)</option>
                          <option value={1}>Slot 2 (Secondary Ref)</option>
                          <option value={2}>Slot 3 (Tertiary Ref)</option>
                          <option value={3}>Slot 4 (Shot Composition Ref)</option>
                          <option value={4}>Slot 5 (Lighting Ref)</option>
                          <option value={5}>Slot 6 (Atmosphere Ref)</option>
                          <option value={6}>Slot 7 (Action Ref)</option>
                          <option value={7}>Slot 8 (Style Ref)</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveCompositeReference}
                    disabled={isExportingComposite}
                    className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-black font-bold px-6 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] shrink-0"
                  >
                    {isExportingComposite ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-black" />
                        <span>Flattening & Uploading Composite...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 text-black" />
                        <span>Save Composite Reference</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

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
