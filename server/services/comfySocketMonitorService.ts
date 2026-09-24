import WebSocket from "ws";
import { Response } from "express";
import { createScopedLogger } from "../utils/logger";

const log = createScopedLogger("ComfySocketService");

export interface ComfyJobState {
  promptId: string;
  status: "queued" | "running" | "completed" | "failed";
  currentNodeId: string | null;
  step: number;
  maxSteps: number;
  percent: number;
  outputs?: any;
  error?: string;
  timestamp: number;
}

// Maps comfyApiUrl -> Active WebSocket connection
const wsPool = new Map<string, WebSocket>();

// Maps promptId -> Live job progress state
const jobStates = new Map<string, ComfyJobState>();

// Maps comfyApiUrl -> Set of active SSE client connections
const sseClients = new Map<string, Set<Response>>();

// Maps comfyApiUrl -> timestamp of last connection warning to avoid log spamming
const lastWarnTime = new Map<string, number>();

/**
 * Normalizes ComfyUI base HTTP URL to a WebSocket URL (ws:// or wss://)
 */
function getComfyWsUrl(apiUrl: string, clientId: string = "comfyui-bridge-session"): string {
  const cleanUrl = apiUrl.trim().replace(/\/$/, "");
  let wsProtocol = "ws:";
  let hostAndPort = cleanUrl;

  if (cleanUrl.startsWith("https://")) {
    wsProtocol = "wss:";
    hostAndPort = cleanUrl.substring(8);
  } else if (cleanUrl.startsWith("http://")) {
    wsProtocol = "ws:";
    hostAndPort = cleanUrl.substring(7);
  }

  return `${wsProtocol}//${hostAndPort}/ws?clientId=${clientId}`;
}

/**
 * Returns or connects to the WebSocket stream for a specific ComfyUI instance
 */
export function connectComfyWebSocket(apiUrl: string): WebSocket | null {
  const normalizedUrl = apiUrl.trim().replace(/\/$/, "");
  if (!normalizedUrl) return null;

  if (wsPool.has(normalizedUrl)) {
    const existing = wsPool.get(normalizedUrl)!;
    if (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING) {
      return existing;
    }
  }

  const wsUrl = getComfyWsUrl(normalizedUrl);

  try {
    const ws = new WebSocket(wsUrl);
    wsPool.set(normalizedUrl, ws);

    ws.on("open", () => {
      log.info(`WS connection successfully established with ${normalizedUrl}`);
      lastWarnTime.delete(normalizedUrl);
      broadcastToClients(normalizedUrl, { type: "connected", url: normalizedUrl });
    });

    ws.on("message", (rawMsg) => {
      try {
        const text = rawMsg.toString();
        const msg = JSON.parse(text);
        handleComfyMessage(normalizedUrl, msg);
      } catch (err) {
        // Quietly ignore binary previews or unparseable text
      }
    });

    ws.on("error", (err: any) => {
      const isConnRefused = err?.code === "ECONNREFUSED" || (err?.message && err.message.includes("ECONNREFUSED"));
      const now = Date.now();
      const lastWarn = lastWarnTime.get(normalizedUrl) || 0;

      // Throttle repetitive ECONNREFUSED notices to once every 30 seconds as an informative warning
      if (isConnRefused) {
        if (now - lastWarn > 30000) {
          log.warn(`ComfyUI instance at ${normalizedUrl} is currently offline (ECONNREFUSED). Waiting for connection.`);
          lastWarnTime.set(normalizedUrl, now);
        }
      } else {
        log.warn(`WS Notice on ${normalizedUrl}`, { error: err?.message || err });
      }

      broadcastToClients(normalizedUrl, { type: "error", message: err?.message || String(err) });
    });

    ws.on("close", (code, reason) => {
      wsPool.delete(normalizedUrl);
      broadcastToClients(normalizedUrl, { type: "disconnected", url: normalizedUrl });

      // Automatically attempt reconnection if there are active SSE clients listening
      const clients = sseClients.get(normalizedUrl);
      if (clients && clients.size > 0) {
        setTimeout(() => connectComfyWebSocket(normalizedUrl), 5000);
      }
    });

    return ws;
  } catch (err: any) {
    log.warn(`Could not initiate WS for ${normalizedUrl}`, { error: err.message });
    return null;
  }
}

/**
 * Handle incoming ComfyUI live event stream payload
 */
function handleComfyMessage(apiUrl: string, message: any) {
  const type = message.type;
  const data = message.data;
  if (!type || !data) return;

  // Always broadcast raw events down to SSE browser clients so the client hook works seamlessly
  broadcastToClients(apiUrl, message);

  const promptId = data.prompt_id;
  if (!promptId) return;

  let state = jobStates.get(promptId);
  if (!state) {
    state = {
      promptId,
      status: "queued",
      currentNodeId: null,
      step: 0,
      maxSteps: 100,
      percent: 0,
      timestamp: Date.now()
    };
    jobStates.set(promptId, state);
  }

  switch (type) {
    case "status":
      // Global stats update
      break;

    case "execution_start":
      state.status = "running";
      state.timestamp = Date.now();
      break;

    case "executing":
      state.currentNodeId = data.node || null;
      if (data.node === null) {
        // Complete execution cycle finished on ComfyUI
        state.status = "completed";
        state.percent = 100;
      } else {
        state.status = "running";
      }
      break;

    case "progress":
      state.status = "running";
      state.step = data.value || 0;
      state.maxSteps = data.max || 100;
      state.percent = Math.round((state.step / state.maxSteps) * 100);
      break;

    case "executed":
      state.status = "completed";
      state.currentNodeId = data.node || null;
      state.outputs = data.output || null;
      state.percent = 100;
      break;

    case "execution_error":
      state.status = "failed";
      state.error = data.exception_message || "ComfyUI Execution Error";
      break;
  }

  // Save updated state
  jobStates.set(promptId, state);

  // Broadcast the updated state to all connected SSE browser clients
  broadcastToClients(apiUrl, {
    type: "job_update",
    job: state
  });
}

/**
 * Registers a new SSE client for a specific ComfyUI instance
 */
export function registerSSEClient(apiUrl: string, res: Response) {
  const normalizedUrl = apiUrl.trim().replace(/\/$/, "");
  if (!normalizedUrl) return;

  if (!sseClients.has(normalizedUrl)) {
    sseClients.set(normalizedUrl, new Set<Response>());
  }
  const clients = sseClients.get(normalizedUrl)!;
  clients.add(res);

  // Ensure WebSocket is open and listening for this ComfyUI instance
  connectComfyWebSocket(normalizedUrl);

  // Send historical job states currently tracked for this session
  const relevantJobs = Array.from(jobStates.values())
    .filter(job => Date.now() - job.timestamp < 3600000) // limit to past 1 hour of states
    .sort((a, b) => b.timestamp - a.timestamp);

  if (relevantJobs.length > 0) {
    res.write(`data: ${JSON.stringify({ type: "history", jobs: relevantJobs })}\n\n`);
  }
}

/**
 * Unregisters an SSE client safely
 */
export function unregisterSSEClient(apiUrl: string, res: Response) {
  const normalizedUrl = apiUrl.trim().replace(/\/$/, "");
  if (!normalizedUrl) return;

  const clients = sseClients.get(normalizedUrl);
  if (clients) {
    clients.delete(res);
    if (clients.size === 0) {
      sseClients.delete(normalizedUrl);
      // Close Comfy WebSocket after 10s if no clients reconnect to save resources
      setTimeout(() => {
        const remainingClients = sseClients.get(normalizedUrl);
        if (!remainingClients || remainingClients.size === 0) {
          const ws = wsPool.get(normalizedUrl);
          if (ws) {
            log.info(`No active clients, closing WebSocket to ${normalizedUrl}`);
            ws.close();
            wsPool.delete(normalizedUrl);
          }
        }
      }, 10000);
    }
  }
}

/**
 * Send SSE event payload to all clients listening to a specific ComfyUI url
 */
function broadcastToClients(apiUrl: string, payload: any) {
  const clients = sseClients.get(apiUrl);
  if (!clients || clients.size === 0) return;

  const dataStr = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) {
    try {
      client.write(dataStr);
    } catch (err) {
      // client disconnected silently
    }
  }
}

/**
 * Returns the current live status of a single job
 */
export function getJobState(promptId: string): ComfyJobState | null {
  return jobStates.get(promptId) || null;
}
