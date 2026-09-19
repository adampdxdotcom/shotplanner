import { describe, it, expect } from "vitest";
import { isCacheOrTempWorkflow } from "../../server/utils/workflowFilter";
import { filterRemoteWorkflows } from "../utils/remoteWorkflowFilter";
import { RemoteWorkflowItem } from "../types";

describe("Workflow Cache, Temp & Non-Workflow Filter", () => {
  it("identifies cache, autosave, and temp files correctly", () => {
    expect(isCacheOrTempWorkflow("autosave_123.json", "workflows", "workflows/autosave_123.json")).toBe(true);
    expect(isCacheOrTempWorkflow("temp_workflow.json", "workflows", "workflows/temp_workflow.json")).toBe(true);
    expect(isCacheOrTempWorkflow(".hidden_workflow.json", "workflows", "workflows/.hidden_workflow.json")).toBe(true);
    expect(isCacheOrTempWorkflow("preview_wf.json", "workflows", "workflows/preview_wf.json")).toBe(true);
    expect(isCacheOrTempWorkflow("my_workflow.bak.json", "workflows", "workflows/my_workflow.bak.json")).toBe(true);
    expect(isCacheOrTempWorkflow("checkpoint-checkpoint.json", "workflows", "workflows/checkpoint-checkpoint.json")).toBe(true);
  });

  it("identifies non-workflow system files and manager lists correctly", () => {
    expect(isCacheOrTempWorkflow("comfy.settings.json", "user/default", "user/default/comfy.settings.json")).toBe(true);
    expect(isCacheOrTempWorkflow("model-list.json", "custom_nodes", "custom_nodes/model-list.json")).toBe(true);
    expect(isCacheOrTempWorkflow("extension-node-map.json", "node_db", "node_db/extension-node-map.json")).toBe(true);
    expect(isCacheOrTempWorkflow("package.json", "root", "package.json")).toBe(true);
  });

  it("identifies cache and temporary folders correctly", () => {
    expect(isCacheOrTempWorkflow("workflow.json", ".cache", ".cache/workflow.json")).toBe(true);
    expect(isCacheOrTempWorkflow("workflow.json", "cache", "user/cache/workflow.json")).toBe(true);
    expect(isCacheOrTempWorkflow("workflow.json", "__pycache__", "custom_nodes/__pycache__/workflow.json")).toBe(true);
    expect(isCacheOrTempWorkflow("workflow.json", "custom_nodes", "custom_nodes/workflow.json")).toBe(true);
    expect(isCacheOrTempWorkflow("workflow.json", "temp", "temp/workflow.json")).toBe(true);
  });

  it("keeps legitimate user workflows intact", () => {
    expect(isCacheOrTempWorkflow("txt2img_flux.json", "user/default/workflows", "user/default/workflows/txt2img_flux.json")).toBe(false);
    expect(isCacheOrTempWorkflow("portrait_cinematic.json", "user/default/workflows/project1", "user/default/workflows/project1/portrait_cinematic.json")).toBe(false);
    expect(isCacheOrTempWorkflow("animatediff_v3.json", "workflows", "workflows/animatediff_v3.json")).toBe(false);
  });

  it("filters a mixed list of workflow items correctly", () => {
    const rawList: RemoteWorkflowItem[] = [
      { filename: "good_workflow.json", path: "user/default/workflows/good_workflow.json", folder: "user/default/workflows" },
      { filename: "comfy.settings.json", path: "user/default/comfy.settings.json", folder: "user/default" },
      { filename: "autosave_temp.json", path: "user/autosave_temp.json", folder: "user" },
      { filename: "cache_file.json", path: "cache/cache_file.json", folder: "cache" },
      { filename: "cinematic_shot.json", path: "user/default/workflows/my_project/cinematic_shot.json", folder: "user/default/workflows/my_project" },
      { filename: ".dotfile.json", path: ".dotfile.json", folder: "root" }
    ];

    const filtered = filterRemoteWorkflows(rawList);
    expect(filtered).toHaveLength(2);
    expect(filtered.map(w => w.filename)).toEqual(["good_workflow.json", "cinematic_shot.json"]);
  });
});
