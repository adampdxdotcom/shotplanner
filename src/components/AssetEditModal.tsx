import React, { useState, useEffect, useMemo } from "react";
import { AppConfig, MediaAsset, SceneProjectFile, ImageVisualAnalysis } from "../types";
import { Edit3, X, AlertCircle, Sparkles, Loader2 } from "lucide-react";
import { SubjectCombobox } from "./SubjectCombobox";
import { getAssetMediaUrl } from "../utils/assetUrl";
import { 
  getModifierConfig,
  updateDescriptionWithModifier, 
  detectActiveModifier 
} from "../utils/assetModifiers";
import { useVisionCaption, generateCaptionForFile, generateCaptionForAsset } from "../hooks/useVisionCaption";
import { assetsApi } from "../api";
import {
  PRESET_TYPES,
  AssetPreviewHeaderCard,
  AssetReferenceTypeSelector,
  AssetFileReplacementSection,
  VisualIntelligenceBreakdownEditor,
  VisualIntelligenceBreakdownValues
} from "./assetManager/edit";

interface AssetEditModalProps {
  asset: MediaAsset | null;
  subjects: string[];
  characters: Record<string, any>;
  config?: AppConfig;
  sceneProject?: SceneProjectFile;
  onUpdateProject?: React.Dispatch<React.SetStateAction<any>>;
  onRegisterSubject?: (name: string) => void;
  onClose: () => void;
  onAssetUpdated: (oldFilename: string, newAsset: MediaAsset) => void;
}

const DEFAULT_VI_VALUES: VisualIntelligenceBreakdownValues = {
  summary: "",
  subjectIdentifiedName: "",
  subjectAge: "",
  subjectExpression: "",
  subjectHair: "",
  wardrobeGarments: "",
  wardrobeColors: "",
  wardrobeEra: "",
  lightingQuality: "",
  lightingDirection: "",
  lightingTemp: "",
  cinemaFraming: "",
  cinemaLens: "",
  cinemaAngle: "",
  envLocationType: "",
  envPalette: ""
};

export const AssetEditModal: React.FC<AssetEditModalProps> = ({
  asset,
  subjects,
  characters,
  config,
  sceneProject,
  onUpdateProject,
  onRegisterSubject,
  onClose,
  onAssetUpdated
}) => {
  const [assetType, setAssetType] = useState<string>("Headshot");
  const [customType, setCustomType] = useState<string>("");
  const [selectedModifier, setSelectedModifier] = useState<string>("");
  const [editSubjectName, setEditSubjectName] = useState<string>("");
  const [editDescription, setEditDescription] = useState<string>("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [isReplacingFile, setIsReplacingFile] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [isCaptioning, setIsCaptioning] = useState(false);
  const [captionToast, setCaptionToast] = useState<string | null>(null);

  // Editable Visual Intelligence Breakdown Fields
  const [viValues, setViValues] = useState<VisualIntelligenceBreakdownValues>(DEFAULT_VI_VALUES);

  const visionState = useVisionCaption(config);

  const handleViChange = <K extends keyof VisualIntelligenceBreakdownValues>(
    field: K,
    val: VisualIntelligenceBreakdownValues[K]
  ) => {
    setViValues(prev => ({ ...prev, [field]: val }));
  };

  useEffect(() => {
    if (asset) {
      const rawType = asset.type || "Headshot";
      const matchingPreset = PRESET_TYPES.find(p => p.value.toLowerCase() === rawType.toLowerCase());

      if (matchingPreset && matchingPreset.value !== "Other") {
        setAssetType(matchingPreset.value);
        setCustomType("");
      } else {
        const lower = rawType.toLowerCase();
        if (lower.includes("headshot")) {
          setAssetType("Headshot");
          setCustomType("");
        } else if (lower.includes("body") || lower.includes("outfit")) {
          setAssetType("Body Reference");
          setCustomType("");
        } else if (lower.includes("scene") || lower.includes("location")) {
          setAssetType("Scene / Location");
          setCustomType("");
        } else if (lower.includes("object") || lower.includes("prop")) {
          setAssetType("Object / Prop");
          setCustomType("");
        } else if (lower.includes("style") || lower.includes("mood")) {
          setAssetType("Style / Mood");
          setCustomType("");
        } else {
          setAssetType("Other");
          setCustomType(rawType);
        }
      }

      const effective = matchingPreset ? matchingPreset.value : rawType;
      const detectedMod = detectActiveModifier(asset.description || "", effective);
      setSelectedModifier(detectedMod);
      setEditSubjectName(asset.subject_name || "");
      setEditDescription(asset.description || "");
      setIsReplacingFile(false);
      setEditFile(null);
      setEditError(null);
      setIsCaptioning(false);
      setCaptionToast(null);

      // Populate Visual Intelligence fields from project cache
      const cached = sceneProject?.visual_analysis_cache?.[asset.filename];
      if (cached) {
        setViValues({
          summary: cached.summary || "",
          subjectIdentifiedName: cached.subject?.identified_name || "",
          subjectAge: cached.subject?.apparent_age || "",
          subjectExpression: cached.subject?.expression || "",
          subjectHair: cached.subject?.hair || "",
          wardrobeGarments: cached.wardrobe?.garments || "",
          wardrobeColors: cached.wardrobe?.colors || "",
          wardrobeEra: cached.wardrobe?.era_style || "",
          lightingQuality: cached.lighting?.quality || "",
          lightingDirection: cached.lighting?.key_direction || "",
          lightingTemp: cached.lighting?.color_temperature || "",
          cinemaFraming: cached.cinematography?.framing || "",
          cinemaLens: cached.cinematography?.lens_feel || "",
          cinemaAngle: cached.cinematography?.camera_angle || "",
          envLocationType: cached.environment_palette?.location_type || cached.environment_palette?.setting || "",
          envPalette: Array.isArray(cached.environment_palette?.dominant_colors)
            ? cached.environment_palette.dominant_colors.join(", ")
            : cached.environment_palette?.dominant_colors || ""
        });
      } else {
        setViValues(DEFAULT_VI_VALUES);
      }
    }
  }, [asset, sceneProject]);

  const effectiveType = useMemo(() => {
    if (assetType === "Other") {
      return customType.trim() || "Other";
    }
    return assetType;
  }, [assetType, customType]);

  const modifierConfig = useMemo(() => getModifierConfig(effectiveType) || getModifierConfig(assetType), [effectiveType, assetType]);

  const handleModifierChange = (modValue: string) => {
    setSelectedModifier(modValue);
    setEditDescription(prev => updateDescriptionWithModifier(prev, effectiveType, modValue));
  };

  const handleRequestVisionCaption = async () => {
    if (!asset || !visionState.canCaption) return;
    setIsCaptioning(true);
    setCaptionToast(null);
    try {
      let res;
      if (isReplacingFile && editFile) {
        res = await generateCaptionForFile(editFile, {
          contextType: effectiveType,
          subjectName: editSubjectName.trim(),
          sceneName: sceneProject?.scene_name,
          filename: asset.filename,
          lmStudioUrl: visionState.lmStudioUrl
        });
      } else {
        res = await generateCaptionForAsset(asset, {
          contextType: effectiveType,
          subjectName: editSubjectName.trim(),
          sceneName: sceneProject?.scene_name,
          assetMediaUrl: getAssetMediaUrl(asset, true),
          lmStudioUrl: visionState.lmStudioUrl
        });
      }

      if (res.success && res.caption) {
        setEditDescription(res.caption);
        setCaptionToast("AI visual description generated");
        setTimeout(() => setCaptionToast(null), 3000);

        if (res.analysis) {
          const dom = res.analysis.environment_palette?.dominant_colors;
          setViValues(prev => ({
            ...prev,
            summary: res.analysis?.summary || prev.summary,
            wardrobeGarments: res.analysis?.wardrobe?.garments || prev.wardrobeGarments,
            wardrobeColors: res.analysis?.wardrobe?.colors || prev.wardrobeColors,
            wardrobeEra: res.analysis?.wardrobe?.era_style || prev.wardrobeEra,
            lightingQuality: res.analysis?.lighting?.quality || prev.lightingQuality,
            lightingDirection: res.analysis?.lighting?.key_direction || prev.lightingDirection,
            lightingTemp: res.analysis?.lighting?.color_temperature || prev.lightingTemp,
            cinemaFraming: res.analysis?.cinematography?.framing || prev.cinemaFraming,
            cinemaLens: res.analysis?.cinematography?.lens_feel || prev.cinemaLens,
            cinemaAngle: res.analysis?.cinematography?.camera_angle || prev.cinemaAngle,
            envLocationType: res.analysis?.environment_palette?.location_type || prev.envLocationType,
            envPalette: dom ? (Array.isArray(dom) ? dom.join(", ") : dom) : prev.envPalette
          }));

          if (onUpdateProject) {
            onUpdateProject((prev: any) => ({
              ...prev,
              visual_analysis_cache: {
                ...(prev?.visual_analysis_cache || {}),
                [asset.filename]: res.analysis
              }
            }));
          }
        }
      } else if (res.error) {
        setCaptionToast(`Vision notice: ${res.error}`);
        setTimeout(() => setCaptionToast(null), 4000);
      }
    } catch (err: any) {
      setCaptionToast("Failed to generate AI description");
      setTimeout(() => setCaptionToast(null), 3000);
    } finally {
      setIsCaptioning(false);
    }
  };

  const handleEditFileSelected = (file: File | null) => {
    setEditFile(file);
    setIsReplacingFile(!!file);
    setEditError(null);
    if (file && visionState.autoCaption) {
      generateCaptionForFile(file, {
        contextType: effectiveType,
        subjectName: editSubjectName.trim(),
        lmStudioUrl: visionState.lmStudioUrl
      }).then(res => {
        if (res.success && res.caption) {
          setEditDescription(res.caption);
        }
      });
    }
  };

  const handleRevertToOriginal = () => {
    setIsReplacingFile(false);
    setEditFile(null);
    setEditError(null);
  };

  const submitEdit = async () => {
    if (!asset) return;

    if (!editSubjectName.trim() || !editDescription.trim()) {
      setEditError("Subject name and visual description are required.");
      return;
    }

    setIsEditing(true);
    setEditError(null);

    const formData = new FormData();
    formData.append("original_filename", asset.filename);
    formData.append("type", effectiveType);
    formData.append("subject_name", editSubjectName.trim());
    formData.append("description", editDescription.trim());

    if (isReplacingFile && editFile) {
      formData.append("file", editFile);
    } else {
      formData.append("keep_original_file", "true");
    }

    try {
      const data: any = await assetsApi.update(encodeURIComponent(asset.filename), formData as any);

      let updatedAsset: MediaAsset = {
        ...asset,
        type: effectiveType,
        subject_name: editSubjectName.trim(),
        description: editDescription.trim()
      };

      if (data && data.asset) {
        updatedAsset = {
          ...asset,
          ...data.asset,
          type: effectiveType,
          subject_name: editSubjectName.trim(),
          description: editDescription.trim()
        };
      }

      // Persist Visual Intelligence Analysis updates to project cache
      if (onUpdateProject) {
        const updatedAnalysis: ImageVisualAnalysis = {
          filename: asset.filename,
          scanned_at: new Date().toISOString(),
          summary: viValues.summary.trim(),
          subject: {
            identified_name: viValues.subjectIdentifiedName.trim() || undefined,
            apparent_age: viValues.subjectAge.trim() || undefined,
            expression: viValues.subjectExpression.trim() || undefined,
            hair: viValues.subjectHair.trim() || undefined
          },
          wardrobe: {
            garments: viValues.wardrobeGarments.trim() || undefined,
            colors: viValues.wardrobeColors.trim() || undefined,
            era_style: viValues.wardrobeEra.trim() || undefined
          },
          lighting: {
            quality: viValues.lightingQuality.trim() || undefined,
            key_direction: viValues.lightingDirection.trim() || undefined,
            color_temperature: viValues.lightingTemp.trim() || undefined
          },
          cinematography: {
            framing: viValues.cinemaFraming.trim() || undefined,
            lens_feel: viValues.cinemaLens.trim() || undefined,
            camera_angle: viValues.cinemaAngle.trim() || undefined
          },
          environment_palette: {
            location_type: viValues.envLocationType.trim() || undefined,
            dominant_colors: viValues.envPalette.trim() || undefined
          }
        };

        onUpdateProject((prev: any) => ({
          ...prev,
          visual_analysis_cache: {
            ...(prev?.visual_analysis_cache || {}),
            [asset.filename]: updatedAnalysis
          }
        }));
      }

      onAssetUpdated(asset.filename, updatedAsset);
      onClose();
    } catch (err: any) {
      setEditError(err.message || "Failed to update asset");
    } finally {
      setIsEditing(false);
    }
  };

  if (!asset) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/50">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            Edit Asset Metadata
          </h3>
          <button 
            onClick={onClose} 
            className="text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white p-1 rounded-md hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer" 
            disabled={isEditing}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto max-h-[70vh] custom-scrollbar text-zinc-800 dark:text-zinc-200">
          {captionToast && (
            <div className="p-2.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>{captionToast}</span>
            </div>
          )}

          {/* Asset Preview Header Card */}
          <AssetPreviewHeaderCard
            asset={asset}
            effectiveType={effectiveType}
            subjectName={editSubjectName}
          />

          {/* Type of Reference & Modifier Selectors */}
          <AssetReferenceTypeSelector
            assetType={assetType}
            customType={customType}
            selectedModifier={selectedModifier}
            modifierConfig={modifierConfig}
            onTypeChange={(nextType) => {
              setAssetType(nextType);
              setSelectedModifier("");
            }}
            onCustomTypeChange={setCustomType}
            onModifierChange={handleModifierChange}
          />

          {/* Subject / Entity Name */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-400 mb-1">Subject / Entity Name</label>
            <SubjectCombobox
              value={editSubjectName}
              onChange={setEditSubjectName}
              subjects={subjects}
              characters={characters}
              onRegisterSubject={onRegisterSubject}
              assetType={effectiveType}
              placeholder={
                effectiveType === "Scene / Location" ? "e.g., Cyberpunk City, Living Room" :
                effectiveType === "Object / Prop" ? "e.g., Magic Sword, Coffee Mug" :
                "e.g., John Doe, Hero Character"
              }
            />
          </div>

          {/* Visual Description */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-400">Visual Description (for prompting)</label>
              {visionState.canCaption && (
                <button
                  type="button"
                  onClick={handleRequestVisionCaption}
                  disabled={isCaptioning}
                  className="text-[11px] text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 disabled:opacity-40 flex items-center gap-1 cursor-pointer transition-colors font-medium"
                  title="Generate AI visual caption with loaded vision model"
                >
                  {isCaptioning ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Describing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3" />
                      <span>AI Auto-Describe</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <textarea 
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={3}
              placeholder={
                effectiveType === "Scene / Location" ? "Dark rainy street lit by neon..." :
                effectiveType === "Object / Prop" ? "Glowing blue crystalline sword..." :
                "A man with short brown hair wearing a red jacket..."
              }
              className="w-full bg-white dark:bg-zinc-950 border-2 border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-zinc-200 focus:border-amber-500 transition-colors outline-none resize-none placeholder-zinc-400 dark:placeholder-zinc-600 shadow-2xs"
            />
          </div>

          {/* Visual Intelligence Breakdown (Editable) */}
          <VisualIntelligenceBreakdownEditor
            values={viValues}
            onChangeField={handleViChange}
          />

          {/* Media File Replacement Option */}
          <AssetFileReplacementSection
            asset={asset}
            isReplacingFile={isReplacingFile}
            editFile={editFile}
            onStartReplace={() => setIsReplacingFile(true)}
            onRevertToOriginal={handleRevertToOriginal}
            onFileSelected={handleEditFileSelected}
          />

          {editError && (
            <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-400">{editError}</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/30 flex justify-end gap-3">
          <button 
            onClick={onClose} 
            className="px-4 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer" 
            disabled={isEditing}
          >
            Cancel
          </button>
          <button 
            onClick={submitEdit} 
            disabled={isEditing}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-md"
          >
            {isEditing ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};
