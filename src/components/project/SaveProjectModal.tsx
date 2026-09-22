import React, { useState, useEffect } from "react";
import { 
  X, 
  Save, 
  AlertCircle, 
  Download, 
  Loader2, 
  FolderArchive,
  Info
} from "lucide-react";
import { assetsApi, projectsApi } from "../../api";

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

const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (val: boolean) => void;
  id: string;
}> = ({ checked, onChange, id }) => {
  return (
    <button
      type="button"
      id={id}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-indigo-500/50 ${
        checked ? "bg-indigo-600" : "bg-zinc-300 dark:bg-zinc-700"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
};

export const SaveProjectModal: React.FC<SaveProjectModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  currentProjectName,
  sceneProject 
}) => {
  const [filename, setFilename] = useState("");
  const [saving, setSaving] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [takesSummary, setTakesSummary] = useState<ProjectTakesSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Export switches (Assets on by default, Renders off by default)
  const [includeAssets, setIncludeAssets] = useState(true);
  const [includeRenders, setIncludeRenders] = useState(false);
  const [assetCount, setAssetCount] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && currentProjectName) {
      setFilename(currentProjectName);
      fetchSummary(currentProjectName);
    } else if (isOpen) {
      setFilename("");
      setTakesSummary(null);
      setAssetCount(null);
    }
  }, [isOpen, currentProjectName]);

  const activeSceneName = takesSummary?.sceneName || sceneProject?.scene_name || "Scene_01";

  // Fetch asset count whenever the active scene changes
  useEffect(() => {
    if (!isOpen || !activeSceneName) return;
    assetsApi.list(activeSceneName)
      .then((data: any) => {
        if (data && Array.isArray(data.assets)) {
          setAssetCount(data.assets.length);
        }
      })
      .catch(() => {});
  }, [isOpen, activeSceneName]);

  const fetchSummary = async (name: string) => {
    const clean = name.trim().replace(/\.json$/, "");
    if (!clean) return;
    setLoadingSummary(true);
    try {
      const data = await projectsApi.getTakesSummary(clean);
      if (data) {
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

  const handleExportZip = async () => {
    if (!targetName) {
      setError("Please enter a project name before exporting.");
      return;
    }
    setExportingZip(true);
    setError(null);
    try {
      // Auto-save first to ensure the backend holds the latest state
      await onSave(targetName);

      // Trigger parameterized project archive download
      const query = `include_assets=${includeAssets}&include_renders=${includeRenders}`;
      const response = await fetch(`/api/projects/${encodeURIComponent(targetName)}/export?${query}`);
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
      setError(err.message || "Failed to export project ZIP package.");
    } finally {
      setExportingZip(false);
    }
  };

  const isBusy = saving || exportingZip;
  const displayTakesCount = takesSummary?.totalTakes ?? localTakesCount;
  const displaySizeBytes = takesSummary?.totalSizeBytes ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="modal-dialog-surface bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/80 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-zinc-900 dark:text-zinc-100">
        {/* Header */}
        <div className="modal-dialog-header flex items-center justify-between px-6 py-4 border-b border-zinc-150 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 font-sans">
                Save & Export Project
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Save project state to disk or bundle files into a consolidated ZIP archive.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={isBusy}
            className="p-1 text-zinc-400 hover:text-zinc-800 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Filename Input */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
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
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700/80 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none transition-colors"
                autoFocus
              />
              <span className="absolute right-3.5 top-2.5 text-xs text-zinc-400 dark:text-zinc-500 font-mono font-medium">
                .json
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 rounded-xl flex items-start gap-2.5 text-rose-700 dark:text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">{error}</p>
            </div>
          )}

          {/* Redesigned Unified Export Option */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Export Options (Storage Optimization)
              </label>
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                Choose assets to bundle in a single archive
              </span>
            </div>

            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 p-5 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-zinc-150 dark:border-zinc-800/80">
                <FolderArchive className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-sm font-bold text-zinc-850 dark:text-zinc-200">
                  Export Project Package
                </span>
              </div>

              <div className="space-y-4">
                {/* Switch 1: Include Assets */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-850 dark:text-zinc-200">
                        Include Assets
                      </span>
                      {includeAssets && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30">
                          {assetCount !== null ? `${assetCount} assets` : "scanning..."}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-normal">
                      Packages project media, character reference portraits, audio stubs, and workflow files.
                    </p>
                  </div>
                  <ToggleSwitch
                    id="switch-include-assets"
                    checked={includeAssets}
                    onChange={setIncludeAssets}
                  />
                </div>

                {/* Switch 2: Include Renders */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-850 dark:text-zinc-200">
                        Include Renders
                      </span>
                      {includeRenders && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
                          {displayTakesCount} {displayTakesCount === 1 ? "take" : "takes"} • {formatBytes(displaySizeBytes)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-normal">
                      Packages generated video takes (.mp4) into organized shot folders.
                    </p>
                  </div>
                  <ToggleSwitch
                    id="switch-include-renders"
                    checked={includeRenders}
                    onChange={setIncludeRenders}
                  />
                </div>
              </div>

              {/* Dynamic Export Button */}
              <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800/80">
                <button
                  type="button"
                  onClick={handleExportZip}
                  disabled={isBusy}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exportingZip ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>
                        {includeAssets && includeRenders
                          ? "Packaging Project, Assets & Renders..."
                          : includeAssets
                          ? "Packaging Project & Assets..."
                          : includeRenders
                          ? "Packaging Project & Renders..."
                          : "Packaging Project Manifest..."}
                      </span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-white" />
                      <span>Download Project ZIP</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer / Standard Save actions */}
        <div className="p-4 px-6 border-t border-zinc-150 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/70 flex items-center justify-between gap-3">
          <button 
            type="button"
            onClick={onClose} 
            disabled={isBusy}
            className="px-4 py-2 text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {currentProjectName && (
              <button 
                type="button"
                onClick={handleSaveAs} 
                disabled={isBusy}
                className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 text-zinc-700 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer"
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
