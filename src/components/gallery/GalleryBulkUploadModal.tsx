import React from "react";
import { X, UploadCloud, MapPin } from "lucide-react";
import { CharacterReferencePackGrid } from "./CharacterReferencePackGrid";
import {
  BulkQueueItem,
  GalleryBulkUploadModalProps,
  useBulkUploadState,
  BulkUploadTargetHeader,
  BulkUploadGeneralDropzone,
  BulkUploadQueueList,
  BulkUploadFooter
} from "./bulk";

export type { BulkQueueItem, GalleryBulkUploadModalProps };

export const GalleryBulkUploadModal: React.FC<GalleryBulkUploadModalProps> = ({
  isOpen,
  onClose,
  subjects,
  defaultSubject,
  isLocation,
  characters,
  assets,
  sceneName,
  onAssetUploaded,
  onRegisterSubject
}) => {
  const {
    bulkSubject,
    entityMode,
    switchEntityMode,
    packSlots,
    handleUpdatePackSlot,
    handleClearPackSlot,
    bulkQueue,
    handleFilesAdded,
    handleRemoveQueueItem,
    bulkDescription,
    setBulkDescription,
    bulkAssetType,
    setBulkAssetType,
    bulkModifier,
    setBulkModifier,
    isBulkUploading,
    uploadSummary,
    handleSubjectChange,
    populatedPackSlots,
    totalPendingCount,
    runUnifiedUpload
  } = useBulkUploadState({
    isOpen,
    onClose,
    defaultSubject,
    isLocation,
    characters,
    assets,
    sceneName,
    onAssetUploaded,
    onRegisterSubject
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 dark:bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700/90 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-1.5 rounded-lg border ${
                entityMode === "location"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
              }`}
            >
              {entityMode === "location" ? (
                <MapPin className="w-4 h-4" />
              ) : (
                <UploadCloud className="w-4 h-4" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                {entityMode === "location"
                  ? "Library Bulk Upload & Location Reference Slots"
                  : "Library Bulk Upload & Character Reference Pack"}
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {entityMode === "location"
                  ? "Quickly populate location reference slots or batch upload assets to your library"
                  : "Quickly populate character reference slots or batch upload assets to your library"}
                {sceneName ? ` for "${sceneName}"` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            disabled={isBulkUploading}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* Top Target Subject Section */}
          <BulkUploadTargetHeader
            entityMode={entityMode}
            onSwitchEntityMode={switchEntityMode}
            bulkSubject={bulkSubject}
            onSubjectChange={handleSubjectChange}
            subjects={subjects}
            onRegisterSubject={onRegisterSubject}
            disabled={isBulkUploading}
          />

          {/* 4-Slot Reference Pack Panel */}
          <div className="bg-zinc-50 dark:bg-zinc-900/60 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800/90">
            <CharacterReferencePackGrid
              slots={packSlots}
              subjectName={bulkSubject}
              onUpdateSlot={handleUpdatePackSlot}
              onClearSlot={handleClearPackSlot}
              disabled={isBulkUploading}
              isLocationMode={entityMode === "location"}
            />
          </div>

          {/* General Bulk Upload Section */}
          <div className="space-y-4">
            <BulkUploadGeneralDropzone
              entityMode={entityMode}
              bulkAssetType={bulkAssetType}
              setBulkAssetType={setBulkAssetType}
              bulkModifier={bulkModifier}
              setBulkModifier={setBulkModifier}
              bulkDescription={bulkDescription}
              setBulkDescription={setBulkDescription}
              onFilesAdded={handleFilesAdded}
              disabled={isBulkUploading}
            />

            {/* General Bulk Queue List */}
            <BulkUploadQueueList
              queue={bulkQueue}
              onRemoveItem={handleRemoveQueueItem}
              disabled={isBulkUploading}
            />
          </div>
        </div>

        {/* Modal Footer / Action Bar */}
        <BulkUploadFooter
          uploadSummary={uploadSummary}
          populatedPackSlotsCount={populatedPackSlots.length}
          bulkQueueCount={bulkQueue.length}
          totalPendingCount={totalPendingCount}
          isBulkUploading={isBulkUploading}
          onClose={onClose}
          onUpload={runUnifiedUpload}
        />
      </div>
    </div>
  );
};
