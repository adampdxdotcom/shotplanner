import { useState, useEffect, useRef } from "react";
import { MediaAsset, SceneProjectFile, ShotItem } from "../../../types";
import { getAssetMediaUrl } from "../../../utils/assetUrl";
import { apiClient, assetsApi } from "../../../api";
import { 
  ComposerSlotType, 
  ReferenceSlotState, 
  CandidateItem 
} from "./types";

interface UseMultimodalComposerProps {
  sceneProject?: SceneProjectFile;
  activeShot: ShotItem;
  activeScene: string;
  allAssets?: MediaAsset[];
  onAssetUploaded?: (asset: MediaAsset, targetSlotIndex?: number) => void;
  addToast?: (msg: string, type?: "success" | "error" | "info") => void;
}

export function useMultimodalComposer({
  sceneProject,
  activeShot,
  activeScene,
  allAssets = [],
  onAssetUploaded,
  addToast
}: UseMultimodalComposerProps) {
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
  const [activePickerSlot, setActivePickerSlot] = useState<ComposerSlotType | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetSlot, setUploadTargetSlot] = useState<ComposerSlotType | null>(null);

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

    const shotChar = activeShot.characters?.[0] || activeShot.ots_focus_subject || activeShot.ots_anchor_subject;
    if (shotChar) {
      const charProfile = characters.find(c => c.name.toLowerCase() === shotChar.toLowerCase());
      if (charProfile?.quick_slots?.[0]) {
        matchedActorFilename = charProfile.quick_slots[0];
      }
    }

    if (!matchedActorFilename) {
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

  // Safety Pre-flight Translation
  const handleTranslateSafety = async () => {
    if (!prompt.trim()) return;
    setIsCheckingSafety(true);
    try {
      const data: any = await apiClient.post("/api/first-frame/sanitize-prompt", { prompt });
      if (data && data.sanitizedPrompt) {
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

  // Multimodal Candidate Generation
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

      const data: any = await apiClient.post("/api/first-frame/generate", payload);

      if (!data || data.error) {
        throw new Error(data?.error || "Generation failed.");
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

  // Candidate Acceptance
  const handleAcceptCandidate = async (candidate: CandidateItem) => {
    setIsAccepting(true);
    try {
      const data: any = await apiClient.post("/api/first-frame/accept", {
        base64: candidate.base64,
        sceneName: sceneProject?.scene_name || activeScene,
        shotNumber: activeShot.shot_number || 1,
        aspectRatio: candidate.aspectRatio,
        promptUsed: candidate.promptUsed
      });

      if (!data || !data.success) {
        throw new Error(data?.error || "Failed to commit candidate.");
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

  // Send to Local ComfyUI Fallback
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

      const data: any = await apiClient.post("/api/first-frame/send-to-comfy", payload);
      if (!data || data.error) {
        throw new Error(data?.error || "Failed to stage to ComfyUI.");
      }

      if (addToast) addToast(`Shot ${activeShot.shot_number} prompt & references staged to local ComfyUI!`, "success");
    } catch (err: any) {
      console.error("Failed to dispatch to ComfyUI:", err);
      if (addToast) addToast(`ComfyUI dispatch error: ${err.message}`, "error");
    } finally {
      setIsSendingToComfy(false);
    }
  };

  // Clear a specific slot
  const handleClearSlot = (slot: ComposerSlotType) => {
    if (slot === "actor") setActorSlot({});
    if (slot === "wardrobe") setWardrobeSlot({});
    if (slot === "location") setLocationSlot({});
  };

  // Select asset from picker
  const handleSelectAsset = (slotType: ComposerSlotType, slotData: ReferenceSlotState) => {
    if (slotType === "actor") setActorSlot(slotData);
    if (slotType === "wardrobe") setWardrobeSlot(slotData);
    if (slotType === "location") setLocationSlot(slotData);
    setActivePickerSlot(null);
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
      const data: any = await assetsApi.upload(formData);
      if (data && (data.success || data.asset)) {
        const asset = data.asset || data;
        if (onAssetUploaded) onAssetUploaded(asset);
        const slotData = {
          filename: asset.filename,
          previewUrl: getAssetMediaUrl(asset.filename),
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

  const handleTriggerUpload = (slot: ComposerSlotType) => {
    setUploadTargetSlot(slot);
    fileInputRef.current?.click();
  };

  return {
    actorSlot,
    wardrobeSlot,
    locationSlot,
    prompt,
    setPrompt,
    aspectRatio,
    setAspectRatio,
    candidateCount,
    setCandidateCount,
    isCheckingSafety,
    sanitizedPrompt,
    safetyReplacements,
    useSanitized,
    setUseSanitized,
    isGenerating,
    candidates,
    selectedCandidate,
    activeModalCandidate,
    setActiveModalCandidate,
    isAccepting,
    generationError,
    wasBlockedByFilter,
    isSendingToComfy,
    activePickerSlot,
    setActivePickerSlot,
    fileInputRef,
    handleTranslateSafety,
    handleGenerate,
    handleAcceptCandidate,
    handleSendToLocalComfy,
    handleClearSlot,
    handleSelectAsset,
    handleSlotFileUpload,
    handleTriggerUpload
  };
}
