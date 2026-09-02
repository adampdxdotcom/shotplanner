import React, { useRef, useState } from "react";
import { Camera, User, Image as ImageIcon, X, Check, Loader2, AlertCircle, Sparkles, Shirt } from "lucide-react";
import {
  getModifierConfig,
  detectActiveModifier,
  updateDescriptionWithModifier
} from "../../utils/assetModifiers";

export type CharacterPackSlotId = "headshot_facing" | "headshot_3_4" | "body_primary" | "body_secondary";

export interface CharacterPackSlot {
  id: CharacterPackSlotId;
  title: string;
  badge: string;
  icon: "camera" | "user" | "sparkles" | "shirt";
  assetType: "Headshot" | "Body Reference";
  file: File | null;
  previewUrl: string | null;
  description: string;
  defaultDescription: string;
  placeholder: string;
  status: "idle" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
}

export const INITIAL_PACK_SLOTS: CharacterPackSlot[] = [
  {
    id: "headshot_facing",
    title: "Headshot (Facing)",
    badge: "Facing",
    icon: "camera",
    assetType: "Headshot",
    file: null,
    previewUrl: null,
    description: "headshot facing, ",
    defaultDescription: "headshot facing, ",
    placeholder: "e.g. headshot facing, neutral expression, 8k portrait",
    status: "idle",
    progress: 0
  },
  {
    id: "headshot_3_4",
    title: "Headshot (3/4 Profile)",
    badge: "3/4 Angle",
    icon: "sparkles",
    assetType: "Headshot",
    file: null,
    previewUrl: null,
    description: "headshot 3/4 profile, ",
    defaultDescription: "headshot 3/4 profile, ",
    placeholder: "e.g. headshot 3/4 profile, dynamic rim lighting",
    status: "idle",
    progress: 0
  },
  {
    id: "body_primary",
    title: "Body Reference (Full Body)",
    badge: "Full Body",
    icon: "user",
    assetType: "Body Reference",
    file: null,
    previewUrl: null,
    description: "body reference full body, ",
    defaultDescription: "body reference full body, ",
    placeholder: "e.g. body reference full body, athletic build, standard outfit",
    status: "idle",
    progress: 0
  },
  {
    id: "body_secondary",
    title: "Body Reference (Upper Body / Outfit)",
    badge: "Upper Body",
    icon: "shirt",
    assetType: "Body Reference",
    file: null,
    previewUrl: null,
    description: "body reference upper body, ",
    defaultDescription: "body reference upper body, ",
    placeholder: "e.g. body reference upper body, winter tactical jacket, combat boots",
    status: "idle",
    progress: 0
  }
];

interface CharacterReferencePackGridProps {
  slots: CharacterPackSlot[];
  onUpdateSlot: (slotId: CharacterPackSlotId, updater: Partial<CharacterPackSlot>) => void;
  onClearSlot: (slotId: CharacterPackSlotId) => void;
  disabled?: boolean;
}

export const CharacterReferencePackGrid: React.FC<CharacterReferencePackGridProps> = ({
  slots,
  onUpdateSlot,
  onClearSlot,
  disabled = false
}) => {
  const [dragActiveSlot, setDragActiveSlot] = useState<CharacterPackSlotId | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleDragOver = (e: React.DragEvent, slotId: CharacterPackSlotId) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (dragActiveSlot !== slotId) {
      setDragActiveSlot(slotId);
    }
  };

  const handleDragLeave = (e: React.DragEvent, slotId: CharacterPackSlotId) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragActiveSlot === slotId) {
      setDragActiveSlot(null);
    }
  };

  const handleDrop = (e: React.DragEvent, slotId: CharacterPackSlotId) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveSlot(null);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        const previewUrl = URL.createObjectURL(file);
        onUpdateSlot(slotId, {
          file,
          previewUrl,
          status: "idle",
          progress: 0,
          error: undefined
        });
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, slotId: CharacterPackSlotId) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const previewUrl = URL.createObjectURL(file);
      onUpdateSlot(slotId, {
        file,
        previewUrl,
        status: "idle",
        progress: 0,
        error: undefined
      });
    }
    // Reset file input value so re-selecting same file triggers onChange
    if (e.target) e.target.value = "";
  };

  const renderIcon = (type: CharacterPackSlot["icon"]) => {
    switch (type) {
      case "camera":
        return <Camera className="w-3.5 h-3.5 text-amber-400" />;
      case "sparkles":
        return <Sparkles className="w-3.5 h-3.5 text-amber-300" />;
      case "shirt":
        return <Shirt className="w-3.5 h-3.5 text-blue-400" />;
      case "user":
      default:
        return <User className="w-3.5 h-3.5 text-indigo-400" />;
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Character Reference Pack (4-Slot Grid)
          </span>
          <span className="text-[10px] text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded-full border border-zinc-700/50">
            Optional Quick Setup
          </span>
        </div>
        <span className="text-[11px] text-zinc-500">
          {slots.filter(s => s.file !== null).length} of 4 slots ready
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {slots.map((slot) => {
          const isDragOver = dragActiveSlot === slot.id;
          const isPopulated = Boolean(slot.file && slot.previewUrl);

          return (
            <div
              key={slot.id}
              className={`flex flex-col bg-zinc-950 border rounded-xl overflow-hidden transition-all duration-200 ${
                isDragOver
                  ? "border-amber-400 ring-2 ring-amber-500/30 bg-amber-950/20"
                  : isPopulated
                  ? "border-zinc-700/80 shadow-md bg-zinc-900/60"
                  : "border-zinc-800/90 hover:border-zinc-700 bg-zinc-950/80"
              }`}
            >
              {/* Slot Header Banner */}
              <div className="px-2.5 py-1.5 bg-zinc-900/90 border-b border-zinc-800/70 flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  {renderIcon(slot.icon)}
                  <span className="text-[11px] font-semibold text-zinc-200 truncate" title={slot.title}>
                    {slot.title}
                  </span>
                </div>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                  slot.assetType === "Headshot"
                    ? "bg-amber-950/60 text-amber-300 border border-amber-800/50"
                    : "bg-blue-950/60 text-blue-300 border border-blue-800/50"
                }`}>
                  {slot.badge}
                </span>
              </div>

              {/* Upload Drop Container / Preview Container */}
              <div
                className="relative aspect-[4/3] bg-zinc-950/90 flex items-center justify-center p-2 group"
                onDragOver={(e) => handleDragOver(e, slot.id)}
                onDragLeave={(e) => handleDragLeave(e, slot.id)}
                onDrop={(e) => handleDrop(e, slot.id)}
              >
                <input
                  type="file"
                  accept="image/*"
                  ref={(el) => (fileInputRefs.current[slot.id] = el)}
                  onChange={(e) => handleFileChange(e, slot.id)}
                  className="hidden"
                  disabled={disabled}
                />

                {isPopulated ? (
                  <div className="relative w-full h-full rounded-lg overflow-hidden border border-zinc-800 bg-black flex items-center justify-center">
                    <img
                      src={slot.previewUrl!}
                      alt={slot.title}
                      className="w-full h-full object-cover"
                    />

                    {/* Overlay remove / change controls */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRefs.current[slot.id]?.click()}
                        disabled={disabled || slot.status === "uploading"}
                        className="px-2 py-1 bg-zinc-800/90 hover:bg-zinc-700 text-white text-[10px] font-medium rounded shadow transition-colors"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={() => onClearSlot(slot.id)}
                        disabled={disabled || slot.status === "uploading"}
                        className="p-1 bg-red-900/80 hover:bg-red-700 text-white rounded shadow transition-colors"
                        title="Remove image"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Status Badge Overlays */}
                    {slot.status === "uploading" && (
                      <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-1.5 p-2 text-amber-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-[10px] font-bold">{slot.progress}%</span>
                      </div>
                    )}
                    {slot.status === "success" && (
                      <div className="absolute top-1.5 right-1.5 bg-emerald-900/90 border border-emerald-600/80 text-emerald-200 px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 shadow">
                        <Check className="w-3 h-3" /> Ready
                      </div>
                    )}
                    {slot.status === "error" && (
                      <div className="absolute inset-0 bg-red-950/85 flex flex-col items-center justify-center gap-1 p-2 text-red-300 text-center">
                        <AlertCircle className="w-5 h-5 text-red-400" />
                        <span className="text-[9px] leading-tight max-w-[90%] line-clamp-2">{slot.error || "Upload failed"}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    onClick={() => !disabled && fileInputRefs.current[slot.id]?.click()}
                    className={`w-full h-full rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-center p-2 cursor-pointer transition-colors ${
                      isDragOver
                        ? "border-amber-400 bg-amber-500/10 text-amber-300"
                        : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/40 text-zinc-500 hover:text-zinc-400"
                    }`}
                  >
                    <div className="p-1.5 bg-zinc-900 rounded-full mb-1 border border-zinc-800">
                      <ImageIcon className="w-4 h-4 text-zinc-400" />
                    </div>
                    <span className="text-[10px] font-medium text-zinc-300">
                      {isDragOver ? "Drop image here" : "Click or drop image"}
                    </span>
                    <span className="text-[8px] text-zinc-500 mt-0.5">JPG, PNG, WEBP</span>
                  </div>
                )}
              </div>

              {/* Inline Description Editor */}
              <div className="p-2 bg-zinc-950/95 border-t border-zinc-850 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Prompt Description
                  </label>
                  {(() => {
                    const modConfig = getModifierConfig(slot.assetType);
                    if (!modConfig) return null;
                    const activeMod = detectActiveModifier(slot.description, slot.assetType);
                    return (
                      <select
                        value={activeMod}
                        onChange={(e) => {
                          const newDesc = updateDescriptionWithModifier(slot.description, slot.assetType, e.target.value);
                          onUpdateSlot(slot.id, { description: newDesc });
                        }}
                        disabled={disabled || slot.status === "uploading"}
                        className="bg-zinc-900 border border-zinc-800 text-[9px] text-amber-400 font-medium rounded px-1 py-0.5 outline-none"
                      >
                        <option value="">No modifier</option>
                        {modConfig.modifiers.map(m => (
                          <option key={m.id} value={m.modifier}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    );
                  })()}
                </div>
                <input
                  type="text"
                  value={slot.description}
                  onChange={(e) => onUpdateSlot(slot.id, { description: e.target.value })}
                  placeholder={slot.placeholder}
                  disabled={disabled || slot.status === "uploading"}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500 rounded px-2 py-1 text-[11px] text-zinc-200 placeholder-zinc-600 outline-none transition-colors"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
