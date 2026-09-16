import React from "react";
import { Type, ArrowRight } from "lucide-react";

interface PromptNodeSelectorProps {
  promptNodes: any[];
  selectedPromptNodeId: string;
  onSelectPromptNodeId: (id: string) => void;
}

export const PromptNodeSelector: React.FC<PromptNodeSelectorProps> = ({
  promptNodes,
  selectedPromptNodeId,
  onSelectPromptNodeId
}) => {
  return (
    <div className="bg-white dark:bg-zinc-950/60 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 space-y-2 shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 flex items-center gap-1.5">
          <Type className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          Target Prompt Node Mapping (inputs.text)
        </span>
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {promptNodes.length} text node(s) detected
        </span>
      </div>
      <div className="flex items-center gap-2">
        <ArrowRight className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
        <select
          value={selectedPromptNodeId}
          onChange={(e) => onSelectPromptNodeId(e.target.value)}
          className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 focus:border-indigo-500 rounded-md px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-200 outline-none shadow-2xs"
        >
          <option value="">-- Do Not Inject Prompt --</option>
          {promptNodes.map(node => (
            <option key={node.id} value={node.id}>
              Node #{node.id} — {node.title} (default: "{node.current_text?.substring(0, 30)}...")
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
