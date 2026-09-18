import React from "react";
import { SceneProjectFile, ShotItem, PromptVariation } from "../../types";
import { VariationSelector } from "../workflow/VariationSelector";
import { TakeSelector } from "../TakeSelector";

interface PromptHeaderBarProps {
  sceneProject: SceneProjectFile;
  activeShotId: string | null;
  activeShot: ShotItem | null;
  onSelectShot: (id: string | null) => void;
  onUpdateShot: (updater: (prev: ShotItem) => ShotItem) => void;
  onUpdateSpecificShot?: (id: string, updater: (prev: ShotItem) => ShotItem) => void;
  onChangeExpandedPrompt: (val: string) => void;
  onChangeBasicStub: (val: string) => void;
  onShowToast?: (text: string, type: "success" | "error" | "info") => void;
  onReviewTake: (takeId: string) => void;
}

/**
 * Top control bar housing the shot selector dropdown, prompt variation strip,
 * and take management selector.
 */
export const PromptHeaderBar: React.FC<PromptHeaderBarProps> = ({
  sceneProject,
  activeShotId,
  activeShot,
  onSelectShot,
  onUpdateShot,
  onUpdateSpecificShot,
  onChangeExpandedPrompt,
  onChangeBasicStub,
  onShowToast,
  onReviewTake
}) => {
  return (
    <>
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
            {sceneProject.shots.map((s) => (
              <option key={s.id} value={s.id}>
                Shot {s.shot_number.toString().padStart(2, "0")} - {s.shot_type}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Prompt Variation History Strip */}
      {activeShot && activeShot.prompt_variations && activeShot.prompt_variations.length > 0 && (
        <div className="bg-white dark:bg-zinc-900/80 border border-amber-300 dark:border-amber-500/30 rounded-xl p-3 shadow-xs -mt-2">
          <VariationSelector
            variations={activeShot.prompt_variations}
            activeVariationId={activeShot.active_variation_id}
            shotNumber={activeShot.shot_number}
            onSelectVariation={(variation: PromptVariation) => {
              if (onUpdateSpecificShot && activeShotId) {
                onUpdateSpecificShot(activeShotId, (prev) => ({
                  ...prev,
                  expanded_prompt: variation.expanded_prompt,
                  basic_stub: variation.basic_stub || prev.basic_stub,
                  active_variation_id: variation.id,
                  status: "unstaged"
                }));
              } else {
                onUpdateShot((prev) => ({
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
            onDeleteVariation={(varId: string) => {
              if (onUpdateSpecificShot && activeShotId) {
                onUpdateSpecificShot(activeShotId, (prev) => {
                  const filtered = (prev.prompt_variations || []).filter((v) => v.id !== varId);
                  return {
                    ...prev,
                    prompt_variations: filtered,
                    active_variation_id: prev.active_variation_id === varId ? (filtered[filtered.length - 1]?.id || undefined) : prev.active_variation_id
                  };
                });
              } else {
                onUpdateShot((prev) => {
                  const filtered = (prev.prompt_variations || []).filter((v) => v.id !== varId);
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

      {/* Hero Take Selector */}
      {activeShot && activeShot.takes && activeShot.takes.length > 0 && (
        <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-xs -mt-2">
          <TakeSelector 
            shot={activeShot} 
            onSetHeroTake={(tid) => onUpdateShot((prev) => {
              const updatedTakes = (prev.takes || []).map((t) => ({
                ...t,
                is_hero: t.id === tid
              }));
              return { ...prev, hero_take_id: tid, takes: updatedTakes };
            })}
            onReviewTake={onReviewTake}
          />
        </div>
      )}
    </>
  );
};
