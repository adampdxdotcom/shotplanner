import React, { useState, useEffect, useMemo } from "react";
import { WorkflowItem, ParsedWorkflow, MediaAsset, GenerationParameters, ParameterNodeMappings, ShotItem, SceneProjectFile } from "../types";
import { getAssetMediaUrl } from "../utils/assetUrl";
import { formatShotNumber, generateSaveVideoPrefix } from "../utils/formatters";
import { copyToClipboard } from "../utils/clipboard";
import { generateLiveInjectedWorkflow } from "../utils/workflowInjection";
import { WorkflowHeaderControls } from "./workflow/WorkflowHeaderControls";
import { WorkflowFileSelector } from "./workflow/WorkflowFileSelector";
import { PromptNodeSelector } from "./workflow/PromptNodeSelector";
import { MediaLoaderMapper } from "./workflow/MediaLoaderMapper";
import { LiveWorkflowPreview } from "./workflow/LiveWorkflowPreview";
import { GenerationParametersSection } from "./GenerationParametersSection";
import { JsonViewerWithSearch } from "./JsonViewerWithSearch";
import { 
  Workflow, 
  Upload, 
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
  activeSceneName
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

    if (!file.name.endsWith(".json")) {
      setUploadError("Only .json ComfyUI workflow files are allowed.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("scene_name", activeSceneName);

    try {
      const res = await fetch("/api/workflows/upload", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        onRefreshWorkflows();
        onSelectWorkflow(data.filename);
        if (activeShotId) {
          onUpdateShot(prev => ({ ...prev, workflow_file: data.filename }));
        }
      } else {
        setUploadError(data.error || "Failed to upload workflow");
      }
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div id="workflow-section" className="space-y-5 flex flex-col min-h-0">
      <WorkflowHeaderControls 
        activeShotId={activeShotId}
        onSelectShot={onSelectShot}
        shots={sceneProject.shots}
        activeShot={activeShot}
      />

      {!activeShotId ? (
        <div className="flex flex-col items-center justify-center p-12 bg-zinc-900/40 border-2 border-dashed border-zinc-800 rounded-xl">
          <Layers className="w-12 h-12 text-zinc-600 mb-4" />
          <h2 className="text-xl font-semibold text-zinc-300 mb-2">No Shot Selected</h2>
          <p className="text-sm text-zinc-500 text-center max-w-md">
            Please select a shot from the top dropdown or the Scene Planning panel to configure its workflow mapping.
          </p>
        </div>
      ) : (
        <div className="bg-zinc-900/60 border-2 border-zinc-700 rounded-xl p-5 shadow-sm space-y-5">
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

          {parsedWorkflow && (
            <div className="pt-2 border-t border-zinc-800/80 space-y-5">
              <GenerationParametersSection
                generationParams={generationParams}
                onUpdateParam={onUpdateParam}
                parameterNodeMappings={parameterNodeMappings}
                onUpdateParameterMapping={onUpdateParameterMapping}
                parsedWorkflow={parsedWorkflow}
              />

              <PromptNodeSelector 
                promptNodes={promptNodes}
                selectedPromptNodeId={selectedPromptNodeId}
                onSelectPromptNodeId={onSelectPromptNodeId}
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
          )}
        </div>
      )}

      <LiveWorkflowPreview 
        showRawJson={showRawJson}
        liveInjectedWorkflow={liveInjectedWorkflow}
        parsedWorkflowRaw={parsedWorkflow?.raw_json}
        handleCopyJson={handleCopyJson}
        copiedJson={copiedJson}
      />
    </div>
  );
};