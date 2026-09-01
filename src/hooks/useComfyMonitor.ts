import { useState, useEffect, useRef, useCallback } from 'react';

export interface ComfyMonitorState {
  isConnected: boolean;
  isExecuting: boolean;
  queueRemaining: number;
  currentStep: number;
  maxSteps: number;
  activeNodeId: string | null;
  elapsedMs: number;
  activePromptId: string | null;
}

export function useComfyMonitor(
  comfyApiUrl: string, 
  onShowToast?: (msg: string, type: "success" | "error" | "info") => void,
  activeSceneName?: string,
  onOutputPulled?: (filename: string) => void,
  onExecutionStarted?: (promptId: string) => void
) {
  const [state, setState] = useState<ComfyMonitorState>({
    isConnected: false,
    isExecuting: false,
    queueRemaining: 0,
    currentStep: 0,
    maxSteps: 0,
    activeNodeId: null,
    elapsedMs: 0,
    activePromptId: null,
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
      elapsedMs: 0,
      activePromptId: null,
    }));
  }, [stopTimer]);

  useEffect(() => {
    if (!comfyApiUrl) return;

    let wsUrl = comfyApiUrl.replace(/^http/, 'ws');
    if (wsUrl.endsWith('/')) wsUrl = wsUrl.slice(0, -1);
    
    // Generate a simple clientId
    const clientId = Math.random().toString(36).substring(2, 15);
    const fullWsUrl = `${wsUrl}/ws?clientId=${clientId}`;

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
            } else if (msg.type === 'executing') {
              const node = msg.data.node;
              if (node) {
                setState(prev => {
                  if (!prev.isExecuting) {
                     startTimeRef.current = Date.now();
                     startTimer();
                  }
                  return { ...prev, activeNodeId: node, isExecuting: true };
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
              if (now - toastThrottler.current > 3000) {
                 toastThrottler.current = now;
                 const pct = Math.round((currentStep / maxSteps) * 100);
                 onShowToast?.(`⚙️ Sampling: Step ${currentStep}/${maxSteps} (${pct}%)`, 'info');
              }
            } else if (msg.type === 'execution_success') {
              onShowToast?.('🎬 Shot Staging / Render Complete', 'success');
              resetState();
                        } else if (msg.type === 'executed') {
              const nodeOutput = msg.data?.output;
              if (nodeOutput && activeSceneName) {
                let files: any[] = [];
                if (Array.isArray(nodeOutput.videos)) files.push(...nodeOutput.videos);
                if (Array.isArray(nodeOutput.gifs)) files.push(...nodeOutput.gifs);
                if (Array.isArray(nodeOutput.images)) files.push(...nodeOutput.images);
                if (Array.isArray(nodeOutput.files)) files.push(...nodeOutput.files);
                
                files.forEach((file: any) => {
                  const fname = typeof file === "string" ? file : file?.filename;
                  const subf = typeof file === "object" ? file?.subfolder : undefined;
                  if (fname) {
                    fetch('/api/outputs/pull', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        scene_name: activeSceneName,
                        filename: fname,
                        subfolder: subf,
                        comfyui_api_url: comfyApiUrl
                      })
                    }).then(res => res.json()).then(data => {
                      if (data.status === "success" && onOutputPulled) {
                        onOutputPulled(data.filename);
                      }
                    }).catch(err => console.error("Failed to pull output", err));
                  }
                });
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
