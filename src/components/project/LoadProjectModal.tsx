import React, { useState, useEffect } from "react";
import { X, Save, FolderOpen, AlertCircle, Download, Upload, Plus, Trash2, Loader2, FileArchive } from "lucide-react";
import { UniverseIngestionModal } from "../cast/UniverseIngestionModal";
import { UniverseInspectionResult } from "../../types";

interface LoadProjectModalProps {
  onReloadProjects?: () => void;
  isOpen: boolean;
  onClose: () => void;
  onLoad: (filename: string) => Promise<void>;
}

export const LoadProjectModal: React.FC<LoadProjectModalProps> = ({ isOpen, onClose, onLoad }) => {
  const [uploadingZip, setUploadingZip] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFile, setLoadingFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Universe Ingestion State
  const [isUniverseModalOpen, setIsUniverseModalOpen] = useState(false);
  const [inspectionData, setInspectionData] = useState<UniverseInspectionResult | null>(null);
  const [tempZipPath, setTempZipPath] = useState<string | null>(null);
  const [activeZipFileName, setActiveZipFileName] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch("/api/projects")
        .then(res => res.json())
        .then(data => {
          if (data.projects) {
            const mapped = data.projects.map((p: any) => 
              typeof p === "string" 
                ? { filename: p, display_name: p.replace(/\.json$/i, ""), mtime: "", size: 0 } 
                : p
            );
            setProjects(mapped);
          }
        })
        .catch(err => setError("Failed to load project list."))
        .finally(() => setLoading(false));
    } else {
      setError(null);
      setLoadingFile(null);
      setUploadStatus(null);
      setUploadingZip(false);
      setIsUniverseModalOpen(false);
      setInspectionData(null);
      setTempZipPath(null);
    }
  }, [isOpen]);

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setActiveZipFileName(file.name);
    setUploadingZip(true);
    setUploadStatus(`Inspecting "${file.name}" for universe characters and assets...`);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      // First, run inspection pass
      const inspectRes = await fetch("/api/projects/inspect-zip", {
        method: "POST",
        body: formData
      });

      if (!inspectRes.ok) {
        let errMessage = `Failed to inspect project (HTTP ${inspectRes.status})`;
        try {
          const errData = await inspectRes.json();
          errMessage = errData.detail || errData.error || errMessage;
        } catch {}
        throw new Error(errMessage);
      }

      const inspectData = await inspectRes.json();
      
      // If there are Universe character conflicts or new universe characters in the archive
      if (inspectData.has_universe_data && inspectData.items && inspectData.items.length > 0) {
        setInspectionData(inspectData);
        setTempZipPath(inspectData.temp_file_path);
        setIsUniverseModalOpen(true);
        setUploadingZip(false);
        setUploadStatus(null);
        return;
      }

      // If no universe characters to inspect, proceed directly with extraction
      await completeImportWithResolutions(inspectData.temp_file_path, {});
    } catch (err: any) {
      console.error("ZIP import error:", err);
      setError(err.message || "Failed to import project archive.");
      setUploadingZip(false);
      setUploadStatus(null);
    } finally {
      e.target.value = ''; // reset input
    }
  };

  const completeImportWithResolutions = async (
    tempPath: string | null,
    resolutions: Record<string, "keep_local" | "overwrite" | "ingest_as_new">
  ) => {
    setUploadingZip(true);
    setUploadStatus("Finalizing extraction and updating Universe records...");
    setError(null);

    try {
      const res = await fetch("/api/projects/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          temp_file_path: tempPath,
          universe_resolutions: resolutions
        })
      });

      if (!res.ok) {
        let errMessage = `Failed to complete import (HTTP ${res.status})`;
        try {
          const errData = await res.json();
          errMessage = errData.detail || errData.error || errMessage;
        } catch {}
        throw new Error(errMessage);
      }

      const data = await res.json();
      setUploadStatus("Extraction complete! Refreshing projects...");
      
      // Refresh list
      const listRes = await fetch("/api/projects");
      if (listRes.ok) {
        const listData = await listRes.json();
        if (listData.projects) {
          const mapped = listData.projects.map((p: any) => 
            typeof p === "string" 
              ? { filename: p, display_name: p.replace(/\.json$/i, ""), mtime: "", size: 0 } 
              : p
          );
          setProjects(mapped);
        }
      }
      
      // Automatically load the newly imported scene
      if (data.filename) {
        await handleLoad(data.filename);
      }
    } catch (err: any) {
      console.error("Finalize import error:", err);
      setError(err.message || "Failed to complete import.");
    } finally {
      setUploadingZip(false);
      setUploadStatus(null);
      setIsUniverseModalOpen(false);
    }
  };

  if (!isOpen) return null;

  const handleLoad = async (filename: string) => {
    setLoadingFile(filename);
    setError(null);
    try {
      await onLoad(filename);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to load project.");
    } finally {
      setLoadingFile(null);
    }
  };

  const handleDelete = async (filename: string) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete the project "${filename}"? This action cannot be undone.`);
    if (!confirmDelete) return;

    setError(null);
    try {
      const res = await fetch(`/api/projects/${filename}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete project.");
      }
      setProjects(prev => prev.filter(p => p.filename !== filename));
      const listRes = await fetch("/api/projects");
      if (listRes.ok) {
        const listData = await listRes.json();
        if (listData.projects) {
          setProjects(listData.projects);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete project.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="modal-dialog-surface bg-zinc-900 border-2 border-zinc-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        
        <div className="modal-dialog-header flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/50 shrink-0">
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-indigo-400" />
            Load Project
          </h3>
          <div className="flex items-center gap-2">
            <label className={`cursor-pointer px-3 py-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors flex items-center gap-1.5 border border-emerald-500/20 ${uploadingZip ? "opacity-50 pointer-events-none cursor-not-allowed" : ""}`}>
              {uploadingZip ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  <span>Extracting...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Zip</span>
                </>
              )}
              <input type="file" accept=".zip" className="hidden" onChange={handleZipUpload} disabled={uploadingZip || loadingFile !== null} />
            </label>
            <button onClick={onClose} disabled={uploadingZip} className="text-zinc-400 hover:text-white disabled:opacity-50 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto space-y-2 flex-1">
          {/* ZIP Import Loading Feedback Banner */}
          {uploadingZip && (
            <div className="p-3.5 mb-3 bg-emerald-950/40 border border-emerald-500/30 rounded-lg flex items-center gap-3 animate-pulse">
              <Loader2 className="w-5 h-5 text-emerald-400 animate-spin shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-emerald-300">Importing Project Archive</p>
                <p className="text-[11px] text-zinc-400 truncate mt-0.5">{uploadStatus || "Streaming and unpacking media assets..."}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 mb-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-400 leading-relaxed">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
              <p className="text-xs text-zinc-500">Loading saved projects...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <FileArchive className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-xs text-zinc-400">No projects saved yet.</p>
              <p className="text-[11px] text-zinc-500">Click &quot;Upload Zip&quot; above to import a project archive up to 500MB.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {projects.map((p) => {
                const dateStr = p.mtime ? new Date(p.mtime).toLocaleString() : "";
                const sizeStr = p.size ? (p.size / 1024).toFixed(1) + " KB" : "";
                
                return (
                <div key={p.filename} className="flex items-center gap-2 group/row">
                  <button
                    onClick={() => handleLoad(p.filename)}
                    disabled={loadingFile !== null || uploadingZip}
                    className="flex-1 text-left px-4 py-3 bg-zinc-950/50 hover:bg-zinc-800 disabled:opacity-50 border-2 border-zinc-700/80 hover:border-zinc-700 rounded-lg transition-colors flex items-center justify-between min-w-0 cursor-pointer"
                  >
                    <div className="flex flex-col truncate">
                      <span className="text-sm text-zinc-200 truncate">{p.display_name}</span>
                      {(dateStr || sizeStr) && (
                        <span className="text-xs text-zinc-500 truncate mt-0.5">
                          {dateStr}{dateStr && sizeStr && " • "}{sizeStr}
                        </span>
                      )}
                    </div>
                    {loadingFile === p.filename ? (
                      <div className="flex items-center gap-1.5 text-xs text-indigo-400 ml-2 shrink-0">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Loading...</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-zinc-500 group-hover:text-zinc-300 transition-colors ml-2 shrink-0">Load</span>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(p.filename);
                    }}
                    disabled={loadingFile !== null || uploadingZip}
                    className="p-3 bg-zinc-950/50 hover:bg-red-950/60 disabled:opacity-50 text-zinc-500 hover:text-red-400 border-2 border-zinc-700/80 hover:border-red-900/50 rounded-lg transition-colors shrink-0 cursor-pointer"
                    title="Delete Project"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                </div>
              )})}
            </div>
          )}
        </div>
      </div>

      {/* Universe Ingestion & Conflict Resolution Modal */}
      <UniverseIngestionModal
        isOpen={isUniverseModalOpen}
        onClose={() => setIsUniverseModalOpen(false)}
        inspectionResult={inspectionData}
        tempFilePath={tempZipPath}
        archiveFileName={activeZipFileName}
        onConfirmImport={async (resolutions) => {
          await completeImportWithResolutions(tempZipPath, resolutions);
        }}
      />
    </div>
  );
};


export interface ProjectInfo {
  filename: string;
  display_name: string;
  mtime?: string;
  size?: number;
}
