import { useState, useMemo } from "react";
import { 
  CharacterProfile, 
  UniverseCharacterProfile, 
  MediaAsset, 
  ParsedSceneSketchShot, 
  ParseSceneSketchResult,
  ShotItem,
  PromptVariation
} from "../../../types";
import { requestSceneSketchParse } from "../../../services/sceneSketchClient";
import { 
  resolveAllShotCharacters, 
  ResolvedShotCharacters,
  prepareUniverseImportPayload
} from "../../../utils/sceneSketchResolver";
import { SketchImportStep, SketchImportMode } from "./types";

interface UseSceneSketchImportProps {
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
  onClose: () => void;
}

export function useSceneSketchImport({
  existingShotsCount,
  sceneCast,
  universeCast,
  universeAssets,
  existingSceneAssets,
  lmStudioUrl,
  onImportSuccess,
  onClose
}: UseSceneSketchImportProps) {
  // Step State: 1 = Input/Upload, 2 = Review & Stage Table
  const [step, setStep] = useState<SketchImportStep>(1);
  const [sketchText, setSketchText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Staged Data
  const [stagedSceneTitle, setStagedSceneTitle] = useState("");
  const [stagedShots, setStagedShots] = useState<ParsedSceneSketchShot[]>([]);
  const [importMode, setImportMode] = useState<SketchImportMode>("append");
  const [providerUsed, setProviderUsed] = useState<string>("");
  const [cleanImport, setCleanImport] = useState(false); // False = Artistic Director (default), True = Clean Import

  // Character resolution state memoized against staged shots and cast
  const resolvedShots: ResolvedShotCharacters[] = useMemo(() => {
    return resolveAllShotCharacters(stagedShots, sceneCast, universeCast);
  }, [stagedShots, sceneCast, universeCast]);

  // Universe import summary
  const universeImportPayload = useMemo(() => {
    return prepareUniverseImportPayload(resolvedShots, universeCast, universeAssets, existingSceneAssets);
  }, [resolvedShots, universeCast, universeAssets, existingSceneAssets]);

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

  return {
    step,
    setStep,
    sketchText,
    setSketchText,
    isParsing,
    parseError,
    stagedSceneTitle,
    setStagedSceneTitle,
    stagedShots,
    importMode,
    setImportMode,
    providerUsed,
    cleanImport,
    setCleanImport,
    resolvedShots,
    universeImportPayload,
    handleParse,
    handleUpdateShotField,
    handleDeleteShot,
    handleAddShot,
    handleRemoveCharacterFromShot,
    handleConfirmImport
  };
}
