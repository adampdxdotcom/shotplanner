import React, { useState, useEffect } from "react";
import { MediaAsset } from "../types";
import { Edit3, X, AlertCircle, UploadCloud, Undo2, Trash2, CheckCircle } from "lucide-react";
import { SubjectCombobox } from "./SubjectCombobox";

interface AssetEditModalProps {
  asset: MediaAsset | null;
  subjects: string[];
  characters: Record<string, any>;
  onRegisterSubject?: (name: string) => void;
  onClose: () => void;
  onAssetUpdated: (oldFilename: string, newAsset: MediaAsset) => void;
}

export const AssetEditModal: React.FC<AssetEditModalProps> = ({
  asset,
  subjects,
  characters,
  onRegisterSubject,
  onClose,
  onAssetUpdated
}) => {
  const [editType, setEditType] = useState<string>("");
  const [editSubjectName, setEditSubjectName] = useState<string>("");
  const [editDescription, setEditDescription] = useState<string>("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [isReplacingFile, setIsReplacingFile] = useState<boolean>(false);
  const [editDragActive, setEditDragActive] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (asset) {
      setEditType(asset.type || "");
      setEditSubjectName(asset.subject_name || "");
      setEditDescription(asset.description || "");
      setIsReplacingFile(false);
      setEditFile(null);
      setEditError(null);
    }
  }, [asset]);

  const handleEditFileSelected = (file: File | null) => {
    setEditFile(file);
    setIsReplacingFile(!!file);
    setEditError(null);
  };

  const handleRevertToOriginal = () => {
    setIsReplacingFile(false);
    setEditFile(null);
    setEditError(null);
  };

  const submitEdit = async () => {
    if (!asset) return;
    
    if (!editSubjectName.trim() || !editDescription.trim()) {
      setEditError("Subject name and description are required.");
      return;
    }

    setIsEditing(true);
    setEditError(null);

    const formData = new FormData();
    formData.append("original_filename", asset.filename);
    formData.append("type", editType);
    formData.append("subject_name", editSubjectName.trim());
    formData.append("description", editDescription.trim());

    if (isReplacingFile && editFile) {
      formData.append("file", editFile);
    } else {
      formData.append("keep_original_file", "true");
    }

    try {
      const res = await fetch("/api/assets/update", {
        method: "PUT",
        body: formData
      });

      if (!res.ok) {
        let errStr = "Failed to update asset";
        try {
          const eJson = await res.json();
          errStr = eJson.error || errStr;
        } catch {}
        throw new Error(errStr);
      }

      const data = await res.json();
      
      onAssetUpdated(asset.filename, data.asset);
      onClose();
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setIsEditing(false);
    }
  };

  if (!asset) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border-2 border-zinc-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/50">
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-indigo-400" />
            Edit Asset
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-4 space-y-4 overflow-y-auto max-h-[70vh]">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Asset Type</label>
            <input
              type="text"
              value={editType}
              onChange={(e) => setEditType(e.target.value)}
              className="w-full bg-zinc-950 border-2 border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-indigo-500 transition-colors outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Subject / Entity Name</label>
            <SubjectCombobox
              value={editSubjectName}
              onChange={setEditSubjectName}
              subjects={subjects}
              characters={characters}
              onRegisterSubject={onRegisterSubject}
              assetType={editType}
              placeholder="e.g., John Doe"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Visual Description</label>
            <textarea 
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={3}
              className="w-full bg-zinc-950 border-2 border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-indigo-500 transition-colors outline-none resize-none"
            />
          </div>
          
          <div className="pt-2 border-t border-zinc-800/50">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-zinc-400">Media File</label>
              {!isReplacingFile && (
                <button
                  type="button"
                  onClick={() => setIsReplacingFile(true)}
                  className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded transition-colors"
                >
                  Replace File
                </button>
              )}
            </div>
            
            {!isReplacingFile ? (
              <div className="flex items-center gap-3 p-3 bg-zinc-950/50 border border-zinc-800 rounded-lg opacity-70">
                <div className="w-10 h-10 bg-zinc-800 rounded flex items-center justify-center shrink-0">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                </div>
                <div className="overflow-hidden flex-1">
                  <p className="text-xs text-zinc-300 truncate font-mono">{asset.filename}</p>
                  <p className="text-[10px] text-zinc-500">Original file preserved</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {editFile ? (
                  <div className="border border-amber-600/30 bg-amber-950/20 rounded-lg overflow-hidden">
                    <div className="p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 bg-amber-900/40 rounded flex items-center justify-center shrink-0">
                          <UploadCloud className="w-4 h-4 text-amber-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-amber-200 truncate">{editFile.name}</p>
                          <p className="text-[10px] text-amber-500/70">{(editFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-2.5 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={handleRevertToOriginal}
                        className="px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 transition-colors"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        <span>Keep original file</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditFileSelected(null)}
                        className="px-2.5 py-1 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/50 rounded-md text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onDragEnter={(e) => { e.preventDefault(); setEditDragActive(true); }}
                    onDragOver={(e) => { e.preventDefault(); setEditDragActive(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setEditDragActive(false); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setEditDragActive(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleEditFileSelected(e.dataTransfer.files[0]);
                      }
                    }}
                    className={`relative w-full flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-all ${
                      editDragActive
                        ? "border-amber-400 bg-amber-500/10"
                        : "border-zinc-700 hover:border-amber-500/80 bg-zinc-950/60 hover:bg-zinc-900/60 cursor-pointer"
                    }`}
                  >
                    <label className="w-full flex flex-col items-center justify-center cursor-pointer">
                      <UploadCloud className="w-8 h-8 mb-2 text-amber-400 animate-pulse" />
                      <p className="text-xs font-semibold text-zinc-200 text-center">
                        Select Replacement {asset.media_type ? asset.media_type.toUpperCase() : "MEDIA"} File
                      </p>
                      <p className="text-[11px] text-zinc-400 text-center mt-1">
                        Click to browse files or drag and drop here
                      </p>
                      <input
                        type="file"
                        accept={asset.media_type === "image" ? "image/*" : asset.media_type === "audio" ? "audio/*" : "video/*"}
                        onChange={(e) => handleEditFileSelected(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleRevertToOriginal}
                      className="mt-3 text-[11px] text-zinc-400 hover:text-zinc-200 underline flex items-center gap-1"
                    >
                      <Undo2 className="w-3 h-3" />
                      Cancel replacement & keep original
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {editError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{editError}</p>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/30 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button 
            onClick={submitEdit} 
            disabled={isEditing}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2"
          >
            {isEditing ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};
