import React, { useState, useEffect } from "react";
import { X, Save, FolderOpen, AlertCircle, Download, Upload, Plus, Trash2, Loader2, FileArchive } from "lucide-react";

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


