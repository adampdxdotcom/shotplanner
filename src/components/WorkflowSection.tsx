import React, { useState, useEffect, useMemo } from "react";
import { WorkflowItem, ParsedWorkflow, MediaAsset, GenerationParameters, ParameterNodeMappings, ShotItem, SceneProjectFile } from "../types";
import { getAssetMediaUrl } from "../utils/assetUrl";
import { formatShotNumber, generateSaveVideoPrefix } from "../utils/formatters";
import { copyToClipboard } from "../utils/clipboard";
import { generateLiveInjectedWorkflow } from "../utils/workflowInjection";
import { WorkflowFileSelector } from "./workflow/WorkflowFileSelector";
import { MediaLoaderMapper } from "./workflow/MediaLoaderMapper";
import { LiveWorkflowPreview } from "./workflow/LiveWorkflowPreview";
import { GenerationParametersSection } from "./GenerationParametersSection";
import { JsonViewerWithSearch } from "./JsonViewerWithSearch";
import { workflowsApi } from "../api";
import { 
  Workflow, 
  Layers, 
  Type, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  Music, 
  ArrowRight, 
  Code, 
  Check, 
  Copy,
  FileJson,
  AlertTriangle,
  RefreshCw
} from "lucide-react";

/**
 * Performs live in-memory injection of active shot assets, prompt, and parameters
 * into the workflow canvas JSON for instant preview and copy.
 */

export interface WorkflowSectionProps {
  activeSceneName: string;
  workflows: WorkflowItem[];
  selectedWorkflowFile: string;
  onSelectWorkflow: (filename: string) => void;
  onRefreshWorkflows: () => void;
  parsedWorkflow: ParsedWorkflow | null;
  selectedPromptNodeId: string;
  onSelectPromptNodeId: (nodeId: string) => void;
  nodeMappings: Record<string, string>;
  onUpdateMapping: (nodeId: string, filename: string) => void;
  uploadedAssets: MediaAsset[];
  bypassMissing: boolean;
  onToggleBypass: (val: boolean) => void;
  generationParams: GenerationParameters;
  onUpdateParam: (key: keyof GenerationParameters, value: number) => void;
  parameterNodeMappings: ParameterNodeMappings;
  onUpdateParameterMapping: (key: keyof ParameterNodeMappings, nodeId: string) => void;
  activeShotId: string | null;
  onSelectShot: (id: string | null) => void;
  sceneProject: SceneProjectFile;
  onUpdateShot: (updater: (prev: ShotItem) => ShotItem) => void;
  onUpdateProject?: React.Dispatch<React.SetStateAction<SceneProjectFile>> | ((updater: (prev: SceneProjectFile) => SceneProjectFile) => void);
  onOpenScenePlan?: () => void;
  hasScenePlan?: boolean;
}

export const WorkflowSection: React.FC<WorkflowSectionProps> = ({
  workflows,
  selectedWorkflowFile,
  onSelectWorkflow,
  onRefreshWorkflows,
  parsedWorkflow,
  selectedPromptNodeId,
  onSelectPromptNodeId,
  nodeMappings,
  onUpdateMapping,
  uploadedAssets,
  bypassMissing,
  onToggleBypass,
  generationParams,
  onUpdateParam,
  parameterNodeMappings,
  onUpdateParameterMapping,
  activeShotId,
  onSelectShot,
  sceneProject,
  onUpdateShot,
  onUpdateProject,
  activeSceneName,
  onOpenScenePlan,
  hasScenePlan = false
}) => {
  const [uploading, setUploading] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);

  const promptNodes = parsedWorkflow?.nodes_info?.prompt_nodes || [];
  const imageNodes = parsedWorkflow?.nodes_info?.image_loader_nodes || [];
  const videoNodes = parsedWorkflow?.nodes_info?.video_loader_nodes || [];
  const audioNodes = parsedWorkflow?.nodes_info?.audio_loader_nodes || [];

  const activeShot = sceneProject.shots.find((s) => s.id === activeShotId);

  const handleAddBlankShot = () => {
    if (!onUpdateProject) return;
    const newId = "shot_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
    onUpdateProject(prev => {
      const newShot: ShotItem = {
        id: newId,
        shot_number: prev.shots.length + 1,
        shot_type: "Medium Shot",
        camera_movement: "Locked Off",
        lens_focal_length: "50mm Standard Prime",
        aspect_ratio: "16:9 Widescreen",
        basic_stub: "",
        expanded_prompt: "",
        assigned_slots: {},
        status: "unstaged",
        takes: [],
        updated_at: new Date().toISOString()
      };
      return { ...prev, shots: [...prev.shots, newShot] };
    });
    onSelectShot(newId);
  };

  const handleDuplicateShot = () => {
    if (!onUpdateProject || !activeShot) return;
    const newId = "shot_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
    onUpdateProject(prev => {
      const duplicatedShot: ShotItem = {
        ...activeShot,
        id: newId,
        shot_number: prev.shots.length + 1,
        shot_name: activeShot.shot_name ? `${activeShot.shot_name} (Copy)` : undefined,
        status: "unstaged",
        takes: [],
        hero_take_id: undefined,
        assigned_slots: { ...(activeShot.assigned_slots || {}) },
        characters: activeShot.characters ? [...activeShot.characters] : [],
        updated_at: new Date().toISOString()
      };
      return { ...prev, shots: [...prev.shots, duplicatedShot] };
    });
    onSelectShot(newId);
  };

  const rawWorkflowData = parsedWorkflow?.raw_json || parsedWorkflow?.workflow || parsedWorkflow?.raw_workflow;

  // Compute live in-memory injected workflow JSON for the active shot
  const liveInjectedWorkflow = useMemo(() => {
    return generateLiveInjectedWorkflow(
      rawWorkflowData,
      activeShot,
      selectedPromptNodeId,
      nodeMappings,
      bypassMissing,
      generationParams,
      parameterNodeMappings,
      activeSceneName || sceneProject.scene_name,
      imageNodes
    );
  }, [
    rawWorkflowData,
    activeShot,
    selectedPromptNodeId,
    nodeMappings,
    bypassMissing,
    generationParams,
    parameterNodeMappings,
    activeSceneName,
    sceneProject.scene_name,
    imageNodes
  ]);

  const handleCopyJson = async () => {
    const targetJson = liveInjectedWorkflow || rawWorkflowData;
    if (!targetJson) return;
    try {
      const textToCopy = JSON.stringify(targetJson, null, 2);
      const success = await copyToClipboard(textToCopy);
      if (success) {
        setCopiedJson(true);
        setTimeout(() => setCopiedJson(false), 2000);
      }
    } catch (err) {
      console.error("Failed to copy JSON:", err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".json")) {
      setUploadError("Only .json ComfyUI workflow files are allowed.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("scene_name", activeSceneName);

    try {
      const data: any = await workflowsApi.upload(formData);
      if (data && data.filename) {
        onRefreshWorkflows();
        onSelectWorkflow(data.filename);
        if (activeShotId) {
          onUpdateShot(prev => ({ ...prev, workflow_file: data.filename }));
        }
      } else {
        setUploadError(data?.error || "Failed to upload workflow");
      }
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div id="workflow-section" className="w-full space-y-5 flex flex-col min-h-0">
      <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-700 rounded-xl p-5 shadow-xs space-y-5">
        <WorkflowFileSelector 
          activeShotId={activeShotId}
          parsedWorkflow={parsedWorkflow}
          workflows={workflows}
          selectedWorkflowFile={selectedWorkflowFile}
          onSelectWorkflow={onSelectWorkflow}
          onRefreshWorkflows={onRefreshWorkflows}
          handleFileUpload={handleFileUpload}
          uploading={uploading}
          uploadError={uploadError}
          bypassMissing={bypassMissing}
          onToggleBypass={() => onToggleBypass(!bypassMissing)}
          showRawJson={showRawJson}
          setShowRawJson={setShowRawJson}
        />

        {!activeShotId ? (
          <div className="flex flex-col items-center justify-center p-8 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-lg text-center space-y-2">
            <Layers className="w-8 h-8 text-zinc-400 dark:text-zinc-500" />
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-300">Scene-Wide Workflow Active</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md">
              Workflows can be uploaded and inspected at any time. Select a shot above to map assets to node inputs and adjust per-shot generation parameters.
            </p>
          </div>
        ) : (
          parsedWorkflow && (
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/80 space-y-5">
              <GenerationParametersSection
                detectedNodes={parsedWorkflow.detected_nodes || parsedWorkflow.nodes_info?.detected_nodes}
                generationParams={generationParams}
                onChangeParam={onUpdateParam}
                parameterNodeMappings={parameterNodeMappings}
                onChangeParameterMapping={onUpdateParameterMapping}
                parsedWorkflow={parsedWorkflow}
                workflowFilename={selectedWorkflowFile}
                promptNodes={promptNodes}
                selectedPromptNodeId={selectedPromptNodeId}
                onSelectPromptNodeId={onSelectPromptNodeId}
                activeShot={activeShot}
              />

              <MediaLoaderMapper 
                imageNodes={imageNodes}
                videoNodes={videoNodes}
                audioNodes={audioNodes}
                activeShot={activeShot}
                activeShotId={activeShotId}
                nodeMappings={nodeMappings}
                uploadedAssets={uploadedAssets}
                onUpdateMapping={onUpdateMapping}
                onUpdateShot={onUpdateShot}
              />
            </div>
          )
        )}
      </div>

      <LiveWorkflowPreview 
        showRawJson={showRawJson}
        liveInjectedWorkflow={liveInjectedWorkflow}
        parsedWorkflowRaw={rawWorkflowData}
        handleCopyJson={handleCopyJson}
        copiedJson={copiedJson}
        activeShotNumber={activeShot ? formatShotNumber(activeShot.shot_number) : "01"}
        isVisualWorkflow={Boolean(parsedWorkflow?.is_visual || Array.isArray(rawWorkflowData?.nodes))}
        nodeCount={parsedWorkflow?.node_count || (Array.isArray(rawWorkflowData?.nodes) ? rawWorkflowData.nodes.length : (rawWorkflowData ? Object.keys(rawWorkflowData).length : 0))}
      />
    </div>
  );
};