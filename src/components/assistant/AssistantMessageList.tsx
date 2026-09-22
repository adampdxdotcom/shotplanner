import React from "react";
import { Bot, Clapperboard, Loader2, CheckCheck, Eye } from "lucide-react";
import Markdown from "react-markdown";
import { AssistantChatMessage } from "../../services/assistantClient";
import { AssistantAction, parseAssistantActions, validateActionSafety } from "../../types/assistantActions";
import { AssistantActionCard } from "./AssistantActionCard";
import { StagingProgressState, ExpandingProgressState } from "./useAssistantActions";
import { CharacterProfile, MediaAsset } from "../../types";

interface AssistantMessageListProps {
  messages: AssistantChatMessage[];
  isLoading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  existingShotNumbers: number[];
  appliedActionKeys: Record<string, boolean>;
  dismissedActionKeys: Record<string, boolean>;
  stagingProgressMap: Record<string, StagingProgressState>;
  expandingProgressMap: Record<string, ExpandingProgressState>;
  characters?: Record<string, CharacterProfile>;
  assets?: MediaAsset[];
  sceneName?: string;
  onNavigateToSection?: (section: string) => void;
  onApplyAction: (action: AssistantAction, actionKey: string) => void;
  onDismissAction: (action: AssistantAction, actionKey: string) => void;
  onUndoAction: (action: AssistantAction, actionKey: string) => void;
  onApplyAllActions: (actions: AssistantAction[], msgIdx: number) => void;
}

/**
 * Scrollable conversation message feed rendering user prompts, assistant replies with Markdown,
 * proposed action card widgets, and real-time execution status.
 */
export const AssistantMessageList: React.FC<AssistantMessageListProps> = ({
  messages,
  isLoading,
  messagesEndRef,
  existingShotNumbers,
  appliedActionKeys,
  dismissedActionKeys,
  stagingProgressMap,
  expandingProgressMap,
  characters,
  assets,
  sceneName,
  onNavigateToSection,
  onApplyAction,
  onDismissAction,
  onUndoAction,
  onApplyAllActions
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm bg-slate-50/60 dark:bg-zinc-950">
      {messages.map((msg, idx) => {
        // Render system status feedback events
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
                <div className="space-y-2">
                  {msg.attached_image && (
                    <div className="flex items-center gap-2 p-1.5 rounded-xl bg-white/10 border border-white/20 text-xs">
                      {msg.attached_image.preview_url ? (
                        <img
                          src={msg.attached_image.preview_url}
                          alt={msg.attached_image.filename}
                          className="w-10 h-10 rounded-lg object-cover bg-black/20 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                          <Eye className="w-4 h-4 text-white" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate text-[11px] text-white">
                          {msg.attached_image.filename}
                        </div>
                        <div className="text-[10px] text-indigo-100 truncate">
                          {msg.attached_image.subject_name ? `Subject: ${msg.attached_image.subject_name}` : "Vision Inspection"}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              ) : (() => {
                const { cleanContent, actions } = parseAssistantActions(msg.content);
                const validActions = actions.filter((act) => validateActionSafety(act, existingShotNumbers).valid);
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
                            onClick={() => onApplyAllActions(actions, idx)}
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
                      <div className="space-y-2 mt-2">
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
                              characters={characters}
                              assets={assets}
                              sceneName={sceneName}
                              onNavigateToSection={onNavigateToSection}
                              onApply={(action) => onApplyAction(action, actionKey)}
                              onDismiss={(action) => onDismissAction(action, actionKey)}
                              onUndo={(action) => onUndoAction(action, actionKey)}
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
  );
};
