import React from "react";
import { AssistantAction } from "../../types/assistantActions";
import { DismissedActionBadge } from "./actionCards/DismissedActionBadge";
import { ValidationGuardrailCard } from "./actionCards/ValidationGuardrailCard";
import { UpdateShotActionCard } from "./actionCards/UpdateShotActionCard";
import { AddShotActionCard } from "./actionCards/AddShotActionCard";
import { UpdateScenePlanningActionCard } from "./actionCards/UpdateScenePlanningActionCard";
import { UpdateCharacterActionCard } from "./actionCards/UpdateCharacterActionCard";
import { StageShotAssetsActionCard } from "./actionCards/StageShotAssetsActionCard";
import { ExpandShotPromptActionCard } from "./actionCards/ExpandShotPromptActionCard";
import { CharacterProfile, MediaAsset } from "../../types";

interface AssistantActionCardProps {
  action: AssistantAction;
  isApplied: boolean;
  isDismissed?: boolean;
  validationError?: string | null;
  characters?: Record<string, CharacterProfile>;
  assets?: MediaAsset[];
  sceneName?: string;
  onNavigateToSection?: (section: string) => void;
  onApply: (action: AssistantAction) => void;
  onDismiss?: (action: AssistantAction) => void;
  onUndo?: (action: AssistantAction) => void;
  stagingProgress?: {
    status: "idle" | "staging" | "success" | "error";
    progress: number;
    message?: string;
  };
  expandingProgress?: {
    status: "idle" | "expanding" | "success" | "error";
    message?: string;
  };
}

/**
 * Assistant Action Card Dispatcher.
 * Delegates rendering to specialized sub-cards based on action type,
 * safety validation checks, and dismissal states.
 */
export const AssistantActionCard: React.FC<AssistantActionCardProps> = ({
  action,
  isApplied,
  isDismissed,
  validationError,
  characters,
  assets,
  sceneName,
  onNavigateToSection,
  onApply,
  onDismiss,
  onUndo,
  stagingProgress,
  expandingProgress
}) => {
  // If dismissed by user, render compact dismissed badge with restore option
  if (isDismissed) {
    return <DismissedActionBadge action={action} onApply={onApply} />;
  }

  // If safety validation failed (e.g. shot target does not exist), render guardrail card
  if (validationError) {
    return (
      <ValidationGuardrailCard
        action={action}
        validationError={validationError}
        onDismiss={onDismiss}
      />
    );
  }

  switch (action.type) {
    case "update_shot":
      return (
        <UpdateShotActionCard
          action={action}
          isApplied={isApplied}
          characters={characters}
          assets={assets}
          sceneName={sceneName}
          onNavigateToSection={onNavigateToSection}
          onApply={onApply}
          onDismiss={onDismiss}
          onUndo={onUndo}
        />
      );

    case "add_shot":
      return (
        <AddShotActionCard
          action={action}
          isApplied={isApplied}
          characters={characters}
          assets={assets}
          sceneName={sceneName}
          onNavigateToSection={onNavigateToSection}
          onApply={onApply}
          onDismiss={onDismiss}
          onUndo={onUndo}
        />
      );

    case "update_scene_planning":
      return (
        <UpdateScenePlanningActionCard
          action={action}
          isApplied={isApplied}
          onApply={onApply}
          onDismiss={onDismiss}
          onUndo={onUndo}
        />
      );

    case "update_character":
      return (
        <UpdateCharacterActionCard
          action={action}
          isApplied={isApplied}
          onApply={onApply}
          onDismiss={onDismiss}
          onUndo={onUndo}
        />
      );

    case "stage_shot_assets":
      return (
        <StageShotAssetsActionCard
          action={action}
          isApplied={isApplied}
          onApply={onApply}
          onDismiss={onDismiss}
          stagingProgress={stagingProgress}
        />
      );

    case "expand_shot_prompt":
      return (
        <ExpandShotPromptActionCard
          action={action}
          isApplied={isApplied}
          onApply={onApply}
          onDismiss={onDismiss}
          expandingProgress={expandingProgress}
        />
      );

    default:
      return null;
  }
};
