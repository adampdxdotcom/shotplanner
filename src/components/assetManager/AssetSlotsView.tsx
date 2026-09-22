import React from "react";
import { MediaAsset } from "../../types";
import { AssetCard, EmptySlotCard } from "../AssetSlotGrid";
import { MAX_IMAGES, MAX_VIDEOS, MAX_AUDIOS } from "./AssetTabBar";

interface AssetSlotsViewProps {
  activeTab: "image" | "audio" | "video";
  draggingSlot: { type: string; localIdx: number; globalSlot: number } | null;
  dragOverSlot: number | null;
  getGlobalSlotIndex: (type: "image" | "audio" | "video", localIndex: number) => number;
  getAssetForGlobalSlot: (globalSlotStr: string) => MediaAsset | null;
  onEditAsset: (asset: MediaAsset) => void;
  onClearSlot: (type: "image" | "audio" | "video", idx: number) => void;
  onLightbox: (asset: MediaAsset) => void;
  onOpenUpload: (slot: { type: "image" | "audio" | "video"; index: number }) => void;
  onDragStart: (info: { type: string; localIdx: number; globalSlot: number }, e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (globalSlot: number, e: React.DragEvent) => void;
  onDragLeave: (globalSlot: number) => void;
  onDropOnSlot: (type: "image" | "audio" | "video", idx: number, e: React.DragEvent) => void;
}

/**
 * Grid rendering assigned asset cards and empty slot dropzones for the active media tab.
 */
export const AssetSlotsView: React.FC<AssetSlotsViewProps> = ({
  activeTab,
  draggingSlot,
  dragOverSlot,
  getGlobalSlotIndex,
  getAssetForGlobalSlot,
  onEditAsset,
  onClearSlot,
  onLightbox,
  onOpenUpload,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDropOnSlot
}) => {
  const currentMax = activeTab === "image" ? MAX_IMAGES : activeTab === "video" ? MAX_VIDEOS : MAX_AUDIOS;

  return (
    <div className={
      activeTab === "image"
        ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
        : activeTab === "video"
          ? "grid grid-cols-1 max-w-sm gap-4"
          : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
    }>
      {Array.from({ length: currentMax }).map((_, idx) => {
        const globalSlot = getGlobalSlotIndex(activeTab, idx);
        const asset = getAssetForGlobalSlot(globalSlot.toString());
        const isThisDragging = draggingSlot?.globalSlot === globalSlot;
        const isThisDragOver = dragOverSlot === globalSlot && !isThisDragging;
        
        return asset ? (
          <AssetCard 
            key={`slot-${activeTab}-${idx}-${asset.filename}`}
            asset={asset}
            idx={idx}
            type={activeTab}
            isDragging={isThisDragging}
            isDragOver={isThisDragOver}
            onEdit={() => onEditAsset(asset)}
            onDelete={() => onClearSlot(activeTab, idx)}
            onLightbox={() => onLightbox(asset)}
            onDragStart={(e) => onDragStart({ type: activeTab, localIdx: idx, globalSlot }, e)}
            onDragEnd={onDragEnd}
            onDragOver={(e) => onDragOver(globalSlot, e)}
            onDragLeave={() => onDragLeave(globalSlot)}
            onDrop={(e) => onDropOnSlot(activeTab, idx, e)}
          />
        ) : (
          <EmptySlotCard 
            key={`empty-${activeTab}-${idx}`}
            idx={idx}
            type={activeTab}
            isDragOver={isThisDragOver}
            onClick={() => onOpenUpload({ type: activeTab, index: idx })}
            onDragOver={(e) => onDragOver(globalSlot, e)}
            onDragLeave={() => onDragLeave(globalSlot)}
            onDrop={(e) => onDropOnSlot(activeTab, idx, e)}
          />
        );
      })}
    </div>
  );
};
