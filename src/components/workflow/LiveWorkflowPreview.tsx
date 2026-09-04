import React from "react";
import { Copy, Check, FileJson, Info } from "lucide-react";
import { JsonViewerWithSearch } from "../JsonViewerWithSearch";

interface LiveWorkflowPreviewProps {
  showRawJson: boolean;
  liveInjectedWorkflow: any;
  parsedWorkflowRaw: any;
  handleCopyJson: () => void;
  copiedJson: boolean;
  activeShotNumber?: number | string;
  isVisualWorkflow?: boolean;
  nodeCount?: number;
}

export const LiveWorkflowPreview: React.FC<LiveWorkflowPreviewProps> = ({
  showRawJson,
  liveInjectedWorkflow,
  parsedWorkflowRaw,
  handleCopyJson,
  copiedJson,
  activeShotNumber = "01",
  isVisualWorkflow = true,
  nodeCount = 0
}) => {
  if (!showRawJson) return null;

  const displayData = liveInjectedWorkflow || parsedWorkflowRaw;

  return (
    <div className="bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden flex flex-col min-h-0 mt-4 shadow-sm">
      <div className="flex items-center justify-between p-3 border-b border-zinc-800 bg-zinc-900/50">
        <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
          <FileJson className="w-4 h-4 text-indigo-400" />
          Live Injected Workflow JSON
        </h3>
        {displayData && (
          <button
            onClick={handleCopyJson}
            className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-md transition-colors flex items-center gap-1.5"
            title="Copy live injected workflow JSON to clipboard"
          >
            {copiedJson ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-zinc-400" />
                <span>Copy JSON</span>
              </>
            )}
          </button>
        )}
      </div>

      <div className="p-3 overflow-y-auto max-h-[600px]">
        {displayData ? (
          <JsonViewerWithSearch 
            data={displayData}
            activeShotNumber={activeShotNumber}
            isVisualWorkflow={isVisualWorkflow}
            nodeCount={nodeCount}
          />
        ) : (
          <div className="flex items-center gap-2.5 p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 text-zinc-400 text-xs">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Select a ComfyUI workflow template above to preview live injected workflow JSON.</span>
          </div>
        )}
      </div>
    </div>
  );
};

