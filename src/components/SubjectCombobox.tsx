import React, { useState, useRef, useEffect } from "react";
import { User, ChevronDown, Check, Plus, X, Tag } from "lucide-react";
import { MediaAsset } from "../types";

interface SubjectComboboxProps {
  value: string;
  onChange: (value: string) => void;
  subjects: string[];
  onRegisterSubject?: (name: string) => void;
  characters?: Record<string, any>;
  assets?: MediaAsset[];
  assetType?: string;
  placeholder?: string;
  disabled?: boolean;
}

export const SubjectCombobox: React.FC<SubjectComboboxProps> = ({
  value,
  onChange,
  subjects = [],
  onRegisterSubject = (_name: string) => {},
  characters: _characters,
  assets = [],
  assetType = "",
  placeholder = "e.g. Jackie, Cyberpunk_Car, Tavern",
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Helper to clean accidental 'reference_' prefixes and normalize formatting
  const cleanSubjectName = (raw: string): string => {
    if (!raw) return "";
    let clean = raw.trim();
    clean = clean.replace(/^reference[_\-\s]+/i, "").replace(/^_+|_+$/g, "").trim();
    if (!clean || ["unknown", "null", "undefined", "subject"].includes(clean.toLowerCase())) {
      return "";
    }
    if (clean === clean.toLowerCase()) {
      clean = clean
        .split(/[_\s]+/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    } else {
      clean = clean.replace(/_/g, " ");
    }
    return clean;
  };

  // Derive consolidated subjects (registered subjects + any subject found in assets)
  // Strips accidental 'reference_' prefixes and deduplicates case-insensitively
  const normalizedMap = new Map<string, string>();
  [
    ...subjects.map(cleanSubjectName),
    ...assets.map(a => cleanSubjectName(a.subject_name || ""))
  ].forEach(s => {
    if (!s) return;
    const key = s.toLowerCase();
    if (!normalizedMap.has(key)) {
      normalizedMap.set(key, s);
    }
  });

  const allKnownSubjects = Array.from(normalizedMap.values());

  const query = value.trim().toLowerCase();

  // Filter matching subjects
  const filteredSubjects = query
    ? allKnownSubjects.filter(s => s.toLowerCase().includes(query))
    : allKnownSubjects;

  const isExactMatch = allKnownSubjects.some(
    s => s.toLowerCase() === value.trim().toLowerCase()
  );

  const showCreateOption = value.trim().length > 0 && !isExactMatch;

  // Compute stats/categories where each subject is used
  const getSubjectMeta = (name: string) => {
    const cleanTarget = cleanSubjectName(name).toLowerCase();
    const matchedAssets = assets.filter(a => {
      const assetSubj = cleanSubjectName(a.subject_name || "").toLowerCase();
      return assetSubj === cleanTarget || (a.subject_name || "").trim().toLowerCase() === name.trim().toLowerCase();
    });
    const types = Array.from(new Set(matchedAssets.map(a => a.type).filter(Boolean)));
    return {
      count: matchedAssets.length,
      types
    };
  };

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectSubject = (name: string) => {
    const trimmed = name.trim();
    onChange(trimmed);
    onRegisterSubject(trimmed);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleCreateNew = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onChange(trimmed);
    onRegisterSubject(trimmed);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex(0);
        return;
      }
    }

    const totalOptions = filteredSubjects.length + (showCreateOption ? 1 : 0);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex(prev => (prev + 1) % totalOptions);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(totalOptions - 1);
      } else {
        setHighlightedIndex(prev => (prev <= 0 ? totalOptions - 1 : prev - 1));
      }
    } else if (e.key === "Enter") {
      if (isOpen) {
        e.preventDefault();
        if (showCreateOption && highlightedIndex === filteredSubjects.length) {
          handleCreateNew();
        } else if (highlightedIndex >= 0 && highlightedIndex < filteredSubjects.length) {
          handleSelectSubject(filteredSubjects[highlightedIndex]);
        } else if (value.trim()) {
          handleCreateNew();
        }
      } else if (value.trim()) {
        onRegisterSubject(value.trim());
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full space-y-1.5">
      {/* Input container */}
      <div className="relative flex items-center">
        <div className="absolute left-2.5 text-zinc-500 pointer-events-none">
          <User className="w-3.5 h-3.5" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-amber-500 rounded-lg pl-8 pr-16 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none transition-colors"
        />

        {/* Right actions: clear + dropdown toggle */}
        <div className="absolute right-1.5 flex items-center gap-0.5">
          {value && !disabled && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                inputRef.current?.focus();
              }}
              className="p-1 text-zinc-500 hover:text-zinc-300 rounded hover:bg-zinc-800 transition-colors"
              title="Clear text"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setIsOpen(!isOpen);
              inputRef.current?.focus();
            }}
            className="p-1 text-zinc-400 hover:text-zinc-200 rounded hover:bg-zinc-800 transition-colors"
            title="Toggle existing subjects"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {/* Suggested quick chips (if project already has established subjects) */}
      {allKnownSubjects.length > 0 && !isOpen && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <span className="text-[10px] text-zinc-400 font-medium flex items-center gap-1">
            <Tag className="w-2.5 h-2.5 text-indigo-400" />
            Suggested:
          </span>
          {allKnownSubjects.slice(0, 5).map((subj) => {
            const isSelected = subj.toLowerCase() === value.trim().toLowerCase();
            return (
              <button
                key={`quick-chip-${subj}`}
                type="button"
                onClick={() => handleSelectSubject(subj)}
                className={`text-[10px] px-2 py-0.5 rounded-md font-medium border transition-all ${
                  isSelected
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-zinc-600"
                }`}
              >
                {subj}
              </button>
            );
          })}
        </div>
      )}

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-zinc-900 border-2 border-zinc-700 rounded-lg shadow-xl overflow-hidden max-h-56 overflow-y-auto">
          {/* Header info */}
          <div className="px-3 py-1.5 bg-zinc-950/80 border-b border-zinc-800 flex items-center justify-between text-[10px] text-zinc-400">
            <span>Project Subjects Registry</span>
            <span className="font-mono text-indigo-400">{allKnownSubjects.length} established</span>
          </div>

          {/* List of existing subjects */}
          <div className="p-1 space-y-0.5">
            {filteredSubjects.length > 0 ? (
              filteredSubjects.map((subj, index) => {
                const isSelected = subj.toLowerCase() === value.trim().toLowerCase();
                const isHighlighted = highlightedIndex === index;
                const meta = getSubjectMeta(subj);

                return (
                  <button
                    key={`subj-item-${subj}`}
                    type="button"
                    onClick={() => handleSelectSubject(subj)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center justify-between transition-colors ${
                      isHighlighted
                        ? "bg-zinc-800 text-white"
                        : isSelected
                        ? "bg-amber-500/10 text-amber-300"
                        : "text-zinc-300 hover:bg-zinc-800/60"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <User className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-amber-400" : "text-indigo-400"}`} />
                      <span className="font-medium truncate">{subj}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {meta.types.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 font-mono">
                          {meta.types.join(", ")}
                        </span>
                      )}
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                  </button>
                );
              })
            ) : !showCreateOption ? (
              <div className="px-3 py-3 text-center text-xs text-zinc-400">
                No registered subjects yet. Type a name to create one.
              </div>
            ) : null}

            {/* Create new subject option on-the-fly */}
            {showCreateOption && (
              <button
                type="button"
                onClick={handleCreateNew}
                onMouseEnter={() => setHighlightedIndex(filteredSubjects.length)}
                className={`w-full text-left px-2.5 py-2 rounded-md text-xs flex items-center gap-2 border-t border-zinc-800 transition-colors ${
                  highlightedIndex === filteredSubjects.length
                    ? "bg-emerald-950/50 text-emerald-200 border-emerald-800/50"
                    : "text-emerald-400 bg-emerald-950/20 hover:bg-emerald-950/40"
                }`}
              >
                <Plus className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                <div className="flex-1 truncate">
                  <span>Create new subject </span>
                  <span className="font-bold text-emerald-300">"{value.trim()}"</span>
                </div>
                <span className="text-[10px] text-emerald-500 font-mono">Press Enter ↵</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
