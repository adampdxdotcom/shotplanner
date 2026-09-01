import React, { useState } from "react";
import { X, UploadCloud, FileText, Music, Image as ImageIcon, Loader2, Check } from "lucide-react";
import { formatSize } from "../../utils/formatters";
import { MediaAsset } from "../../types";

export interface BulkQueueItem {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
}

interface GalleryBulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: string[];
  defaultSubject?: string;
  sceneName?: string;
  onAssetUploaded: (asset: MediaAsset) => void;
  onRegisterSubject: (name: string) => void;
}

export const GalleryBulkUploadModal: React.FC<GalleryBulkUploadModalProps> = ({
  isOpen, onClose, subjects, defaultSubject, sceneName, onAssetUploaded, onRegisterSubject
}) => {
  const [bulkQueue, setBulkQueue] = useState<BulkQueueItem[]>([]);
  const [bulkSubject, setBulkSubject] = useState(defaultSubject || "");
  const [bulkDescription, setBulkDescription] = useState("");
  const [bulkAssetType, setBulkAssetType] = useState(defaultSubject ? "Body Reference" : "Scene Reference");
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [bulkDragActive, setBulkDragActive] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      if (defaultSubject) {
        setBulkSubject(defaultSubject);
        setBulkAssetType("Body Reference");
      }
    }
  }, [isOpen, defaultSubject]);

  if (!isOpen) return null;

  const handleBulkDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setBulkDragActive(true);
    else if (e.type === "dragleave") setBulkDragActive(false);
  };

  const handleBulkDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBulkDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      setBulkQueue(prev => [...prev, ...files.map(f => ({ file: f, progress: 0, status: "pending" as const }))]);
    }
  };

  const handleBulkFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      setBulkQueue(prev => [...prev, ...files.map(f => ({ file: f, progress: 0, status: "pending" as const }))]);
    }
  };

  const removeQueueItem = (idx: number) => {
    setBulkQueue(prev => prev.filter((_, i) => i !== idx));
  };

  const runBulkUpload = async () => {
    setIsBulkUploading(true);
    let anySuccess = false;
    
    for (let i = 0; i < bulkQueue.length; i++) {
      if (bulkQueue[i].status === "success") continue;
      
      setBulkQueue(prev => {
        const newQueue = [...prev];
        newQueue[i].status = "uploading";
        newQueue[i].progress = 10;
        return newQueue;
      });
      
      const formData = new FormData();
      formData.append("file", bulkQueue[i].file);
      if (sceneName) {
        formData.append("scene_name", sceneName);
      }
      formData.append("subject_name", bulkSubject);
      formData.append("type", bulkAssetType);
      formData.append("description", bulkDescription);
      
      try {
        const res = await fetch("/api/assets/upload", { method: "POST", body: formData });
        setBulkQueue(prev => {
          const newQueue = [...prev];
          newQueue[i].progress = 90;
          return newQueue;
        });
        if (res.ok) {
          const newAsset = await res.json();
          onAssetUploaded(newAsset);
          anySuccess = true;
          setBulkQueue(prev => {
            const newQueue = [...prev];
            newQueue[i].status = "success";
            newQueue[i].progress = 100;
            return newQueue;
          });
          if (bulkSubject && !subjects.includes(bulkSubject)) {
            onRegisterSubject(bulkSubject);
          }
        } else {
          const text = await res.text();
          throw new Error(text || "Upload failed");
        }
      } catch (e: any) {
        setBulkQueue(prev => {
          const newQueue = [...prev];
          newQueue[i].status = "error";
          newQueue[i].error = e.message;
          return newQueue;
        });
      }
    }
    
    setIsBulkUploading(false);
    if (anySuccess && bulkQueue.every(item => item.status === "success")) {
      setTimeout(() => {
        onClose();
        setBulkQueue([]);
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border-2 border-zinc-700 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/50 shrink-0">
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-amber-400 animate-pulse" />
            Bulk Library Upload
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors" disabled={isBulkUploading}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-4">
            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Batch Defaults (Applies to all files)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Default Subject Name</label>
                <input
                  type="text"
                  value={bulkSubject}
                  onChange={e => setBulkSubject(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-zinc-200 outline-none"
                  disabled={isBulkUploading}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Default Semantic Type</label>
                <select
                  value={bulkAssetType}
                  onChange={e => setBulkAssetType(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500 rounded-lg px-2.5 py-2 text-xs text-zinc-200 outline-none"
                  disabled={isBulkUploading}
                >
                  <option value="Headshot">Headshot</option>
                  <option value="Body Reference">Body Reference</option>
                  <option value="Scene Reference">Scene Reference</option>
                  <option value="Object Reference">Object Reference</option>
                  <option value="Style Reference">Style Reference</option>
                  <option value="Voiceover Audio">Voiceover Audio</option>
                  <option value="Soundtrack / BGM">Soundtrack / BGM</option>
                  <option value="SFX / Ambient">SFX / Ambient</option>
                  <option value="Motion Reference Video">Motion Reference Video</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Default Description</label>
              <textarea
                value={bulkDescription}
                onChange={e => setBulkDescription(e.target.value)}
                placeholder="Brief description applied to all uploaded assets..."
                rows={2}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-zinc-200 outline-none resize-none"
                disabled={isBulkUploading}
              />
            </div>
          </div>

          <div
            className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all ${
              bulkDragActive ? "border-amber-500 bg-amber-500/10" : "border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800"
            }`}
            onDragEnter={handleBulkDrag}
            onDragLeave={handleBulkDrag}
            onDragOver={handleBulkDrag}
            onDrop={handleBulkDrop}
          >
            <div className="absolute inset-0 z-0 flex items-center justify-center opacity-5 pointer-events-none">
              <UploadCloud className="w-32 h-32 text-white" />
            </div>
            
            <div className="relative z-10 flex flex-col items-center space-y-3">
              <div className="p-3 bg-zinc-800 rounded-full">
                <UploadCloud className="w-6 h-6 text-zinc-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-200 mb-1">Drag and drop files here</p>
                <p className="text-xs text-zinc-500">Supports images, audio, and video files</p>
              </div>
              <div className="pt-2">
                <label className="cursor-pointer inline-flex items-center justify-center px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white rounded-lg transition-colors border border-zinc-700">
                  <span>Browse Files</span>
                  <input type="file" multiple className="hidden" onChange={handleBulkFileSelect} disabled={isBulkUploading} />
                </label>
              </div>
            </div>
          </div>

          {bulkQueue.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 px-1">
                <span>Upload Queue ({bulkQueue.length})</span>
                {bulkQueue.some(i => i.status === 'success') && (
                  <span className="text-emerald-400">{bulkQueue.filter(i => i.status === 'success').length} Complete</span>
                )}
              </div>
              <div className="divide-y divide-zinc-850 max-h-[180px] overflow-y-auto border border-zinc-800 rounded-xl bg-zinc-950">
                {bulkQueue.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {item.file.type.startsWith("image/") ? (
                        <ImageIcon className="w-4 h-4 text-amber-500 shrink-0" />
                      ) : item.file.type.startsWith("audio/") ? (
                        <Music className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-zinc-600 shrink-0" />
                      )}
                      <div className="truncate min-w-0">
                        <p className="font-medium text-zinc-300 truncate">{item.file.name}</p>
                        <p className="text-[10px] text-zinc-500">{formatSize(item.file.size)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      {item.status === "pending" && (
                        <button
                          onClick={() => removeQueueItem(idx)}
                          disabled={isBulkUploading}
                          className="text-zinc-500 hover:text-zinc-300 p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {item.status === "uploading" && (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                          <span className="text-[10px] font-semibold text-amber-400">{item.progress}%</span>
                        </div>
                      )}
                      {item.status === "success" && (
                        <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/80 font-semibold flex items-center gap-1">
                          <Check className="w-3 h-3" /> Done
                        </span>
                      )}
                      {item.status === "error" && (
                        <span className="text-[10px] text-red-400 bg-red-950/80 px-2 py-0.5 rounded border border-red-800/80 font-semibold max-w-[150px] truncate" title={item.error}>
                          Error
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/50 flex justify-end gap-3 shrink-0">
          <button 
             onClick={onClose} 
             className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
             disabled={isBulkUploading}
          >
            Cancel
          </button>
          <button
            onClick={runBulkUpload}
            disabled={isBulkUploading || bulkQueue.length === 0 || bulkQueue.every(i => i.status === "success")}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-950 text-xs font-bold rounded-lg shadow-md transition-all flex items-center gap-2"
          >
            {isBulkUploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Uploading Batch...
              </>
            ) : (
              <>
                <UploadCloud className="w-3.5 h-3.5" />
                Upload Queue ({bulkQueue.filter(i => i.status !== "success").length} items)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
