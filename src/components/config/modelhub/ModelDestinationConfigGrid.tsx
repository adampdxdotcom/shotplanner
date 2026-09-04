import React from "react";
import { HardDrive } from "lucide-react";
import { COMFYUI_MODEL_CATEGORIES, computeFullRemotePath } from "./modelHubConstants";

export interface ModelDestinationConfigGridProps {
  categoryPreset: string;
  onCategoryChange: (presetId: string) => void;
  targetDest: string;
  onTargetDestChange: (dest: string) => void;
  targetFilename: string;
  onTargetFilenameChange: (filename: string) => void;
  remoteComfyRoot?: string;
  accentColor?: "amber" | "blue";
}

export const ModelDestinationConfigGrid: React.FC<ModelDestinationConfigGridProps> = ({
  categoryPreset,
  onCategoryChange,
  targetDest,
  onTargetDestChange,
  targetFilename,
  onTargetFilenameChange,
  remoteComfyRoot = "/workspace/runpod-slim/ComfyUI",
  accentColor = "amber"
}) => {
  const isAmber = accentColor === "amber";
  const focusBorderClass = isAmber ? "focus:border-amber-500" : "focus:border-blue-500";
  const iconColorClass = isAmber ? "text-amber-400" : "text-blue-400";
  const selectId = isAmber ? "select-hf-category" : "select-civitai-category";

  return (
    <div className="space-y-4">
      {/* Destination Configuration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Category Preset Selector */}
        <div>
          <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
            Target Model Category
          </label>
          <select
            id={selectId}
            value={categoryPreset}
            onChange={(e) => onCategoryChange(e.target.value)}
            className={`w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-200 ${focusBorderClass} outline-none`}
          >
            {COMFYUI_MODEL_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label} {cat.subfolder ? `(${cat.subfolder})` : ""}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-neutral-400 mt-1">
            {COMFYUI_MODEL_CATEGORIES.find((c) => c.id === categoryPreset)?.description}
          </p>
        </div>

        {/* Subfolder override input */}
        <div>
          <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
            Destination Subfolder (Relative to ComfyUI Root)
          </label>
          <div className="relative">
            <input
              type="text"
              value={targetDest}
              onChange={(e) => {
                onTargetDestChange(e.target.value);
                onCategoryChange("custom");
              }}
              className={`w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-200 font-mono ${focusBorderClass} outline-none`}
            />
          </div>
          <p className="text-[11px] text-neutral-400 mt-1">
            Folder is automatically created if it does not exist on remote host.
          </p>
        </div>

        {/* Target Filename input */}
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
            Target Filename on Remote Host
          </label>
          <input
            type="text"
            value={targetFilename}
            onChange={(e) => onTargetFilenameChange(e.target.value)}
            className={`w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-200 font-mono ${focusBorderClass} outline-none`}
          />
        </div>
      </div>

      {/* Path confirmation callout */}
      <div className="bg-neutral-950/80 border border-neutral-800 rounded-lg p-3 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 font-semibold uppercase tracking-wider">
          <HardDrive className={`w-3.5 h-3.5 ${iconColorClass}`} />
          Full Remote Destination Path:
        </div>
        <div className="font-mono text-xs text-emerald-300 bg-neutral-900/90 px-2.5 py-1.5 rounded border border-neutral-800 break-all select-all">
          {computeFullRemotePath(targetDest, targetFilename, remoteComfyRoot)}
        </div>
      </div>
    </div>
  );
};
