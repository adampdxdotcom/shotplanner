import React, { useState } from "react";
import { HardDrive, RefreshCw, Trash2, Search, CheckCircle2, Clock, FileCode, Image as ImageIcon, Video, ExternalLink } from "lucide-react";
import { RecentAssetItem } from "../../context/TransferContext";

interface RecentUpdatedAssetsCardProps {
  recentAssets: RecentAssetItem[];
  onRefresh: () => void;
  onClear: () => void;
}

export const RecentUpdatedAssetsCard: React.FC<RecentUpdatedAssetsCardProps> = ({
  recentAssets,
  onRefresh,
  onClear
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshClick = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const filteredAssets = recentAssets.filter(asset => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      asset.filename.toLowerCase().includes(q) ||
      asset.remote_path.toLowerCase().includes(q) ||
      (asset.scene_name && asset.scene_name.toLowerCase().includes(q))
    );
  });

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes <= 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatTimeAgo = (timestampStr: string): string => {
    try {
      const date = new Date(timestampStr);
      const diffMs = Date.now() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 15) return "Just now";
      if (diffSec < 60) return `${diffSec}s ago`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      return date.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return timestampStr;
    }
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (ext === "json") return <FileCode className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
    if (["mp4", "webm", "mov"].includes(ext || "")) return <Video className="w-3.5 h-3.5 text-purple-500 shrink-0" />;
    return <ImageIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />;
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm transition-colors">
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50/50 dark:bg-zinc-900/50">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Recently Updated Assets on Remote GPU
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60">
                {recentAssets.length} file{recentAssets.length === 1 ? "" : "s"}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Running history of files pushed to remote ComfyUI <code className="font-mono text-zinc-600 dark:text-zinc-300">/input</code> and <code className="font-mono text-zinc-600 dark:text-zinc-300">/workflows</code>.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-2.5 py-1 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-36 sm:w-44"
            />
          </div>

          <button
            onClick={handleRefreshClick}
            disabled={isRefreshing}
            className="p-1.5 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer"
            title="Refresh recent assets from server"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-emerald-500" : ""}`} />
          </button>

          {recentAssets.length > 0 && (
            <button
              onClick={onClear}
              className="p-1.5 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer"
              title="Clear transfer history"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Body List */}
      <div className="max-h-72 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
        {filteredAssets.length === 0 ? (
          <div className="p-8 text-center">
            {recentAssets.length === 0 ? (
              <div className="space-y-1.5">
                <Clock className="w-6 h-6 text-zinc-300 dark:text-zinc-600 mx-auto" />
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">No assets pushed yet</p>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 max-w-xs mx-auto">
                  Click "Stage Shot" or "Send Scene" to push workflows and input images to your remote ComfyUI container.
                </p>
              </div>
            ) : (
              <p className="text-xs text-zinc-500">No assets match "{searchQuery}"</p>
            )}
          </div>
        ) : (
          filteredAssets.map((asset) => (
            <div
              key={asset.id}
              className="p-3 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {getFileIcon(asset.filename)}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 truncate">
                      {asset.filename}
                    </span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                      {formatFileSize(asset.size_bytes)}
                    </span>
                    {asset.scene_name && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-sans">
                        {asset.scene_name}
                      </span>
                    )}
                  </div>
                  <p
                    className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 truncate mt-0.5"
                    title={asset.remote_path}
                  >
                    {asset.remote_path}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-zinc-400" />
                  {formatTimeAgo(asset.timestamp)}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  Synced
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {filteredAssets.length > 0 && (
        <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
          <span>Showing {filteredAssets.length} of {recentAssets.length} total transferred assets</span>
          <span className="font-mono text-[10px]">Auto-saved to remote server</span>
        </div>
      )}
    </div>
  );
};
