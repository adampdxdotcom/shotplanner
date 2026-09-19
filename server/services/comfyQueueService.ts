import nodeFetchModule from "node-fetch";

const getFetch = (): typeof fetch => {
  if (typeof globalThis.fetch === "function") {
    return globalThis.fetch as typeof fetch;
  }
  return ((nodeFetchModule as any).default || nodeFetchModule) as typeof fetch;
};

export interface ComfyQueueItem {
  index: number;
  prompt_id: string;
  client_id?: string;
  status: "running" | "pending";
  scene_name?: string;
  shot_number?: number | string;
  nodes_count?: number;
  output_prefix?: string;
  timestamp?: number;
}

export interface ComfyQueueStatus {
  success: boolean;
  is_executing: boolean;
  queue_remaining: number;
  running: ComfyQueueItem[];
  pending: ComfyQueueItem[];
  error?: string;
}

export interface ComfyDeviceStats {
  name: string;
  type: string;
  index: number;
  vram_total: number;
  vram_free: number;
  vram_total_gb: string;
  vram_free_gb: string;
  vram_used_gb: string;
  vram_usage_percent: number;
  torch_vram_total?: number;
  torch_vram_free?: number;
}

export interface ComfySystemStats {
  success: boolean;
  os?: string;
  python_version?: string;
  devices: ComfyDeviceStats[];
  error?: string;
}

/**
 * Helper to extract metadata (shot, scene, output prefixes) from ComfyUI prompt JSON
 */
function extractPromptMetadata(rawItem: any, status: "running" | "pending"): ComfyQueueItem {
  const index = typeof rawItem[0] === "number" ? rawItem[0] : 0;
  const prompt_id = typeof rawItem[1] === "string" ? rawItem[1] : String(rawItem[1] || "");
  const promptObj = rawItem[2] && typeof rawItem[2] === "object" ? rawItem[2] : {};
  const extraData = rawItem[3] && typeof rawItem[3] === "object" ? rawItem[3] : {};

  const client_id = extraData.client_id;
  let scene_name: string | undefined;
  let shot_number: number | string | undefined;
  let output_prefix: string | undefined;

  // Inspect nodes for SaveImage / SaveVideo / VHS_VideoCombine prefix
  const nodeKeys = Object.keys(promptObj);
  for (const k of nodeKeys) {
    const node = promptObj[k];
    if (!node || typeof node !== "object") continue;
    const inputs = node.inputs || {};
    const prefix = inputs.filename_prefix || inputs.save_prefix || inputs.prefix;
    if (typeof prefix === "string" && prefix.trim()) {
      output_prefix = prefix;
      // Check for patterns like "scene01_shot_01" or "Shot_01"
      const shotMatch = prefix.match(/shot[_\-\s]*0*(\d+)/i);
      if (shotMatch) {
        shot_number = parseInt(shotMatch[1], 10);
      }
      const sceneMatch = prefix.match(/scene[_\-\s]*0*(\d+)/i);
      if (sceneMatch) {
        scene_name = `Scene ${sceneMatch[1]}`;
      }
      break;
    }
  }

  // Check extra_pnginfo or custom tags
  if (extraData.extra_pnginfo && typeof extraData.extra_pnginfo === "object") {
    if (extraData.extra_pnginfo.scene_name) {
      scene_name = extraData.extra_pnginfo.scene_name;
    }
    if (extraData.extra_pnginfo.shot_number) {
      shot_number = extraData.extra_pnginfo.shot_number;
    }
  }

  return {
    index,
    prompt_id,
    client_id,
    status,
    scene_name,
    shot_number,
    nodes_count: nodeKeys.length,
    output_prefix,
    timestamp: Date.now()
  };
}

/**
 * Normalize ComfyUI API Base URL
 */
export function normalizeComfyUrl(url?: string): string {
  const raw = url || process.env.COMFYUI_API_URL || "http://127.0.0.1:8188";
  return raw.trim().replace(/\/$/, "");
}

/**
 * Fetch the active and pending queue from ComfyUI
 */
export async function fetchComfyQueue(
  apiUrl?: string,
  authToken?: string,
  timeoutMs: number = 6000
): Promise<ComfyQueueStatus> {
  const baseUrl = normalizeComfyUrl(apiUrl);
  const queueUrl = `${baseUrl}/queue`;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (authToken && authToken.trim()) {
    headers["Authorization"] = `Bearer ${authToken.trim()}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const fetchFn = getFetch();
    const res = await fetchFn(queueUrl, {
      method: "GET",
      headers,
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`ComfyUI /queue returned HTTP ${res.status}: ${res.statusText}`);
    }

    const data: any = await res.json();
    const rawRunning = Array.isArray(data?.queue_running) ? data.queue_running : [];
    const rawPending = Array.isArray(data?.queue_pending) ? data.queue_pending : [];

    const running = rawRunning.map((item: any) => extractPromptMetadata(item, "running"));
    const pending = rawPending.map((item: any) => extractPromptMetadata(item, "pending"));

    return {
      success: true,
      is_executing: running.length > 0,
      queue_remaining: running.length + pending.length,
      running,
      pending
    };
  } catch (err: any) {
    const isAbort = err.name === "AbortError";
    const errorMsg = isAbort ? "Connection timed out connecting to ComfyUI /queue" : err.message;
    return {
      success: false,
      is_executing: false,
      queue_remaining: 0,
      running: [],
      pending: [],
      error: errorMsg
    };
  }
}

/**
 * Interrupt currently running execution on ComfyUI
 */
export async function interruptComfyExecution(
  apiUrl?: string,
  authToken?: string
): Promise<{ success: boolean; message: string }> {
  const baseUrl = normalizeComfyUrl(apiUrl);
  const interruptUrl = `${baseUrl}/interrupt`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken && authToken.trim()) {
    headers["Authorization"] = `Bearer ${authToken.trim()}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const fetchFn = getFetch();
    const res = await fetchFn(interruptUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Interrupt failed: HTTP ${res.status} ${res.statusText}`);
    }

    return {
      success: true,
      message: "Execution interrupted successfully on ComfyUI."
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Failed to trigger interrupt on ComfyUI"
    };
  }
}

/**
 * Delete a specific pending job or clear the pending queue on ComfyUI
 */
export async function deleteComfyQueueItem(
  promptId: string,
  apiUrl?: string,
  authToken?: string
): Promise<{ success: boolean; message: string }> {
  const baseUrl = normalizeComfyUrl(apiUrl);
  const queueUrl = `${baseUrl}/queue`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken && authToken.trim()) {
    headers["Authorization"] = `Bearer ${authToken.trim()}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(queueUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ delete: [promptId] }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Delete job failed: HTTP ${res.status} ${res.statusText}`);
    }

    return {
      success: true,
      message: `Job ${promptId} removed from queue.`
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || `Failed to remove job ${promptId} from queue`
    };
  }
}

/**
 * Clear all pending jobs from the queue on ComfyUI
 */
export async function clearComfyQueue(
  apiUrl?: string,
  authToken?: string
): Promise<{ success: boolean; message: string }> {
  const baseUrl = normalizeComfyUrl(apiUrl);
  const queueUrl = `${baseUrl}/queue`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken && authToken.trim()) {
    headers["Authorization"] = `Bearer ${authToken.trim()}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(queueUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ clear: true }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Clear queue failed: HTTP ${res.status} ${res.statusText}`);
    }

    return {
      success: true,
      message: "Pending queue cleared successfully on ComfyUI."
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Failed to clear pending queue on ComfyUI"
    };
  }
}

/**
 * Fetch hardware and VRAM telemetry from ComfyUI /system_stats
 */
export async function fetchComfySystemStats(
  apiUrl?: string,
  authToken?: string,
  timeoutMs: number = 6000
): Promise<ComfySystemStats> {
  const baseUrl = normalizeComfyUrl(apiUrl);
  const statsUrl = `${baseUrl}/system_stats`;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (authToken && authToken.trim()) {
    headers["Authorization"] = `Bearer ${authToken.trim()}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(statsUrl, {
      method: "GET",
      headers,
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data: any = await res.json();
    const os = data?.system?.os;
    const python_version = data?.system?.python_version;
    const rawDevices = Array.isArray(data?.devices) ? data.devices : [];

    const devices: ComfyDeviceStats[] = rawDevices.map((d: any, idx: number) => {
      const vramTotal = typeof d.vram_total === "number" ? d.vram_total : 0;
      const vramFree = typeof d.vram_free === "number" ? d.vram_free : 0;
      const vramUsed = Math.max(0, vramTotal - vramFree);

      const totalGB = (vramTotal / (1024 * 1024 * 1024)).toFixed(1);
      const freeGB = (vramFree / (1024 * 1024 * 1024)).toFixed(1);
      const usedGB = (vramUsed / (1024 * 1024 * 1024)).toFixed(1);
      const percent = vramTotal > 0 ? Math.round((vramUsed / vramTotal) * 100) : 0;

      return {
        name: d.name || `GPU Device ${idx}`,
        type: d.type || "cuda",
        index: typeof d.index === "number" ? d.index : idx,
        vram_total: vramTotal,
        vram_free: vramFree,
        vram_total_gb: totalGB,
        vram_free_gb: freeGB,
        vram_used_gb: usedGB,
        vram_usage_percent: percent,
        torch_vram_total: d.torch_vram_total,
        torch_vram_free: d.torch_vram_free
      };
    });

    return {
      success: true,
      os,
      python_version,
      devices
    };
  } catch (err: any) {
    const isAbort = err.name === "AbortError";
    const errorMsg = isAbort ? "Connection timed out fetching /system_stats" : err.message;
    return {
      success: false,
      devices: [],
      error: errorMsg
    };
  }
}
