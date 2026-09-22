import React, { useRef, useState } from "react";
import { Upload, FileText, Sparkles, Layers, AlertCircle } from "lucide-react";

interface SketchTextInputStepProps {
  sketchText: string;
  onSketchTextChange: (text: string) => void;
  cleanImport: boolean;
  onCleanImportChange: (clean: boolean) => void;
  parseError: string | null;
}

export const SketchTextInputStep: React.FC<SketchTextInputStepProps> = ({
  sketchText,
  onSketchTextChange,
  cleanImport,
  onCleanImportChange,
  parseError
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileRead = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        onSketchTextChange(content);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileRead(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-6">
      {/* File Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20"
            : "border-zinc-300 dark:border-zinc-700 hover:border-indigo-400 bg-zinc-50/50 dark:bg-zinc-900/40"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.fountain"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFileRead(e.target.files[0]);
            }
          }}
        />
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="p-3 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-xs">
            <Upload className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Click to browse or drag and drop script text
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Supports plain text (.txt), Markdown (.md), or Fountain screenplay files
          </p>
        </div>
      </div>

      {/* Text Area */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-indigo-500" />
            Scene Sketch / Script Text
          </label>
          {sketchText.trim() && (
            <button
              type="button"
              onClick={() => onSketchTextChange("")}
              className="text-xs text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
            >
              Clear Text
            </button>
          )}
        </div>
        <textarea
          value={sketchText}
          onChange={(e) => onSketchTextChange(e.target.value)}
          placeholder={`Paste scene sketch beats, screenplay excerpt, or rough visual notes here...
Example:
INT. OBSERVATION DECK - NIGHT
Marcus stares through the observation glass into the nebulous starfield. Elena enters from the airlock behind him holding a tablet.
Marcus turns around slowly, looking exhausted. Elena steps closer and shows him the decrypted telemetry.`}
          rows={10}
          className="w-full px-4 py-3 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 font-mono transition-colors resize-y leading-relaxed"
        />
      </div>

      {/* Cinematography Mode: Artistic Director vs Clean Import */}
      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/50 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg mt-0.5 shrink-0 transition-colors ${
              !cleanImport
                ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700"
            }`}>
              {!cleanImport ? (
                <Sparkles className="w-5 h-5" />
              ) : (
                <Layers className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {!cleanImport ? "Artistic Director Mode" : "Clean Import Mode"}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  !cleanImport
                    ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800"
                    : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700"
                }`}>
                  {!cleanImport ? "Active (Default)" : "Strict Literal"}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xl leading-relaxed">
                {!cleanImport
                  ? "AI acts as a director, intelligently proposing dramatic framing, camera movements, and lenses suited to the emotional pacing of each beat."
                  : "Disables AI creativity. Only extracts framing, movement, and lenses if explicitly written in your text; all others default to neutral Medium Shot, Locked Off, 50mm Standard Prime."}
              </p>
            </div>
          </div>

          {/* Clean Import Toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer shrink-0 select-none self-start sm:self-center px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors shadow-2xs">
            <input
              type="checkbox"
              checked={cleanImport}
              onChange={(e) => onCleanImportChange(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-zinc-300 dark:bg-zinc-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 relative"></div>
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Clean Import
            </span>
          </label>
        </div>
      </div>

      {/* Error Message */}
      {parseError && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
          <div className="flex-1 font-medium">{parseError}</div>
        </div>
      )}
    </div>
  );
};
