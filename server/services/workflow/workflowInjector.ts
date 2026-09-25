import { assembleFinalPrompt, hasSceneReferencePhoto } from "../../utils/formatters";
import { assetService } from "../assetService";
import { injectWorkflowGraph } from "../../../src/shared/workflowInjectionEngine";

/**
 * Injects prompt, node mappings, media assets, generation parameters, and save video prefixes
 * into a ComfyUI workflow (both visual canvas and flat API dictionary format).
 * Delegates to the canonical shared workflow injection engine.
 */
export function injectAndPrepareWorkflowData(
  workflowData: any,
  promptNodeId: string | null | undefined,
  expandedPrompt: string,
  nodeMappings: Record<string, string>,
  bypassMissing: boolean = true,
  safePlaceholder: string = "empty.png",
  parameterOverrides: Record<string, any> = {},
  parameterNodeMappings: Record<string, string> = {},
  promptPrefix: string = "",
  saveVideoPrefix: string = "",
  aspectRatio?: string,
  loraAssignments?: Record<string, any>
): any {
  if (!workflowData) return null;

  const rawDb = assetService.getRawDatabase();
  const mappedFilenames = Object.values(nodeMappings).filter(Boolean);
  const mappedAssets = mappedFilenames.map((fn) => rawDb.find((a) => a.filename === fn)).filter(Boolean);
  const isSceneRefPresent = hasSceneReferencePhoto(mappedAssets) || hasSceneReferencePhoto(rawDb);

  const finalPrompt = assembleFinalPrompt(expandedPrompt, promptPrefix, isSceneRefPresent);

  return injectWorkflowGraph({
    workflowData,
    promptNodeId,
    finalPrompt,
    nodeMappings,
    loraAssignments,
    bypassMissing,
    safePlaceholder,
    parameterOverrides,
    parameterNodeMappings,
    saveVideoPrefix,
    aspectRatio
  });
}
