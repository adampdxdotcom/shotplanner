import React, { useState, useRef, useMemo } from "react";
import { ShotItem, ShotTake } from "../types";
import { formatTakeFilename, formatSize } from "../utils/formatters";
import { copyToClipboard } from "../utils/clipboard";
import { 
  Clapperboard, 
  Upload, 
  Star, 
  ThumbsUp, 
  ThumbsDown, 
  Check, 
  Copy, 
  Trash2, 
  Eye, 
  Download, 
  ArrowRightLeft, 
  Video, 
  FileVideo, 
  AlertCircle, 
  Info,
  ChevronDown,
  ChevronUp,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2
} from "lucide-react";

interface ShotTakesManagerProps {
  shot: ShotItem | null;
  sceneName: string;
  onUpdateShot: (updatedShot: ShotItem) => void;
  onReviewTake: (takeId: string) => void;
  onCompareTakes?: () => void;
}

export const ShotTakesManager: React.FC<ShotTakesManagerProps> = ({
  shot,
  sceneName,
  onUpdateShot,
  onReviewTake,
  onCompareTakes
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [autoFormatFilename, setAutoFormatFilename] = useState(true);
  const [customFilename, setCustomFilename] = useState("");
  const [initialNotes, setInitialNotes] = useState("");
  const [filterRating, setFilterRating] = useState<"all" | "good" | "bad" | "unreviewed">("all");
  const [copiedTakeId, setCopiedTakeId] = useState<string | null>(null);
  const [expandedPrompts, setExpandedPrompts] = useState<Record<string, boolean>>({});
  const [isExportingTakes, setIsExportingTakes] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportTakesZip = async () => {
    const cleanScene = (sceneName || "Scene").trim().replace(/\.json$/, "");
    setIsExportingTakes(true);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(cleanScene)}/export-takes`);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Export failed (HTTP ${response.status})`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `${cleanScene}_takes.zip`;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(downloadUrl);
      link.remove();
    } catch (err: any) {
      alert(`Failed to export takes: ${err.message}`);
    } finally {
      setIsExportingTakes(false);
    }
  };

  if (!shot) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-12 text-center shadow-xs">
        <Clapperboard className="w-12 h-12 mx-auto text-zinc-400 dark:text-zinc-600 mb-3" />
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">No Shot Selected</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mt-1">
          Select or create a shot from the carousel above to inspect and manage its video takes.
        </p>
      </div>
    );
  }

  const takes = shot.takes || [];
  const nextTakeNumber = takes.length + 1;
  const suggestedFilename = formatTakeFilename(sceneName, shot.shot_number, nextTakeNumber, "mp4");

  // Filter takes based on user selection
  const filteredTakes = useMemo(() => {
    return [...takes].sort((a, b) => b.take_number - a.take_number).filter(t => {
      if (filterRating === "good") return t.rating === "good" || t.review_status === "approved";
      if (filterRating === "bad") return t.rating === "bad" || t.review_status === "needs_work";
      if (filterRating === "unreviewed") return !t.rating && t.review_status !== "approved" && t.review_status !== "needs_work";
      return true;
    });
  }, [takes, filterRating]);

  const counts = useMemo(() => {
    let good = 0;
    let bad = 0;
    let unreviewed = 0;
    for (const t of takes) {
      if (t.rating === "good" || t.review_status === "approved") good++;
      else if (t.rating === "bad" || t.review_status === "needs_work") bad++;
      else unreviewed++;
    }
    return { all: takes.length, good, bad, unreviewed };
  }, [takes]);

  const handleUploadFile = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith("video/") && !file.name.match(/\.(mp4|webm|mov|mkv)$/i)) {
      setUploadError("Please upload a valid video file (.mp4, .webm, or .mov)");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const ext = file.name.substring(file.name.lastIndexOf(".")) || ".mp4";
    const targetName = autoFormatFilename 
      ? formatTakeFilename(sceneName, shot.shot_number, nextTakeNumber, ext.replace(".", ""))
      : (customFilename.trim() || file.name);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("scene_name", sceneName);
    formData.append("target_filename", targetName);

    try {
      const response = await fetch("/api/outputs/upload", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Upload failed with status ${response.status}`);
      }

      const data = await response.json();
      const savedFilename = data.filename || targetName;
      const streamUrl = data.stream_url || `/api/outputs/stream/${encodeURIComponent(sceneName)}/${encodeURIComponent(savedFilename)}`;

      const newTake: ShotTake = {
        id: "take_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
        take_number: nextTakeNumber,
        created_at: new Date().toISOString(),
        video_filename: savedFilename,
        video_url: streamUrl,
        variation_id: shot.active_variation_id || (shot.prompt_variations && shot.prompt_variations.length > 0 ? shot.prompt_variations[shot.prompt_variations.length - 1].id : undefined),
        expanded_prompt: shot.expanded_prompt || "",
        basic_stub: shot.basic_stub || "",
        generation_params: shot.generation_params,
        sampling_steps: shot.generation_params?.steps ? Number(shot.generation_params.steps) : undefined,
        aspect_ratio: shot.aspect_ratio || "16:9 Widescreen",
        review_status: "unreviewed",
        rating: null,
        notes: initialNotes.trim(),
        file_size: data.size || file.size,
        is_hero: takes.length === 0 // Default first take to hero
      };

      const updatedTakes = [...takes, newTake];
      const updatedShot: ShotItem = {
        ...shot,
        takes: updatedTakes,
        hero_take_id: takes.length === 0 ? newTake.id : shot.hero_take_id,
        updated_at: new Date().toISOString()
      };

      onUpdateShot(updatedShot);
      setCustomFilename("");
      setInitialNotes("");
    } catch (err: any) {
      console.error("Take upload error:", err);
      setUploadError(err.message || "Failed to upload video take.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSetHero = (takeId: string) => {
    const updatedTakes = takes.map(t => ({
      ...t,
      is_hero: t.id === takeId
    }));

    onUpdateShot({
      ...shot,
      hero_take_id: takeId,
      takes: updatedTakes,
      updated_at: new Date().toISOString()
    });
  };

  const handleSetRating = (takeId: string, rating: "good" | "bad" | null) => {
    const updatedTakes = takes.map(t => {
      if (t.id !== takeId) return t;
      const newRating = t.rating === rating ? null : rating;
      const newReviewStatus = newRating === "good" ? "approved" : newRating === "bad" ? "needs_work" : "unreviewed";
      return {
        ...t,
        rating: newRating,
        review_status: newReviewStatus
      };
    });

    onUpdateShot({
      ...shot,
      takes: updatedTakes,
      updated_at: new Date().toISOString()
    });
  };

  const handleUpdateNotes = (takeId: string, notes: string) => {
    const updatedTakes = takes.map(t => {
      if (t.id !== takeId) return t;
      return { ...t, notes };
    });

    onUpdateShot({
      ...shot,
      takes: updatedTakes,
      updated_at: new Date().toISOString()
    });
  };

  const handleAssignVariation = (takeId: string, variationId: string) => {
    const selectedVar = (shot.prompt_variations || []).find(v => v.id === variationId);
    
    const updatedTakes = takes.map(t => {
      if (t.id !== takeId) return t;
      if (!selectedVar) {
        // Unlinked / Custom variation
        return {
          ...t,
          variation_id: undefined
        };
      }
      return {
        ...t,
        variation_id: selectedVar.id,
        expanded_prompt: selectedVar.expanded_prompt,
        basic_stub: selectedVar.basic_stub || t.basic_stub
      };
    });

    onUpdateShot({
      ...shot,
      takes: updatedTakes,
      updated_at: new Date().toISOString()
    });
  };

  const handleDeleteTake = async (take: ShotTake) => {
    if (!window.confirm(`Are you sure you want to delete Take ${take.take_number} (${take.video_filename || "Video"})?`)) {
      return;
    }

    if (take.video_filename) {
      try {
        await fetch(`/api/outputs/${encodeURIComponent(sceneName)}/${encodeURIComponent(take.video_filename)}`, {
          method: "DELETE"
        });
      } catch (e) {
        console.warn("Could not delete file from disk:", e);
      }
    }

    const remainingTakes = takes.filter(t => t.id !== take.id);
    let newHeroId = shot.hero_take_id;
    if (shot.hero_take_id === take.id) {
      newHeroId = remainingTakes[0]?.id;
      if (newHeroId) {
        remainingTakes[0].is_hero = true;
      }
    }

    onUpdateShot({
      ...shot,
      hero_take_id: newHeroId,
      takes: remainingTakes,
      updated_at: new Date().toISOString()
    });
  };

  const handleCopyFilename = (take: ShotTake) => {
    const fn = take.video_filename || formatTakeFilename(sceneName, shot.shot_number, take.take_number, "mp4");
    copyToClipboard(fn);
    setCopiedTakeId(take.id);
    setTimeout(() => setCopiedTakeId(null), 2000);
  };

  const togglePromptExpanded = (takeId: string) => {
    setExpandedPrompts(prev => ({
      ...prev,
      [takeId]: !prev[takeId]
    }));
  };

  return (
    <div className="space-y-6">
      {/* Takes Ingest & Header Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                Shot {String(shot.shot_number).padStart(2, "0")}
              </span>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                {shot.shot_name ? shot.shot_name : `Shot ${String(shot.shot_number).padStart(2, "0")} Takes`}
              </h2>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Ingest video takes, evaluate with Good / Bad ratings, and attach director review notes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {takes.length >= 2 && onCompareTakes && (
              <button
                type="button"
                onClick={onCompareTakes}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer border border-zinc-300 dark:border-zinc-700"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-500" />
                Compare Takes
              </button>
            )}

            {takes.length > 0 && (
              <button
                type="button"
                onClick={handleExportTakesZip}
                disabled={isExportingTakes}
                title="Download all video takes as a separate ZIP archive"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-semibold rounded-lg transition-colors cursor-pointer border border-amber-500/30 disabled:opacity-50"
              >
                {isExportingTakes ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Exporting...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 text-amber-500" />
                    <span>Takes ZIP</span>
                  </>
                )}
              </button>
            )}

            <div className="flex items-center gap-1.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 font-medium">
              <Clapperboard className="w-3.5 h-3.5 text-amber-500" />
              <span>Total: <strong className="text-zinc-900 dark:text-zinc-200">{takes.length}</strong></span>
              {shot.hero_take_id && (
                <span className="ml-2 pl-2 border-l border-zinc-200 dark:border-zinc-800 flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                  Hero Take Selected
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Ingest Dropzone / Uploader */}
        <div className="mt-4 pt-1">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragActive(true);
            }}
            onDragLeave={() => setIsDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragActive(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleUploadFile(file);
            }}
            className={`border-2 border-dashed rounded-xl p-5 transition-all text-center ${
              isDragActive 
                ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20" 
                : "border-zinc-300 dark:border-zinc-700 hover:border-amber-400 dark:hover:border-amber-500/50 bg-zinc-50/50 dark:bg-zinc-950/40"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadFile(file);
              }}
            />

            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="p-3 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 rounded-full">
                <Upload className={`w-5 h-5 ${isUploading ? "animate-bounce" : ""}`} />
              </div>
              
              <div>
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                >
                  {isUploading ? "Ingesting video clip..." : "Click to upload a video take"}
                </button>
                <span className="text-xs text-zinc-500 dark:text-zinc-400"> or drag and drop here</span>
              </div>

              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Supports MP4, WebM, MOV (approx. 1.5MB - 50MB)
              </p>
            </div>
          </div>

          {/* Upload Configuration & Comfy Note */}
          <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto-format-filename"
                checked={autoFormatFilename}
                onChange={(e) => setAutoFormatFilename(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <label htmlFor="auto-format-filename" className="text-zinc-700 dark:text-zinc-300 cursor-pointer">
                Auto-format filename: <code className="font-mono text-amber-600 dark:text-amber-400 font-semibold">{suggestedFilename}</code>
              </label>
            </div>

            <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>ComfyUI Bridge: Automated outputs will sync directly to this tab</span>
            </div>
          </div>

          {!autoFormatFilename && (
            <div className="mt-2 flex items-center gap-2">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 shrink-0">
                Custom Target Filename:
              </label>
              <input
                type="text"
                value={customFilename}
                onChange={(e) => setCustomFilename(e.target.value)}
                placeholder={suggestedFilename}
                className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 font-mono"
              />
            </div>
          )}

          {uploadError && (
            <div className="mt-3 flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-xl text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}
        </div>
      </div>

      {/* Filter / Filter Bar */}
      {takes.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mr-1">Filter Takes:</span>
            <button
              type="button"
              onClick={() => setFilterRating("all")}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer border ${
                filterRating === "all"
                  ? "bg-zinc-800 text-white border-zinc-700 dark:bg-zinc-200 dark:text-zinc-900"
                  : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
              }`}
            >
              All ({counts.all})
            </button>
            <button
              type="button"
              onClick={() => setFilterRating("good")}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer border ${
                filterRating === "good"
                  ? "bg-emerald-600 text-white border-emerald-500"
                  : "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 border-zinc-200 dark:border-zinc-800 hover:border-emerald-300"
              }`}
            >
              <ThumbsUp className="w-3 h-3" />
              Good ({counts.good})
            </button>
            <button
              type="button"
              onClick={() => setFilterRating("bad")}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer border ${
                filterRating === "bad"
                  ? "bg-rose-600 text-white border-rose-500"
                  : "bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 border-zinc-200 dark:border-zinc-800 hover:border-rose-300"
              }`}
            >
              <ThumbsDown className="w-3 h-3" />
              Bad ({counts.bad})
            </button>
            <button
              type="button"
              onClick={() => setFilterRating("unreviewed")}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer border ${
                filterRating === "unreviewed"
                  ? "bg-amber-600 text-white border-amber-500"
                  : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
              }`}
            >
              Unreviewed ({counts.unreviewed})
            </button>
          </div>

          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Showing {filteredTakes.length} of {takes.length} take{takes.length === 1 ? "" : "s"}
          </div>
        </div>
      )}

      {/* Takes List */}
      {filteredTakes.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-10 text-center shadow-xs">
          <FileVideo className="w-10 h-10 mx-auto text-zinc-400 dark:text-zinc-600 mb-2" />
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            {takes.length === 0 
              ? "No takes ingested yet" 
              : `No takes matching "${filterRating}" rating`}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
            {takes.length === 0
              ? "Drag and drop an MP4 clip into the box above to add Take 01 for this shot."
              : "Switch filter to view other takes or upload another take."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTakes.map((take) => {
            const isHero = take.id === shot.hero_take_id || Boolean(take.is_hero);
            const isGood = take.rating === "good" || take.review_status === "approved";
            const isBad = take.rating === "bad" || take.review_status === "needs_work";
            const filename = take.video_filename || formatTakeFilename(sceneName, shot.shot_number, take.take_number, "mp4");
            const streamUrl = take.video_url || `/api/outputs/stream/${encodeURIComponent(sceneName)}/${encodeURIComponent(filename)}`;

            return (
              <div
                key={take.id}
                className={`bg-white dark:bg-zinc-900 border rounded-2xl overflow-hidden transition-all shadow-xs ${
                  isHero 
                    ? "border-amber-400 dark:border-amber-500/60 ring-1 ring-amber-400/30" 
                    : isGood 
                    ? "border-emerald-300 dark:border-emerald-800/60" 
                    : isBad 
                    ? "border-rose-300 dark:border-rose-800/60" 
                    : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                {/* Take Header Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-zinc-100 dark:border-zinc-800/70 bg-zinc-50/70 dark:bg-zinc-950/50">
                  <div className="flex items-center gap-2.5">
                    {/* Take number badge */}
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-bold font-mono px-2.5 py-1 rounded-lg border ${
                        isHero
                          ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-700"
                          : "bg-zinc-100 text-zinc-800 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700"
                      }`}>
                        Take {String(take.take_number).padStart(2, "0")}
                      </span>

                      {/* Assigned Variation Badge */}
                      {take.variation_id && (() => {
                        const matchedVar = (shot.prompt_variations || []).find(v => v.id === take.variation_id);
                        return (
                          <span className="flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-md">
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            {matchedVar?.label || `Var ${matchedVar?.variation_number || ""}`}
                          </span>
                        );
                      })()}

                      {isHero && (
                        <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-full">
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                          Hero Take
                        </span>
                      )}
                    </div>

                    {/* Status badge */}
                    {isGood && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-md">
                        <CheckCircle2 className="w-3 h-3" />
                        Good Take
                      </span>
                    )}
                    {isBad && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-md">
                        <XCircle className="w-3 h-3" />
                        Needs Work
                      </span>
                    )}
                    {!isGood && !isBad && (
                      <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-md">
                        <Clock className="w-3 h-3" />
                        Unreviewed
                      </span>
                    )}
                  </div>

                  {/* Rating Buttons & Hero Toggle */}
                  <div className="flex items-center gap-2">
                    {/* Good / Bad Quick Toggles */}
                    <div className="flex items-center bg-zinc-200/70 dark:bg-zinc-800/80 p-0.5 rounded-lg border border-zinc-300/60 dark:border-zinc-700">
                      <button
                        type="button"
                        onClick={() => handleSetRating(take.id, "good")}
                        title={isGood ? "Clear rating" : "Mark as Good Take"}
                        className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                          isGood
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                        }`}
                      >
                        <ThumbsUp className={`w-3.5 h-3.5 ${isGood ? "fill-white" : ""}`} />
                        <span>Good</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSetRating(take.id, "bad")}
                        title={isBad ? "Clear rating" : "Mark as Bad / Needs Work"}
                        className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                          isBad
                            ? "bg-rose-600 text-white shadow-xs"
                            : "text-zinc-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400"
                        }`}
                      >
                        <ThumbsDown className={`w-3.5 h-3.5 ${isBad ? "fill-white" : ""}`} />
                        <span>Bad</span>
                      </button>
                    </div>

                    {/* Set as Hero Button */}
                    {!isHero ? (
                      <button
                        type="button"
                        onClick={() => handleSetHero(take.id)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-zinc-100 hover:bg-amber-50 hover:text-amber-700 dark:bg-zinc-800 dark:hover:bg-amber-950/40 dark:hover:text-amber-300 text-zinc-600 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 transition-colors cursor-pointer"
                        title="Set as Hero Take"
                      >
                        <Star className="w-3.5 h-3.5 text-amber-500" />
                        <span>Make Hero</span>
                      </button>
                    ) : null}

                    {/* Review in Modal */}
                    <button
                      type="button"
                      onClick={() => onReviewTake(take.id)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      title="Inspect Take in Modal"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {/* Delete take */}
                    <button
                      type="button"
                      onClick={() => handleDeleteTake(take)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      title="Delete Take"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Take Card Content */}
                <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Left: Video Player */}
                  <div className="lg:col-span-6 flex flex-col space-y-2">
                    <div className="bg-black rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 aspect-video relative flex items-center justify-center group shadow-xs">
                      <video
                        src={streamUrl}
                        controls
                        loop
                        playsInline
                        preload="metadata"
                        className="w-full h-full object-contain"
                      />
                    </div>

                    {/* Filename & Info Bar */}
                    <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 pt-1">
                      <div className="flex items-center gap-1.5 truncate max-w-[70%]">
                        <Video className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span className="font-mono text-[11px] truncate" title={filename}>
                          {filename}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyFilename(take)}
                          className="p-1 hover:text-zinc-900 dark:hover:text-zinc-200 cursor-pointer"
                          title="Copy filename"
                        >
                          {copiedTakeId === take.id ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        {take.file_size && (
                          <span className="text-[11px] font-mono">{formatSize(take.file_size)}</span>
                        )}
                        <a
                          href={streamUrl}
                          download={filename}
                          className="p-1 text-zinc-400 hover:text-amber-500 transition-colors"
                          title="Download video clip"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Right: Notes & Snapshot */}
                  <div className="lg:col-span-6 flex flex-col space-y-3">
                    {/* Notes Field */}
                    <div className="flex-1 flex flex-col">
                      <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center justify-between">
                        <span>Take Notes & Director Feedback</span>
                        <span className="text-[10px] text-zinc-400 font-normal">Autosaves</span>
                      </label>
                      <textarea
                        value={take.notes || ""}
                        onChange={(e) => handleUpdateNotes(take.id, e.target.value)}
                        placeholder="Add review notes for this take (e.g. 'Great camera motion, watch hand glitch at end, approved for final edit')..."
                        rows={3}
                        className="w-full flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-amber-500 resize-none"
                      />
                    </div>

                    {/* Metadata & Prompt Snapshot Accordion */}
                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/40 p-2.5">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => togglePromptExpanded(take.id)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer"
                        >
                          {expandedPrompts[take.id] ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                          <span>Prompt Snapshot & Parameters</span>
                        </button>

                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                          {take.aspect_ratio && <span>{take.aspect_ratio}</span>}
                          {take.sampling_steps && <span>• {take.sampling_steps} steps</span>}
                        </div>
                      </div>

                      {/* Prompt Variation Assignment Bar */}
                      <div className="mt-2 pt-2 border-t border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">Assigned Variation:</label>
                        </div>

                        <select
                          value={take.variation_id || ""}
                          onChange={(e) => handleAssignVariation(take.id, e.target.value)}
                          className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md px-2 py-1 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-amber-500 font-mono max-w-[240px]"
                        >
                          <option value="">-- Custom / Current Prompt --</option>
                          {(shot.prompt_variations || []).map((v) => (
                            <option key={v.id} value={v.id}>
                              Variation {v.variation_number} {v.provider ? `(${v.provider})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      {expandedPrompts[take.id] && (
                        <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-800 text-xs space-y-2">
                          {take.basic_stub && (
                            <div>
                              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">Concept Stub</span>
                              <p className="text-zinc-700 dark:text-zinc-300 text-xs bg-white dark:bg-zinc-900 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800">
                                {take.basic_stub}
                              </p>
                            </div>
                          )}

                          <div>
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">Expanded Prompt</span>
                            <div className="text-zinc-700 dark:text-zinc-300 text-[11px] font-mono bg-white dark:bg-zinc-900 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 max-h-28 overflow-y-auto whitespace-pre-wrap">
                              {take.expanded_prompt || "No prompt snapshot recorded for this take."}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
