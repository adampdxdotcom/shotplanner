import React, { useState, useEffect, useMemo, useRef } from "react";
import { MediaAsset, CharacterProfile, SceneProjectFile, ShotItem, StagingLayerRecipe } from "../../types";
import { StagedActor } from "./types";
import { StagedActorCanvasItem } from "../cast/StagingInteractiveCanvas";
import { useCompositeExporter } from "../../hooks/useCompositeExporter";
import { getAssetMediaUrl } from "../../utils/assetUrl";
import { sanitizeStagingRecipeForPersistence } from "../../utils/recipeSanitizer";
import { uploadCutoutAsset, uploadMaskAsset, uploadBackgroundAsset } from "../../utils/cutoutAssetUploader";
import { createManagedBlobUrl, revokeManagedBlobUrl, purgeManagedBlobUrls } from "../../utils/blobRegistry";
import { 
  getLastStagingTab, 
  setLastStagingTab, 
  getLastActiveSubject, 
  setLastActiveSubject,
  StagingWorkspaceTab
} from "../../utils/workspaceSessionStore";
import { assetsApi } from "../../api";

export interface UseStagingStageProps {
  sceneProject?: SceneProjectFile;
  activeShotId?: string | null;
  onSelectShot?: (id: string | null) => void;
  assets?: MediaAsset[];
  characters?: Record<string, CharacterProfile>;
  subjects?: string[];
  activeSceneName?: string;
  onUpdateProject?: React.Dispatch<React.SetStateAction<SceneProjectFile>> | ((updater: (prev: SceneProjectFile) => SceneProjectFile) => void);
  onUpdateShot?: (updater: (prev: ShotItem) => ShotItem) => void;
  onAssetUploaded?: (asset: MediaAsset, targetSlotIndex?: number) => void;
  addToast?: (msg: string, type?: "success" | "error" | "info") => void;
  initialTab?: StagingWorkspaceTab;
  initialSubject?: string;
}

export function useStagingStage({
  sceneProject,
  activeShotId,
  onSelectShot,
  assets = [],
  characters = {},
  subjects = [],
  activeSceneName,
  onUpdateProject,
  onUpdateShot,
  onAssetUploaded,
  addToast,
  initialTab = "staging",
  initialSubject = ""
}: UseStagingStageProps) {
  // Studio Active Tab state (persisted across reloads)
  const [activeTab, setActiveTab] = useState<StagingWorkspaceTab>(() => {
    return getLastStagingTab(initialTab);
  });

  // Active character context (preserved across tabs and reloads)
  const [activeSubject, setActiveSubject] = useState<string>(() => {
    if (initialSubject) return initialSubject;
    const saved = getLastActiveSubject();
    if (saved && (subjects.includes(saved) || characters[saved])) {
      return saved;
    }
    return subjects[0] || Object.keys(characters)[0] || "";
  });

  // Persist staging active tab
  useEffect(() => {
    setLastStagingTab(activeTab);
  }, [activeTab]);

  // Persist staging active subject
  useEffect(() => {
    if (activeSubject) {
      setLastActiveSubject(activeSubject);
    }
  }, [activeSubject]);

  const activeScene = activeSceneName || sceneProject?.scene_name || "Scene_01";

  // Active Shot derived
  const activeShot = useMemo(() => {
    if (!sceneProject || !activeShotId) return null;
    return sceneProject.shots.find(s => s.id === activeShotId) || null;
  }, [sceneProject, activeShotId]);

  // Derived assets for active character
  const currentCharacterAssets = useMemo(() => {
    if (!activeSubject) return assets;
    const fromAll = assets.filter(a => (a.subject_name || "").toLowerCase() === activeSubject.toLowerCase());
    return fromAll.length > 0 ? fromAll : assets;
  }, [activeSubject, assets]);

  // All available characters in project
  const availableCharacters = useMemo(() => {
    const list = new Set<string>();
    if (activeSubject) list.add(activeSubject);
    subjects.forEach(s => list.add(s));
    Object.keys(characters).forEach(k => list.add(k));
    return Array.from(list);
  }, [activeSubject, subjects, characters]);

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
  const [assignToShotSlot, setAssignToShotSlot] = useState<boolean>(true);
  const [targetSlotIndex, setTargetSlotIndex] = useState<number>(8); // default to Slot 9 (index 8)

  // Selected actor index derived for backward compatibility
  const selectedActorIndex = useMemo(() => {
    const idx = stagedActors.findIndex(a => a.id === selectedActorId);
    return idx >= 0 ? idx : -1;
  }, [stagedActors, selectedActorId]);

  // Track hydration to prevent reverse-syncing freshly loaded recipes
  const isHydratingRef = useRef<boolean>(true);
  const [stagingSaveStatus, setStagingSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");

  // Rehydrate staging layout recipe from activeShot or project
  useEffect(() => {
    isHydratingRef.current = true;

    const recipe = activeShot?.staging_recipe || sceneProject?.staging_recipe;
    if (recipe) {
      if (recipe.backgroundAssetFilename) {
        setSelectedLocationFilename(recipe.backgroundAssetFilename);
      } else if (activeShot?.assigned_slots && activeShot.assigned_slots[8]) {
        setSelectedLocationFilename(activeShot.assigned_slots[8]);
      } else {
        setSelectedLocationFilename("");
      }

      setCustomBackgroundUrl(recipe.backgroundUrl || undefined);
      setViewportRatio(recipe.aspectRatio || "16:9");
      setCameraFraming(recipe.cameraFraming || "Medium Wide Shot");
      setSelectedAtmosphere(recipe.lightingAtmosphere || "golden_hour");
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
          cutoutAssetFilename: a.cutoutAssetFilename,
          maskAssetFilename: a.maskAssetFilename,
          // Rehydrate cutout:
          // 1. If physical cutout asset filename exists -> load from /api/uploads/{filename}
          // 2. Else if cutoutDataUrl is already an asset URL or valid string -> use it
          // 3. Else fallback to reference asset url
          cutoutDataUrl: (a.cutoutAssetFilename ? getAssetMediaUrl(a.cutoutAssetFilename) : undefined)
            || (a.cutoutDataUrl && !a.cutoutDataUrl.startsWith("data:") ? a.cutoutDataUrl : undefined)
            || a.cutoutDataUrl
            || (a.referenceAssetFilename ? getAssetMediaUrl(a.referenceAssetFilename) : undefined),
          originalCutoutDataUrl: a.originalCutoutDataUrl,
          maskDataUrl: (a.maskAssetFilename ? getAssetMediaUrl(a.maskAssetFilename) : undefined) || a.maskDataUrl
        }));
        setStagedActors(loaded);
        setSelectedActorId(loaded[0]?.id || null);
      } else {
        setStagedActors([]);
        setSelectedActorId(null);
      }
    } else {
      setStagedActors([]);
      setSelectedActorId(null);
      if (activeShot?.assigned_slots && activeShot.assigned_slots[8]) {
        setSelectedLocationFilename(activeShot.assigned_slots[8]);
      } else {
        setSelectedLocationFilename("");
      }
      setCustomBackgroundUrl(undefined);
    }

    // Release hydration lock shortly after state settles
    const timer = setTimeout(() => {
      isHydratingRef.current = false;
      setStagingSaveStatus("saved");
    }, 80);

    return () => clearTimeout(timer);
  }, [activeShotId, activeShot, sceneProject?.staging_recipe]);

  // Debounced auto-commit hook: sync real-time 2D coordinates, flips, scales, postures, atmosphere, and background plate
  useEffect(() => {
    if (isHydratingRef.current) return;
    if (!activeShotId) return;

    setStagingSaveStatus("saving");

    const timer = setTimeout(() => {
      // Build serialized recipe with stripped heavy base64 data URLs
      const rawRecipe: StagingLayerRecipe = {
        backgroundAssetFilename: selectedLocationFilename || undefined,
        backgroundUrl: customBackgroundUrl && !customBackgroundUrl.startsWith("data:") ? customBackgroundUrl : undefined,
        aspectRatio: viewportRatio,
        cameraFraming: cameraFraming,
        lightingAtmosphere: selectedAtmosphere,
        targetSlotIndex: targetSlotIndex,
        updatedAt: new Date().toISOString(),
        actors: stagedActors.map(a => ({
          id: a.id,
          characterName: a.characterName,
          referenceAssetFilename: a.referenceAssetFilename,
          cutoutAssetFilename: a.cutoutAssetFilename,
          maskAssetFilename: a.maskAssetFilename,
          xPercent: Number(a.xPercent.toFixed(2)),
          yPercent: Number(a.yPercent.toFixed(2)),
          scale: Number(a.scale.toFixed(3)),
          isFlipped: Boolean(a.isFlipped),
          zIndex: a.zIndex,
          plane: a.plane,
          posture: a.posture,
          facing: a.facing,
          cutoutDataUrl: a.cutoutDataUrl && !a.cutoutDataUrl.startsWith("data:") ? a.cutoutDataUrl : undefined
        }))
      };

      const sanitized = sanitizeStagingRecipeForPersistence(rawRecipe);
      if (!sanitized) return;

      if (onUpdateShot) {
        onUpdateShot(prev => {
          const prevJson = JSON.stringify(prev.staging_recipe);
          const nextJson = JSON.stringify(sanitized);
          if (prevJson === nextJson) return prev;
          return {
            ...prev,
            staging_recipe: sanitized
          };
        });
      }

      if (onUpdateProject) {
        onUpdateProject(prev => {
          const prevJson = JSON.stringify(prev.staging_recipe);
          const nextJson = JSON.stringify(sanitized);
          if (prevJson === nextJson) return prev;
          return {
            ...prev,
            staging_recipe: sanitized
          };
        });
      }

      setStagingSaveStatus("saved");
    }, 300);

    return () => clearTimeout(timer);
  }, [
    stagedActors,
    selectedLocationFilename,
    customBackgroundUrl,
    viewportRatio,
    cameraFraming,
    selectedAtmosphere,
    targetSlotIndex,
    activeShotId,
    onUpdateShot,
    onUpdateProject
  ]);

  // Chroma-Key Pose Inspector Modal State
  const [isPoseKeyingOpen, setIsPoseKeyingOpen] = useState<boolean>(false);
  const [keyingTargetSubject, setKeyingTargetSubject] = useState<string>(activeSubject || "");

  // Filter location assets
  const locationAssets = useMemo(() => {
    return assets.filter(a => {
      const type = (a.type || "").toLowerCase();
      const desc = (a.description || "").toLowerCase();
      const filename = (a.filename || "").toLowerCase();
      return (
        type.includes("scene") ||
        type.includes("location") ||
        desc.includes("location") ||
        desc.includes("environment") ||
        filename.includes("location") ||
        filename.includes("scene") ||
        filename.includes("env")
      );
    });
  }, [assets]);

  // Selected location asset
  const activeLocationAsset = useMemo(() => {
    return assets.find(a => a.filename === selectedLocationFilename) || locationAssets[0];
  }, [assets, selectedLocationFilename, locationAssets]);

  // Derived default environment reference name
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

  const { isExportingComposite, isDownloading, handleSaveCompositeReference, handleDownloadComposite } = useCompositeExporter({
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
    onAssetSaved: onAssetUploaded,
    onUpdateShot,
    addToast
  });

  // Synchronize composite reference name if user hasn't explicitly edited it
  useEffect(() => {
    if (!hasUserEditedRefName && defaultEnvironmentName) {
      setCompositeRefName(defaultEnvironmentName);
    }
  }, [defaultEnvironmentName, hasUserEditedRefName]);

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

    let targetId: string;

    if (existingIndex >= 0) {
      targetId = stagedActors[existingIndex].id;
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
      setSelectedActorId(targetId);
    } else {
      const offset = (stagedActors.length * 20 + 30) % 70 + 15;
      targetId = `actor-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newActor: StagedActor = {
        id: targetId,
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

    // Assetize in-memory base64 into a physical asset on disk
    if (actorData.cutoutDataUrl && actorData.cutoutDataUrl.startsWith("data:")) {
      uploadCutoutAsset({
        dataUrl: actorData.cutoutDataUrl,
        characterName: actorData.characterName,
        sceneName: activeSceneName || sceneProject?.scene_name,
        onUploaded: (savedFilename, url) => {
          setStagedActors(prev => prev.map(a => {
            if (a.id === targetId) {
              return {
                ...a,
                cutoutAssetFilename: savedFilename,
                cutoutDataUrl: url
              };
            }
            return a;
          }));
        }
      });
    }
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

    // If cutoutDataUrl was updated with a new base64 buffer (e.g. from canvas brush masking), assetize it in background
    if (updates.cutoutDataUrl && updates.cutoutDataUrl.startsWith("data:")) {
      const currentActor = stagedActors.find(a => a.id === id);
      const charName = currentActor?.characterName || "actor";
      uploadCutoutAsset({
        dataUrl: updates.cutoutDataUrl,
        characterName: charName,
        sceneName: activeSceneName || sceneProject?.scene_name,
        onUploaded: (savedFilename, url) => {
          setStagedActors(prev => prev.map(a => {
            if (a.id === id) {
              return {
                ...a,
                cutoutAssetFilename: savedFilename,
                cutoutDataUrl: url
              };
            }
            return a;
          }));
        }
      });
    }

    // If maskDataUrl was updated with a new base64 buffer, assetize it as a physical mask asset
    if (updates.maskDataUrl && updates.maskDataUrl.startsWith("data:")) {
      const currentActor = stagedActors.find(a => a.id === id);
      const charName = currentActor?.characterName || "actor";
      uploadMaskAsset({
        dataUrl: updates.maskDataUrl,
        characterName: charName,
        sceneName: activeSceneName || sceneProject?.scene_name,
        onUploaded: (savedFilename) => {
          setStagedActors(prev => prev.map(a => {
            if (a.id === id) {
              return {
                ...a,
                maskAssetFilename: savedFilename,
                maskDataUrl: undefined
              };
            }
            return a;
          }));
        }
      });
    }
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

  const handleReorderActors = (reordered: StagedActorCanvasItem[]) => {
    setStagedActors(prev => {
      return reordered.map((item, idx) => {
        const found = prev.find(p => p.id === item.id);
        return found ? { ...found, ...item, zIndex: idx + 1 } : (item as StagedActor);
      });
    });
  };

  const handleApplyActors = (newActors: StagedActorCanvasItem[]) => {
    setStagedActors(prev => {
      return newActors.map(item => {
        const existing = prev.find(p => p.id === item.id);
        return {
          ...(existing || {}),
          ...item,
          horizontalPercent: Math.round(item.xPercent)
        } as StagedActor;
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

      const data: any = await assetsApi.upload(formData);
      if (data && (data.success || data.asset)) {
        const asset = data.asset || data;
        if (onAssetUploaded) onAssetUploaded(asset);
        setSelectedLocationFilename(asset.filename);
        setCustomBackgroundUrl(prev => {
          if (prev) revokeManagedBlobUrl(prev);
          return undefined;
        });
        if (addToast) addToast(`Room photo uploaded as location reference: ${asset.filename}`, "success");
        return;
      }
    } catch (err) {
      console.warn("Could not upload environment to server, reading as managed blob URL:", err);
    }

    // Fallback to local Managed Blob URL (lightweight binary pointer instead of heavy multi-megabyte base64 string)
    const localBlobUrl = createManagedBlobUrl(file, "staging-custom-bg");
    setCustomBackgroundUrl(prev => {
      if (prev) revokeManagedBlobUrl(prev);
      return localBlobUrl;
    });
    setSelectedLocationFilename("");
    if (addToast) addToast("Room photo loaded into stage background.", "info");
  };

  const handleClearBackground = () => {
    setSelectedLocationFilename("");
    setCustomBackgroundUrl(prev => {
      if (prev) revokeManagedBlobUrl(prev);
      return undefined;
    });
  };

  return {
    activeTab,
    setActiveTab,
    activeSubject,
    setActiveSubject,
    activeScene,
    activeShot,
    currentCharacterAssets,
    availableCharacters,
    locationAssets,
    activeLocationAsset,
    selectedLocationFilename,
    setSelectedLocationFilename,
    customLocationName,
    setCustomLocationName,
    selectedAtmosphere,
    setSelectedAtmosphere,
    cameraFraming,
    setCameraFraming,
    viewportRatio,
    setViewportRatio,
    showGrid,
    setShowGrid,
    showSafeAreas,
    setShowSafeAreas,
    stagedActors,
    setStagedActors,
    selectedActorId,
    setSelectedActorId,
    selectedActorIndex,
    activeMaskingActorId,
    setActiveMaskingActorId,
    customBackgroundUrl,
    setCustomBackgroundUrl,
    compositeRefName,
    setCompositeRefName,
    hasUserEditedRefName,
    setHasUserEditedRefName,
    assignToShotSlot,
    setAssignToShotSlot,
    targetSlotIndex,
    setTargetSlotIndex,
    defaultEnvironmentName,
    isExportingComposite,
    isDownloading,
    handleSaveCompositeReference,
    handleDownloadComposite,
    isPoseKeyingOpen,
    setIsPoseKeyingOpen,
    keyingTargetSubject,
    setKeyingTargetSubject,
    handleAddActorToStage,
    handleAddPosedActorToStage,
    handleUpdateActor,
    updateSelectedActor,
    handleRemoveActor,
    handleRemoveActorFromStage,
    handleReorderActors,
    handleApplyActors,
    handleUploadCustomBackground,
    handleClearBackground,
    stagingSaveStatus
  };
}
