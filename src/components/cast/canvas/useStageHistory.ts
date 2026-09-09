import { StagedActorCanvasItem } from "./types";
import { useCallback, useRef, useState, useEffect } from "react";

const MAX_HISTORY_STEPS = 15;

export interface UseStageHistoryProps {
  actors: StagedActorCanvasItem[];
  onApplyActors: (actors: StagedActorCanvasItem[]) => void;
  isMaskingMode?: boolean;
}

export interface UseStageHistoryReturn {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  recordSnapshot: (customActors?: StagedActorCanvasItem[]) => void;
  historyLength: number;
  historyIndex: number;
}

/**
 * Deep clones the lightweight actor state objects so mutations don't corrupt history.
 */
function cloneActorsState(items: StagedActorCanvasItem[]): StagedActorCanvasItem[] {
  return items.map((a) => ({
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
    facing: a.facing,
  }));
}

/**
 * Compares two actor lists for meaningful transform or mask changes
 */
function areActorStatesEqual(a: StagedActorCanvasItem[], b: StagedActorCanvasItem[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const a1 = a[i];
    const b1 = b.find((item) => item.id === a1.id);
    if (!b1) return false;
    if (
      a1.xPercent !== b1.xPercent ||
      a1.yPercent !== b1.yPercent ||
      a1.scale !== b1.scale ||
      a1.isFlipped !== b1.isFlipped ||
      a1.zIndex !== b1.zIndex ||
      a1.cutoutDataUrl !== b1.cutoutDataUrl ||
      a1.maskDataUrl !== b1.maskDataUrl
    ) {
      return false;
    }
  }
  return true;
}

export function useStageHistory({
  actors,
  onApplyActors,
  isMaskingMode = false,
}: UseStageHistoryProps): UseStageHistoryReturn {
  // Stack of historical snapshots
  const [history, setHistory] = useState<StagedActorCanvasItem[][]>(() => [cloneActorsState(actors)]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  // Ref tracking latest actors to avoid stale closures during continuous drag/paint
  const currentActorsRef = useRef<StagedActorCanvasItem[]>(actors);
  currentActorsRef.current = actors;

  const isPerformingHistoryActionRef = useRef<boolean>(false);

  // Initialize stack if empty
  useEffect(() => {
    if (history.length === 0 && actors.length > 0) {
      setHistory([cloneActorsState(actors)]);
      setCurrentIndex(0);
    }
  }, [actors, history.length]);

  /**
   * Explicitly records a checkpoint (e.g. after pointerUp drag, pointerUp resize, mask stroke commit, flip, reorder)
   */
  const recordSnapshot = useCallback(
    (customActors?: StagedActorCanvasItem[]) => {
      if (isPerformingHistoryActionRef.current) return;

      const stateToRecord = customActors || currentActorsRef.current;
      setHistory((prevHistory) => {
        const activeHead = prevHistory[currentIndex];
        if (activeHead && areActorStatesEqual(activeHead, stateToRecord)) {
          return prevHistory; // No-op if identical to current snapshot
        }

        // Truncate any redo entries ahead of currentIndex
        const truncated = prevHistory.slice(0, currentIndex + 1);
        const nextStack = [...truncated, cloneActorsState(stateToRecord)];

        // Enforce max step limit (sliding window of 10-15 steps)
        if (nextStack.length > MAX_HISTORY_STEPS) {
          nextStack.shift();
        }

        return nextStack;
      });

      setCurrentIndex((prevIdx) => {
        const nextIdx = prevIdx + 1;
        return nextIdx >= MAX_HISTORY_STEPS ? MAX_HISTORY_STEPS - 1 : nextIdx;
      });
    },
    [currentIndex]
  );

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  const undo = useCallback(() => {
    if (!canUndo) return;
    const targetIdx = currentIndex - 1;
    const targetSnapshot = history[targetIdx];
    if (!targetSnapshot) return;

    isPerformingHistoryActionRef.current = true;
    setCurrentIndex(targetIdx);
    onApplyActors(cloneActorsState(targetSnapshot));

    setTimeout(() => {
      isPerformingHistoryActionRef.current = false;
    }, 50);
  }, [canUndo, currentIndex, history, onApplyActors]);

  const redo = useCallback(() => {
    if (!canRedo) return;
    const targetIdx = currentIndex + 1;
    const targetSnapshot = history[targetIdx];
    if (!targetSnapshot) return;

    isPerformingHistoryActionRef.current = true;
    setCurrentIndex(targetIdx);
    onApplyActors(cloneActorsState(targetSnapshot));

    setTimeout(() => {
      isPerformingHistoryActionRef.current = false;
    }, 50);
  }, [canRedo, currentIndex, history, onApplyActors]);

  // Global Keyboard Shortcuts (Ctrl+Z / Cmd+Z for Undo, Ctrl+Y / Cmd+Shift+Z for Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing inside text inputs, textareas or contenteditables
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (!cmdOrCtrl) return;

      if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          // Redo via Cmd+Shift+Z or Ctrl+Shift+Z
          redo();
        } else {
          // Undo via Cmd+Z or Ctrl+Z
          undo();
        }
      } else if (e.key === "y" || e.key === "Y") {
        // Redo via Ctrl+Y on Windows/Linux
        if (!isMac) {
          e.preventDefault();
          e.stopPropagation();
          redo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    recordSnapshot,
    historyLength: history.length,
    historyIndex: currentIndex,
  };
}
