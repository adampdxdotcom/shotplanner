import React, { useState, useEffect } from "react";
import { 
  X, 
  Save, 
  AlertCircle, 
  Download, 
  Loader2, 
  FileArchive, 
  Film, 
  CheckCircle2, 
  FolderArchive,
  Info,
  Sparkles,
  Clapperboard
} from "lucide-react";

interface ProjectTakesSummary {
  projectName: string;
  sceneName: string;
  totalShots: number;
  totalTakes: number;
  foundVideoFiles: number;
  totalSizeBytes: number;
  heroTakesCount: number;
  goodTakesCount: number;
  badTakesCount: number;
  unreviewedTakesCount: number;
  takesByShot: Array<{
    shotNumber: number;
    shotName: string;
    takesCount: number;
    foundFilesCount: number;
  }>;
}

interface SaveProjectModalProps {
  currentProjectName?: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (filename: string) => Promise<void>;
  sceneProject?: any;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${(bytes / 1024).toFixed(1)} KB`;
  if (mb > 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
}

export const SaveProjectModal: React.FC<SaveProjectModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  currentProjectName,
  sceneProject 
}) => {
  const [filename, setFilename] = useState("");
  const [saving, setSaving] = useState(false);
  const [exportingProject, setExportingProject] = useState(false);
  const [exportingTakes, setExportingTakes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [takesSummary, setTakesSummary] = useState<ProjectTakesSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  useEffect(() => {
    if (isOpen && currentProjectName) {
      setFilename(currentProjectName);
      fetchSummary(currentProjectName);
    } else if (isOpen) {
      setFilename("");
      setTakesSummary(null);
    }
  }, [isOpen, currentProjectName]);

  const fetchSummary = async (name: string) => {
    const clean = name.trim().replace(/\.json$/, "");
    if (!clean) return;
    setLoadingSummary(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(clean)}/takes-summary`);
      if (res.ok) {
        const data = await res.json();
        setTakesSummary(data);
      }
    } catch (e) {
      // Ignore background summary load errors
    } finally {
      setLoadingSummary(false);
    }
  };

  if (!isOpen) return null;

  const targetName = (filename.trim() || currentProjectName || "").replace(/\.json$/, "");

  // Calculate live take stats from sceneProject if available
  const localTakesCount = sceneProject?.shots?.reduce((acc: number, s: any) => acc + (s.takes?.length || 0), 0) ?? 0;
  const localHeroCount = sceneProject?.shots?.reduce((acc: number, s: any) => acc + (s.hero_take_id || s.takes?.some((t: any) => t.is_hero) ? 1 : 0), 0) ?? 0;

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

  const handleExportStandardZip = async () => {
    if (!targetName) {
      setError("Please enter a project name before exporting.");
      return;
    }
    setExportingProject(true);
    setError(null);
    try {
      // Auto-save first to ensure server holds latest project state
      await onSave(targetName);

      // Download lightweight standard project archive
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
      setError(err.message || "Failed to export standard project ZIP.");
    } finally {
      setExportingProject(false);
    }
  };

  const handleExportTakesZip = async () => {
    if (!targetName) {
      setError("Please enter a project name before exporting takes.");
      return;
    }
    setExportingTakes(true);
    setError(null);
    try {
      // Auto-save first
      await onSave(targetName);

      // Download takes archive
      const response = await fetch(`/api/projects/${encodeURIComponent(targetName)}/export-takes`);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Export takes failed (HTTP ${response.status})`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      const downloadFilename = takesSummary?.sceneName 
        ? `${takesSummary.sceneName}_takes.zip` 
        : `${targetName}_takes.zip`;
      link.download = downloadFilename;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(downloadUrl);
      link.remove();

      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to export video takes ZIP.");
    } finally {
      setExportingTakes(false);
    }
  };

  const isBusy = saving || exportingProject || exportingTakes;
  const displayTakesCount = takesSummary?.totalTakes ?? localTakesCount;
  const displayFoundFiles = takesSummary?.foundVideoFiles ?? 0;
  const displaySizeBytes = takesSummary?.totalSizeBytes ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="modal-dialog-surface bg-zinc-900 border border-zinc-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="modal-dialog-header flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100">
                Save & Export Project
              </h3>
              <p className="text-xs text-zinc-400">
                Save changes to disk or export separate lightweight and media archives.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={isBusy}
            className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Filename Input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Project Filename
            </label>
            <div className="relative">
              <input
                type="text"
                value={filename}
                onChange={(e) => {
                  setFilename(e.target.value);
                  if (e.target.value.trim()) {
                    fetchSummary(e.target.value.trim());
                  }
                }}
                disabled={isBusy}
                placeholder="e.g. cyber_alley_scene_v1"
                className="w-full bg-zinc-950 border border-zinc-700/80 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none transition-colors"
                autoFocus
              />
              <span className="absolute right-3.5 top-2.5 text-xs text-zinc-500 font-mono">
                .json
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/25 rounded-xl flex items-start gap-2.5 text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">{error}</p>
            </div>
          )}

          {/* Export Options Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Export Options (Storage Optimization)
              </label>
              <span className="text-[11px] text-zinc-500">
                Choose separate archives to avoid large project file bloat
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option 1: Standard Project Archive */}
              <div className="flex flex-col justify-between p-4 rounded-xl border border-zinc-800 bg-zinc-950/40 hover:border-indigo-500/50 transition-all group">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileArchive className="w-4 h-4 text-indigo-400" />
                      <span className="text-sm font-bold text-zinc-200">
                        Standard Archive
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                      Lightweight
                    </span>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Compact archive with project JSON, prompt templates, staged workflows, universe characters & asset metadata.
                  </p>

                  <ul className="text-[11px] text-zinc-400 space-y-1 pt-1">
                    <li className="flex items-center gap-1.5 text-emerald-400/90">
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                      <span>Fast transfer & instant backup</span>
                    </li>
                    <li className="flex items-center gap-1.5 text-zinc-500">
                      <span>• Excludes heavy .mp4 take files</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-4 mt-2 border-t border-zinc-800/80">
                  <button
                    type="button"
                    onClick={handleExportStandardZip}
                    disabled={isBusy}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 hover:text-white border border-zinc-700 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {exportingProject ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                        <span>Packaging Project...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Export Project ZIP</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Option 2: Takes Media Archive (Separate ZIP) */}
              <div className="flex flex-col justify-between p-4 rounded-xl border border-zinc-800 bg-zinc-950/40 hover:border-amber-500/50 transition-all group">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Film className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-bold text-zinc-200">
                        Takes Media ZIP
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      Heavy Media
                    </span>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Bundles all .mp4 video takes into organized shot folders (<code className="text-amber-300 font-mono text-[10px]">takes/Shot_01/</code>), with director notes log & manifest.
                  </p>

                  {/* Live Stats Badge */}
                  <div className="p-2 rounded-lg bg-zinc-900/90 border border-zinc-800 text-[11px] text-zinc-300 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Clapperboard className="w-3 h-3 text-amber-400" />
                      <span>{displayTakesCount} takes registered</span>
                    </div>
                    {displaySizeBytes > 0 && (
                      <span className="font-mono text-zinc-400 text-[10px]">
                        {formatBytes(displaySizeBytes)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-4 mt-2 border-t border-zinc-800/80">
                  <button
                    type="button"
                    onClick={handleExportTakesZip}
                    disabled={isBusy || displayTakesCount === 0}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg bg-amber-600/90 hover:bg-amber-600 text-white transition-colors disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500 cursor-pointer"
                  >
                    {exportingTakes ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Packaging Takes...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Takes ZIP</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer / Standard Save actions */}
        <div className="p-4 px-6 border-t border-zinc-800 bg-zinc-950/70 flex items-center justify-between gap-3">
          <button 
            type="button"
            onClick={onClose} 
            disabled={isBusy}
            className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {currentProjectName && (
              <button 
                type="button"
                onClick={handleSaveAs} 
                disabled={isBusy}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 hover:text-white text-xs font-semibold rounded-xl border border-zinc-700 transition-colors cursor-pointer"
              >
                Save As Copy
              </button>
            )}

            <button 
              type="button"
              onClick={handleSave} 
              disabled={isBusy}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Project</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


