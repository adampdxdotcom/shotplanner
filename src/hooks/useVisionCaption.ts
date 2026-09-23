import { useMemo, useState, useCallback } from "react";
import { AppConfig, MediaAsset, ImageVisualAnalysis } from "../types";
import { llmApi } from "../api";

export interface VisionCaptionState {
  /** True if vision is enabled and local LLM endpoint is configured */
  canCaption: boolean;
  /** True if canCaption is true AND auto-caption on upload is enabled */
  autoCaption: boolean;
  /** Direct vision enabled toggle state */
  visionEnabled: boolean;
  /** Direct auto caption enabled toggle state */
  autoCaptionEnabled: boolean;
  /** Active LM Studio API endpoint URL */
  lmStudioUrl: string;
}

/**
 * Checks vision captioning availability given configuration or localStorage fallbacks.
 */
export function getVisionCaptionState(config?: Partial<AppConfig>): VisionCaptionState {
  const isVision = config?.vision_enabled !== undefined
    ? Boolean(config.vision_enabled)
    : (typeof window !== "undefined" && localStorage.getItem("vision_enabled") === "true");

  const isAuto = config?.auto_caption_enabled !== undefined
    ? Boolean(config.auto_caption_enabled)
    : (typeof window !== "undefined" && localStorage.getItem("auto_caption_enabled") === "true");

  const url = config?.lm_studio_url || 
    (typeof window !== "undefined" ? localStorage.getItem("lm_studio_url") || "http://localhost:1234/v1" : "http://localhost:1234/v1");

  // Endpoint must be present and vision explicitly enabled
  const canCaption = Boolean(isVision && url && url.trim().length > 0);
  const autoCaption = Boolean(canCaption && isAuto);

  return {
    canCaption,
    autoCaption,
    visionEnabled: isVision,
    autoCaptionEnabled: isAuto,
    lmStudioUrl: url
  };
}

/**
 * Resizes a File or Blob client-side to a max dimension and returns a compact base64 JPEG URI.
 */
export async function fileToVisionBase64(file: File | Blob, maxDimension = 384): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to decode image"));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(width, 1);
        canvas.height = Math.max(height, 1);

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const base64Uri = canvas.toDataURL("image/jpeg", 0.82);
        resolve(base64Uri);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Loads an image from a URL and converts to scaled base64 JPEG.
 */
export async function imageUrlToVisionBase64(url: string, maxDimension = 384): Promise<string> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    return await fileToVisionBase64(blob, maxDimension);
  } catch (err) {
    // If CORS or direct fetch fails, fallback to passing image URL directly or reject
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onerror = () => reject(new Error("Failed to load image from URL"));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(width, 1);
        canvas.height = Math.max(height, 1);

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context unavailable"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = url;
    });
  }
}

/**
 * Client-side helper to request vision captions from /api/llm/caption.
 */
export interface RequestVisionCaptionParams {
  thumbnailPath?: string;
  imageBase64?: string;
  filename?: string;
  sceneName?: string;
  contextType?: "character" | "scene" | "shot" | "asset" | string;
  subjectName?: string;
  lmStudioUrl?: string;
}

export async function requestVisionCaption(params: RequestVisionCaptionParams): Promise<{
  success: boolean;
  caption: string;
  analysis?: ImageVisualAnalysis;
  words_count?: number;
  saved_to_cache?: boolean;
  error?: string;
}> {
  try {
    const data = await llmApi.generateCaption({
      thumbnailPath: params.thumbnailPath,
      imageBase64: params.imageBase64,
      filename: params.filename,
      sceneName: params.sceneName,
      contextType: params.contextType,
      subjectName: params.subjectName,
      lm_studio_url: params.lmStudioUrl
    });

    if (!data.success) {
      return { 
        success: false, 
        caption: "", 
        error: data.error || "Failed to generate visual caption" 
      };
    }
    return { 
      success: true, 
      caption: data.caption || "", 
      analysis: data.analysis,
      words_count: data.words_count,
      saved_to_cache: data.saved_to_cache
    };
  } catch (err: any) {
    return { 
      success: false, 
      caption: "", 
      error: err?.message || "Network error requesting vision caption" 
    };
  }
}

/**
 * Convenience helper to generate a caption for a File instance.
 */
export async function generateCaptionForFile(
  file: File | Blob,
  options?: {
    contextType?: string;
    subjectName?: string;
    filename?: string;
    sceneName?: string;
    lmStudioUrl?: string;
  }
): Promise<{ 
  success: boolean; 
  caption: string; 
  analysis?: ImageVisualAnalysis; 
  saved_to_cache?: boolean; 
  error?: string 
}> {
  try {
    const imageBase64 = await fileToVisionBase64(file);
    return await requestVisionCaption({
      imageBase64,
      filename: options?.filename,
      sceneName: options?.sceneName,
      contextType: options?.contextType || "asset",
      subjectName: options?.subjectName || "",
      lmStudioUrl: options?.lmStudioUrl
    });
  } catch (err: any) {
    return {
      success: false,
      caption: "",
      error: err?.message || "Failed to prepare image for vision captioning"
    };
  }
}

/**
 * Convenience helper to generate a caption for an existing MediaAsset.
 */
export async function generateCaptionForAsset(
  asset: MediaAsset,
  options?: {
    contextType?: string;
    subjectName?: string;
    sceneName?: string;
    lmStudioUrl?: string;
    assetMediaUrl?: string;
  }
): Promise<{ 
  success: boolean; 
  caption: string; 
  analysis?: ImageVisualAnalysis; 
  saved_to_cache?: boolean; 
  error?: string 
}> {
  try {
    let imageBase64: string | undefined;
    if (options?.assetMediaUrl) {
      try {
        imageBase64 = await imageUrlToVisionBase64(options.assetMediaUrl);
      } catch {
        // Fallback to server-side thumbnailPath resolution
      }
    }

    return await requestVisionCaption({
      thumbnailPath: asset.filename,
      filename: asset.filename,
      sceneName: options?.sceneName,
      imageBase64,
      contextType: options?.contextType || asset.type || "asset",
      subjectName: options?.subjectName || asset.subject_name || "",
      lmStudioUrl: options?.lmStudioUrl
    });
  } catch (err: any) {
    return {
      success: false,
      caption: "",
      error: err?.message || "Failed to generate caption for asset"
    };
  }
}

/**
 * React hook to access vision captioning capabilities and auto-caption preferences.
 */
export function useVisionCaption(config?: Partial<AppConfig>): VisionCaptionState {
  return useMemo(() => {
    return getVisionCaptionState(config);
  }, [config?.vision_enabled, config?.auto_caption_enabled, config?.lm_studio_url]);
}



