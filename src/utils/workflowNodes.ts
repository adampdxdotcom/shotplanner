import { WorkflowNodeInfo, ParsedWorkflow } from "../types";
import { isExactLoraLoader } from "../shared/comfyNodeClassifiers";

/**
 * Categorize a node based on its title and ComfyUI class type.
 */
export function categorizeWorkflowNode(classType: string = "", title: string = ""): string {
  const t = title.toLowerCase();
  const c = classType.toLowerCase();

  if (isExactLoraLoader(classType, title)) {
    return "LoRA Loader";
  }
  if (c.includes("prompt") || c.includes("cliptextencode") || t.includes("prompt") || t.includes("positive") || t.includes("negative")) {
    return "Prompt";
  }
  if (c.includes("loadimage") || t.includes("load image") || t.includes("headshot") || t.includes("body ref") || t.includes("scene ref")) {
    return "Image Loader";
  }
  if (c.includes("loadvideo") || c.includes("vhs_loadvideo") || t.includes("load video") || t.includes("motion ref")) {
    return "Video Loader";
  }
  if (c.includes("loadaudio") || c.includes("vhs_loadaudio") || t.includes("load audio") || t.includes("voiceover")) {
    return "Audio Loader";
  }
  if (c.includes("sampler") || c.includes("scheduler") || t.includes("sampler") || t.includes("step") || c.includes("fluxguidance")) {
    return "Sampler / Steps";
  }
  if (c.includes("latent") || c.includes("resolution") || c.includes("megapixels") || t.includes("resolution") || t.includes("megapixel") || c.includes("scale") || c.includes("aspectratio")) {
    return "Resolution / Latent";
  }
  if (c.includes("video") || c.includes("frame") || c.includes("duration") || c.includes("animatediff") || t.includes("video") || t.includes("frame") || t.includes("length") || c.includes("wan") || c.includes("hunyuan") || c.includes("cogvideo")) {
    return "Video / Frames";
  }
  if (c.includes("loader") || c.includes("checkpoint") || c.includes("vae") || c.includes("clip") || c.includes("unet") || c.includes("model")) {
    return "Model / Weights";
  }
  if (c.includes("save") || c.includes("preview") || t.includes("save") || t.includes("preview") || t.includes("output")) {
    return "Output / Save";
  }
  return "Utility / Other";
}

/**
 * Extracts and normalizes a complete list of nodes from any ComfyUI visual or flat workflow.
 */
export function extractAllWorkflowNodes(parsedWorkflow: ParsedWorkflow | Record<string, any> | null): WorkflowNodeInfo[] {
  if (!parsedWorkflow) return [];

  // Check if all_nodes was pre-parsed by the server
  const preParsed = (parsedWorkflow as any)?.nodes_info?.all_nodes;
  if (Array.isArray(preParsed) && preParsed.length > 0) {
    return preParsed;
  }

  const raw = (parsedWorkflow as any)?.raw_json || (parsedWorkflow as any)?.workflow || (parsedWorkflow as any)?.raw_workflow || parsedWorkflow;
  if (!raw || typeof raw !== "object") return [];

  const nodes: WorkflowNodeInfo[] = [];

  // Case 1: Standard ComfyUI Visual Canvas format
  if (Array.isArray(raw.nodes)) {
    for (const node of raw.nodes) {
      if (!node || typeof node !== "object") continue;
      const nodeId = String(node.id ?? "");
      const classType = String(node.type ?? "");
      const metaTitle = node.title || node.properties?.["Node name for S&R"] || `${classType} (#${nodeId})`;
      const widgetsValues = Array.isArray(node.widgets_values) ? node.widgets_values : [];
      const mode = node.mode ?? 0;
      const category = categorizeWorkflowNode(classType, metaTitle);

      nodes.push({
        id: nodeId,
        class_type: classType,
        title: metaTitle,
        category,
        mode,
        inputs: {
          widgets_values: widgetsValues,
          widgets_values_named: node.widgets_values_named || {},
          inputs: node.inputs || []
        }
      });
    }
  } 
  // Case 2: Flat API Dictionary format
  else {
    for (const [nodeId, nodeData] of Object.entries<any>(raw)) {
      if (!nodeData || typeof nodeData !== "object") continue;
      const classType = String(nodeData.class_type || "");
      const meta = nodeData._meta || {};
      const metaTitle = meta.title || `${classType} (#${nodeId})`;
      const inputs = nodeData.inputs || {};
      const category = categorizeWorkflowNode(classType, metaTitle);

      nodes.push({
        id: String(nodeId),
        class_type: classType,
        title: metaTitle,
        category,
        inputs
      });
    }
  }

  // Sort nodes naturally by numeric ID
  return nodes.sort((a, b) => {
    const numA = parseInt(a.id, 10);
    const numB = parseInt(b.id, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.id.localeCompare(b.id);
  });
}
