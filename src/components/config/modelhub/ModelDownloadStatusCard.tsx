import React from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";

export interface DownloadResult {
  success: boolean;
  message: string;
  destination_path?: string;
  file_size?: string;
  duration_seconds?: number;
  logs?: string;
  error?: string;
}

export interface ModelDownloadStatusCardProps {
  downloadResult: DownloadResult | null;
}

export const ModelDownloadStatusCard: React.FC<ModelDownloadStatusCardProps> = ({
  downloadResult
}) => {
  if (!downloadResult) return null;

  return (
    <div
      className={`p-4 rounded-xl border animate-in fade-in duration-300 ${
        downloadResult.success
          ? "bg-emerald-950/30 border-emerald-800/60 text-emerald-200"
          : "bg-red-950/30 border-red-800/60 text-red-200"
      }`}
    >
      <div className="flex items-start gap-3">
        {downloadResult.success ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        ) : (
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
        )}
        <div className="space-y-2 flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <h5 className="text-sm font-bold">
              {downloadResult.success ? "Model Ingested Successfully!" : "Remote Download Failed"}
            </h5>
            {downloadResult.duration_seconds !== undefined && (
              <span className="text-xs font-mono opacity-80">
                Duration: {downloadResult.duration_seconds}s
              </span>
            )}
          </div>
          <p className="text-xs opacity-90 leading-relaxed">
            {downloadResult.message}
          </p>

          {downloadResult.destination_path && (
            <div className="text-xs font-mono bg-neutral-950/80 px-2.5 py-1.5 rounded border border-neutral-800/80 text-neutral-300 select-all">
              Location: {downloadResult.destination_path}
            </div>
          )}

          {downloadResult.logs && (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer text-neutral-400 hover:text-neutral-200 font-medium">
                View Remote SSH Execution Logs
              </summary>
              <pre className="mt-1.5 p-3 bg-neutral-950 rounded border border-neutral-800 font-mono text-[11px] text-neutral-300 max-h-48 overflow-y-auto whitespace-pre-wrap">
                {downloadResult.logs}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
};
