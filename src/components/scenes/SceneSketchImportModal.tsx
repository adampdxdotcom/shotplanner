import React, { useState, useRef, useMemo } from "react";
import { 
  X, 
  Sparkles, 
  Upload, 
  FileText, 
  AlertCircle, 
  Check, 
  Trash2, 
  Plus, 
  Layers, 
  Film, 
  Camera, 
  Aperture, 
  ArrowRight, 
  RefreshCw, 
  Globe, 
  User, 
  Users,
  ChevronDown,
  Info
} from "lucide-react";
import { 
  CharacterProfile, 
  UniverseCharacterProfile, 
  MediaAsset, 
  ParsedSceneSketchShot, 
  ParseSceneSketchResult,
  ShotItem,
  PromptVariation
} from "../../types";
import { requestSceneSketchParse } from "../../services/sceneSketchClient";
import { 
  resolveAllShotCharacters, 
  ResolvedShotCharacters,
  ResolvedCharacterItem,
  prepareUniverseImportPayload
} from "../../utils/sceneSketchResolver";
import { 
  SHOT_TYPES, 
  CAMERA_MOVEMENTS, 
  LENS_PRESETS 
} from "../ScenePlanningHeader";

export interface SceneSketchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingShotsCount: number;
  sceneCast: Record<string, CharacterProfile> | CharacterProfile[];
  universeCast: Record<string, UniverseCharacterProfile>;
  universeAssets: MediaAsset[];
  existingSceneAssets: MediaAsset[];
  lmStudioUrl?: string;
  onImportSuccess: (payload: {
    shotsToInsert: Partial<ShotItem>[];
    importMode: "append" | "replace";
    charactersToImport: UniverseCharacterProfile[];
    assetsToImport: MediaAsset[];
    sceneTitle?: string;
  }) => void;
}

export const SceneSketchImportModal: React.FC<SceneSketchImportModalProps> = ({
  isOpen,
  onClose,
  existingShotsCount,
  sceneCast,
  universeCast,
  universeAssets,
  existingSceneAssets,
  lmStudioUrl,
  onImportSuccess
}) => {
  // Step State: 1 = Input/Upload, 2 = Review & Stage Table
  const [step, setStep] = useState<1 | 2>(1);
  const [sketchText, setSketchText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Staged Data
  const [stagedSceneTitle, setStagedSceneTitle] = useState("");
  const [stagedShots, setStagedShots] = useState<ParsedSceneSketchShot[]>([]);
  const [importMode, setImportMode] = useState<"append" | "replace">("append");
  const [providerUsed, setProviderUsed] = useState<string>("");
  const [cleanImport, setCleanImport] = useState(false); // False = Artistic Director (default), True = Clean Import

  // Drag and drop state for file
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Character resolution state memoized against staged shots and cast
  const resolvedShots: ResolvedShotCharacters[] = useMemo(() => {
    return resolveAllShotCharacters(stagedShots, sceneCast, universeCast);
  }, [stagedShots, sceneCast, universeCast]);

  // Universe import summary
  const universeImportPayload = useMemo(() => {
    return prepareUniverseImportPayload(resolvedShots, universeCast, universeAssets, existingSceneAssets);
  }, [resolvedShots, universeCast, universeAssets, existingSceneAssets]);

  if (!isOpen) return null;

  // File handling
  const handleFileRead = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setSketchText(content);
        setParseError(null);
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

  // Execution: Parse sketch via local LLM / server endpoint
  const handleParse = async () => {
    if (!sketchText.trim()) {
      setParseError("Please enter or paste your scene sketch text.");
      return;
    }

    setIsParsing(true);
    setParseError(null);

    try {
      const result: ParseSceneSketchResult = await requestSceneSketchParse({
        sketch_text: sketchText,
        lm_studio_url: lmStudioUrl,
        clean_import: cleanImport
      });

      if (!result.shots || result.shots.length === 0) {
        throw new Error("No shots could be extracted from the provided sketch. Please verify the text.");
      }

      setStagedSceneTitle(result.scene_title || "");
      setStagedShots(result.shots);
      setProviderUsed(result.provider_used || "Local LLM");
      setStep(2);
    } catch (err: any) {
      console.error("Sketch parse error:", err);
      setParseError(err.message || "Failed to parse scene sketch. Ensure your Local LLM / LM Studio is running.");
    } finally {
      setIsParsing(false);
    }
  };

  // Shot editing helpers
  const handleUpdateShotField = (index: number, field: keyof ParsedSceneSketchShot, value: any) => {
    setStagedShots(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleDeleteShot = (index: number) => {
    setStagedShots(prev => {
      const updated = prev.filter((_, i) => i !== index);
      // Re-index remaining shots
      return updated.map((s, idx) => ({ ...s, shot_number: idx + 1 }));
    });
  };

  const handleAddShot = () => {
    setStagedShots(prev => [
      ...prev,
      {
        shot_number: prev.length + 1,
        shot_name: `Shot ${prev.length + 1}`,
        basic_stub: "",
        detected_characters: [],
        shot_type: "Medium Shot",
        camera_movement: "Locked Off",
        lens_focal_length: "50mm Standard Prime"
      }
    ]);
  };

  const handleRemoveCharacterFromShot = (shotIdx: number, charName: string) => {
    setStagedShots(prev => {
      const updated = [...prev];
      const shot = updated[shotIdx];
      if (shot) {
        shot.detected_characters = (shot.detected_characters || []).filter(
          c => c.toLowerCase() !== charName.toLowerCase()
        );
      }
      return updated;
    });
  };

  // Final confirmation: assemble shots payload and trigger callback
  const handleConfirmImport = () => {
    if (stagedShots.length === 0) return;

    const baseOffset = importMode === "append" ? existingShotsCount : 0;
    const nowIso = new Date().toISOString();

    const shotsToInsert: Partial<ShotItem>[] = stagedShots.map((s, idx) => {
      const shotNum = baseOffset + idx + 1;
      const initialVariation: PromptVariation = {
        id: `var_${Date.now()}_${idx}_1`,
        variation_number: 1,
        label: "Variation 1",
        basic_stub: s.basic_stub || "",
        expanded_prompt: "",
        created_at: nowIso
      };

      return {
        id: `shot_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
        shot_number: shotNum,
        shot_name: s.shot_name || `Shot ${shotNum}`,
        basic_stub: s.basic_stub || "",
        expanded_prompt: "",
        prompt_variations: [initialVariation],
        active_variation_id: initialVariation.id,
        shot_type: s.shot_type || "Medium Shot",
        camera_movement: s.camera_movement || "Locked Off",
        lens_focal_length: s.lens_focal_length || "50mm Standard Prime",
        characters: s.detected_characters || [],
        assigned_slots: {},
        status: "unstaged",
        takes: [],
        updated_at: nowIso
      };
    });

    onImportSuccess({
      shotsToInsert,
      importMode,
      charactersToImport: universeImportPayload.charactersToImport,
      assetsToImport: universeImportPayload.assetsToImport,
      sceneTitle: stagedSceneTitle.trim() || undefined
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                Import Scene Sketch
                {step === 2 && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {stagedShots.length} {stagedShots.length === 1 ? "Shot" : "Shots"} Parsed
                  </span>
                )}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {step === 1 
                  ? "Upload or paste raw scene script/sketch text to break it down into sequential shots."
                  : "Review and refine parsed shots and cinematography parameters before adding to your scene."
                }
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 ? (
            /* STEP 1: Input & Upload */
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
                      onClick={() => setSketchText("")}
                      className="text-xs text-zinc-400 hover:text-red-500 transition-colors"
                    >
                      Clear Text
                    </button>
                  )}
                </div>
                <textarea
                  value={sketchText}
                  onChange={(e) => setSketchText(e.target.value)}
                  placeholder="Paste scene sketch beats, screenplay excerpt, or rough visual notes here...
Example:
INT. OBSERVATION DECK - NIGHT
Marcus stares through the observation glass into the nebulous starfield. Elena enters from the airlock behind him holding a tablet.
Marcus turns around slowly, looking exhausted. Elena steps closer and shows him the decrypted telemetry."
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
                      onChange={(e) => setCleanImport(e.target.checked)}
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
          ) : (
            /* STEP 2: Review & Staging Table */
            <div className="space-y-6">
              {/* Scene Title Bar & Summary */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
                <div className="flex-1 min-w-[240px]">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block mb-1">
                    Scene Title
                  </label>
                  <input
                    type="text"
                    value={stagedSceneTitle}
                    onChange={(e) => setStagedSceneTitle(e.target.value)}
                    placeholder="e.g. Observation Deck Confrontation"
                    className="w-full px-3 py-1.5 text-sm font-semibold rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>

                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap">
                  <span className="px-2.5 py-1 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 font-medium flex items-center gap-1.5">
                    {cleanImport ? (
                      <>
                        <Layers className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Clean Import (Neutral)</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-amber-500 font-semibold">Artistic Director</span>
                      </>
                    )}
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 font-medium">
                    Parsed via: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{providerUsed}</span>
                  </span>
                </div>
              </div>

              {/* Universe Auto-Import Banner if applicable */}
              {universeImportPayload.charactersToImport.length > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-300 text-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Globe className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div>
                      <span className="font-bold">Universe Sync Notice:</span> {universeImportPayload.charactersToImport.length}{" "}
                      {universeImportPayload.charactersToImport.length === 1 ? "character" : "characters"} (
                      <span className="font-semibold underline">
                        {universeImportPayload.charactersToImport.map(c => c.name).join(", ")}
                      </span>
                      ) and {universeImportPayload.assetsToImport.length} reference{" "}
                      {universeImportPayload.assetsToImport.length === 1 ? "asset" : "assets"} will be imported into this scene.
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-amber-200/70 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-bold text-[10px] tracking-wide shrink-0">
                    AUTO-IMPORT
                  </span>
                </div>
              )}

              {/* Shots Staging List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                    <Film className="w-3.5 h-3.5 text-indigo-500" />
                    Parsed Shots ({stagedShots.length})
                  </h3>

                  <button
                    type="button"
                    onClick={handleAddShot}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Shot
                  </button>
                </div>

                {stagedShots.map((shot, idx) => {
                  const shotRes = resolvedShots[idx];

                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-900/90 shadow-xs space-y-3 transition-colors"
                    >
                      {/* Shot Row Header */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="px-2 py-0.5 text-xs font-bold font-mono rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                            Shot {shot.shot_number}
                          </span>
                          <input
                            type="text"
                            value={shot.shot_name}
                            onChange={(e) => handleUpdateShotField(idx, "shot_name", e.target.value)}
                            placeholder="Shot descriptor"
                            className="flex-1 max-w-xs px-2.5 py-1 text-xs font-semibold rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteShot(idx)}
                          className="p-1.5 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                          title="Delete shot"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Basic Stub Text (Faithful user prompt) */}
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block mb-1">
                          Prompt Action Stub
                        </label>
                        <textarea
                          value={shot.basic_stub}
                          onChange={(e) => handleUpdateShotField(idx, "basic_stub", e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 leading-relaxed font-sans"
                        />
                      </div>

                      {/* Cinematography Parameters Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                        {/* Framing / Shot Type */}
                        <div>
                          <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mb-1">
                            <Camera className="w-3 h-3 text-zinc-400" />
                            Framing
                          </label>
                          <select
                            value={shot.shot_type}
                            onChange={(e) => handleUpdateShotField(idx, "shot_type", e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                          >
                            {SHOT_TYPES.map((st) => (
                              <option key={st.value} value={st.value}>
                                {st.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Camera Movement */}
                        <div>
                          <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mb-1">
                            <Film className="w-3 h-3 text-zinc-400" />
                            Movement
                          </label>
                          <select
                            value={shot.camera_movement}
                            onChange={(e) => handleUpdateShotField(idx, "camera_movement", e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                          >
                            {CAMERA_MOVEMENTS.map((cm) => (
                              <option key={cm.value} value={cm.value}>
                                {cm.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Lens Preset */}
                        <div>
                          <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mb-1">
                            <Aperture className="w-3 h-3 text-zinc-400" />
                            Lens
                          </label>
                          <select
                            value={shot.lens_focal_length}
                            onChange={(e) => handleUpdateShotField(idx, "lens_focal_length", e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                          >
                            {LENS_PRESETS.map((lp) => (
                              <option key={lp.value} value={lp.value}>
                                {lp.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Detected Character Badges */}
                      <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 mr-1 flex items-center gap-1">
                          <Users className="w-3 h-3" /> Cast:
                        </span>

                        {(!shotRes || shotRes.characters.length === 0) ? (
                          <span className="text-[11px] text-zinc-400 italic">No specific characters detected</span>
                        ) : (
                          shotRes.characters.map((charItem, charIdx) => {
                            if (charItem.status === "in_scene") {
                              return (
                                <span
                                  key={charIdx}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[10px] font-semibold"
                                >
                                  <User className="w-2.5 h-2.5" />
                                  {charItem.cleanName}
                                  <span className="text-[8px] opacity-75 font-normal">(In Scene)</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveCharacterFromShot(idx, charItem.rawName)}
                                    className="ml-0.5 hover:text-red-500"
                                  >
                                    ×
                                  </button>
                                </span>
                              );
                            }

                            if (charItem.status === "in_universe") {
                              return (
                                <span
                                  key={charIdx}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-300 text-[10px] font-semibold"
                                  title="Exists in Universe. Will be imported into this scene upon submit."
                                >
                                  <Globe className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                                  {charItem.cleanName}
                                  <span className="text-[8px] font-bold text-amber-700 dark:text-amber-400">(Universe)</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveCharacterFromShot(idx, charItem.rawName)}
                                    className="ml-0.5 hover:text-red-500"
                                  >
                                    ×
                                  </button>
                                </span>
                              );
                            }

                            return (
                              <span
                                key={charIdx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] font-medium"
                              >
                                {charItem.cleanName}
                                <span className="text-[8px] text-zinc-400">(Unassigned)</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCharacterFromShot(idx, charItem.rawName)}
                                  className="ml-0.5 hover:text-red-500"
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* STEP 3: Import Mode Controls */}
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 block">
                  Import Destination Mode
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label 
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      importMode === "append"
                        ? "bg-white dark:bg-zinc-900 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs"
                        : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value="append"
                      checked={importMode === "append"}
                      onChange={() => setImportMode("append")}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        Append to Existing Scene ({existingShotsCount} Existing)
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        New shots will start at #{existingShotsCount + 1} through #{existingShotsCount + stagedShots.length}.
                      </div>
                    </div>
                  </label>

                  <label 
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      importMode === "replace"
                        ? "bg-white dark:bg-zinc-900 border-red-500 ring-2 ring-red-500/20 shadow-xs"
                        : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === "replace"}
                      onChange={() => setImportMode("replace")}
                      className="mt-0.5 text-red-600 focus:ring-red-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-red-700 dark:text-red-400">
                        Replace All Existing Shots in Scene
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Replaces the current shot list with these {stagedShots.length} parsed shots.
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-xs">
          {step === 1 ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleParse}
                disabled={isParsing || !sketchText.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isParsing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Parsing Scene via LLM...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Parse Sketch into Shots
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                ← Back to Input
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={stagedShots.length === 0}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Check className="w-4 h-4" />
                  Import {stagedShots.length} {stagedShots.length === 1 ? "Shot" : "Shots"} to Scene
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
