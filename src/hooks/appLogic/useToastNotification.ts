import { useState, useRef, useCallback, useEffect } from 'react';
import { ToastMessage } from '../../types';

export function useToastNotification() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const dismissToast = useCallback((_id?: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToasts([]);
  }, []);

  const addToast = useCallback((text: string, type: "success" | "error" | "info" = "info") => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    setToasts([{ id, text, type }]);
    toastTimerRef.current = setTimeout(() => {
      setToasts([]);
      toastTimerRef.current = null;
    }, 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  return {
    toasts,
    setToasts,
    addToast,
    dismissToast
  };
}
