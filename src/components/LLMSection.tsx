import React, { useState, useMemo, useRef, useEffect } from "react";
import { 
  MediaAsset, 
  LLMProvider, 
  ScenePlanning, 
  hasSceneReferencePhoto, 
  SCENE_REFERENCE_DIRECTIVE, 
  assembleFinalPrompt, 
  generatePromptPrefix,
  computePrePromptContext,
  PromptDebugInfo,
  PromptVariation,
  AppConfig
} from "../types";
import { formatShotNumber } from "./ScenePlanningHeader";
import { TakeSelector } from "./TakeSelector";
import { TakeReviewModal } from "./TakeReviewModal";
import { PromptDebugModal } from "./PromptDebugModal";
import { VariationSelector } from "./workflow/VariationSelector";
import { copyToClipboard } from "../utils/clipboard";
import { getAssetMediaUrl } from "../utils/assetUrl";
import { 
  Sparkles, 
  Bot, 
  Send, 
  Check, 
  Copy, 
  AlertCircle, 
  Info, 
  FileText,
  Sliders,
  Film,
  Camera,
  Layers,
  MapPin,
  RotateCcw,
  Eye,
  Loader2,
  Square,
  XSquare,
  History,
  Clock,
  Image as ImageIcon,
  Video as VideoIcon,
  Music as MusicIcon,
  AlertTriangle,
  Plus
} from "lucide-react";

interface LLMSectionProps {
  basicStub: string;
  onChangeBasicStub: (val: string) => void;
  expandedPrompt: string;
  onChangeExpandedPrompt: (val: string) => void;
  providerChoice?: LLMProvider;
  onChangeProviderChoice?: (val: LLMProvider) => void;
  defaultProvider?: LLMProvider;
  promptPrefix?: string;
  planning?: ScenePlanning;
  assets: MediaAsset[];
  lmStudioUrl: string;
  geminiApiKey?: string;
  onShowToast?: (text: string, type: "success" | "error" | "info") => void;
  activeShotId: string | null;
  onSelectShot: (id: string | null) => void;
  sceneProject: import("../types").SceneProjectFile;
  onUpdateShot: (updater: (prev: import("../types").ShotItem) => import("../types").ShotItem) => void;
  onUpdateSpecificShot?: (id: string, updater: (prev: import("../types").ShotItem) => import("../types").ShotItem) => void;
  config?: AppConfig;
}

export const LLMSection: React.FC<LLMSectionProps> = ({
  basicStub,
  onChangeBasicStub,
  expandedPrompt,
  onChangeExpandedPrompt,
  providerChoice: controlledProvider,
  onChangeProviderChoice,
  defaultProvider: propDefaultProvider,
  promptPrefix = "",
  planning,
  assets,
  lmStudioUrl,
  geminiApiKey,
  onShowToast,
  activeShotId,
  onSelectShot,
  sceneProject,
  onUpdateShot,
  onUpdateSpecificShot,
  config
}) => {
  const [internalProvider, setInternalProvider] = useState<LLMProvider>("lm_studio");
  
  // Resolve effective default provider (only default LLM should be active & shown)
  const effectiveDefaultProvider: LLMProvider = 
    propDefaultProvider || 
    config?.default_llm_provider || 
    (typeof window !== "undefined" && (localStorage.getItem("default_llm_provider") as LLMProvider)) || 
    controlledProvider || 
    internalProvider || 
    "lm_studio";

  const providerChoice = effectiveDefaultProvider;

  const setProviderChoice = (p: LLMProvider) => {
    setInternalProvider(p);
    onChangeProviderChoice?.(p);
  };

  const [generating, setGenerating] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Live elapsed counter tracking generation duration up to 60s timeout
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (generating) {
      setElapsedSeconds(0);
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [generating]);
  const [reviewTakeId, setReviewTakeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [presentedFallbackNotice, setPresentedFallbackNotice] = useState<string | null>(null);
  const lastGeneratedPromptRef = useRef<string>(expandedPrompt || "");
  const [providerUsed, setProviderUsed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [lastDebugInfo, setLastDebugInfo] = useState<PromptDebugInfo | null>(null);
  const [showDebugModal, setShowDebugModal] = useState(false);

  const isSceneRefPresent = hasSceneReferencePhoto(assets);

  const activeShot = activeShotId ? sceneProject.shots.find(s => s.id === activeShotId) : null;
  const activeShotAssets = activeShot ? Object.values(activeShot.assigned_slots).filter(Boolean) : [];
  
  // Isolate active shot data as source of truth for prompt and stub
  const currentBasicStub = activeShot ? (activeShot.basic_stub ?? "") : basicStub;
  const currentExpandedPrompt = activeShot ? (activeShot.expanded_prompt ?? "") : expandedPrompt;
  
  const relevantAssets = useMemo(() => {
    if (!activeShot) return assets;
    const slotEntries = Object.entries(activeShot.assigned_slots || {});
    if (slotEntries.length > 0) {
      const mapped: Array<MediaAsset & { slot_index?: number }> = [];
      slotEntries.forEach(([slotKey, filename]) => {
        if (!filename) return;
        const asset = assets.find(a => a.filename === filename);
        if (asset) {
          const match = slotKey.match(/slot_(\d+)/);
          const slotIdx = match ? parseInt(match[1], 10) : asset.slot_index;
          mapped.push({ ...asset, slot_index: slotIdx });
        }
      });
      (sceneProject.shared_assets || []).forEach(sa => {
        if (!mapped.some(m => m.filename === sa.filename)) {
          const asset = assets.find(a => a.filename === sa.filename);
          if (asset) mapped.push({ ...asset, slot_index: sa.slot_index });
        }
      });
      if (mapped.length > 0) return mapped;
    }
    return assets.filter(a => activeShotAssets.includes(a.filename) || sceneProject.shared_assets?.some(sa => sa.filename === a.filename));
  }, [activeShot, assets, activeShotAssets, sceneProject.shared_assets]);

  // Unique associated assets with their slot index for 3-wide thumbnail preview
  const displayAssociatedAssets = useMemo(() => {
    // Only display assets actually relevant to the active shot (or all assets if no shot is selected)
    const list = activeShot ? relevantAssets : assets;
    const seen = new Set<string>();
    const result: Array<MediaAsset & { slot_index?: number }> = [];
    list.forEach((item, idx) => {
      const slotNum = item.slot_index !== undefined ? item.slot_index : idx;
      const key = `${slotNum}_${item.filename}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ ...item, slot_index: slotNum });
      }
    });
    return result.sort((a, b) => (a.slot_index ?? 0) - (b.slot_index ?? 0));
  }, [activeShot, relevantAssets, assets]);

  // Analyze whether the active shot or its characters are missing reference photos
  const missingPhotoInfo = useMemo(() => {
    if (!activeShot) return null;
    const assignedCount = relevantAssets.length;
    const shotCharacters = activeShot.characters || [];
    const allSceneChars = sceneProject.characters || {};

    const charStatus = shotCharacters.map(charName => {
      const profile = (allSceneChars as any)[charName] || 
        Object.entries(allSceneChars).find(([k]) => k.toLowerCase() === charName.toLowerCase())?.[1];
      const quickSlots = Array.isArray(profile?.quick_slots) ? profile.quick_slots.filter(Boolean) : [];
      const charAssets = assets.filter(a => (a.subject_name || "").trim().toLowerCase() === charName.trim().toLowerCase());
      const hasPhotos = quickSlots.length > 0 || charAssets.length > 0;
      return {
        name: charName,
        hasPhotos,
        quickSlots,
        charAssets
      };
    });

    const charactersWithoutPhotos = charStatus.filter(c => !c.hasPhotos);
    const charactersWithPhotosUnassigned = charStatus.filter(c => c.hasPhotos && assignedCount === 0);

    return {
      assignedCount,
      shotCharacters,
      charStatus,
      charactersWithoutPhotos,
      charactersWithPhotosUnassigned,
      isMissingAllReferences: assignedCount === 0
    };
  }, [activeShot, relevantAssets, sceneProject.characters, assets]);

  // Auto-assign available reference photos for a character directly from prompt expansion view
  const handleAutoAssignCharacterPhotos = (charName: string) => {
    if (!activeShot || !onUpdateSpecificShot) return;
    const allSceneChars = sceneProject.characters || {};
    const profile = (allSceneChars as any)[charName] || 
      Object.entries(allSceneChars).find(([k]) => k.toLowerCase() === charName.toLowerCase())?.[1];
    
    let candidateFilenames: string[] = [];
    if (profile && Array.isArray(profile.quick_slots)) {
      candidateFilenames = profile.quick_slots.filter(Boolean);
    }
    if (candidateFilenames.length === 0) {
      candidateFilenames = assets
        .filter(a => (a.subject_name || "").trim().toLowerCase() === charName.trim().toLowerCase())
        .map(a => a.filename);
    }

    if (candidateFilenames.length === 0) {
      onShowToast?.(`No reference photos found for character "${charName}".`, "error");
      return;
    }

    onUpdateSpecificShot(activeShot.id, prev => {
      const nextSlots = { ...(prev.assigned_slots || {}) };
      let assigned = 0;
      for (const fn of candidateFilenames) {
        if (Object.values(nextSlots).includes(fn)) continue;
        let targetSlot = -1;
        for (let i = 0; i < 8; i++) {
          if (!nextSlots[i] && !nextSlots[`slot_${i}`]) {
            targetSlot = i;
            break;
          }
        }
        if (targetSlot !== -1) {
          nextSlots[targetSlot] = fn;
          assigned++;
        }
      }
      return {
        ...prev,
        assigned_slots: nextSlots,
        status: "unstaged"
      };
    });

    onShowToast?.(`Assigned reference photo(s) for ${charName} to Shot #${activeShot.shot_number}.`, "success");
  };

  const activeShotPrefix = activeShot 
    ? generatePromptPrefix({
        scene_name: sceneProject.scene_name || activeShot.shot_name,
        shot_number: activeShot.shot_number,
        shot_type: activeShot.shot_type,
        lens_focal_length: activeShot.lens_focal_length,
        camera_movement: activeShot.camera_movement,
        aspect_ratio: activeShot.aspect_ratio
      })
    : promptPrefix;

  const livePrePromptContext = useMemo(() => {
    return computePrePromptContext({
      sceneName: sceneProject.scene_name || activeShot?.shot_name || planning?.scene_name,
      shotNumber: activeShot?.shot_number ?? planning?.shot_number ?? 1,
      shotType: activeShot?.shot_type || planning?.shot_type,
      lensFocalLength: activeShot?.lens_focal_length || planning?.lens_focal_length,
      cameraMovement: activeShot?.camera_movement || planning?.camera_movement,
      aspectRatio: activeShot?.aspect_ratio || planning?.aspect_ratio,
      otsAnchorSubject: activeShot?.ots_anchor_subject || planning?.ots_anchor_subject,
      otsFocusSubject: activeShot?.ots_focus_subject || planning?.ots_focus_subject,
      otsSide: activeShot?.ots_side || planning?.ots_side,
      basicStub: currentBasicStub,
      assets: relevantAssets
    });
  }, [
    sceneProject.scene_name,
    activeShot?.shot_name,
    activeShot?.shot_number,
    activeShot?.shot_type,
    activeShot?.lens_focal_length,
    activeShot?.camera_movement,
    activeShot?.aspect_ratio,
    activeShot?.ots_anchor_subject,
    activeShot?.ots_focus_subject,
    activeShot?.ots_side,
    planning,
    currentBasicStub,
    relevantAssets
  ]);

  const isLivePreview = !currentExpandedPrompt || !currentExpandedPrompt.trim();
  const displayedPrompt = isLivePreview ? livePrePromptContext : currentExpandedPrompt;

  const handleCancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setGenerating(false);
    onShowToast?.("LLM prompt expansion cancelled.", "info");
  };

  const handleStubChange = (val: string) => {
    onChangeBasicStub(val);
    if (activeShotId && onUpdateSpecificShot) {
      onUpdateSpecificShot(activeShotId, prev => ({ ...prev, basic_stub: val, status: "unstaged" }));
    }
  };

  const handlePromptChange = (val: string) => {
    onChangeExpandedPrompt(val);
    if (activeShotId && onUpdateSpecificShot) {
      onUpdateSpecificShot(activeShotId, prev => ({ ...prev, expanded_prompt: val, status: "unstaged" }));
    }
  };

  const handleGeneratePrompt = async () => {
    // If already generating, act as Cancel button (double duty)
    if (generating) {
      handleCancelGeneration();
      return;
    }

    if (!activeShotId) {
      setError("Please select a shot to rework or generate its prompt.");
      onShowToast?.("Please select a shot first.", "error");
      return;
    }

    const currentShotId = activeShotId;
    const targetShot = sceneProject.shots.find(s => s.id === currentShotId) || activeShot;
    const stubToUse = (targetShot?.basic_stub ?? currentBasicStub).trim();

    if (!stubToUse) {
      setError("Please provide a basic prompt stub first.");
      return;
    }

    if (relevantAssets.length === 0) {
      const msg = "At least one reference photo is required to expand the prompt for this shot. Please assign reference photos in the Cast or Asset Manager tabs.";
      setError(msg);
      onShowToast?.(msg, "error");
      return;
    }

    // Snapshot prior prompt strictly for THIS shot in case of failure fallback
    const priorPrompt = targetShot?.expanded_prompt?.trim() || "";

    // Create and attach new AbortController
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setGenerating(true);
    setError(null);
    setPresentedFallbackNotice(null);
    setProviderUsed(null);

    try {
      const res = await fetch("/api/generate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          basic_stub: stubToUse,
          assets: relevantAssets,
          lm_studio_url: lmStudioUrl,
          provider: providerChoice,
          prompt_prefix: activeShotPrefix,
          scene_planning: planning,
          planning: planning,
          active_shot: targetShot || undefined,
          shot_type: targetShot ? targetShot.shot_type : planning?.shot_type,
          camera_movement: targetShot ? targetShot.camera_movement : planning?.camera_movement,
          lens_focal_length: targetShot ? targetShot.lens_focal_length : planning?.lens_focal_length,
          aspect_ratio: targetShot ? targetShot.aspect_ratio : planning?.aspect_ratio,
          ots_anchor_subject: targetShot?.ots_anchor_subject || planning?.ots_anchor_subject,
          ots_focus_subject: targetShot?.ots_focus_subject || planning?.ots_focus_subject,
          ots_side: targetShot?.ots_side || planning?.ots_side,
          shot_number: targetShot ? targetShot.shot_number : planning?.shot_number,
          scene_name: sceneProject?.scene_name || planning?.scene_name,
          characters: sceneProject?.characters,
          gemini_api_key: geminiApiKey,
          custom_system_prompt: config?.llm_custom_system_prompt,
          temperature: config?.llm_temperature,
          max_tokens: config?.llm_max_tokens
        })
      });

      const data = await res.json();
      if (res.ok && data.expanded_prompt) {
        setPresentedFallbackNotice(null);
        
        let createdVariationNumber = 1;
        const updatedShotUpdater = (prev: import("../types").ShotItem): import("../types").ShotItem => {
          const currentVariations = prev.prompt_variations || [];
          const nextVarNum = currentVariations.length + 1;
          createdVariationNumber = nextVarNum;

          // Build new PromptVariation record strictly scoped to this shot's history
          const newVariation: PromptVariation = {
            id: "var_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
            variation_number: nextVarNum,
            created_at: new Date().toISOString(),
            basic_stub: stubToUse,
            expanded_prompt: data.expanded_prompt,
            provider: data.provider || providerChoice,
            label: `Variation ${nextVarNum}`
          };

          return {
            ...prev,
            expanded_prompt: data.expanded_prompt,
            prompt_variations: [...currentVariations, newVariation],
            active_variation_id: newVariation.id,
            status: "unstaged",
            updated_at: new Date().toISOString()
          };
        };

        // CRITICAL: Update strictly and ONLY the selected target shot
        if (onUpdateSpecificShot) {
          onUpdateSpecificShot(currentShotId, updatedShotUpdater);
        } else {
          onUpdateShot(updatedShotUpdater);
        }
        
        // Only update current prompt state if user is still on this same shot
        if (activeShotId === currentShotId) {
          onChangeExpandedPrompt(data.expanded_prompt);
        }
        
        if (data.provider) setProviderUsed(data.provider);
        if (data.debug) setLastDebugInfo(data.debug);
        onShowToast?.(`Shot ${targetShot?.shot_number || 1}: Prompt Variation ${createdVariationNumber} generated successfully!`, "success");
      } else {
        const errorMsg = data.error || `Failed to generate prompt with ${providerChoice === "gemini" ? "Google Gemini" : "LM Studio"}`;
        setError(errorMsg);
        onShowToast?.(`LLM generation failed: ${errorMsg}`, "error");

        // Present the last generated prompt strictly for this shot
        if (priorPrompt) {
          if (onUpdateSpecificShot) {
            onUpdateSpecificShot(currentShotId, prev => ({ ...prev, expanded_prompt: priorPrompt }));
          }
          if (activeShotId === currentShotId) {
            onChangeExpandedPrompt(priorPrompt);
          }
          setPresentedFallbackNotice(`Default LLM service failed (${providerChoice === "gemini" ? "Google Gemini" : "LM Studio"}). Presenting last prompt for this shot.`);
          onShowToast?.("Presenting last prompt for this shot.", "info");
        } else {
          setPresentedFallbackNotice(`Default LLM service failed (${providerChoice === "gemini" ? "Google Gemini" : "LM Studio"}). No previous prompt available for this shot.`);
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        // User aborted the request - do not show error
        return;
      }
      const errorMsg = err.message || `Failed to connect to ${providerChoice === "gemini" ? "Google Gemini" : "LM Studio"}`;
      setError(errorMsg);
      onShowToast?.(`LLM generation failed: ${errorMsg}`, "error");

      // Present the last generated prompt strictly for this shot
      if (priorPrompt) {
        if (onUpdateSpecificShot) {
          onUpdateSpecificShot(currentShotId, prev => ({ ...prev, expanded_prompt: priorPrompt }));
        }
        if (activeShotId === currentShotId) {
          onChangeExpandedPrompt(priorPrompt);
        }
        setPresentedFallbackNotice(`Default LLM service failed (${providerChoice === "gemini" ? "Google Gemini" : "LM Studio"}). Presenting last prompt for this shot.`);
        onShowToast?.("Presenting last prompt for this shot.", "info");
      } else {
        setPresentedFallbackNotice(`Default LLM service failed (${providerChoice === "gemini" ? "Google Gemini" : "LM Studio"}). No previous prompt available for this shot.`);
      }
    } finally {
      abortControllerRef.current = null;
      setGenerating(false);
    }
  };

  const handleResetToLivePreview = () => {
    onChangeExpandedPrompt("");
    if (activeShotId && onUpdateSpecificShot) {
      onUpdateSpecificShot(activeShotId, prev => ({ ...prev, expanded_prompt: "", status: "unstaged" }));
    }
    onShowToast?.("Prompt cleared — live context preview re-engaged.", "info");
  };

  const handleCopy = async () => {
    const textToCopy = displayedPrompt;
    if (!textToCopy || !textToCopy.trim()) {
      onShowToast?.("No prompt text to copy.", "info");
      return;
    }

    const success = await copyToClipboard(textToCopy);

    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      onShowToast?.(
        isLivePreview 
          ? "Pre-generation context preview copied to clipboard!" 
          : "Final prompt copied to clipboard!", 
        "success"
      );
    } else {
      onShowToast?.("Failed to copy prompt to clipboard.", "error");
    }
  };

  return (
    <div id="llm-section" className="space-y-5 flex flex-col min-h-0">
      {/* Prompt Screen Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900/60 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Shot Context:</label>
          <select 
            value={activeShotId || ""}
            onChange={(e) => onSelectShot(e.target.value || null)}
            className="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:border-indigo-500 focus:outline-none min-w-[250px] shadow-xs"
          >
            <option key="empty" value="">-- Select a Shot to Edit Prompt --</option>
            {sceneProject.shots.map(s => (
              <option key={s.id} value={s.id}>
                Shot {s.shot_number.toString().padStart(2, '0')} - {s.shot_type}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {activeShot && activeShot.prompt_variations && activeShot.prompt_variations.length > 0 && (
        <div className="bg-white dark:bg-zinc-900/80 border border-amber-300 dark:border-amber-500/30 rounded-xl p-3 shadow-xs -mt-2">
          <VariationSelector
            variations={activeShot.prompt_variations}
            activeVariationId={activeShot.active_variation_id}
            shotNumber={activeShot.shot_number}
            onSelectVariation={(variation) => {
              if (onUpdateSpecificShot && activeShotId) {
                onUpdateSpecificShot(activeShotId, prev => ({
                  ...prev,
                  expanded_prompt: variation.expanded_prompt,
                  basic_stub: variation.basic_stub || prev.basic_stub,
                  active_variation_id: variation.id,
                  status: "unstaged"
                }));
              } else {
                onUpdateShot(prev => ({
                  ...prev,
                  expanded_prompt: variation.expanded_prompt,
                  basic_stub: variation.basic_stub || prev.basic_stub,
                  active_variation_id: variation.id,
                  status: "unstaged"
                }));
              }
              onChangeExpandedPrompt(variation.expanded_prompt);
              if (variation.basic_stub) {
                onChangeBasicStub(variation.basic_stub);
              }
              onShowToast?.(`Loaded ${variation.label || `Variation ${variation.variation_number}`} into prompt editor.`, "info");
            }}
            onDeleteVariation={(varId) => {
              if (onUpdateSpecificShot && activeShotId) {
                onUpdateSpecificShot(activeShotId, prev => {
                  const filtered = (prev.prompt_variations || []).filter(v => v.id !== varId);
                  return {
                    ...prev,
                    prompt_variations: filtered,
                    active_variation_id: prev.active_variation_id === varId ? (filtered[filtered.length - 1]?.id || undefined) : prev.active_variation_id
                  };
                });
              } else {
                onUpdateShot(prev => {
                  const filtered = (prev.prompt_variations || []).filter(v => v.id !== varId);
                  return {
                    ...prev,
                    prompt_variations: filtered,
                    active_variation_id: prev.active_variation_id === varId ? (filtered[filtered.length - 1]?.id || undefined) : prev.active_variation_id
                  };
                });
              }
            }}
          />
        </div>
      )}

      {activeShot && activeShot.takes && activeShot.takes.length > 0 && (
        <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-xs -mt-2">
          <TakeSelector 
            shot={activeShot} 
            onSetHeroTake={(tid) => onUpdateShot(prev => {
              const updatedTakes = (prev.takes || []).map(t => ({
                ...t,
                is_hero: t.id === tid
              }));
              return { ...prev, hero_take_id: tid, takes: updatedTakes };
            })}
            onReviewTake={setReviewTakeId}
          />
        </div>
      )}

      {!activeShotId ? (
        <div className="flex flex-col items-center justify-center p-12 bg-zinc-50/60 dark:bg-zinc-900/40 border-2 border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl">
          <Bot className="w-12 h-12 text-zinc-400 dark:text-zinc-600 mb-4" />
          <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-300 mb-2">No Shot Selected</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-500 text-center max-w-md">
            Select a shot from the dropdown above to write the concept stub, expand with LLM, and inspect the injected prompt.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-700 rounded-xl p-5 shadow-xs space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">LLM Prompt Expansion ("Generate from Stub")</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Passes basic concept + all uploaded asset metadata into {effectiveDefaultProvider === "gemini" ? "Google Gemini" : "local LM Studio"} to generate ComfyUI-tagged prompts (<code className="text-zinc-700 dark:text-zinc-300 font-mono">&lt;Picture 1&gt;</code>, <code className="text-zinc-700 dark:text-zinc-300 font-mono">&lt;Video 1&gt;</code>).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {providerUsed && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300">
                  Provider: {providerUsed}
                </span>
              )}
              <span className="text-[11px] text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700">
                {activeShotAssets.length} reference asset(s) in context
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-xs text-red-800 dark:text-red-200 space-y-1.5 shadow-xs">
              <div className="flex items-center gap-2 font-medium text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                <span>LLM Generation Failed ({effectiveDefaultProvider === "gemini" ? "Google Gemini" : "LM Studio"})</span>
              </div>
              <p className="text-[11px] text-red-700 dark:text-red-300/90 pl-6 leading-relaxed">
                {error}
              </p>
              {presentedFallbackNotice && (
                <div className="mt-1 pt-1.5 border-t border-red-200 dark:border-red-900/60 pl-6 flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                  <History className="w-3.5 h-3.5 shrink-0" />
                  <span>{presentedFallbackNotice}</span>
                </div>
              )}
            </div>
          )}

          {/* 2-Column Split: Input Stub & Output Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Basic Stub Input */}
        <div className="bg-zinc-50/70 dark:bg-zinc-950/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700/80 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                Basic Prompt / Stub
              </label>
              
              {/* Only the Default Selected LLM is Shown */}
              <div
                id="default-llm-indicator"
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1.5 shadow-xs ${
                  effectiveDefaultProvider === "gemini"
                    ? "bg-purple-600 text-white border border-purple-400/30"
                    : "bg-amber-600 text-white border border-amber-400/30"
                }`}
                title={`Default Selected LLM: ${effectiveDefaultProvider === "gemini" ? "Gemini 3.7 Flash" : "LM Studio"} (managed in Settings)`}
              >
                {effectiveDefaultProvider === "gemini" ? (
                  <>
                    <Sparkles className="w-3 h-3" />
                    <span>Gemini 3.7 Flash</span>
                  </>
                ) : (
                  <>
                    <Bot className="w-3 h-3" />
                    <span>LM Studio</span>
                  </>
                )}
              </div>
            </div>

            <textarea
              rows={5}
              placeholder="e.g. Jackie walking through a neon-lit cyberpunk alleyway in the rain, turning towards the camera with a confident smile..."
              value={currentBasicStub}
              onChange={(e) => handleStubChange(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 focus:border-amber-500 rounded-lg p-3 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none resize-none leading-relaxed shadow-xs"
            />

            {/* 3-Wide Associated Assets & Slot Numbers Thumbnail Preview */}
            <div className="bg-white dark:bg-zinc-900/70 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700/60 text-[11px] space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-zinc-900 dark:text-zinc-200 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Associated Reference Assets ({displayAssociatedAssets.length})
                </span>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                  3-wide preview
                </span>
              </div>

              {displayAssociatedAssets.length === 0 ? (
                <p className="text-zinc-500 italic py-2 text-center bg-zinc-50 dark:bg-zinc-950/40 rounded border border-zinc-200 dark:border-zinc-800/60 text-xs">
                  No assets associated with this shot. Upload or assign assets to inject reference tags.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2.5 max-h-64 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700">
                  {displayAssociatedAssets.map((asset, i) => {
                    const slotNum = asset.slot_index !== undefined ? asset.slot_index + 1 : i + 1;
                    const tagLabel = asset.media_type === "video" ? `<Video ${slotNum}>` : asset.media_type === "audio" ? `<Audio ${slotNum}>` : `<Picture ${slotNum}>`;
                    const isVideo = asset.media_type === "video" || /\.(mp4|mov|webm|mkv)$/i.test(asset.filename);
                    const isAudio = asset.media_type === "audio" || /\.(mp3|wav|ogg|m4a|flac)$/i.test(asset.filename);

                    return (
                      <div 
                        key={`${slotNum}_${asset.filename}`}
                        className="bg-zinc-50/90 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-700/80 hover:border-amber-400 dark:hover:border-amber-500/50 rounded-lg p-2 flex flex-col gap-1.5 transition-all shadow-xs group"
                      >
                        {/* Slot Badge & Tag Header */}
                        <div className="flex items-center justify-between gap-1">
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30 font-mono font-bold text-[10px] rounded border truncate">
                            {tagLabel}
                          </span>
                          <span className="text-[9px] font-mono text-zinc-500 dark:text-zinc-400 font-medium shrink-0">
                            Slot {slotNum}
                          </span>
                        </div>

                        {/* Thumbnail View */}
                        <div className="relative w-full aspect-[4/3] bg-zinc-100 dark:bg-zinc-900 rounded overflow-hidden border border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
                          {isAudio ? (
                            <div className="flex flex-col items-center justify-center gap-1 text-zinc-500 dark:text-zinc-400 p-2">
                              <MusicIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                              <span className="text-[9px] font-mono">Audio Track</span>
                            </div>
                          ) : isVideo ? (
                            <>
                              <video
                                src={getAssetMediaUrl(asset)}
                                className="w-full h-full object-cover"
                                preload="metadata"
                                muted
                              />
                              <div className="absolute top-1 left-1 p-0.5 bg-black/70 rounded text-amber-400">
                                <VideoIcon className="w-3 h-3" />
                              </div>
                            </>
                          ) : (
                            <img
                              src={getAssetMediaUrl(asset, true)}
                              alt={asset.subject_name || asset.filename}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          )}
                        </div>

                        {/* Caption / Subject Info */}
                        <div className="space-y-0.5 min-w-0">
                          <p className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-200 truncate" title={asset.subject_name || asset.filename}>
                            {asset.subject_name || asset.filename}
                          </p>
                          <p className="text-[9px] text-zinc-500 dark:text-zinc-400 truncate capitalize">
                            {asset.asset_type || asset.media_type || "Image"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Missing Reference Photo Alert / Helper */}
          {missingPhotoInfo?.isMissingAllReferences && (
            <div className="mt-3 p-3 rounded-lg border border-amber-300 dark:border-amber-500/40 bg-amber-50/90 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1 min-w-0">
                  <p className="font-semibold text-[11.5px]">Reference Photos Required</p>
                  {missingPhotoInfo.charactersWithoutPhotos.length > 0 ? (
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                      Character <strong>{missingPhotoInfo.charactersWithoutPhotos.map(c => c.name).join(", ")}</strong> has no reference photos configured in slots 1–4 on their character card. Please assign reference photos in the Cast or Asset Manager tabs before expanding the prompt.
                    </p>
                  ) : missingPhotoInfo.charactersWithPhotosUnassigned.length > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                        Reference photos exist on the character card for <strong>{missingPhotoInfo.charactersWithPhotosUnassigned.map(c => c.name).join(", ")}</strong>, but are not linked to this shot yet.
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {missingPhotoInfo.charactersWithPhotosUnassigned.map(c => (
                          <button
                            key={c.name}
                            type="button"
                            onClick={() => handleAutoAssignCharacterPhotos(c.name)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[10.5px] transition-colors cursor-pointer shadow-xs"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Link {c.name}'s Photos to Shot</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                      No reference assets are assigned to this shot. Prompt expansion builds prompt conditioning with reference photo tags (<span className="font-mono">&lt;Picture 1&gt;</span>). Please assign at least one reference photo.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleGeneratePrompt}
            disabled={!generating && (!currentBasicStub.trim() || relevantAssets.length === 0)}
            title={
              generating 
                ? "Click to cancel prompt expansion" 
                : relevantAssets.length === 0 
                ? "At least one reference photo is required to expand the prompt for this shot." 
                : !currentBasicStub.trim()
                ? "Please enter a basic prompt stub first."
                : ""
            }
            className={`w-full mt-3 py-2.5 px-4 font-semibold rounded-lg text-xs transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer ${
              generating
                ? "bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 dark:bg-red-500/15 dark:hover:bg-red-500/25 dark:text-red-300 dark:border-red-500/40 active:scale-[0.99]"
                : relevantAssets.length === 0 
                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed border border-zinc-200 dark:border-zinc-700" 
                : providerChoice === "gemini"
                ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white disabled:opacity-50"
                : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 disabled:opacity-50 font-bold"
            }`}
          >
            {generating ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current text-red-600 dark:text-red-400" />
                <span>Cancel Prompt Expansion ({elapsedSeconds}s / 60s)</span>
              </>
            ) : (
              <>
                {providerChoice === "gemini" ? (
                  <Sparkles className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
                <span>
                  {relevantAssets.length === 0
                    ? "Add Reference Photos to Generate Prompt"
                    : expandedPrompt && expandedPrompt.trim()
                    ? `Regenerate Prompt with ${providerChoice === "gemini" ? "Gemini 3.7 Flash" : "LM Studio"}`
                    : `Generate Prompt with ${providerChoice === "gemini" ? "Gemini 3.7 Flash" : "LM Studio"}`}
                </span>
              </>
            )}
          </button>
        </div>

        {/* Right: Preview & Editable Prompt */}
        <div className="bg-zinc-50/70 dark:bg-zinc-950/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700/80 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Preview / Edit Expanded Prompt
                </label>
                {presentedFallbackNotice ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40 flex items-center gap-1">
                    <History className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    Last Generated Prompt
                  </span>
                ) : isLivePreview ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse" />
                    Live Pre-Prompt Context
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30 flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    Compiled / Custom Prompt
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {lastDebugInfo && (
                  <button
                    type="button"
                    onClick={() => setShowDebugModal(true)}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 dark:border-amber-600/40 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 dark:text-amber-300 dark:hover:text-amber-100 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Inspect exact system directives, user payload, and raw model response"
                  >
                    <Eye className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    <span>Inspect LLM Exchange ({lastDebugInfo.latency_ms}ms)</span>
                  </button>
                )}

                {!isLivePreview && (
                  <button
                    type="button"
                    onClick={handleResetToLivePreview}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-300 dark:hover:text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Clear custom prompt and return to real-time synthesized live context preview"
                  >
                    <RotateCcw className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />
                    <span>Reset to Live Preview</span>
                  </button>
                )}

                {copied && (
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/90 border border-emerald-300 dark:border-emerald-800/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Copied!
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!displayedPrompt || !displayedPrompt.trim()}
                  className={`copy-prompt-btn px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 shadow-xs ${
                    copied
                      ? "is-copied bg-emerald-600 border-emerald-500 text-white shadow-emerald-900/30 cursor-default"
                      : displayedPrompt && displayedPrompt.trim()
                      ? "bg-white hover:bg-zinc-50 text-amber-800 border-zinc-300 hover:border-amber-400 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-amber-300 dark:hover:text-amber-200 dark:border-zinc-700 dark:hover:border-amber-500/50 cursor-pointer"
                      : "bg-zinc-100 text-zinc-400 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-600 dark:border-zinc-800 cursor-not-allowed"
                  }`}
                  title={isLivePreview ? "Copy synthesized live context preview" : "Copy compiled/edited prompt"}
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "Copied to Clipboard" : isLivePreview ? "Copy Preview Context" : "Copy Prompt"}</span>
                </button>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-lg">
              <textarea
                rows={18}
                placeholder="The dynamic pre-prompt context or expanded prompt will appear here ready for editing before execution..."
                value={displayedPrompt}
                onChange={(e) => handlePromptChange(e.target.value)}
                disabled={generating}
                className={`w-full bg-white dark:bg-zinc-900 border rounded-lg p-3 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none resize-none leading-relaxed font-mono transition-opacity duration-300 shadow-xs ${
                  generating ? "opacity-40 cursor-not-allowed select-none" : ""
                } ${
                  isLivePreview 
                    ? "border-amber-400 dark:border-amber-500/40 focus:border-amber-500" 
                    : "border-zinc-300 dark:border-zinc-700 focus:border-amber-500"
                }`}
              />

              {/* Smooth Fade Loading Overlay with Spinner & Abort/Cancel */}
              <div 
                className={`prompt-generating-overlay absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center transition-all duration-300 pointer-events-none rounded-lg ${
                  generating 
                    ? "opacity-100 backdrop-blur-xs bg-white/80 dark:bg-zinc-950/70 pointer-events-auto" 
                    : "opacity-0 pointer-events-none"
                }`}
              >
                {/* Glowing Spinner Centerpiece & Live Counter */}
                <div className="relative mb-3 flex flex-col items-center justify-center">
                  <div className="relative flex items-center justify-center">
                    <div className="absolute inset-0 w-12 h-12 rounded-full bg-amber-500/20 blur-md animate-pulse" />
                    <Loader2 className="w-9 h-9 text-amber-500 dark:text-amber-400 animate-spin relative z-10" />
                  </div>
                  {/* Real-time Elapsed Seconds Counter */}
                  <div className="mt-3 px-3 py-1 rounded-full bg-white dark:bg-zinc-900/95 border border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-300 font-mono text-xs font-bold flex items-center gap-1.5 shadow-md">
                    <Clock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 animate-pulse" />
                    <span>{elapsedSeconds}s / 60s</span>
                  </div>
                </div>

                {/* Status Badges & Text */}
                <div className="space-y-1 max-w-xs">
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 animate-pulse" />
                    <span>Expanding Prompt with {providerChoice === "gemini" ? "Gemini 3.7 Flash" : "LM Studio"}...</span>
                  </p>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug">
                    {elapsedSeconds >= 30 
                      ? "Local model is evaluating prompt context or generating tokens..." 
                      : "Synthesizing cinematographic details and slot references."}
                  </p>
                </div>

                {/* Embedded Cancel Action */}
                <button
                  type="button"
                  onClick={handleCancelGeneration}
                  className="mt-4 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-700 hover:text-zinc-900 bg-white hover:bg-zinc-100 border border-zinc-300 dark:text-zinc-300 dark:hover:text-white dark:bg-zinc-800/90 dark:hover:bg-zinc-700/90 dark:border-zinc-600/80 dark:hover:border-zinc-500 shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Square className="w-3 h-3 fill-current text-red-600 dark:text-red-400" />
                  <span>Cancel Generation</span>
                </button>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-zinc-600 dark:text-zinc-400 bg-zinc-100/80 dark:bg-zinc-900/60 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between shadow-xs">
            <span>
              Character Count: {displayedPrompt.length}{" "}
              <span className="text-zinc-500 font-normal">
                ({isLivePreview ? "Synthesized Live Context" : "Compiled Prompt"})
              </span>
            </span>
            <span className="text-zinc-500">Target Node: Configured in Step 2</span>
          </div>
        </div>
      </div>
      </div>
      )}
      {reviewTakeId && activeShot && (
        <TakeReviewModal
          take={activeShot.takes?.find(t => t.id === reviewTakeId)!}
          sceneName={sceneProject.scene_name || "Untitled_Scene"}
          shotNumber={activeShot.shot_number}
          variations={activeShot.prompt_variations}
          onClose={() => setReviewTakeId(null)}
          onSetHero={() => {
            onUpdateShot(prev => {
              const updatedTakes = (prev.takes || []).map(t => ({
                ...t,
                is_hero: t.id === reviewTakeId
              }));
              return { ...prev, hero_take_id: reviewTakeId, takes: updatedTakes };
            });
            setReviewTakeId(null);
          }}
        />
      )}

      {/* LLM Exchange Inspector Modal */}
      <PromptDebugModal
        isOpen={showDebugModal}
        onClose={() => setShowDebugModal(false)}
        debugInfo={lastDebugInfo}
        assembledPrompt={expandedPrompt}
      />
    </div>
  );
};
