import React, { useState, useMemo } from "react";
import { ShotItem, ShotTake } from "../types";
import { formatTakeFilename } from "../utils/formatters";
import { copyToClipboard } from "../utils/clipboard";
import { Clapperboard } from "lucide-react";
import { 
  TakeIngestCard, 
  TakeFilterBar, 
  TakeItemCard, 
  NoTakesEmptyState 
} from "./takes";

interface ShotTakesManagerProps {
  shot: ShotItem | null;
  sceneName: string;
  onUpdateShot: (updatedShot: ShotItem) => void;
  onReviewTake: (takeId: string) => void;
  onCompareTakes?: () => void;
}

/**
 * Manages video takes ingestion, Good/Bad review scoring, hero take selection,
 * metadata extraction, variation association, and take comparison.
 */
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
  const [filterRating, setFilterRating] = useState<"all" | "good" | "bad" | "unreviewed">("all");
  const [copiedTakeId, setCopiedTakeId] = useState<string | null>(null);
  const [expandedPrompts, setExpandedPrompts] = useState<Record<string, boolean>>({});
  const [isExportingTakes, setIsExportingTakes] = useState(false);

  // Handle Exporting takes zip archive
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

  // Upload video take file
  const handleUploadFile = async (file: File) => {
    if (!file || !shot) return;

    if (!file.type.startsWith("video/") && !file.name.match(/\.(mp4|webm|mov|mkv)$/i)) {
      setUploadError("Please upload a valid video file (.mp4, .webm, or .mov)");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const takes = shot.takes || [];
    const nextTakeNumber = takes.length + 1;
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
        notes: "",
        file_size: data.size || file.size,
        is_hero: takes.length === 0
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
    } catch (err: any) {
      console.error("Take upload error:", err);
      setUploadError(err.message || "Failed to upload video take.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSetHero = (takeId: string) => {
    if (!shot) return;
    const takes = shot.takes || [];
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
    if (!shot) return;
    const takes = shot.takes || [];
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
    if (!shot) return;
    const takes = shot.takes || [];
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
    if (!shot) return;
    const takes = shot.takes || [];
    const selectedVar = (shot.prompt_variations || []).find(v => v.id === variationId);
    
    const updatedTakes = takes.map(t => {
      if (t.id !== takeId) return t;
      if (!selectedVar) {
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
    if (!shot) return;
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

    const takes = shot.takes || [];
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
    if (!shot) return;
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

  const takes = shot?.takes || [];
  const nextTakeNumber = takes.length + 1;
  const suggestedFilename = shot ? formatTakeFilename(sceneName, shot.shot_number, nextTakeNumber, "mp4") : "";

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

  return (
    <div className="space-y-6">
      {/* Takes Ingest & Header Card */}
      <TakeIngestCard
        shot={shot}
        sceneName={sceneName}
        takesCount={takes.length}
        hasHeroTake={Boolean(shot.hero_take_id)}
        suggestedFilename={suggestedFilename}
        isUploading={isUploading}
        uploadError={uploadError}
        isDragActive={isDragActive}
        autoFormatFilename={autoFormatFilename}
        customFilename={customFilename}
        isExportingTakes={isExportingTakes}
        onSetIsDragActive={setIsDragActive}
        onSetAutoFormatFilename={setAutoFormatFilename}
        onSetCustomFilename={setCustomFilename}
        onUploadFile={handleUploadFile}
        onExportTakesZip={handleExportTakesZip}
        onCompareTakes={onCompareTakes}
      />

      {/* Rating Filter Bar */}
      {takes.length > 0 && (
        <TakeFilterBar
          filterRating={filterRating}
          onSelectFilter={setFilterRating}
          counts={counts}
          filteredCount={filteredTakes.length}
          totalCount={takes.length}
        />
      )}

      {/* Takes List or Empty State */}
      {filteredTakes.length === 0 ? (
        <NoTakesEmptyState
          totalTakes={takes.length}
          filterRating={filterRating}
        />
      ) : (
        <div className="space-y-4">
          {filteredTakes.map((take) => (
            <TakeItemCard
              key={take.id}
              take={take}
              shot={shot}
              sceneName={sceneName}
              isHero={take.id === shot.hero_take_id || Boolean(take.is_hero)}
              copiedTakeId={copiedTakeId}
              isPromptExpanded={Boolean(expandedPrompts[take.id])}
              onSetRating={handleSetRating}
              onSetHero={handleSetHero}
              onReviewTake={onReviewTake}
              onDeleteTake={handleDeleteTake}
              onCopyFilename={handleCopyFilename}
              onUpdateNotes={handleUpdateNotes}
              onAssignVariation={handleAssignVariation}
              onTogglePromptExpanded={togglePromptExpanded}
            />
          ))}
        </div>
      )}
    </div>
  );
};
