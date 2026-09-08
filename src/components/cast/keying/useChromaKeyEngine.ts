import { useState, useEffect, useCallback, useRef } from "react";
import { KeyingCutoutResult } from "./types";
import { applyChromaKey, autoDetectKeyColor, loadImage } from "../../../utils/chromaKey";
import { revokeManagedBlobUrl } from "../../../utils/blobRegistry";

interface UseChromaKeyEngineProps {
  activeImageSource: string | null;
}

export function useChromaKeyEngine({ activeImageSource }: UseChromaKeyEngineProps) {
  const [keyColor, setKeyColor] = useState<string>("#00FF00");
  const [tolerance, setTolerance] = useState<number>(35); // 0 to 100
  const [softness, setSoftness] = useState<number>(15); // 0 to 100
  const [despill, setDespill] = useState<boolean>(true);

  const [cutoutResult, setCutoutResult] = useState<KeyingCutoutResult | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const activeCutoutBlobRef = useRef<string | null>(null);

  // Auto-detect key color from corners
  const handleAutoDetectColor = useCallback(async (imgSrc: string) => {
    try {
      const img = await loadImage(imgSrc);
      const detected = autoDetectKeyColor(img);
      setKeyColor(detected);
    } catch {
      setKeyColor("#00FF00");
    }
  }, []);

  // When activeImageSource changes, trigger auto-detect
  useEffect(() => {
    if (activeImageSource) {
      handleAutoDetectColor(activeImageSource);
    }
  }, [activeImageSource, handleAutoDetectColor]);

  // Real-time Chroma-Key Processing Engine with 20ms debounce
  useEffect(() => {
    if (!activeImageSource) {
      if (activeCutoutBlobRef.current) {
        revokeManagedBlobUrl(activeCutoutBlobRef.current);
        activeCutoutBlobRef.current = null;
      }
      setCutoutResult(null);
      return;
    }

    let isCancelled = false;
    setIsProcessing(true);

    const timer = setTimeout(async () => {
      try {
        const result = await applyChromaKey({
          source: activeImageSource,
          keyColor,
          tolerance,
          softness,
          despill,
          maxWidth: 1200,
        });
        if (!isCancelled) {
          // Revoke previous intermediate cutout blob URL to prevent memory accumulation during slider drag
          if (activeCutoutBlobRef.current && activeCutoutBlobRef.current !== result.blobUrl) {
            revokeManagedBlobUrl(activeCutoutBlobRef.current);
          }
          activeCutoutBlobRef.current = result.blobUrl || null;
          setCutoutResult(result);
          setIsProcessing(false);
        } else if (result.blobUrl) {
          // If cancelled while rendering, revoke newly created blob URL
          revokeManagedBlobUrl(result.blobUrl);
        }
      } catch (err) {
        console.error("Chroma key processing error:", err);
        if (!isCancelled) {
          setIsProcessing(false);
        }
      }
    }, 20);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [activeImageSource, keyColor, tolerance, softness, despill]);

  // Clean up active cutout blob URL on unmount
  useEffect(() => {
    return () => {
      if (activeCutoutBlobRef.current) {
        revokeManagedBlobUrl(activeCutoutBlobRef.current);
        activeCutoutBlobRef.current = null;
      }
    };
  }, []);

  const resetParameters = useCallback(() => {
    setTolerance(35);
    setSoftness(15);
    setDespill(true);
    setKeyColor("#00FF00");
  }, []);

  return {
    keyColor,
    setKeyColor,
    tolerance,
    setTolerance,
    softness,
    setSoftness,
    despill,
    setDespill,
    cutoutResult,
    isProcessing,
    handleAutoDetectColor,
    resetParameters
  };
}
