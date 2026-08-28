import React, { useState, useEffect } from "react";
import { X, Save, FolderOpen, AlertCircle } from "lucide-react";

interface SaveProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (filename: string) => Promise<void>;
}

export const SaveProjectModal: React.FC<SaveProjectModalProps> = ({ isOpen, onClose, onSave }) => {
  const [filename, setFilename] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!filename.trim()) {
      setError("Please enter a filename.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(filename);
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
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/30 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-2"
          >
            {saving ? "Saving..." : "Save Project"}
          </button>
        </div>
      </div>
    </div>
  );
};

interface LoadProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoad: (filename: string) => Promise<void>;
}

export const LoadProjectModal: React.FC<LoadProjectModalProps> = ({ isOpen, onClose, onLoad }) => {
  const [projects, setProjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFile, setLoadingFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch("/api/projects")
        .then(res => res.json())
        .then(data => {
          if (data.projects) setProjects(data.projects);
        })
        .catch(err => setError("Failed to load project list."))
        .finally(() => setLoading(false));
    } else {
      setError(null);
      setLoadingFile(null);
    }
  }, [isOpen]);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-zinc-900 border-2 border-zinc-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/50 shrink-0">
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-indigo-400" />
            Load Project
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
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
              {projects.map((p) => (
                <button
                  key={p}
                  onClick={() => handleLoad(p)}
                  disabled={loadingFile !== null}
                  className="w-full text-left px-4 py-3 bg-zinc-950/50 hover:bg-zinc-800 border-2 border-zinc-700 hover:border-zinc-700 rounded-lg transition-colors flex items-center justify-between group"
                >
                  <span className="text-sm text-zinc-200 truncate">{p}</span>
                  {loadingFile === p ? (
                    <span className="text-xs text-indigo-400">Loading...</span>
                  ) : (
                    <span className="text-xs text-zinc-500 group-hover:text-zinc-300 transition-colors">Load</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
