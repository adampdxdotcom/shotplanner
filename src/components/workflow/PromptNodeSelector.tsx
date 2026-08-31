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
    <div className="bg-zinc-950/60 p-3 rounded-lg border-2 border-zinc-700 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
          <Type className="w-3.5 h-3.5 text-indigo-400" />
          Target Prompt Node Mapping (inputs.text)
        </span>
        <span className="text-[11px] text-zinc-400">
          {promptNodes.length} text node(s) detected
        </span>
      </div>
      <div className="flex items-center gap-2">
        <ArrowRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        <select
          value={selectedPromptNodeId}
          onChange={(e) => onSelectPromptNodeId(e.target.value)}
          className="flex-1 bg-zinc-900 border-2 border-zinc-700 focus:border-indigo-500 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 outline-none"
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
