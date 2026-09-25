import React from "react";
import { UploadCloud, ArrowRight, CheckCircle2, AlertCircle, X } from "lucide-react";
import { useTransfer } from "../../context/TransferContext";

interface GlobalTransferBannerProps {
  activeSection: string;
  onNavigateToExecute: () => void;
}

export const GlobalTransferBanner: React.FC<GlobalTransferBannerProps> = ({
  activeSection,
  onNavigateToExecute
}) => {
  const {
    transferState,
    isTransferring,
    progressStep,
    progressPercent,
    currentFile,
    currentFilePercent,
    totalFiles,
    fileIndex,
    lastAction,
    error,
    dismissError
  } = useTransfer();

  // If user is currently on the execute section, don't show the floating duplicate banner
  if (activeSection === "execute") return null;

  // Only show if transferring or recently failed
  if (!isTransferring && transferState !== "error") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md w-full sm:w-auto shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-3 duration-300">
      {isTransferring && (
        <div className="bg-zinc-900 border-2 border-indigo-500/80 rounded-xl p-3.5 shadow-xl text-white flex flex-col gap-2 min-w-[320px]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg animate-pulse shrink-0">
                <UploadCloud className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-indigo-200">
                    {lastAction === "scene" ? "Staging Scene to Remote..." : "Staging Shot to Remote..."}
                  </span>
                  <span className="text-[10px] font-mono bg-indigo-950 text-indigo-300 px-1.5 py-0.2 rounded border border-indigo-800">
                    {progressPercent}%
                  </span>
                </div>
                <p className="text-[11px] text-zinc-300 truncate max-w-[220px] font-mono mt-0.5" title={currentFile || progressStep}>
                  {currentFile ? `${currentFile} (${currentFilePercent}%)` : progressStep}
                </p>
              </div>
            </div>

            <button
              onClick={onNavigateToExecute}
              className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
            >
              <span>View</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Dual Progress: Overall & Current File */}
          <div className="space-y-1 pt-1">
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {totalFiles > 0 && (
              <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                <span>File {Math.min(fileIndex + 1, totalFiles)} of {totalFiles}</span>
                <span>Active in background</span>
              </div>
            )}
          </div>
        </div>
      )}

      {transferState === "error" && error && (
        <div className="bg-red-950/95 border-2 border-red-500/80 rounded-xl p-3.5 shadow-xl text-white flex items-center justify-between gap-3 min-w-[320px]">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-red-200">Remote Staging Failed</h4>
              <p className="text-[11px] text-red-300 font-mono truncate max-w-[220px]">{error}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onNavigateToExecute}
              className="px-2 py-1 bg-red-800 hover:bg-red-700 text-white rounded text-xs font-semibold cursor-pointer"
            >
              Details
            </button>
            <button
              onClick={dismissError}
              className="p-1 text-red-300 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
