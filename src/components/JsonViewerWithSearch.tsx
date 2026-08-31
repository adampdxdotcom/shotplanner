import React, { useState, useEffect, useRef, useMemo } from "react";
import { Search, ChevronUp, ChevronDown, X, Copy, Check, FileJson } from "lucide-react";
import { copyToClipboard } from "../utils/clipboard";

interface JsonViewerWithSearchProps {
  data: any;
  activeShotNumber?: number | string;
  isVisualWorkflow?: boolean;
  nodeCount?: number;
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const JsonViewerWithSearch: React.FC<JsonViewerWithSearchProps> = ({
  data,
  activeShotNumber = "01",
  isVisualWorkflow = true,
  nodeCount = 0
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const scrollContainerRef = useRef<HTMLPreElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const jsonString = useMemo(() => {
    try {
      return JSON.stringify(data, null, 2) || "";
    } catch {
      return "";
    }
  }, [data]);

  // Parse matches and text segments
  const { segments, totalMatches } = useMemo(() => {
    if (!searchTerm.trim()) {
      return {
        segments: [{ text: jsonString, isMatch: false, matchIndex: -1 }],
        totalMatches: 0
      };
    }

    const escaped = escapeRegExp(searchTerm.trim());
    const regex = new RegExp(`(${escaped})`, "gi");
    const parts = jsonString.split(regex);
    let matchCount = 0;

    const segs = parts.map((part) => {
      const isMatch = part.toLowerCase() === searchTerm.trim().toLowerCase();
      if (isMatch) {
        const mIdx = matchCount;
        matchCount++;
        return { text: part, isMatch: true, matchIndex: mIdx };
      }
      return { text: part, isMatch: false, matchIndex: -1 };
    });

    return { segments: segs, totalMatches: matchCount };
  }, [jsonString, searchTerm]);

  // Reset or constrain activeMatchIndex when totalMatches changes
  useEffect(() => {
    setActiveMatchIndex(0);
  }, [searchTerm]);

  // Auto-scroll to active match
  useEffect(() => {
    if (totalMatches === 0) return;
    const targetElement = document.getElementById(`json-search-match-${activeMatchIndex}`);
    if (targetElement && scrollContainerRef.current) {
      targetElement.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest"
      });
    }
  }, [activeMatchIndex, totalMatches]);

  const handleNextMatch = () => {
    if (totalMatches === 0) return;
    setActiveMatchIndex((prev) => (prev + 1) % totalMatches);
  };

  const handlePrevMatch = () => {
    if (totalMatches === 0) return;
    setActiveMatchIndex((prev) => (prev - 1 + totalMatches) % totalMatches);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        handlePrevMatch();
      } else {
        handleNextMatch();
      }
    } else if (e.key === "Escape") {
      setSearchTerm("");
    }
  };

  const handleCopy = async () => {
    const success = await copyToClipboard(jsonString);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="p-3 rounded-lg bg-zinc-950 border-2 border-zinc-700 text-xs space-y-2.5">
      {/* Header Info & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-zinc-300 border-b border-zinc-800/80 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <FileJson className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-mono font-medium text-xs text-zinc-200">
            {isVisualWorkflow
              ? `Live Injected Workflow Canvas (${nodeCount} nodes)`
              : `Live Injected Workflow Graph (${nodeCount} nodes)`}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
            Active Shot #{String(activeShotNumber).padStart(2, "0")} Live Data
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
            {isVisualWorkflow ? "Visual UI Workflow JSON" : "API Prompt Format JSON"}
          </span>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-200 border border-zinc-600 transition-colors"
          title="Copy live injected workflow JSON to clipboard"
        >
          {copied ? (
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
      </div>

      <p className="text-[11px] text-zinc-400">
        Live in-memory preview of the workflow JSON populated with the active shot's assigned assets, expanded prompt, and generation parameters.
      </p>

      {/* Interactive Search Bar */}
      <div className="flex flex-wrap items-center gap-2 bg-zinc-900/90 p-2 rounded-md border border-zinc-800">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search JSON (e.g. SaveVideo, node id, prompt, image, steps)..."
            className="w-full bg-zinc-950 border border-zinc-700/80 focus:border-indigo-500 rounded pl-8 pr-7 py-1 text-xs text-zinc-200 font-mono placeholder:text-zinc-500 outline-none"
          />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm("");
                searchInputRef.current?.focus();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Match Count Indicator */}
        <div className="flex items-center gap-1.5">
          {searchTerm.trim() ? (
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                totalMatches > 0
                  ? "bg-amber-950/40 text-amber-300 border-amber-600/30"
                  : "bg-red-950/40 text-red-300 border-red-800/40"
              }`}
            >
              {totalMatches > 0
                ? `${activeMatchIndex + 1} of ${totalMatches} match${totalMatches > 1 ? "es" : ""}`
                : "0 matches"}
            </span>
          ) : (
            <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline">
              Press Enter for next match
            </span>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevMatch}
              disabled={totalMatches === 0}
              className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:hover:bg-zinc-800 text-zinc-300 border border-zinc-700 transition-colors"
              title="Previous match (Shift + Enter)"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleNextMatch}
              disabled={totalMatches === 0}
              className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:hover:bg-zinc-800 text-zinc-300 border border-zinc-700 transition-colors"
              title="Next match (Enter)"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* JSON Display Area with Search Highlights */}
      <pre
        ref={scrollContainerRef}
        className="max-h-72 overflow-auto font-mono text-[11px] text-zinc-300 bg-zinc-900/80 p-3 rounded-lg border border-zinc-800 select-text whitespace-pre leading-relaxed"
      >
        {segments.map((seg, idx) => {
          if (!seg.isMatch) {
            return <React.Fragment key={idx}>{seg.text}</React.Fragment>;
          }
          const isActive = seg.matchIndex === activeMatchIndex;
          return (
            <mark
              key={idx}
              id={`json-search-match-${seg.matchIndex}`}
              className={
                isActive
                  ? "bg-amber-400 text-zinc-950 font-bold px-0.5 rounded shadow-sm ring-2 ring-amber-300"
                  : "bg-yellow-500/30 text-yellow-200 px-0.5 rounded"
              }
            >
              {seg.text}
            </mark>
          );
        })}
      </pre>
    </div>
  );
};
