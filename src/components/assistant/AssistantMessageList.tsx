import React, { useEffect, useState } from "react";
import { 
  Bot, 
  Clapperboard, 
  Loader2, 
  CheckCheck, 
  X, 
  Clock, 
  Copy, 
  Check, 
  RotateCw, 
  Pencil 
} from "lucide-react";
import Markdown from "react-markdown";
import { AssistantChatMessage } from "../../services/assistantClient";
import { AssistantAction, parseAssistantActions, validateActionSafety, validateActionSequenceSafety } from "../../types/assistantActions";
import { AssistantActionCard } from "./AssistantActionCard";
import { StagingProgressState, ExpandingProgressState } from "./useAssistantActions";
import { CharacterProfile, MediaAsset, ShotItem } from "../../types";
import { copyToClipboard } from "../../utils/clipboard";
import { PromptCodeBlock } from "./PromptCodeBlock";
import { MarkdownQuoteBlock } from "./MarkdownQuoteBlock";

interface AssistantMessageListProps {
  messages: AssistantChatMessage[];
  isLoading: boolean;
  elapsedSeconds?: number;
  onCancelRequest?: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  existingShotNumbers: number[];
  appliedActionKeys: Record<string, boolean>;
  dismissedActionKeys: Record<string, boolean>;
  stagingProgressMap: Record<string, StagingProgressState>;
  expandingProgressMap: Record<string, ExpandingProgressState>;
  shots?: ShotItem[];
  characters?: Record<string, CharacterProfile>;
  assets?: MediaAsset[];
  sceneName?: string;
  onNavigateToSection?: (section: string) => void;
  onApplyAction: (action: AssistantAction, actionKey: string) => void;
  onDismissAction: (action: AssistantAction, actionKey: string) => void;
  onUndoAction: (action: AssistantAction, actionKey: string) => void;
  onApplyAllActions: (actions: AssistantAction[], msgIdx: number) => void;
  onRerunPrompt?: (promptText: string) => void;
  onEditPrompt?: (promptText: string) => void;
  onShowToast?: (text: string, type?: "success" | "error" | "info") => void;
}

/**
 * Scrollable conversation message feed rendering user prompts, assistant replies with Markdown,
 * prompt cards with dedicated copy buttons, proposed action card widgets, and real-time execution status.
 */
export const AssistantMessageList: React.FC<AssistantMessageListProps> = ({
  messages,
  isLoading,
  elapsedSeconds = 0,
  onCancelRequest,
  messagesEndRef,
  existingShotNumbers,
  appliedActionKeys,
  dismissedActionKeys,
  stagingProgressMap,
  expandingProgressMap,
  shots = [],
  characters,
  assets,
  sceneName,
  onNavigateToSection,
  onApplyAction,
  onDismissAction,
  onUndoAction,
  onApplyAllActions,
  onRerunPrompt,
  onEditPrompt,
  onShowToast
}) => {
  const [copiedMsgIdx, setCopiedMsgIdx] = useState<number | null>(null);

  // Auto-apply `save_visual_analysis` actions immediately upon message arrival
  useEffect(() => {
    messages.forEach((msg, idx) => {
      if (msg.role === "assistant" && msg.content) {
        const { actions } = parseAssistantActions(msg.content);
        actions.forEach((act, actIdx) => {
          if (act.type === "save_visual_analysis") {
            const actionKey = `${idx}_save_visual_analysis_${actIdx}`;
            if (!appliedActionKeys[actionKey] && !dismissedActionKeys[actionKey]) {
              onApplyAction(act, actionKey);
            }
          }
        });
      }
    });
  }, [messages, appliedActionKeys, dismissedActionKeys, onApplyAction]);

  const handleCopyText = async (text: string, msgIdx: number, label: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedMsgIdx(msgIdx);
      setTimeout(() => setCopiedMsgIdx(null), 1500);
      onShowToast?.(`Copied ${label} to clipboard.`, "info");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 text-sm bg-slate-50/60 dark:bg-zinc-950 min-w-0 max-w-full">
      {messages.map((msg, idx) => {
        // Render system status feedback events
        if (msg.role === "system") {
          return (
            <div key={idx} className="flex justify-center my-1 min-w-0 max-w-full">
              <div className="px-3 py-1 rounded-full bg-slate-200/70 dark:bg-zinc-800 text-[11px] font-mono text-slate-600 dark:text-zinc-400 border border-slate-300/50 dark:border-zinc-700 flex items-center gap-1.5 shadow-2xs max-w-full truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                <span className="truncate">{msg.content.replace(/^\[System:\s*|\]$/g, "")}</span>
              </div>
            </div>
          );
        }

        if (msg.role === "user") {
          return (
            <div key={idx} className="flex justify-end group relative min-w-0 max-w-full">
              <div className="flex flex-col items-end max-w-[85%] sm:max-w-[88%] min-w-0">
                {/* User Message Bubble */}
                <div className="rounded-2xl rounded-tr-xs px-3.5 py-2.5 bg-indigo-600 text-white leading-relaxed shadow-xs whitespace-pre-wrap break-words [overflow-wrap:anywhere] min-w-0 max-w-full">
                  {msg.content}
                </div>

                {/* Mouse-over Action Toolbar for User Prompts */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1 mt-1 px-1 text-slate-500 dark:text-zinc-400">
                  <button
                    type="button"
                    onClick={() => handleCopyText(msg.content, idx, "prompt")}
                    title="Copy prompt"
                    className="p-1 rounded-md hover:bg-slate-200/80 dark:hover:bg-zinc-800 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors flex items-center gap-1 text-[11px] cursor-pointer"
                  >
                    {copiedMsgIdx === idx ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span className="text-[10px] hidden sm:inline">Copy prompt</span>
                      </>
                    )}
                  </button>

                  {onRerunPrompt && (
                    <button
                      type="button"
                      onClick={() => onRerunPrompt(msg.content)}
                      disabled={isLoading}
                      title="Re-run prompt"
                      className="p-1 rounded-md hover:bg-slate-200/80 dark:hover:bg-zinc-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1 text-[11px] cursor-pointer disabled:opacity-40"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span className="text-[10px] hidden sm:inline">Re-run</span>
                    </button>
                  )}

                  {onEditPrompt && (
                    <button
                      type="button"
                      onClick={() => onEditPrompt(msg.content)}
                      title="Edit in input bar"
                      className="p-1 rounded-md hover:bg-slate-200/80 dark:hover:bg-zinc-800 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors flex items-center gap-1 text-[11px] cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span className="text-[10px] hidden sm:inline">Edit</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        }

        // Assistant Message Role
        const { cleanContent, actions } = parseAssistantActions(msg.content);
        const sequenceSafety = validateActionSequenceSafety(actions, existingShotNumbers);
        const validActions = actions.filter((_, actIdx) => sequenceSafety[actIdx]?.valid);
        const unappliedCount = validActions.filter((act, actIdx) => {
          const actionKey = `${idx}_${act.type}_${act.type === "update_shot" ? act.shot_number : act.type === "update_character" ? act.character_name : actIdx}`;
          return !appliedActionKeys[actionKey] && !dismissedActionKeys[actionKey];
        }).length;

        // Find preceding user prompt for Re-run/Regenerate capability
        let precedingUserPrompt = "";
        for (let i = idx - 1; i >= 0; i--) {
          if (messages[i].role === "user") {
            precedingUserPrompt = messages[i].content;
            break;
          }
        }

        return (
          <div key={idx} className="flex gap-2.5 justify-start group relative min-w-0 max-w-full">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
              <Bot className="w-4 h-4" />
            </div>

            <div className="rounded-2xl rounded-tl-xs px-3.5 py-2.5 max-w-[85%] sm:max-w-[88%] min-w-0 overflow-hidden leading-relaxed bg-white text-slate-800 border border-slate-200/90 shadow-xs dark:bg-zinc-800/90 dark:text-zinc-200 dark:border-zinc-700/70">
              {cleanContent && (
                <div className="markdown-body prose prose-slate dark:prose-invert prose-sm max-w-none text-xs sm:text-sm space-y-2 text-slate-800 dark:text-zinc-200 break-words [overflow-wrap:anywhere] min-w-0 overflow-hidden">
                  <Markdown
                    components={{
                      pre: ({ children }) => <>{children}</>,
                      code: ({ node, inline, className, children, ...props }: any) => {
                        const match = /language-(\w+)/.exec(className || "");
                        const codeString = String(children || "").replace(/\n$/, "");
                        const isBlock = !inline && (Boolean(match) || codeString.includes("\n") || Boolean(className));

                        if (isBlock) {
                          return (
                            <PromptCodeBlock
                              codeText={codeString}
                              language={match ? match[1] : (className ? className.replace("language-", "") : "")}
                              onShowToast={onShowToast}
                            />
                          );
                        }

                        return (
                          <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-700 text-indigo-600 dark:text-indigo-400 font-mono text-[11.5px] break-all">
                            {children}
                          </code>
                        );
                      },
                      blockquote: ({ children }) => (
                        <MarkdownQuoteBlock onShowToast={onShowToast}>
                          {children}
                        </MarkdownQuoteBlock>
                      ),
                      p: ({ children }) => (
                        <p className="break-words [overflow-wrap:anywhere] leading-relaxed my-1.5 min-w-0">
                          {children}
                        </p>
                      ),
                      table: ({ children }) => (
                        <div className="max-w-full overflow-x-auto my-2 rounded-lg border border-slate-200 dark:border-zinc-700">
                          <table className="w-full text-left text-xs border-collapse min-w-[240px]">
                            {children}
                          </table>
                        </div>
                      ),
                      ul: ({ children }) => (
                        <ul className="list-disc pl-4 space-y-1 break-words [overflow-wrap:anywhere]">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="list-decimal pl-4 space-y-1 break-words [overflow-wrap:anywhere]">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => (
                        <li className="break-words [overflow-wrap:anywhere]">
                          {children}
                        </li>
                      ),
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 dark:text-indigo-400 underline break-all hover:text-indigo-500"
                        >
                          {children}
                        </a>
                      )
                    }}
                  >
                    {cleanContent}
                  </Markdown>
                </div>
              )}

              {/* Batch Action Group Header if multiple actions */}
              {actions.length > 1 && (
                <div className="mt-3 pt-2 border-t border-slate-200/80 dark:border-zinc-700 flex items-center justify-between gap-2 min-w-0">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 truncate">
                    Proposed Batch Changes ({actions.length})
                  </span>
                  {unappliedCount > 0 ? (
                    <button
                      onClick={() => onApplyAllActions(actions, idx)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-[11px] font-semibold transition-colors shadow-2xs cursor-pointer shrink-0"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Apply All ({unappliedCount})</span>
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium shrink-0">
                      <CheckCheck className="w-3.5 h-3.5" /> All Applied
                    </span>
                  )}
                </div>
              )}

              {/* Action Cards */}
              {actions.length > 0 && (
                <div className="space-y-2 mt-2 min-w-0 max-w-full">
                  {actions.map((act, actIdx) => {
                    const actionKey = `${idx}_${act.type}_${act.type === "update_shot" ? act.shot_number : act.type === "update_character" ? act.character_name : actIdx}`;
                    const isApplied = !!appliedActionKeys[actionKey];
                    const isDismissed = !!dismissedActionKeys[actionKey];
                    const safetyCheck = sequenceSafety[actIdx] || validateActionSafety(act, existingShotNumbers);

                    return (
                      <AssistantActionCard
                        key={actionKey}
                        action={act}
                        isApplied={isApplied}
                        isDismissed={isDismissed}
                        validationError={!safetyCheck.valid ? safetyCheck.reason : null}
                        shots={shots}
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

              {/* Mouse-over Action Toolbar for Assistant Replies */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1 mt-2.5 pt-1.5 border-t border-slate-100 dark:border-zinc-700/60 text-slate-400 dark:text-zinc-500">
                <button
                  type="button"
                  onClick={() => handleCopyText(cleanContent || msg.content, idx, "response")}
                  title="Copy response text"
                  className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-700/60 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors flex items-center gap-1 text-[11px] cursor-pointer"
                >
                  {copiedMsgIdx === idx ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Copied response</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="text-[10px] hidden sm:inline">Copy response</span>
                    </>
                  )}
                </button>

                {onRerunPrompt && precedingUserPrompt && (
                  <button
                    type="button"
                    onClick={() => onRerunPrompt(precedingUserPrompt)}
                    disabled={isLoading}
                    title={`Re-run prompt: "${precedingUserPrompt.slice(0, 40)}${precedingUserPrompt.length > 40 ? "..." : ""}"`}
                    className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-700/60 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1 text-[11px] cursor-pointer disabled:opacity-40"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span className="text-[10px] hidden sm:inline">Re-run</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Thinking / Loading State with timer and Cancel button */}
      {isLoading && (
        <div className="flex gap-2.5 justify-start">
          <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-indigo-600 shadow-2xs dark:bg-zinc-800 dark:border-zinc-700 dark:text-indigo-400 dark:shadow-none flex items-center justify-center shrink-0">
            <Clapperboard className="w-3.5 h-3.5 animate-pulse" />
          </div>
          <div className="rounded-2xl rounded-tl-xs px-3.5 py-2.5 bg-white border border-slate-200 text-slate-600 dark:bg-zinc-800/90 dark:border-zinc-700/70 dark:text-zinc-300 flex items-center gap-2.5 text-xs shadow-xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="font-medium">Consulting project dossier...</span>
            
            {/* Live Timer Counter */}
            <div className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-700/80 text-[11px] font-mono text-slate-600 dark:text-zinc-300 flex items-center gap-1 border border-slate-200 dark:border-zinc-600">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>
                {Math.floor(elapsedSeconds / 60)}:{(elapsedSeconds % 60).toString().padStart(2, "0")} / 5:00
              </span>
            </div>

            {/* Cancel Button */}
            {onCancelRequest && (
              <button
                onClick={onCancelRequest}
                className="ml-1 px-2 py-0.5 rounded-md bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/80 text-rose-600 dark:text-rose-400 text-[11px] font-semibold border border-rose-200 dark:border-rose-800 transition-colors flex items-center gap-1 cursor-pointer"
                title="Cancel request"
              >
                <X className="w-3 h-3" />
                <span>Cancel</span>
              </button>
            )}
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};
