import { useState, useEffect, useRef, useCallback } from 'react';

export interface ComfyMonitorState {
  isConnected: boolean;
  isExecuting: boolean;
  queueRemaining: number;
  currentStep: number;
  maxSteps: number;
  activeNodeId: string | null;
  activeNodeName?: string | null;
  elapsedMs: number;
  activePromptId: string | null;
  lastError?: string | null;
  clientId?: string;
}

export interface PulledOutputDetails {
  promptId?: string;
  nodeId?: string;
  size?: number;
  streamUrl?: string;
  mediaType?: "video" | "image" | "other";
  subfolder?: string;
}

export function useComfyMonitor(
  comfyApiUrl: string, 
  onShowToast?: (msg: string, type: "success" | "error" | "info") => void,
  activeSceneName?: string,
  onOutputPulled?: (filename: string, details?: PulledOutputDetails) => void,
  onExecutionStarted?: (promptId: string) => void,
  onStatusUpdated?: () => void
) {
  // Stable persistent client ID
  const clientIdRef = useRef<string>(
    (() => {
      try {
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem("comfyui_monitor_client_id");
          if (stored) return stored;
          const gen = `cinematic_bridge_${Math.random().toString(36).substring(2, 11)}`;
          localStorage.setItem("comfyui_monitor_client_id", gen);
          return gen;
        }
      } catch {}
      return `cinematic_bridge_${Math.random().toString(36).substring(2, 11)}`;
    })()
  );

  const resolvedClientId = clientIdRef.current;

  // Expose on window for easy access
  if (typeof window !== "undefined") {
    (window as any).__comfyMonitorClientId = resolvedClientId;
  }

  const [state, setState] = useState<ComfyMonitorState>({
    isConnected: false,
    isExecuting: false,
    queueRemaining: 0,
    currentStep: 0,
    maxSteps: 0,
    activeNodeId: null,
    activeNodeName: null,
    elapsedMs: 0,
    activePromptId: null,
    lastError: null,
    clientId: resolvedClientId
  });

  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const toastThrottler = useRef<number>(0);

  const startTimer = useCallback(() => {
    if (!timerRef.current) {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setState(prev => ({ ...prev, elapsedMs: Date.now() - startTimeRef.current }));
      }, 1000);
    }
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetState = useCallback(() => {
    stopTimer();
    setState(prev => ({
      ...prev,
      isExecuting: false,
      currentStep: 0,
      maxSteps: 0,
      activeNodeId: null,
      activeNodeName: null,
      elapsedMs: 0,
      activePromptId: null,
    }));
  }, [stopTimer]);

  useEffect(() => {
    if (!comfyApiUrl) return;

    let wsUrl = comfyApiUrl.replace(/^http/, 'ws');
    if (wsUrl.endsWith('/')) wsUrl = wsUrl.slice(0, -1);
    
    const fullWsUrl = `${wsUrl}/ws?clientId=${resolvedClientId}`;

    let ws: WebSocket;
    let reconnectTimer: NodeJS.Timeout;

    const connect = () => {
      try {
        ws = new WebSocket(fullWsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setState(prev => ({ ...prev, isConnected: true }));
        };

        ws.onmessage = (event) => {
          if (typeof event.data !== 'string') return;
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'status') {
              const queueRemaining = msg.data?.status?.exec_info?.queue_remaining ?? 0;
              setState(prev => {
                if (prev.queueRemaining !== queueRemaining) {
                  if (queueRemaining > 0 && prev.queueRemaining === 0 && !prev.isExecuting) {
                    onShowToast?.(`⚡ Queue position #${queueRemaining}`, 'info');
                  }
                  return { ...prev, queueRemaining };
                }
                return prev;
              });
              onStatusUpdated?.();
            } else if (msg.type === 'execution_start') {
              setState(prev => ({
                ...prev,
                isExecuting: true,
                activePromptId: msg.data.prompt_id,
                currentStep: 0,
                maxSteps: 0,
                elapsedMs: 0
              }));
              startTimeRef.current = Date.now();
              startTimer();
              onShowToast?.('🎬 Execution Started', 'info');
              onExecutionStarted?.(msg.data.prompt_id);
              onStatusUpdated?.();
            } else if (msg.type === 'executing') {
              const node = msg.data.node;
              const promptId = msg.data.prompt_id;
              if (node) {
                setState(prev => {
                  if (!prev.isExecuting) {
                     startTimeRef.current = Date.now();
                     startTimer();
                  }
                  return { 
                    ...prev, 
                    activeNodeId: String(node),
                    activeNodeName: `KSampler`,
                    activePromptId: promptId || prev.activePromptId,
                    isExecuting: true 
                  };
                });
              } else {
                // node is null when execution is finished for this prompt
                // execution_success event should also fire
              }
            } else if (msg.type === 'progress') {
              const currentStep = msg.data.value;
              const maxSteps = msg.data.max;
              setState(prev => ({ ...prev, currentStep, maxSteps }));
              
              const now = Date.now();
              if (now - toastThrottler.current > 2000) {
                 toastThrottler.current = now;
                 const pct = maxSteps > 0 ? Math.round((currentStep / maxSteps) * 100) : 0;
                 onShowToast?.(`Generating (Node: KSampler ${pct}%)`, 'info');
              }
            } else if (msg.type === 'execution_success') {
              onShowToast?.('🎬 ComfyUI Execution Complete', 'success');
              resetState();
              onStatusUpdated?.();
              // Proactively trigger backend history sync
              if (activeSceneName) {
                fetch('/api/outputs/sync-history', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    scene_name: activeSceneName,
                    comfyui_api_url: comfyApiUrl,
                    max_prompts: 5
                  })
                }).catch(() => {});
              }
            } else if (msg.type === 'executed') {
              onStatusUpdated?.();
              // Trigger backend history sync for prompt completion
              if (activeSceneName) {
                fetch('/api/outputs/sync-history', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    scene_name: activeSceneName,
                    comfyui_api_url: comfyApiUrl,
                    prompt_id: msg.data?.prompt_id,
                    max_prompts: 3
                  })
                }).then(res => res.json()).then(data => {
                  if (data?.ingested_count > 0 && onOutputPulled) {
                    data.ingested.forEach((item: any) => {
                      onOutputPulled(item.filename, {
                        promptId: msg.data?.prompt_id,
                        nodeId: msg.data?.node ? String(msg.data.node) : undefined,
                        size: item.size,
                        streamUrl: item.stream_url,
                        mediaType: item.media_type,
                        subfolder: item.subfolder
                      });
                    });
                  }
                }).catch(() => {});
              }
            } else if (msg.type === 'execution_error') {
              onShowToast?.(`⚠️ ComfyUI Error: ${msg.data?.exception_message || 'Unknown error'}`, 'error');
              resetState();
            }
          } catch (e) {
            console.error('Error parsing ComfyUI WS message', e);
          }
        };

        ws.onclose = () => {
          setState(prev => ({ ...prev, isConnected: false }));
          resetState();
          reconnectTimer = setTimeout(connect, 5000); // Polling/Reconnect fallback
        };
        
        ws.onerror = () => {
          // handled by onclose
        };
      } catch (e) {
        reconnectTimer = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      if (ws) ws.close();
      clearTimeout(reconnectTimer);
      resetState();
    };
  }, [comfyApiUrl, onShowToast]);

  return state;
}
