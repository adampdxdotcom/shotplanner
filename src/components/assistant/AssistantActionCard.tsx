import React from "react";
import { 
  Check, 
  Sparkles, 
  PlusCircle, 
  ArrowRight,
  Camera,
  Undo2,
  BookOpen,
  User,
  Palette,
  MapPin,
  Sliders,
  UploadCloud,
  Wand2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  AlertTriangle
} from "lucide-react";
import { AssistantAction } from "../../types/assistantActions";

interface AssistantActionCardProps {
  action: AssistantAction;
  isApplied: boolean;
  isDismissed?: boolean;
  validationError?: string | null;
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

export const AssistantActionCard: React.FC<AssistantActionCardProps> = ({
  action,
  isApplied,
  isDismissed,
  validationError,
  onApply,
  onDismiss,
  onUndo,
  stagingProgress,
  expandingProgress
}) => {
  // If dismissed by user, render compact dismissed badge with restore option
  if (isDismissed) {
    return (
      <div className="mt-2.5 p-2 rounded-lg border border-slate-200/60 dark:border-zinc-800 bg-slate-100/50 dark:bg-zinc-900/50 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-500">
        <span className="flex items-center gap-1.5 italic text-[11px]">
          <X className="w-3.5 h-3.5 opacity-60" />
          Dismissed suggestion {action.title ? `(${action.title})` : ""}
        </span>
        {onApply && (
          <button
            onClick={() => onApply(action)}
            className="text-[10.5px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
          >
            Restore & Apply
          </button>
        )}
      </div>
    );
  }

  // If safety validation failed (e.g. shot number does not exist in scene), render guardrail card
  if (validationError) {
    return (
      <div className="mt-3 p-3 rounded-xl border border-amber-300 dark:border-amber-800/80 bg-amber-50/80 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-xs w-full min-w-0 overflow-hidden">
        <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-amber-200 dark:border-amber-900 min-w-0">
          <div className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-100 min-w-0 flex-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="shrink-0">Target Not Found</span>
            {action.title && (
              <span className="text-amber-700 dark:text-amber-300 font-normal truncate min-w-0 flex-1">
                • {action.title}
              </span>
            )}
          </div>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200 shrink-0 whitespace-nowrap">
            Guardrail
          </span>
        </div>
        <p className="my-2 text-[11px] text-amber-800 dark:text-amber-300 break-words">
          {validationError}
        </p>
        {onDismiss && (
          <div className="mt-2 pt-1 border-t border-amber-200/80 dark:border-amber-900 flex justify-end">
            <button
              onClick={() => onDismiss(action)}
              className="px-2 py-1 rounded bg-amber-200/80 hover:bg-amber-300 dark:bg-amber-900 dark:hover:bg-amber-800 text-amber-900 dark:text-amber-100 text-[10.5px] font-medium transition-colors cursor-pointer shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    );
  }

  if (action.type === "update_shot") {
    const shotNum = action.shot_number;
    const changes = action.changes || {};

    return (
      <div className={`mt-3 p-3 rounded-xl border transition-all text-xs w-full min-w-0 overflow-hidden ${
        isApplied 
          ? "bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-200" 
          : "bg-slate-50 dark:bg-zinc-900/90 border-indigo-200/80 dark:border-indigo-500/30 shadow-xs"
      }`}>
        <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-200/70 dark:border-zinc-800 min-w-0">
          <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-zinc-100 min-w-0 flex-1">
            <Camera className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className="shrink-0">Update Shot #{shotNum}</span>
            {action.title && (
              <span className="text-slate-500 dark:text-zinc-400 font-normal truncate min-w-0 flex-1">
                • {action.title}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 shrink-0 whitespace-nowrap">
              Shot Update
            </span>
            {!isApplied && onDismiss && (
              <button
                onClick={() => onDismiss(action)}
                className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded transition-colors shrink-0 cursor-pointer"
                title="Dismiss suggestion"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Changes summary */}
        <div className="space-y-1 my-2 font-mono text-[11px] text-slate-700 dark:text-zinc-300">
          {changes.shot_name && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 dark:text-zinc-500">Name:</span>
              <strong className="text-slate-800 dark:text-zinc-200 font-medium">{changes.shot_name}</strong>
            </div>
          )}
          {changes.shot_type && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 dark:text-zinc-500">Framing:</span>
              <strong className="text-slate-800 dark:text-zinc-200 font-medium">{changes.shot_type}</strong>
            </div>
          )}
          {changes.lens_focal_length && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 dark:text-zinc-500">Lens:</span>
              <strong className="text-slate-800 dark:text-zinc-200 font-medium">{changes.lens_focal_length}</strong>
            </div>
          )}
          {changes.camera_movement && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 dark:text-zinc-500">Movement:</span>
              <strong className="text-slate-800 dark:text-zinc-200 font-medium">{changes.camera_movement}</strong>
            </div>
          )}
          {changes.camera_angle && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 dark:text-zinc-500">Angle:</span>
              <strong className="text-slate-800 dark:text-zinc-200 font-medium">{changes.camera_angle}</strong>
            </div>
          )}
          {changes.lighting_setup && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 dark:text-zinc-500">Lighting:</span>
              <span className="text-slate-800 dark:text-zinc-200">{changes.lighting_setup}</span>
            </div>
          )}
          {changes.basic_stub && (
            <div className="mt-1 pt-1 border-t border-slate-200/50 dark:border-zinc-800">
              <span className="text-slate-400 dark:text-zinc-500 block mb-0.5">Prompt Stub:</span>
              <p className="font-sans text-[11px] text-slate-800 dark:text-zinc-200 bg-white dark:bg-zinc-950 p-1.5 rounded border border-slate-200 dark:border-zinc-800">
                {changes.basic_stub}
              </p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="mt-2.5 pt-1.5 flex items-center justify-between gap-2 border-t border-slate-200/60 dark:border-zinc-800">
          {isApplied ? (
            <div className="flex items-center justify-between w-full">
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <Check className="w-3.5 h-3.5" /> Applied to Shot #{shotNum}
              </span>
              {onUndo && (
                <button
                  onClick={() => onUndo(action)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-200/80 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-[10.5px] font-semibold transition-colors cursor-pointer"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Undo</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 w-full">
              <button
                onClick={() => onApply(action)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Apply to Shot #{shotNum}</span>
                <ArrowRight className="w-3 h-3 ml-0.5" />
              </button>
              {onDismiss && (
                <button
                  onClick={() => onDismiss(action)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-200/70 hover:bg-slate-300/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 font-medium text-xs transition-colors cursor-pointer"
                  title="Dismiss suggestion"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (action.type === "add_shot") {
    const shotData = action.shot || (action as any).changes || {};

    return (
      <div className={`mt-3 p-3 rounded-xl border transition-all text-xs w-full min-w-0 overflow-hidden ${
        isApplied 
          ? "bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-200" 
          : "bg-slate-50 dark:bg-zinc-900/90 border-emerald-200/80 dark:border-emerald-500/30 shadow-xs"
      }`}>
        <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-200/70 dark:border-zinc-800 min-w-0">
          <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-zinc-100 min-w-0 flex-1">
            <PlusCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="shrink-0">Add New Shot</span>
            {action.title && (
              <span className="text-slate-500 dark:text-zinc-400 font-normal truncate min-w-0 flex-1">
                • {action.title}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 shrink-0 whitespace-nowrap">
              New Shot
            </span>
            {!isApplied && onDismiss && (
              <button
                onClick={() => onDismiss(action)}
                className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded transition-colors shrink-0 cursor-pointer"
                title="Dismiss suggestion"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Shot summary */}
        <div className="space-y-1 my-2 font-mono text-[11px] text-slate-700 dark:text-zinc-300">
          {shotData.shot_type && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 dark:text-zinc-500">Framing:</span>
              <strong className="text-slate-800 dark:text-zinc-200 font-medium">{shotData.shot_type}</strong>
            </div>
          )}
          {shotData.lens_focal_length && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 dark:text-zinc-500">Lens:</span>
              <strong className="text-slate-800 dark:text-zinc-200 font-medium">{shotData.lens_focal_length}</strong>
            </div>
          )}
          {shotData.camera_movement && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 dark:text-zinc-500">Movement:</span>
              <strong className="text-slate-800 dark:text-zinc-200 font-medium">{shotData.camera_movement}</strong>
            </div>
          )}
          {shotData.aspect_ratio && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 dark:text-zinc-500">Aspect Ratio:</span>
              <strong className="text-slate-800 dark:text-zinc-200 font-medium">{shotData.aspect_ratio}</strong>
            </div>
          )}
          {shotData.basic_stub && (
            <div className="mt-1 pt-1 border-t border-slate-200/50 dark:border-zinc-800">
              <span className="text-slate-400 dark:text-zinc-500 block mb-0.5">Prompt Stub:</span>
              <p className="font-sans text-[11px] text-slate-800 dark:text-zinc-200 bg-white dark:bg-zinc-950 p-1.5 rounded border border-slate-200 dark:border-zinc-800">
                {shotData.basic_stub}
              </p>
            </div>
          )}
        </div>

        {/* Action button */}
        <div className="mt-2.5 pt-1.5 border-t border-slate-200/60 dark:border-zinc-800">
          {isApplied ? (
            <div className="flex items-center justify-between w-full">
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <Check className="w-3.5 h-3.5" /> Added to Scene
              </span>
              {onUndo && (
                <button
                  onClick={() => onUndo(action)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-200/80 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-[10.5px] font-semibold transition-colors cursor-pointer"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Undo</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 w-full">
              <button
                onClick={() => onApply(action)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Add Shot to Scene</span>
                <ArrowRight className="w-3 h-3 ml-0.5" />
              </button>
              {onDismiss && (
                <button
                  onClick={() => onDismiss(action)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-200/70 hover:bg-slate-300/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 font-medium text-xs transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (action.type === "update_scene_planning") {
    const changes = action.changes || {};

    return (
      <div className={`mt-3 p-3 rounded-xl border transition-all text-xs w-full min-w-0 overflow-hidden ${
        isApplied 
          ? "bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-200" 
          : "bg-slate-50 dark:bg-zinc-900/90 border-amber-200/80 dark:border-amber-500/30 shadow-xs"
      }`}>
        <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-200/70 dark:border-zinc-800 min-w-0">
          <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-zinc-100 min-w-0 flex-1">
            <BookOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="shrink-0">Scene Planning & Context</span>
            {action.title && (
              <span className="text-slate-500 dark:text-zinc-400 font-normal truncate min-w-0 flex-1">
                • {action.title}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 shrink-0 whitespace-nowrap">
              Scene Planning
            </span>
            {!isApplied && onDismiss && (
              <button
                onClick={() => onDismiss(action)}
                className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded transition-colors shrink-0 cursor-pointer"
                title="Dismiss suggestion"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Planning details */}
        <div className="space-y-1.5 my-2 text-[11px] text-slate-700 dark:text-zinc-300">
          {changes.scene_name && (
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-slate-400 dark:text-zinc-500">Scene Name:</span>
              <strong className="text-slate-800 dark:text-zinc-200 font-medium">{changes.scene_name}</strong>
            </div>
          )}
          {changes.visual_theme && (
            <div className="flex items-start gap-1.5">
              <Palette className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-400 dark:text-zinc-500 mr-1 font-medium">Visual Theme:</span>
                <span className="text-slate-800 dark:text-zinc-200">{changes.visual_theme}</span>
              </div>
            </div>
          )}
          {changes.environment_description && (
            <div className="flex items-start gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-400 dark:text-zinc-500 mr-1 font-medium">Environment:</span>
                <span className="text-slate-800 dark:text-zinc-200">{changes.environment_description}</span>
              </div>
            </div>
          )}
          {changes.lighting_style && (
            <div className="flex items-start gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-400 dark:text-zinc-500 mr-1 font-medium">Lighting:</span>
                <span className="text-slate-800 dark:text-zinc-200">{changes.lighting_style}</span>
              </div>
            </div>
          )}
          {changes.camera_gear && (
            <div className="flex items-start gap-1.5">
              <Camera className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-400 dark:text-zinc-500 mr-1 font-medium">Camera Package:</span>
                <span className="text-slate-800 dark:text-zinc-200">{changes.camera_gear}</span>
              </div>
            </div>
          )}
          {changes.custom_instructions && (
            <div className="mt-1 pt-1 border-t border-slate-200/50 dark:border-zinc-800">
              <span className="text-slate-400 dark:text-zinc-500 block mb-0.5 font-medium">Director Notes:</span>
              <p className="font-sans text-[11px] text-slate-800 dark:text-zinc-200 bg-white dark:bg-zinc-950 p-1.5 rounded border border-slate-200 dark:border-zinc-800">
                {changes.custom_instructions}
              </p>
            </div>
          )}
        </div>

        {/* Action button */}
        <div className="mt-2.5 pt-1.5 flex items-center justify-between gap-2 border-t border-slate-200/60 dark:border-zinc-800">
          {isApplied ? (
            <div className="flex items-center justify-between w-full">
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <Check className="w-3.5 h-3.5" /> Scene Planning Applied
              </span>
              {onUndo && (
                <button
                  onClick={() => onUndo(action)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-200/80 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-[10.5px] font-semibold transition-colors cursor-pointer"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Undo</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 w-full">
              <button
                onClick={() => onApply(action)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                <span>Apply Scene Planning</span>
                <ArrowRight className="w-3 h-3 ml-0.5" />
              </button>
              {onDismiss && (
                <button
                  onClick={() => onDismiss(action)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-200/70 hover:bg-slate-300/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 font-medium text-xs transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (action.type === "update_character") {
    const charName = action.character_name || (action as any).name || "Character";
    const changes = action.changes || {};

    return (
      <div className={`mt-3 p-3 rounded-xl border transition-all text-xs w-full min-w-0 overflow-hidden ${
        isApplied 
          ? "bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-200" 
          : "bg-slate-50 dark:bg-zinc-900/90 border-purple-200/80 dark:border-purple-500/30 shadow-xs"
      }`}>
        <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-200/70 dark:border-zinc-800 min-w-0">
          <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-zinc-100 min-w-0 flex-1">
            <User className="w-3.5 h-3.5 text-purple-500 shrink-0" />
            <span className="shrink-0 truncate max-w-[140px]">Character: "{charName}"</span>
            {action.title && (
              <span className="text-slate-500 dark:text-zinc-400 font-normal truncate min-w-0 flex-1">
                • {action.title}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 shrink-0 whitespace-nowrap">
              Cast & Wardrobe
            </span>
            {!isApplied && onDismiss && (
              <button
                onClick={() => onDismiss(action)}
                className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded transition-colors shrink-0 cursor-pointer"
                title="Dismiss suggestion"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Character changes summary */}
        <div className="space-y-1 my-2 font-mono text-[11px] text-slate-700 dark:text-zinc-300">
          {changes.scene_outfit_ref && (
            <div className="flex items-start gap-1.5">
              <span className="text-slate-400 dark:text-zinc-500 shrink-0">Outfit / Wardrobe:</span>
              <span className="text-slate-800 dark:text-zinc-200 font-medium">{changes.scene_outfit_ref}</span>
            </div>
          )}
          {changes.notes && (
            <div className="flex items-start gap-1.5">
              <span className="text-slate-400 dark:text-zinc-500 shrink-0">Character Notes:</span>
              <p className="font-sans text-[11px] text-slate-800 dark:text-zinc-200 bg-white dark:bg-zinc-950 p-1.5 rounded border border-slate-200 dark:border-zinc-800 w-full">
                {changes.notes}
              </p>
            </div>
          )}
        </div>

        {/* Action button */}
        <div className="mt-2.5 pt-1.5 flex items-center justify-between gap-2 border-t border-slate-200/60 dark:border-zinc-800">
          {isApplied ? (
            <div className="flex items-center justify-between w-full">
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <Check className="w-3.5 h-3.5" /> Updated "{charName}"
              </span>
              {onUndo && (
                <button
                  onClick={() => onUndo(action)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-200/80 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-[10.5px] font-semibold transition-colors cursor-pointer"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Undo</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 w-full">
              <button
                onClick={() => onApply(action)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-200" />
                <span>Update Character Profile</span>
                <ArrowRight className="w-3 h-3 ml-0.5" />
              </button>
              {onDismiss && (
                <button
                  onClick={() => onDismiss(action)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-200/70 hover:bg-slate-300/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 font-medium text-xs transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Phase 3: Remote ComfyUI Staging
  if (action.type === "stage_shot_assets") {
    const shotNum = action.shot_number;
    const destPath = action.destination_path || "/workspace/ComfyUI/input/scene_...";
    const isStaging = stagingProgress?.status === "staging";
    const isSuccess = isApplied || stagingProgress?.status === "success";
    const isError = stagingProgress?.status === "error";

    return (
      <div className={`mt-3 p-3 rounded-xl border transition-all text-xs w-full min-w-0 overflow-hidden ${
        isSuccess
          ? "bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-200"
          : isError
          ? "bg-rose-50/90 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800/80 text-rose-900 dark:text-rose-200"
          : "bg-slate-50 dark:bg-zinc-900/90 border-cyan-200/80 dark:border-cyan-500/30 shadow-xs"
      }`}>
        <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-200/70 dark:border-zinc-800 min-w-0">
          <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-zinc-100 min-w-0 flex-1">
            <UploadCloud className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
            <span className="shrink-0">Remote ComfyUI Staging</span>
            {action.title && (
              <span className="text-slate-500 dark:text-zinc-400 font-normal truncate min-w-0 flex-1">
                • {action.title}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 shrink-0 whitespace-nowrap">
              Remote Staging
            </span>
            {!isSuccess && !isStaging && onDismiss && (
              <button
                onClick={() => onDismiss(action)}
                className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded transition-colors shrink-0 cursor-pointer"
                title="Dismiss suggestion"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Action description */}
        <div className="my-2 space-y-1.5">
          <p className="text-slate-700 dark:text-zinc-300">
            Ready to stage <strong>Shot #{shotNum}</strong> assets to remote host:
          </p>
          <div className="font-mono text-[10.5px] p-2 bg-slate-100 dark:bg-zinc-950 text-slate-800 dark:text-zinc-300 rounded border border-slate-200/80 dark:border-zinc-800 break-all">
            {destPath}
          </div>
        </div>

        {/* Real-time progress bar if staging */}
        {isStaging && (
          <div className="my-2 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400 font-medium">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>{stagingProgress?.message || "Transferring assets via SFTP..."}</span>
              </span>
              <span className="font-mono text-slate-500 dark:text-zinc-400">
                {Math.round(stagingProgress?.progress || 0)}%
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-cyan-500 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.max(5, stagingProgress?.progress || 0)}%` }}
              />
            </div>
          </div>
        )}

        {/* Error message */}
        {isError && stagingProgress?.message && (
          <div className="my-1.5 p-1.5 rounded bg-rose-100/80 dark:bg-rose-950 text-rose-700 dark:text-rose-300 flex items-center gap-1.5 text-[11px]">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{stagingProgress.message}</span>
          </div>
        )}

        {/* Action button */}
        <div className="mt-2.5 pt-1.5 border-t border-slate-200/60 dark:border-zinc-800">
          {isSuccess ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Staged Shot #{shotNum} to Remote ComfyUI
            </span>
          ) : (
            <div className="flex items-center gap-2 w-full">
              <button
                onClick={() => onApply(action)}
                disabled={isStaging}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 active:bg-cyan-800 disabled:opacity-50 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
              >
                {isStaging ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Staging Assets...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Stage Assets</span>
                    <ArrowRight className="w-3 h-3 ml-0.5" />
                  </>
                )}
              </button>
              {onDismiss && !isStaging && (
                <button
                  onClick={() => onDismiss(action)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-200/70 hover:bg-slate-300/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 font-medium text-xs transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Phase 3: Prompt Expansion Dispatcher
  if (action.type === "expand_shot_prompt") {
    const shotNum = action.shot_number;
    const isExpanding = expandingProgress?.status === "expanding";
    const isSuccess = isApplied || expandingProgress?.status === "success";
    const isError = expandingProgress?.status === "error";

    return (
      <div className={`mt-3 p-3 rounded-xl border transition-all text-xs w-full min-w-0 overflow-hidden ${
        isSuccess
          ? "bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-200"
          : isError
          ? "bg-rose-50/90 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800/80 text-rose-900 dark:text-rose-200"
          : "bg-slate-50 dark:bg-zinc-900/90 border-blue-200/80 dark:border-blue-500/30 shadow-xs"
      }`}>
        <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-200/70 dark:border-zinc-800 min-w-0">
          <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-zinc-100 min-w-0 flex-1">
            <Wand2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="shrink-0">Prompt Expansion Dispatcher</span>
            {action.title && (
              <span className="text-slate-500 dark:text-zinc-400 font-normal truncate min-w-0 flex-1">
                • {action.title}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 shrink-0 whitespace-nowrap">
              Prompt Expansion
            </span>
            {!isSuccess && !isExpanding && onDismiss && (
              <button
                onClick={() => onDismiss(action)}
                className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded transition-colors shrink-0 cursor-pointer"
                title="Dismiss suggestion"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Action description */}
        <div className="my-2 space-y-1">
          <p className="text-slate-700 dark:text-zinc-300">
            Dispatch LLM prompt expansion pipeline for <strong>Shot #{shotNum}</strong> to synthesize rich visual descriptors and populate take prompt.
          </p>
          {action.guidance && (
            <div className="font-sans text-[11px] p-2 bg-slate-100 dark:bg-zinc-950 text-slate-800 dark:text-zinc-300 rounded border border-slate-200/80 dark:border-zinc-800 italic">
              "{action.guidance}"
            </div>
          )}
        </div>

        {/* Error message */}
        {isError && expandingProgress?.message && (
          <div className="my-1.5 p-1.5 rounded bg-rose-100/80 dark:bg-rose-950 text-rose-700 dark:text-rose-300 flex items-center gap-1.5 text-[11px]">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{expandingProgress.message}</span>
          </div>
        )}

        {/* Action button */}
        <div className="mt-2.5 pt-1.5 border-t border-slate-200/60 dark:border-zinc-800">
          {isSuccess ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Prompt Expanded & Populated for Shot #{shotNum}
            </span>
          ) : (
            <div className="flex items-center gap-2 w-full">
              <button
                onClick={() => onApply(action)}
                disabled={isExpanding}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
              >
                {isExpanding ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Expanding Prompt...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Expand Shot #{shotNum} Prompt</span>
                    <ArrowRight className="w-3 h-3 ml-0.5" />
                  </>
                )}
              </button>
              {onDismiss && !isExpanding && (
                <button
                  onClick={() => onDismiss(action)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-200/70 hover:bg-slate-300/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 font-medium text-xs transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};
