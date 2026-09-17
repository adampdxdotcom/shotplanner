import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  Bot, 
  Send, 
  Minimize2, 
  Maximize2, 
  Sparkles, 
  X, 
  Clapperboard, 
  Loader2, 
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  CheckCheck
} from "lucide-react";
import Markdown from "react-markdown";
import { SceneProjectFile, LLMProvider, ShotItem, CharacterProfile, ScenePlanningDetails, MediaAsset, AppConfig } from "../../types";
import { 
  sendAssistantChatMessage, 
  AssistantChatMessage 
} from "../../services/assistantClient";
import { probeLMStudioConnection } from "../config/lmStudioProbe";
import { probeGeminiConnection } from "../config/GeminiConfig";
import { parseAssistantActions, AssistantAction, validateActionSafety } from "../../types/assistantActions";
import { AssistantActionCard } from "./AssistantActionCard";
import { toCanonicalSubjectName, findCanonicalSubject } from "../../utils/subjectUtils";
import { generateUUID } from "../../utils/formatters";

interface AssistantFloatingChatProps {
  sceneProject: SceneProjectFile;
  activeShotId?: string;
  activeSection: string;
  config?: AppConfig;
  assets?: MediaAsset[];
  lmStudioUrl?: string;
  llmProvider?: string;
  defaultLlmProvider?: LLMProvider;
  geminiApiKey?: string;
  onNavigateToConfig?: (tab?: "llm" | "remote" | "models" | "general") => void;
  onUpdateProject?: React.Dispatch<React.SetStateAction<SceneProjectFile>>;
  onShowToast?: (text: string, type?: "success" | "error" | "info") => void;
  onStageShot?: (shot: ShotItem) => Promise<boolean>;
  onExpandPrompt?: (shot: ShotItem) => Promise<string>;
}

export const AssistantFloatingChat: React.FC<AssistantFloatingChatProps> = ({
  sceneProject,
  activeShotId,
  activeSection,
  config,
  assets = [],
  lmStudioUrl,
  llmProvider,
  defaultLlmProvider = "lm_studio",
  geminiApiKey,
  onNavigateToConfig,
  onUpdateProject,
  onShowToast,
  onStageShot,
  onExpandPrompt
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Track applied action keys to reflect UI state
  const [appliedActionKeys, setAppliedActionKeys] = useState<Record<string, boolean>>({});
  // Track dismissed action keys for Phase 4 guardrails
  const [dismissedActionKeys, setDismissedActionKeys] = useState<Record<string, boolean>>({});
  
  // Snapshots for undo capability across all action types
  const [undoShotSnapshots, setUndoShotSnapshots] = useState<Record<string, ShotItem>>({});
  const [undoPlanningSnapshots, setUndoPlanningSnapshots] = useState<Record<string, ScenePlanningDetails | undefined>>({});
  const [undoCharSnapshots, setUndoCharSnapshots] = useState<Record<string, { key: string; profile?: CharacterProfile; wasNew?: boolean }>>({});

  // Real-time progress trackers for Phase 3 actions
  const [stagingProgressMap, setStagingProgressMap] = useState<Record<string, {
    status: "idle" | "staging" | "success" | "error";
    progress: number;
    message?: string;
  }>>({});

  const [expandingProgressMap, setExpandingProgressMap] = useState<Record<string, {
    status: "idle" | "expanding" | "success" | "error";
    message?: string;
  }>>({});

  // Connection check state for the default LLM
  const [isDefaultLlmConnected, setIsDefaultLlmConnected] = useState<boolean | null>(null);
  const [isCheckingConnection, setIsCheckingConnection] = useState<boolean>(false);

  const initialWelcome = `Hello! I am your AI Production Assistant. I have full context of **${
    sceneProject?.scene_name || "your active scene"
  }**, including all **${sceneProject?.shots?.length || 0} shots**, world planning, cast profiles, and assets.\n\nAsk me for cinematography recommendations, scene lore, lighting setups, dialogue tweaks, or to stage assets and trigger prompt expansions.`;

  const [messages, setMessages] = useState<AssistantChatMessage[]>([
    {
      role: "assistant",
      content: initialWelcome
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Update initial message if scene changes
  useEffect(() => {
    if (messages.length === 1 && messages[0].role === "assistant") {
      setMessages([{ role: "assistant", content: initialWelcome }]);
    }
  }, [sceneProject?.scene_name, sceneProject?.shots?.length]);

  // Determine effective default provider
  const effectiveDefault: LLMProvider = (llmProvider as LLMProvider) || defaultLlmProvider || "lm_studio";

  // Check connection status
  const checkConnection = useCallback(async () => {
    setIsCheckingConnection(true);
    try {
      if (effectiveDefault === "gemini") {
        const res = await probeGeminiConnection(geminiApiKey);
        setIsDefaultLlmConnected(res.success);
      } else {
        const url = lmStudioUrl || "http://127.0.0.1:1234";
        const res = await probeLMStudioConnection(url);
        setIsDefaultLlmConnected(res.success);
      }
    } catch {
      setIsDefaultLlmConnected(false);
    } finally {
      setIsCheckingConnection(false);
    }
  }, [effectiveDefault, geminiApiKey, lmStudioUrl]);

  useEffect(() => {
    if (isOpen) {
      checkConnection();
    }
  }, [isOpen, checkConnection]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isLoading]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleSendMessage = async () => {
    const trimmed = inputQuery.trim();
    if (!trimmed || isLoading) return;

    setErrorMessage(null);
    const newMessages: AssistantChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed }
    ];

    setMessages(newMessages);
    setInputQuery("");
    setIsLoading(true);

    try {
      const response = await sendAssistantChatMessage({
        messages: newMessages,
        scene_project: sceneProject,
        active_shot_id: activeShotId,
        active_section: activeSection,
        provider: effectiveDefault,
        lm_studio_url: lmStudioUrl
      });

      if (response && response.reply) {
        setMessages([
          ...newMessages,
          { role: "assistant", content: response.reply }
        ]);
        setIsDefaultLlmConnected(true);
      } else {
        throw new Error("Received empty response from assistant.");
      }
    } catch (err: any) {
      console.error("[AssistantFloatingChat] Error chatting with assistant:", err);
      const errText = err.message || "Failed to communicate with LLM provider.";
      setErrorMessage(errText);
      setIsDefaultLlmConnected(false);
      
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: `⚠️ **Connection Error**: ${errText}\n\nPlease verify that your **${
            effectiveDefault === "gemini" ? "Google Gemini API Key" : "LM Studio instance"
          }** is running and configured correctly in the settings.`
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleResetChat = () => {
    setMessages([{ role: "assistant", content: initialWelcome }]);
    setErrorMessage(null);
  };

  const handleGoToLlmSettings = () => {
    if (onNavigateToConfig) {
      onNavigateToConfig("llm");
    }
  };

  // Phase 4: State Feedback Injection Helper
  const injectStateFeedback = useCallback((feedbackText: string) => {
    setMessages(prev => [
      ...prev,
      {
        role: "system",
        content: `[System: ${feedbackText}]`
      }
    ]);
  }, []);

  // Action Handlers for Phases 1, 2, 3 & 4
  const handleApplyAction = useCallback(async (action: AssistantAction, actionKey: string) => {
    // Un-dismiss if previously dismissed
    setDismissedActionKeys(prev => {
      if (!prev[actionKey]) return prev;
      const next = { ...prev };
      delete next[actionKey];
      return next;
    });

    if (action.type === "update_shot") {
      if (!onUpdateProject) {
        if (onShowToast) onShowToast("Project update handler is not available.", "error");
        return;
      }
      const shotNumber = typeof action.shot_number === "string" ? parseInt(action.shot_number, 10) : action.shot_number;
      const targetIndex = sceneProject.shots.findIndex(s => s.shot_number === shotNumber);

      if (targetIndex === -1) {
        if (onShowToast) onShowToast(`Shot #${shotNumber} was not found in active scene.`, "error");
        return;
      }

      const existingShot = sceneProject.shots[targetIndex];
      // Save snapshot for undo
      setUndoShotSnapshots(prev => ({ ...prev, [actionKey]: { ...existingShot } }));

      onUpdateProject(prev => {
        const shots = [...prev.shots];
        const idx = shots.findIndex(s => s.shot_number === shotNumber);
        if (idx !== -1) {
          const current = shots[idx];
          const changes = action.changes || {};
          shots[idx] = {
            ...current,
            ...changes,
            status: "unstaged",
            updated_at: new Date().toISOString()
          };
        }
        return { ...prev, shots };
      });

      setAppliedActionKeys(prev => ({ ...prev, [actionKey]: true }));
      injectStateFeedback(`User applied proposed changes to Shot #${shotNumber}`);
      if (onShowToast) {
        onShowToast(`Applied assistant updates to Shot #${shotNumber}.`, "success");
      }
    } else if (action.type === "add_shot") {
      if (!onUpdateProject) {
        if (onShowToast) onShowToast("Project update handler is not available.", "error");
        return;
      }
      const shotData = action.shot || (action as any).changes || {};
      const newShotNum = sceneProject.shots.length + 1;

      onUpdateProject(prev => {
        const targetNum = prev.shots.length + 1;
        const newShot: ShotItem = {
          id: "shot_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
          shot_name: shotData.shot_name || `Shot #${targetNum}`,
          shot_number: targetNum,
          shot_type: shotData.shot_type || "Medium Shot",
          camera_movement: shotData.camera_movement || "Locked Off",
          lens_focal_length: shotData.lens_focal_length || "50mm Standard Prime",
          aspect_ratio: shotData.aspect_ratio || "16:9 Widescreen",
          basic_stub: shotData.basic_stub || "",
          expanded_prompt: shotData.expanded_prompt || "",
          assigned_slots: {},
          status: "unstaged",
          updated_at: new Date().toISOString()
        };

        return {
          ...prev,
          shots: [...prev.shots, newShot]
        };
      });

      setAppliedActionKeys(prev => ({ ...prev, [actionKey]: true }));
      injectStateFeedback(`User created and added new Shot #${newShotNum} to the scene`);
      if (onShowToast) {
        onShowToast(`Added new Shot #${newShotNum} to scene.`, "success");
      }
    } else if (action.type === "update_scene_planning") {
      if (!onUpdateProject) {
        if (onShowToast) onShowToast("Project update handler is not available.", "error");
        return;
      }
      const existingPlanning = sceneProject.scene_planning ? { ...sceneProject.scene_planning } : undefined;
      setUndoPlanningSnapshots(prev => ({ ...prev, [actionKey]: existingPlanning }));

      onUpdateProject(prev => {
        const currentPlanning = prev.scene_planning || {};
        const changes = action.changes || {};
        const mergedPlanning: ScenePlanningDetails = {
          ...currentPlanning,
          ...changes
        };
        const updatedSceneName = changes.scene_name || prev.scene_name;

        return {
          ...prev,
          scene_name: updatedSceneName,
          scene_planning: mergedPlanning
        };
      });

      setAppliedActionKeys(prev => ({ ...prev, [actionKey]: true }));
      injectStateFeedback("User applied updates to Scene Planning & Theme specifications");
      if (onShowToast) {
        onShowToast("Applied scene planning updates.", "success");
      }
    } else if (action.type === "update_character") {
      if (!onUpdateProject) {
        if (onShowToast) onShowToast("Project update handler is not available.", "error");
        return;
      }
      const rawName = action.character_name || (action as any).name || "";
      const subjects = sceneProject.subjects || [];
      const canonicalName = findCanonicalSubject(rawName, subjects) || toCanonicalSubjectName(rawName) || rawName;

      const existingChar = sceneProject.characters?.[canonicalName];
      setUndoCharSnapshots(prev => ({
        ...prev,
        [actionKey]: {
          key: canonicalName,
          profile: existingChar ? { ...existingChar } : undefined,
          wasNew: !existingChar
        }
      }));

      onUpdateProject(prev => {
        const nextSubjects = [...(prev.subjects || [])];
        if (!findCanonicalSubject(canonicalName, nextSubjects)) {
          nextSubjects.push(canonicalName);
        }

        const nextCharacters = { ...(prev.characters || {}) };
        const changes = action.changes || {};

        const baseProfile: CharacterProfile = nextCharacters[canonicalName] || {
          id: generateUUID(),
          name: canonicalName,
          notes: "",
          quick_slots: [],
          scene_outfit_ref: "",
          is_location: changes.is_location || false
        };

        nextCharacters[canonicalName] = {
          ...baseProfile,
          ...changes,
          name: canonicalName
        };

        return {
          ...prev,
          subjects: nextSubjects,
          characters: nextCharacters
        };
      });

      setAppliedActionKeys(prev => ({ ...prev, [actionKey]: true }));
      injectStateFeedback(`User updated Character Profile & Wardrobe for "${canonicalName}"`);
      if (onShowToast) {
        onShowToast(`Updated character profile for "${canonicalName}".`, "success");
      }
    } else if (action.type === "stage_shot_assets") {
      const shotNumber = typeof action.shot_number === "string" ? parseInt(action.shot_number, 10) : action.shot_number;
      const targetShot = sceneProject.shots.find(s => s.shot_number === shotNumber);

      if (!targetShot) {
        if (onShowToast) onShowToast(`Shot #${shotNumber} was not found in active scene.`, "error");
        return;
      }

      setStagingProgressMap(prev => ({
        ...prev,
        [actionKey]: { status: "staging", progress: 15, message: "Connecting to remote host..." }
      }));

      try {
        const progressTimer = setInterval(() => {
          setStagingProgressMap(prev => {
            const current = prev[actionKey];
            if (!current || current.status !== "staging") return prev;
            const nextProgress = Math.min(current.progress + 25, 90);
            return {
              ...prev,
              [actionKey]: {
                ...current,
                progress: nextProgress,
                message: nextProgress > 60 ? "Transferring assets via SFTP..." : "Packaging payload & workflow..."
              }
            };
          });
        }, 400);

        let success = false;
        if (onStageShot) {
          success = await onStageShot(targetShot);
        } else {
          const payload = {
            ...(config || {}),
            workflow_filename: targetShot.workflow_file || sceneProject.workflow_file,
            output_workflow_filename: `${sceneProject.scene_name}_Shot_${String(targetShot.shot_number).padStart(2, "0")}.json`,
            prompt_node_id: targetShot.prompt_node_id || (sceneProject as any).prompt_node_id,
            expanded_prompt: targetShot.expanded_prompt,
            node_mappings: targetShot.assigned_slots || {},
            scene_name: sceneProject.scene_name,
            shot_number: targetShot.shot_number
          };

          const response = await fetch("/api/execution/stage-shot", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          const data = await response.json();
          success = !!data.success || response.ok;
          if (!response.ok) throw new Error(data.error || "Failed to stage shot assets.");
        }

        clearInterval(progressTimer);

        if (success) {
          setStagingProgressMap(prev => ({
            ...prev,
            [actionKey]: { status: "success", progress: 100, message: "Assets staged successfully." }
          }));
          setAppliedActionKeys(prev => ({ ...prev, [actionKey]: true }));
          injectStateFeedback(`User staged Shot #${shotNumber} assets to ComfyUI remote environment`);
          if (onShowToast) onShowToast(`Successfully staged Shot #${shotNumber} to ComfyUI.`, "success");
        } else {
          throw new Error("Staging pipeline returned unsuccessful status.");
        }
      } catch (err: any) {
        const errorMsg = err.message || "Failed to stage assets.";
        setStagingProgressMap(prev => ({
          ...prev,
          [actionKey]: { status: "error", progress: 0, message: errorMsg }
        }));
        if (onShowToast) onShowToast(`Staging failed: ${errorMsg}`, "error");
      }
    } else if (action.type === "expand_shot_prompt") {
      const shotNumber = typeof action.shot_number === "string" ? parseInt(action.shot_number, 10) : action.shot_number;
      const targetShot = sceneProject.shots.find(s => s.shot_number === shotNumber);

      if (!targetShot) {
        if (onShowToast) onShowToast(`Shot #${shotNumber} was not found in active scene.`, "error");
        return;
      }

      setExpandingProgressMap(prev => ({
        ...prev,
        [actionKey]: { status: "expanding", message: "Synthesizing prompt..." }
      }));

      try {
        let newPrompt = "";
        if (onExpandPrompt) {
          newPrompt = await onExpandPrompt(targetShot);
        } else {
          const response = await fetch("/api/generate-prompt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              basic_stub: action.guidance || targetShot.basic_stub,
              assets: assets,
              prompt_prefix: `[Scene: ${sceneProject.scene_name}] [Shot: ${targetShot.shot_number}]`,
              provider: effectiveDefault,
              lm_studio_url: lmStudioUrl,
              gemini_api_key: geminiApiKey,
              active_shot: targetShot,
              shot_type: targetShot.shot_type,
              camera_movement: targetShot.camera_movement,
              lens_focal_length: targetShot.lens_focal_length,
              aspect_ratio: targetShot.aspect_ratio,
              shot_number: targetShot.shot_number,
              scene_name: sceneProject.scene_name,
              characters: sceneProject.characters
            })
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Prompt expansion failed");
          newPrompt = data.expanded_prompt;
        }

        if (newPrompt && onUpdateProject) {
          onUpdateProject(prev => {
            const shots = [...prev.shots];
            const idx = shots.findIndex(s => s.shot_number === shotNumber);
            if (idx !== -1) {
              shots[idx] = {
                ...shots[idx],
                expanded_prompt: newPrompt,
                updated_at: new Date().toISOString()
              };
            }
            return { ...prev, shots };
          });
        }

        setExpandingProgressMap(prev => ({
          ...prev,
          [actionKey]: { status: "success", message: "Prompt expanded." }
        }));
        setAppliedActionKeys(prev => ({ ...prev, [actionKey]: true }));
        injectStateFeedback(`User expanded and populated the cinematic prompt for Shot #${shotNumber}`);
        if (onShowToast) onShowToast(`Prompt expanded and populated for Shot #${shotNumber}.`, "success");
      } catch (err: any) {
        const errorMsg = err.message || "Prompt expansion failed.";
        setExpandingProgressMap(prev => ({
          ...prev,
          [actionKey]: { status: "error", message: errorMsg }
        }));
        if (onShowToast) onShowToast(`Prompt expansion failed: ${errorMsg}`, "error");
      }
    }
  }, [onUpdateProject, sceneProject, onShowToast, onStageShot, onExpandPrompt, config, assets, effectiveDefault, lmStudioUrl, geminiApiKey, injectStateFeedback]);

  // Phase 4: Dismiss Action Handler
  const handleDismissAction = useCallback((action: AssistantAction, actionKey: string) => {
    setDismissedActionKeys(prev => ({ ...prev, [actionKey]: true }));
    let descriptor = "suggestion";
    if (action.type === "update_shot") descriptor = `changes to Shot #${action.shot_number}`;
    else if (action.type === "add_shot") descriptor = "adding new shot";
    else if (action.type === "update_scene_planning") descriptor = "scene planning changes";
    else if (action.type === "update_character") descriptor = `changes to character "${action.character_name}"`;
    else if (action.type === "stage_shot_assets") descriptor = `remote staging for Shot #${action.shot_number}`;
    else if (action.type === "expand_shot_prompt") descriptor = `prompt expansion for Shot #${action.shot_number}`;

    injectStateFeedback(`User dismissed proposed ${descriptor}`);
    if (onShowToast) {
      onShowToast(`Dismissed ${descriptor}.`, "info");
    }
  }, [injectStateFeedback, onShowToast]);

  const handleUndoAction = useCallback((action: AssistantAction, actionKey: string) => {
    if (!onUpdateProject) return;

    if (action.type === "update_shot") {
      const snapshot = undoShotSnapshots[actionKey];
      if (!snapshot) return;

      onUpdateProject(prev => {
        const shots = [...prev.shots];
        const idx = shots.findIndex(s => s.id === snapshot.id || s.shot_number === snapshot.shot_number);
        if (idx !== -1) {
          shots[idx] = { ...snapshot };
        }
        return { ...prev, shots };
      });

      setAppliedActionKeys(prev => {
        const next = { ...prev };
        delete next[actionKey];
        return next;
      });

      injectStateFeedback(`User reverted (undid) applied changes to Shot #${action.shot_number}`);
      if (onShowToast) {
        onShowToast(`Reverted changes to Shot #${action.shot_number}.`, "info");
      }
    } else if (action.type === "update_scene_planning") {
      const snapshot = undoPlanningSnapshots[actionKey];

      onUpdateProject(prev => ({
        ...prev,
        scene_planning: snapshot
      }));

      setAppliedActionKeys(prev => {
        const next = { ...prev };
        delete next[actionKey];
        return next;
      });

      injectStateFeedback("User reverted (undid) scene planning modifications");
      if (onShowToast) {
        onShowToast("Reverted scene planning changes.", "info");
      }
    } else if (action.type === "update_character") {
      const snapInfo = undoCharSnapshots[actionKey];
      if (!snapInfo) return;

      onUpdateProject(prev => {
        const nextCharacters = { ...(prev.characters || {}) };
        if (snapInfo.wasNew) {
          delete nextCharacters[snapInfo.key];
        } else if (snapInfo.profile) {
          nextCharacters[snapInfo.key] = snapInfo.profile;
        }
        return {
          ...prev,
          characters: nextCharacters
        };
      });

      setAppliedActionKeys(prev => {
        const next = { ...prev };
        delete next[actionKey];
        return next;
      });

      injectStateFeedback(`User reverted (undid) changes for "${snapInfo.key}"`);
      if (onShowToast) {
        onShowToast(`Reverted changes for "${snapInfo.key}".`, "info");
      }
    }
  }, [undoShotSnapshots, undoPlanningSnapshots, undoCharSnapshots, onUpdateProject, onShowToast, injectStateFeedback]);

  const handleApplyAllActions = (actions: AssistantAction[], msgIdx: number) => {
    const existingShotNums = (sceneProject.shots || []).map(s => s.shot_number);
    actions.forEach((act, actIdx) => {
      const safety = validateActionSafety(act, existingShotNums);
      const actionKey = `${msgIdx}_${act.type}_${act.type === "update_shot" ? act.shot_number : act.type === "update_character" ? act.character_name : actIdx}`;
      if (safety.valid && !appliedActionKeys[actionKey] && !dismissedActionKeys[actionKey]) {
        handleApplyAction(act, actionKey);
      }
    });
  };

  const existingShotNumbers = (sceneProject.shots || []).map(s => s.shot_number);

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg hover:shadow-indigo-500/25 transition-all duration-200 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          aria-label="Open AI Production Assistant"
        >
          <div className="relative">
            <Bot className="w-5 h-5 transition-transform group-hover:scale-110" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border-2 border-indigo-600 rounded-full" />
          </div>
          <span className="font-semibold text-sm tracking-wide">Production Assistant</span>
          <Sparkles className="w-4 h-4 text-amber-300 transition-transform group-hover:rotate-12" />
        </button>
      )}

      {/* Floating Chat Modal */}
      {isOpen && (
        <div
          className={`fixed z-50 transition-all duration-200 shadow-2xl rounded-2xl flex flex-col overflow-hidden border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 ${
            isExpanded
              ? "inset-4 sm:inset-10"
              : "bottom-6 right-6 w-[94vw] sm:w-[460px] h-[640px] max-h-[85vh]"
          }`}
        >
          {/* Header */}
          <div className="px-4 py-3 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 shrink-0 select-none">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm tracking-tight text-slate-900 dark:text-zinc-100">AI Production Assistant</h3>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800/60 font-semibold">
                    {effectiveDefault === "gemini" ? "Gemini" : "LM Studio"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate max-w-[200px] sm:max-w-[260px]">
                  Context: <strong className="text-slate-800 dark:text-zinc-200 font-medium">{sceneProject.scene_name || "Untitled Scene"}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Close Assistant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Connection Status Banner (if offline/failed) */}
          {isDefaultLlmConnected === false && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/60 px-3.5 py-2 flex items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200 shrink-0">
              <div className="flex items-center gap-1.5 truncate">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="truncate">
                  LLM provider ({effectiveDefault}) seems offline or unreachable.
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={checkConnection}
                  disabled={isCheckingConnection}
                  className="px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 dark:bg-amber-900 dark:hover:bg-amber-800 text-amber-800 dark:text-amber-200 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                  title="Retry connection"
                >
                  <RefreshCw className={`w-3 h-3 ${isCheckingConnection ? "animate-spin" : ""}`} />
                </button>
                <button
                  onClick={handleGoToLlmSettings}
                  className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-medium transition-colors cursor-pointer"
                >
                  Settings
                </button>
              </div>
            </div>
          )}

          {/* Chat Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm bg-slate-50/60 dark:bg-zinc-950">
            {messages.map((msg, idx) => {
              // Render silent system confirmations
              if (msg.role === "system") {
                return (
                  <div key={idx} className="flex justify-center my-1">
                    <div className="px-3 py-1 rounded-full bg-slate-200/70 dark:bg-zinc-800 text-[11px] font-mono text-slate-600 dark:text-zinc-400 border border-slate-300/50 dark:border-zinc-700 flex items-center gap-1.5 shadow-2xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      <span>{msg.content.replace(/^\[System:\s*|\]$/g, "")}</span>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={idx}
                  className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`rounded-2xl px-3.5 py-2.5 max-w-[85%] leading-relaxed ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white rounded-tr-xs shadow-xs"
                        : "bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs shadow-xs dark:bg-zinc-800/90 dark:text-zinc-200 dark:border-zinc-700/70"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    ) : (() => {
                      const { cleanContent, actions } = parseAssistantActions(msg.content);
                      const validActions = actions.filter(act => validateActionSafety(act, existingShotNumbers).valid);
                      const unappliedCount = validActions.filter((act, actIdx) => {
                        const actionKey = `${idx}_${act.type}_${act.type === "update_shot" ? act.shot_number : act.type === "update_character" ? act.character_name : actIdx}`;
                        return !appliedActionKeys[actionKey] && !dismissedActionKeys[actionKey];
                      }).length;

                      return (
                        <div>
                          {cleanContent && (
                            <div className="markdown-body prose prose-slate dark:prose-invert prose-sm max-w-none text-xs sm:text-sm space-y-2 text-slate-800 dark:text-zinc-200">
                              <Markdown>{cleanContent}</Markdown>
                            </div>
                          )}

                          {/* Batch Action Group Header if multiple actions */}
                          {actions.length > 1 && (
                            <div className="mt-3 pt-2 border-t border-slate-200/80 dark:border-zinc-700 flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                                Proposed Batch Changes ({actions.length})
                              </span>
                              {unappliedCount > 0 ? (
                                <button
                                  onClick={() => handleApplyAllActions(actions, idx)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-[11px] font-semibold transition-colors shadow-2xs cursor-pointer"
                                >
                                  <CheckCheck className="w-3.5 h-3.5" />
                                  <span>Apply All ({unappliedCount})</span>
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium">
                                  <CheckCheck className="w-3.5 h-3.5" /> All Applied
                                </span>
                              )}
                            </div>
                          )}

                          {actions.length > 0 && (
                            <div className="space-y-2">
                              {actions.map((act, actIdx) => {
                                const actionKey = `${idx}_${act.type}_${act.type === "update_shot" ? act.shot_number : act.type === "update_character" ? act.character_name : actIdx}`;
                                const isApplied = !!appliedActionKeys[actionKey];
                                const isDismissed = !!dismissedActionKeys[actionKey];
                                const safetyCheck = validateActionSafety(act, existingShotNumbers);

                                return (
                                  <AssistantActionCard
                                    key={actionKey}
                                    action={act}
                                    isApplied={isApplied}
                                    isDismissed={isDismissed}
                                    validationError={!safetyCheck.valid ? safetyCheck.reason : null}
                                    onApply={(action) => handleApplyAction(action, actionKey)}
                                    onDismiss={(action) => handleDismissAction(action, actionKey)}
                                    onUndo={(action) => handleUndoAction(action, actionKey)}
                                    stagingProgress={stagingProgressMap[actionKey]}
                                    expandingProgress={expandingProgressMap[actionKey]}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}

            {/* Thinking / Loading State */}
            {isLoading && (
              <div className="flex gap-2.5 justify-start">
                <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-indigo-600 shadow-2xs dark:bg-zinc-800 dark:border-zinc-700 dark:text-indigo-400 dark:shadow-none flex items-center justify-center shrink-0">
                  <Clapperboard className="w-3.5 h-3.5 animate-pulse" />
                </div>
                <div className="rounded-2xl rounded-tl-xs px-3.5 py-2.5 bg-white border border-slate-200 text-slate-600 dark:bg-zinc-800/90 dark:border-zinc-700/70 dark:text-zinc-400 flex items-center gap-2 text-xs shadow-xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
                  <span>Consulting project dossier...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white dark:bg-zinc-900 border-t border-slate-200/90 dark:border-zinc-800 shrink-0">
            <div className="relative flex items-end bg-slate-100 dark:bg-zinc-800 rounded-xl p-1.5 focus-within:ring-2 focus-within:ring-indigo-500/80 border border-slate-200 dark:border-zinc-700">
              <textarea
                ref={inputRef}
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask assistant to update scene, stage assets, or expand prompts..."
                rows={1}
                className="w-full resize-none bg-transparent px-2.5 py-1.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none max-h-28"
                style={{ height: "auto" }}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputQuery.trim() || isLoading}
                className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0 ml-1 shadow-2xs"
                title="Send query"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-slate-400 dark:text-zinc-500">
              <span>Shift + Enter for new line</span>
              <button
                onClick={handleResetChat}
                className="hover:text-slate-600 dark:hover:text-zinc-300 transition-colors cursor-pointer"
              >
                Clear History
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
