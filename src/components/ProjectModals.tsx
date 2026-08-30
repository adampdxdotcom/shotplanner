import React, { useState, useEffect } from "react";
import { X, Save, FolderOpen, AlertCircle, Download, Upload, Plus, Trash2 } from "lucide-react";

interface SaveProjectModalProps {
  currentProjectName?: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (filename: string) => Promise<void>;
}

export const SaveProjectModal: React.FC<SaveProjectModalProps> = ({ isOpen, onClose, onSave, currentProjectName }) => {
  const [filename, setFilename] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && currentProjectName) {
      setFilename(currentProjectName);
    } else if (isOpen) {
      setFilename("");
    }
  }, [isOpen, currentProjectName]);

  if (!isOpen) return null;

  const handleSaveAs = async () => {
    if (!filename.trim()) {
      setError("Please enter a filename.");
      return;
    }
    if (currentProjectName && filename.trim() === currentProjectName) {
      setError("Please choose a different name to save a copy.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(filename.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save project.");
    } finally {
      setSaving(false);
    }
  };

  const handleExportZip = async () => {
    const targetName = (filename.trim() || currentProjectName || "").replace(/\.json$/, "");
    if (!targetName) {
      setError("Please enter a project name before exporting.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Auto-save first so the server has the latest project configuration
      await onSave(targetName);

      // Fetch the zip as a blob to prevent navigating away on error
      const response = await fetch(`/api/projects/${encodeURIComponent(targetName)}/export`);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Export failed (HTTP ${response.status})`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `${targetName}.zip`;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(downloadUrl);
      link.remove();

      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to export project ZIP.");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!filename.trim()) {
      setError("Please enter a filename.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(filename.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save project.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-zinc-900 border-2 border-zinc-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/50">
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Save className="w-4 h-4 text-indigo-400" />
            Save Project
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Project Name (Filename)</label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="e.g. cyber_alley_scene_v1"
              className="w-full bg-zinc-950 border-2 border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors"
              autoFocus
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-400 leading-relaxed">{error}</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-zinc-800 bg-zinc-950/30 flex justify-between gap-3">
          <button 
            onClick={handleExportZip} 
            disabled={saving}
            className="px-4 py-2 text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2 border border-emerald-500/20 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            {saving ? "Exporting..." : "Export Zip"}
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors">
              Cancel
            </button>
            {currentProjectName && (
              <button 
                onClick={handleSaveAs} 
                disabled={saving}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                Save As
              </button>
            )}
            <button 
              onClick={handleSave} 
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-2"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export interface ProjectInfo {
  filename: string;
  display_name: string;
  mtime?: string;
  size?: number;
}

interface LoadProjectModalProps {
  onReloadProjects?: () => void;
  isOpen: boolean;
  onClose: () => void;
  onLoad: (filename: string) => Promise<void>;
}

export const LoadProjectModal: React.FC<LoadProjectModalProps> = ({ isOpen, onClose, onLoad }) => {
  const [uploadingZip, setUploadingZip] = useState(false);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFile, setLoadingFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    }
  }, [isOpen]);

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploadingZip(true);
    setError(null);
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/projects/import", {
        method: "POST",
        body: formData
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to import project.");
      }
      const data = await res.json();
      
      // refresh list
      const listRes = await fetch("/api/projects");
      const listData = await listRes.json();
      if (listData.projects) {
        const mapped = listData.projects.map((p: any) => 
          typeof p === "string" 
            ? { filename: p, display_name: p.replace(/\.json$/i, ""), mtime: "", size: 0 } 
            : p
        );
        setProjects(mapped);
      }
      
      // automatically load it
      if (data.filename) {
        await handleLoad(data.filename);
      }
    } catch (err: any) {
      setError(err.message || "Failed to import zip.");
    } finally {
      setUploadingZip(false);
      e.target.value = ''; // reset
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
      setProjects(prev => prev.filter(p => p !== filename));
    } catch (err: any) {
      setError(err.message || "Failed to delete project.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-zinc-900 border-2 border-zinc-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/50 shrink-0">
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-indigo-400" />
            Load Project
          </h3>
          <div className="flex items-center gap-2">
            <label className="cursor-pointer px-3 py-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors flex items-center gap-1.5 border border-emerald-500/20">
              <Upload className="w-3.5 h-3.5" />
              {uploadingZip ? "Uploading..." : "Upload Zip"}
              <input type="file" accept=".zip" className="hidden" onChange={handleZipUpload} disabled={uploadingZip} />
            </label>
            <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto space-y-2 flex-1">
          {error && (
            <div className="p-3 mb-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-400 leading-relaxed">{error}</p>
            </div>
          )}

          {loading ? (
            <p className="text-xs text-zinc-500 text-center py-4">Loading projects...</p>
          ) : projects.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-4">No projects saved yet.</p>
          ) : (
            <div className="space-y-2">
              {projects.map((p) => {
                const dateStr = p.mtime ? new Date(p.mtime).toLocaleString() : "";
                const sizeStr = p.size ? (p.size / 1024).toFixed(1) + " KB" : "";
                
                return (
                <div key={p.filename} className="flex items-center gap-2 group/row">
                  <button
                    onClick={() => handleLoad(p.filename)}
                    disabled={loadingFile !== null}
                    className="flex-1 text-left px-4 py-3 bg-zinc-950/50 hover:bg-zinc-800 border-2 border-zinc-700/80 hover:border-zinc-700 rounded-lg transition-colors flex items-center justify-between min-w-0"
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
                      <span className="text-xs text-indigo-400 ml-2 shrink-0">Loading...</span>
                    ) : (
                      <span className="text-[11px] text-zinc-500 group-hover:text-zinc-300 transition-colors ml-2 shrink-0">Load</span>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(p.filename);
                    }}
                    disabled={loadingFile !== null}
                    className="p-3 bg-zinc-950/50 hover:bg-red-950/60 text-zinc-500 hover:text-red-400 border-2 border-zinc-700/80 hover:border-red-900/50 rounded-lg transition-colors shrink-0"
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
    </div>
  );
};

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (sceneName: string) => Promise<void>;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [sceneName, setSceneName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSceneName("");
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!sceneName.trim()) {
      setError("Please enter a scene name.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await onCreate(sceneName.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create new scene.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-zinc-900 border-2 border-zinc-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/50">
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Plus className="w-4 h-4 text-amber-500" />
            New Scene
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Scene Name</label>
            <input
              type="text"
              value={sceneName}
              onChange={(e) => setSceneName(e.target.value)}
              placeholder="e.g. Desert Car Chase"
              className="w-full bg-zinc-950 border-2 border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500 transition-colors"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreate();
                }
              }}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-400 leading-relaxed">{error}</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-zinc-800 bg-zinc-950/30 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button 
            onClick={handleCreate} 
            disabled={creating}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-2"
          >
            {creating ? "Creating..." : "Create Scene"}
          </button>
        </div>
      </div>
    </div>
  );
};
