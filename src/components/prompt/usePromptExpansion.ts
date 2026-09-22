import { useState, useRef, useEffect } from "react";
import { 
  LLMProvider, 
  ScenePlanning, 
  SceneProjectFile, 
  ShotItem, 
  PromptDebugInfo, 
  PromptVariation, 
  AppConfig, 
  MediaAsset 
} from "../../types";
import { llmApi } from "../../api";

export interface UsePromptExpansionParams {
  providerChoice: LLMProvider;
  activeShotId: string | null;
  activeShot: ShotItem | null;
  currentBasicStub: string;
  expandedPrompt: string;
  relevantAssets: Array<MediaAsset & { slot_index?: number }>;
  activeShotPrefix: string;
  planning?: ScenePlanning;
  sceneProject: SceneProjectFile;
  lmStudioUrl: string;
  geminiApiKey?: string;
  config?: AppConfig;
  onChangeExpandedPrompt: (val: string) => void;
  onUpdateShot: (updater: (prev: ShotItem) => ShotItem) => void;
  onUpdateSpecificShot?: (id: string, updater: (prev: ShotItem) => ShotItem) => void;
  onShowToast?: (text: string, type: "success" | "error" | "info") => void;
}

export interface UsePromptExpansionReturn {
  generating: boolean;
  elapsedSeconds: number;
  error: string | null;
  presentedFallbackNotice: string | null;
  providerUsed: string | null;
  lastDebugInfo: PromptDebugInfo | null;
  showDebugModal: boolean;
  setShowDebugModal: (show: boolean) => void;
  handleGeneratePrompt: () => Promise<void>;
  handleCancelGeneration: () => void;
}

/**
 * Custom hook managing LLM prompt expansion network requests, abort signals,
 * elapsed timers, variations, and fallback presentation.
 */
export function usePromptExpansion({
  providerChoice,
  activeShotId,
  activeShot,
  currentBasicStub,
  expandedPrompt,
  relevantAssets,
  activeShotPrefix,
  planning,
  sceneProject,
  lmStudioUrl,
  geminiApiKey,
  config,
  onChangeExpandedPrompt,
  onUpdateShot,
  onUpdateSpecificShot,
  onShowToast
}: UsePromptExpansionParams): UsePromptExpansionReturn {
  const [generating, setGenerating] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [presentedFallbackNotice, setPresentedFallbackNotice] = useState<string | null>(null);
  const [providerUsed, setProviderUsed] = useState<string | null>(null);
  const [lastDebugInfo, setLastDebugInfo] = useState<PromptDebugInfo | null>(null);
  const [showDebugModal, setShowDebugModal] = useState(false);

  // Live timer tracking elapsed generation duration
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

  const handleCancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setGenerating(false);
    onShowToast?.("LLM prompt expansion cancelled.", "info");
  };

  const handleGeneratePrompt = async () => {
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
    const targetShot = sceneProject.shots.find((s) => s.id === currentShotId) || activeShot;
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

    const priorPrompt = targetShot?.expanded_prompt?.trim() || "";
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setGenerating(true);
    setError(null);
    setPresentedFallbackNotice(null);
    setProviderUsed(null);

    try {
      const payload: any = {
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
      };

      const data: any = await llmApi.generatePrompt(payload, { signal: controller.signal });
      if (data && data.expanded_prompt) {
        setPresentedFallbackNotice(null);

        let createdVariationNumber = 1;
        const updatedShotUpdater = (prev: ShotItem): ShotItem => {
          const currentVariations = prev.prompt_variations || [];
          const nextVarNum = currentVariations.length + 1;
          createdVariationNumber = nextVarNum;

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

        if (onUpdateSpecificShot) {
          onUpdateSpecificShot(currentShotId, updatedShotUpdater);
        } else {
          onUpdateShot(updatedShotUpdater);
        }

        if (activeShotId === currentShotId) {
          onChangeExpandedPrompt(data.expanded_prompt);
        }

        if (data.provider) setProviderUsed(data.provider);
        if (data.debug) setLastDebugInfo(data.debug);
        onShowToast?.(`Shot ${targetShot?.shot_number || 1}: Prompt Variation ${createdVariationNumber} generated successfully!`, "success");
      } else {
        const providerLabel = providerChoice === "gemini" ? "Google Gemini" : "LM Studio";
        const errorMsg = data.error || `Failed to generate prompt with ${providerLabel}`;
        setError(errorMsg);
        onShowToast?.(`LLM generation failed: ${errorMsg}`, "error");

        if (priorPrompt) {
          if (onUpdateSpecificShot) {
            onUpdateSpecificShot(currentShotId, (prev) => ({ ...prev, expanded_prompt: priorPrompt }));
          }
          if (activeShotId === currentShotId) {
            onChangeExpandedPrompt(priorPrompt);
          }
          setPresentedFallbackNotice(`Default LLM service failed (${providerLabel}). Presenting last prompt for this shot.`);
          onShowToast?.("Presenting last prompt for this shot.", "info");
        } else {
          setPresentedFallbackNotice(`Default LLM service failed (${providerLabel}). No previous prompt available for this shot.`);
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        return;
      }
      const providerLabel = providerChoice === "gemini" ? "Google Gemini" : "LM Studio";
      const errorMsg = err.message || `Failed to connect to ${providerLabel}`;
      setError(errorMsg);
      onShowToast?.(`LLM generation failed: ${errorMsg}`, "error");

      if (priorPrompt) {
        if (onUpdateSpecificShot) {
          onUpdateSpecificShot(currentShotId, (prev) => ({ ...prev, expanded_prompt: priorPrompt }));
        }
        if (activeShotId === currentShotId) {
          onChangeExpandedPrompt(priorPrompt);
        }
        setPresentedFallbackNotice(`Default LLM service failed (${providerLabel}). Presenting last prompt for this shot.`);
        onShowToast?.("Presenting last prompt for this shot.", "info");
      } else {
        setPresentedFallbackNotice(`Default LLM service failed (${providerLabel}). No previous prompt available for this shot.`);
      }
    } finally {
      abortControllerRef.current = null;
      setGenerating(false);
    }
  };

  return {
    generating,
    elapsedSeconds,
    error,
    presentedFallbackNotice,
    providerUsed,
    lastDebugInfo,
    showDebugModal,
    setShowDebugModal,
    handleGeneratePrompt,
    handleCancelGeneration
  };
}
