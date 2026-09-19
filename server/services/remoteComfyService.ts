import fs from "fs";
import path from "path";
import { Client } from "ssh2";
import nodeFetchModule from "node-fetch";

const getFetch = (): typeof fetch => {
  if (typeof globalThis.fetch === "function") {
    return globalThis.fetch as typeof fetch;
  }
  return ((nodeFetchModule as any).default || nodeFetchModule) as typeof fetch;
};
import { SSHCredentials, resolveSSHConfig, connectSSH, execSSHCommand } from "./sshService";
import { isCacheOrTempWorkflow } from "../utils/workflowFilter";
import { WORKFLOWS_DIR, getSceneDirectories, formatSceneFolderName } from "../config/constants";
import { parseWorkflowData } from "./workflowService";

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
      const timeout = setTimeout(() => controller.abort(), 1500);

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

/**
 * Fetches the raw JSON content of a remote workflow file.
 */
export async function fetchRemoteWorkflowJson(
  creds: SSHCredentials & { comfyui_api_url?: string },
  remotePath: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const resolved = resolveSSHConfig(creds);
  const comfyApiUrl = (creds.comfyui_api_url || "http://127.0.0.1:8188").replace(/\/$/, "");
  const root = resolved.remoteComfyUIRoot || "/workspace/runpod-slim/ComfyUI";

  // 1. Try SSH fetch
  if (resolved.host && resolved.authMethod !== "None") {
    let client: Client | null = null;
    try {
      client = await connectSSH(resolved.connectConfig);
      const fullPath = remotePath.startsWith("/") ? remotePath : `${root}/${remotePath}`;
      const escapedPath = fullPath.replace(/"/g, '\\"');
      const { stdout, code } = await execSSHCommand(client, `cat "${escapedPath}"`);
      try { client.end(); } catch {}

      if (code === 0 && stdout.trim()) {
        try {
          const parsed = JSON.parse(stdout.trim());
          return { success: true, data: parsed };
        } catch (e: any) {
          return { success: false, error: `Invalid JSON returned from remote file: ${e.message}` };
        }
      }
    } catch (sshErr: any) {
      console.warn(`[Remote ComfyUI] SSH fetch failed for ${remotePath}: ${sshErr.message}`);
    } finally {
      if (client) {
        try { client.end(); } catch {}
      }
    }
  }

  // 2. Try HTTP API fetch
  if (comfyApiUrl) {
    const cleanPath = remotePath.replace(/^\//, "");
    const testUrls = [
      `${comfyApiUrl}/api/userdata/workflows/${cleanPath}`,
      `${comfyApiUrl}/userdata?file=workflows/${cleanPath}`,
      `${comfyApiUrl}/userdata?file=${cleanPath}`,
      `${comfyApiUrl}/api/view?filename=${cleanPath}&type=workflow`
    ];

    for (const url of testUrls) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data === "object") {
            return { success: true, data };
          }
        }
      } catch {}
    }
  }

  return {
    success: false,
    error: `Could not fetch remote workflow at '${remotePath}'. Check connection settings.`
  };
}

/**
 * Synchronizes a remote workflow file to local disk and parses schema metadata.
 */
export async function syncRemoteWorkflowToLocal(
  creds: SSHCredentials & { comfyui_api_url?: string },
  remotePath: string,
  sceneName: string = "scene01"
): Promise<{
  success: boolean;
  filename: string;
  folder: string;
  parsed?: any;
  raw_workflow?: any;
  error?: string;
}> {
  const fetchRes = await fetchRemoteWorkflowJson(creds, remotePath);
  if (!fetchRes.success || !fetchRes.data) {
    return {
      success: false,
      filename: path.basename(remotePath),
      folder: "workflows",
      error: fetchRes.error || "Failed to download remote workflow."
    };
  }

  const rawWorkflow = fetchRes.data;
  const filename = path.basename(remotePath);
  const sceneFolder = formatSceneFolderName(sceneName);

  const sceneWfDir = getSceneDirectories(sceneName).workflows;
  const globalSceneWfDir = path.join(WORKFLOWS_DIR, sceneFolder);

  if (!fs.existsSync(sceneWfDir)) fs.mkdirSync(sceneWfDir, { recursive: true });
  if (!fs.existsSync(globalSceneWfDir)) fs.mkdirSync(globalSceneWfDir, { recursive: true });
  if (!fs.existsSync(WORKFLOWS_DIR)) fs.mkdirSync(WORKFLOWS_DIR, { recursive: true });

  const targetScenePath = path.join(sceneWfDir, filename);
  const targetGlobalScenePath = path.join(globalSceneWfDir, filename);
  const targetRootPath = path.join(WORKFLOWS_DIR, filename);

  const jsonContent = JSON.stringify(rawWorkflow, null, 2);
  fs.writeFileSync(targetScenePath, jsonContent, "utf-8");
  fs.writeFileSync(targetGlobalScenePath, jsonContent, "utf-8");
  fs.writeFileSync(targetRootPath, jsonContent, "utf-8");

  const parsed = parseWorkflowData(rawWorkflow);

  console.log(`[Remote Workflow Sync] Successfully synced "${filename}" for scene "${sceneFolder}"`);

  return {
    success: true,
    filename,
    folder: sceneFolder,
    parsed: {
      detected_nodes: parsed.detectedNodes,
      detected_values: parsed.detectedValues,
      nodes_info: {
        prompt_nodes: parsed.promptNodes,
        image_loader_nodes: parsed.imageLoaderNodes,
        video_loader_nodes: parsed.videoLoaderNodes,
        audio_loader_nodes: parsed.audioLoaderNodes,
        detected_nodes: parsed.detectedNodes,
        total_nodes: parsed.totalNodes
      }
    },
    raw_workflow: rawWorkflow
  };
}

/**
 * Queries remote ComfyUI's /object_info endpoint for complete node schema discovery.
 */
export async function getRemoteComfyObjectInfo(
  creds: SSHCredentials & { comfyui_api_url?: string }
): Promise<{ success: boolean; object_info?: any; embeddings?: any; error?: string }> {
  const comfyApiUrl = (creds.comfyui_api_url || "http://127.0.0.1:8188").replace(/\/$/, "");

  // 1. Direct HTTP call if reachable
  if (comfyApiUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(`${comfyApiUrl}/object_info`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const objectInfo = await res.json();
        let embeddings: any = [];
        try {
          const embRes = await fetch(`${comfyApiUrl}/embeddings`, { signal: controller.signal });
          if (embRes.ok) embeddings = await embRes.json();
        } catch {}
        return { success: true, object_info: objectInfo, embeddings };
      }
    } catch {}
  }

  // 2. SSH fallback
  const resolved = resolveSSHConfig(creds);
  if (resolved.host && resolved.authMethod !== "None") {
    let client: Client | null = null;
    try {
      client = await connectSSH(resolved.connectConfig);
      const { stdout, code } = await execSSHCommand(client, `curl -s "http://127.0.0.1:8188/object_info"`);
      try { client.end(); } catch {}
      if (code === 0 && stdout.trim()) {
        try {
          const parsed = JSON.parse(stdout.trim());
          return { success: true, object_info: parsed };
        } catch {}
      }
    } catch (e: any) {
      return { success: false, error: `SSH object_info query failed: ${e.message}` };
    } finally {
      if (client) {
        try { client.end(); } catch {}
      }
    }
  }

  return { success: false, error: "Could not query ComfyUI /object_info endpoint." };
}

export interface QueuePromptResult {
  success: boolean;
  prompt_id?: string;
  number?: number;
  node_errors?: any;
  error?: string;
  dispatch_method: "direct_http" | "ssh_bridge" | "failed";
  details?: string;
}

/**
 * Submits an API prompt graph directly to ComfyUI via HTTP or SSH bridge.
 */
export async function queuePromptToRemoteComfy(
  creds: SSHCredentials & { comfyui_api_url?: string; remote_api_token?: string },
  apiPrompt: Record<string, any>,
  clientId: string = "comfyui-bridge-session",
  extraData: Record<string, any> = {}
): Promise<QueuePromptResult> {
  const comfyApiUrl = (creds.comfyui_api_url || "http://127.0.0.1:8188").replace(/\/$/, "");
  const payload = {
    prompt: apiPrompt,
    client_id: clientId,
    extra_data: extraData
  };

  const payloadString = JSON.stringify(payload);

  // 1. Attempt Direct HTTP Dispatch
  if (comfyApiUrl) {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Accept": "application/json"
      };
      if (creds.remote_api_token) {
        headers["Authorization"] = `Bearer ${creds.remote_api_token}`;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);

      const res = await fetch(`${comfyApiUrl}/prompt`, {
        method: "POST",
        headers,
        body: payloadString,
        signal: controller.signal
      });
      clearTimeout(timeout);

      const resText = await res.text();
      let resJson: any = null;
      try {
        resJson = JSON.parse(resText);
      } catch {}

      if (res.ok && resJson && resJson.prompt_id) {
        return {
          success: true,
          prompt_id: resJson.prompt_id,
          number: resJson.number,
          node_errors: resJson.node_errors,
          dispatch_method: "direct_http",
          details: `Direct HTTP queue succeeded (prompt_id: ${resJson.prompt_id})`
        };
      } else if (resJson && resJson.error) {
        const errorMsg = typeof resJson.error === "string" 
          ? resJson.error 
          : resJson.error.message || JSON.stringify(resJson.error);
        return {
          success: false,
          error: `ComfyUI API rejected prompt: ${errorMsg}`,
          node_errors: resJson.node_errors,
          dispatch_method: "direct_http"
        };
      }
    } catch (httpErr: any) {
      console.log(`[ComfyUI Dispatch] Direct HTTP fetch failed (${httpErr.message}). Checking SSH fallback...`);
    }
  }

  // 2. Attempt SSH Fallback Dispatch (executes python directly on the remote GPU instance)
  const resolved = resolveSSHConfig(creds);
  if (resolved.host && resolved.authMethod !== "None") {
    let client: Client | null = null;
    try {
      client = await connectSSH(resolved.connectConfig);

      // Write payload to a temporary file on remote host or stream via stdin to python
      const pyScript = `
import urllib.request, json, sys

try:
    payload_raw = sys.stdin.read()
    req = urllib.request.Request(
        "http://127.0.0.1:8188/prompt",
        data=payload_raw.encode("utf-8"),
        headers={"Content-Type": "application/json", "Accept": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=12) as response:
        body = response.read().decode("utf-8")
        print(body)
except urllib.error.HTTPError as e:
    err_body = e.read().decode("utf-8", errors="ignore")
    print(json.dumps({"error": f"HTTP {e.code}: {err_body}", "code": e.code}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`.trim();

      const cmd = `python3 -c '${pyScript.replace(/'/g, "'\\''")}'`;
      
      // Execute with stdin stream
      const result = await new Promise<{ stdout: string; stderr: string; code: number }>((resolve, reject) => {
        client!.exec(cmd, (err, stream) => {
          if (err) return reject(err);
          let stdout = "";
          let stderr = "";
          stream.on("data", (d: Buffer) => { stdout += d.toString(); });
          stream.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
          stream.on("close", (code: number) => { resolve({ stdout, stderr, code: code ?? 0 }); });

          // Write payload to stdin and close stdin
          stream.write(payloadString);
          stream.end();
        });
      });

      try { client.end(); } catch {}

      if (result.stdout.trim()) {
        try {
          const parsed = JSON.parse(result.stdout.trim());
          if (parsed.prompt_id) {
            return {
              success: true,
              prompt_id: parsed.prompt_id,
              number: parsed.number,
              node_errors: parsed.node_errors,
              dispatch_method: "ssh_bridge",
              details: `Dispatched to ComfyUI via SSH bridge (prompt_id: ${parsed.prompt_id})`
            };
          } else if (parsed.error) {
            return {
              success: false,
              error: `ComfyUI returned error over SSH bridge: ${parsed.error}`,
              node_errors: parsed.node_errors,
              dispatch_method: "ssh_bridge"
            };
          }
        } catch {}
      }

      return {
        success: false,
        error: result.stderr.trim() || result.stdout.trim() || "Remote SSH bridge returned empty response from ComfyUI /prompt.",
        dispatch_method: "ssh_bridge"
      };
    } catch (sshErr: any) {
      return {
        success: false,
        error: `Failed to dispatch prompt via SSH bridge: ${sshErr.message}`,
        dispatch_method: "ssh_bridge"
      };
    } finally {
      if (client) {
        try { client.end(); } catch {}
      }
    }
  }

  return {
    success: false,
    error: "Could not connect to ComfyUI instance (both direct HTTP and SSH failed).",
    dispatch_method: "failed"
  };
}

