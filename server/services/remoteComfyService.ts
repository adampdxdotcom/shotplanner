import { Client } from "ssh2";
import fetch from "node-fetch";
import { SSHCredentials, resolveSSHConfig, connectSSH, execSSHCommand } from "./sshService";
import { isCacheOrTempWorkflow } from "../utils/workflowFilter";

export interface RemoteWorkflowItem {
  filename: string;
  path: string;
  folder?: string;
  size_bytes?: number;
  modified_at?: string | number;
  node_count?: number;
  source?: "ssh" | "api";
}

export interface RemoteWorkflowsResult {
  success: boolean;
  workflows: RemoteWorkflowItem[];
  message: string;
  source: "ssh" | "api" | "none";
  host?: string;
}

/**
 * Discovers workflows available on the remote ComfyUI installation.
 * Queries via SSH (primary) and falls back to ComfyUI HTTP API.
 * Focused specifically on user workflow directories:
 *   - ComfyUI/user/default/workflows/{project_name}
 *   - ComfyUI/user/default/workflows
 *   - ComfyUI/workflows
 *
 * Automatically strictly excludes non-workflow metadata (comfy.settings, custom_nodes, node_db, cache).
 */
export async function listRemoteWorkflows(
  creds: SSHCredentials & { comfyui_api_url?: string; project_name?: string }
): Promise<RemoteWorkflowsResult> {
  const resolved = resolveSSHConfig(creds);
  const comfyApiUrl = (creds.comfyui_api_url || "http://127.0.0.1:8188").replace(/\/$/, "");
  const projectName = creds.project_name ? creds.project_name.trim().replace(/[^a-zA-Z0-9_-]/g, "_") : "";

  // 1. Try SSH discovery if host is configured
  if (resolved.host && resolved.authMethod !== "None") {
    let client: Client | null = null;
    try {
      console.log(`[Remote ComfyUI] Scanning workflow directories on ${resolved.username}@${resolved.host}:${resolved.port}...`);
      client = await connectSSH(resolved.connectConfig);

      const root = resolved.remoteComfyUIRoot || "/workspace/runpod-slim/ComfyUI";

      // Focus search dirs specifically on workflows and user workflows
      const pyScript = `
import os, json

root = os.path.expanduser("${root}")
project_name = "${projectName}"

# Priority search directories specifically for workflows
search_dirs = []
if project_name:
    search_dirs.append(os.path.join(root, "user", "default", "workflows", project_name))
    search_dirs.append(os.path.join(root, "workflows", project_name))

search_dirs.extend([
    os.path.join(root, "user", "default", "workflows"),
    os.path.join(root, "workflows"),
    os.path.join(root, "user", "default"),
    os.path.join(root, "user")
])

# Strict directory exclusion - never scan custom nodes, manager db, cache, or models
exclude_dirs = {
    ".git", "node_modules", "models", "venv", ".venv", "env",
    "__pycache__", "input", "output", ".cache", "cache", "dist",
    "temp", "tmp", ".temp", ".tmp", "logs", "custom_nodes",
    "comfyui-manager", "node_db", ".vscode", ".idea"
}

# Excluded filename prefixes or patterns
exclude_prefixes = ("autosave", "auto_save", "temp_", "tmp_", "cache_", "backup_", ".", "~", "_", "preview_")
exclude_substrings = (".cache.", ".bak", ".backup", "-checkpoint", ".tmp.", ".swp", "settings", "model-list", "github-stats", "extras", "extension-node-map", "custom-node-list", "alter-list")

results = []
seen = set()

for sdir in search_dirs:
    if not os.path.exists(sdir):
        continue
    for r, dirs, files in os.walk(sdir):
        dirs[:] = [d for d in dirs if d.lower() not in exclude_dirs and not d.startswith(".")]
        for f in files:
            f_lower = f.lower()
            if not f_lower.endswith(".json"):
                continue
            if any(f_lower.startswith(p) for p in exclude_prefixes):
                continue
            if any(sub in f_lower for sub in exclude_substrings):
                continue
            if f_lower in {"comfy.settings.json", "comfyui.json", "package.json", "tsconfig.json"}:
                continue

            fp = os.path.join(r, f)
            if fp in seen:
                continue
            seen.add(fp)
            try:
                stat = os.stat(fp)
                node_count = 0
                is_valid_workflow = False
                try:
                    with open(fp, "r", encoding="utf-8", errors="ignore") as jf:
                        data = json.load(jf)
                        if isinstance(data, dict):
                            # ComfyUI UI format: has 'nodes' array
                            if "nodes" in data and isinstance(data["nodes"], list):
                                node_count = len(data["nodes"])
                                is_valid_workflow = True
                            # ComfyUI API / prompt format: dictionary of node IDs with 'class_type'
                            elif any(isinstance(v, dict) and "class_type" in v for v in data.values()):
                                node_count = sum(1 for v in data.values() if isinstance(v, dict) and "class_type" in v)
                                is_valid_workflow = True
                except:
                    pass
                
                # Only include files verified to contain ComfyUI workflow structures
                if not is_valid_workflow:
                    continue

                rel = os.path.relpath(fp, root)
                folder = os.path.dirname(rel)
                results.append({
                    "filename": f,
                    "path": rel,
                    "folder": folder if folder and folder != "." else "workflows",
                    "size_bytes": stat.st_size,
                    "modified_at": int(stat.st_mtime),
                    "node_count": node_count,
                    "source": "ssh"
                })
            except:
                pass
            if len(results) >= 100:
                break
        if len(results) >= 100:
            break
    if len(results) >= 100:
        break

print(json.dumps(results))
`.trim();

      const cmd = `python3 -c '${pyScript.replace(/'/g, "'\\''")}'`;
      const { stdout, stderr, code } = await execSSHCommand(client, cmd);

      try { client.end(); } catch {}

      if (code === 0 && stdout.trim()) {
        try {
          const parsed = JSON.parse(stdout.trim());
          if (Array.isArray(parsed) && parsed.length > 0) {
            const cleanedWorkflows = parsed.filter((w: any) => !isCacheOrTempWorkflow(w.filename, w.folder, w.path));
            console.log(`[Remote ComfyUI] Found ${cleanedWorkflows.length} genuine workflows via SSH.`);
            return {
              success: true,
              workflows: cleanedWorkflows,
              message: `Discovered ${cleanedWorkflows.length} workflow(s) in remote ComfyUI.`,
              source: "ssh",
              host: resolved.host
            };
          }
        } catch (parseErr) {
          console.warn("[Remote ComfyUI] Failed to parse Python discovery JSON:", stdout);
        }
      }

      // Fallback shell find command specifically in workflows directory
      client = await connectSSH(resolved.connectConfig);
      const findCmd = `find "${root}/user/default/workflows" "${root}/workflows" -maxdepth 3 -name "*.json" -not -path "*/.git/*" -not -path "*/custom_nodes/*" -not -name "autosave*" -not -name "temp_*" -not -name ".*" -not -name "comfy.settings*" 2>/dev/null | head -n 50`;
      const findRes = await execSSHCommand(client, findCmd);
      try { client.end(); } catch {}

      const lines = findRes.stdout.trim().split("\n").filter(Boolean);
      if (lines.length > 0) {
        const workflows: RemoteWorkflowItem[] = lines
          .map((fullPath) => {
            const filename = fullPath.split("/").pop() || "workflow.json";
            const rel = fullPath.startsWith(root) ? fullPath.slice(root.length).replace(/^\//, "") : filename;
            const folder = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "workflows";
            return {
              filename,
              path: rel,
              folder,
              source: "ssh" as const
            };
          })
          .filter((w) => !isCacheOrTempWorkflow(w.filename, w.folder, w.path));

        return {
          success: true,
          workflows,
          message: `Discovered ${workflows.length} workflow(s) in remote ComfyUI.`,
          source: "ssh",
          host: resolved.host
        };
      }
    } catch (sshErr: any) {
      console.warn(`[Remote ComfyUI] SSH discovery failed: ${sshErr.message}. Attempting ComfyUI HTTP API...`);
    } finally {
      if (client) {
        try { client.end(); } catch {}
      }
    }
  }

  // 2. Try ComfyUI HTTP API if reachable
  if (comfyApiUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      // Query ComfyUI userdata / workflows API endpoints
      const testUrls = [
        `${comfyApiUrl}/api/userdata/workflows`,
        `${comfyApiUrl}/userdata?file=workflows/`,
        `${comfyApiUrl}/api/workflows`
      ];

      for (const url of testUrls) {
        try {
          const res = await fetch(url, { signal: controller.signal });
          if (res.ok) {
            const data: any = await res.json();
            clearTimeout(timeout);

            let rawList: any[] = [];
            if (Array.isArray(data)) {
              rawList = data;
            } else if (data && typeof data === "object") {
              rawList = Array.isArray(data.workflows) ? data.workflows : Object.keys(data);
            }

            if (rawList.length > 0) {
              const workflows: RemoteWorkflowItem[] = rawList
                .map((item) => {
                  const name = typeof item === "string" ? item : (item.name || item.filename || "workflow.json");
                  const cleanName = name.replace(/^workflows\//, "");
                  return {
                    filename: cleanName.split("/").pop() || cleanName,
                    path: name,
                    folder: cleanName.includes("/") ? cleanName.slice(0, cleanName.lastIndexOf("/")) : "workflows",
                    source: "api" as const
                  };
                })
                .filter((w) => !isCacheOrTempWorkflow(w.filename, w.folder, w.path));

              return {
                success: true,
                workflows,
                message: `Discovered ${workflows.length} workflow(s) via ComfyUI API.`,
                source: "api",
                host: resolved.host
              };
            }
          }
        } catch {
          // continue to next endpoint
        }
      }
      clearTimeout(timeout);
    } catch (apiErr: any) {
      // API unreachable
    }
  }

  // 3. Return informative message if no remote host or connection succeeded
  const hostLabel = resolved.host ? `${resolved.username}@${resolved.host}:${resolved.port}` : "No SSH host configured";
  return {
    success: false,
    workflows: [],
    message: resolved.host
      ? `Could not connect to remote host (${hostLabel}) or ComfyUI API (${comfyApiUrl}). Please check SSH credentials in Settings.`
      : "No remote GPU host configured. Enter your RunPod / SSH credentials in Settings to scan remote ComfyUI workflows.",
    source: "none"
  };
}
