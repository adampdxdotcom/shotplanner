import { isCacheOrTempWorkflow } from "../../server/utils/workflowFilter";
import { RemoteWorkflowItem } from "../types";

/**
 * Filters a list of remote workflows, removing cache, temporary, autosaves,
 * system files, and checkpoint duplicates.
 */
export function filterRemoteWorkflows(workflows: RemoteWorkflowItem[]): RemoteWorkflowItem[] {
  if (!Array.isArray(workflows)) return [];
  return workflows.filter(wf => !isCacheOrTempWorkflow(wf.filename, wf.folder, wf.path));
}
