/**
 * Client-Side Video Frame Extraction Utility
 * 
 * Safely extracts high-resolution video frames (e.g., final discrete frame for shot chaining)
 * using an off-screen HTML5 video element & canvas, and uploads the frame as a project asset.
 */

import { MediaAsset } from "../types";

export interface FrameExtractionResult {
  success: boolean;
  blob?: Blob;
  dataUrl?: string;
  asset?: MediaAsset;
  assetFilename?: string;
  width?: number;
  height?: number;
  error?: string;
}

/**
 * Extracts a frame from a video URL at a specific timestamp (default: duration - 0.04s for the final discrete frame).
 */
export async function extractFrameFromVideoUrl(
  videoUrl: string,
  options?: {
    timestampSeconds?: number;
    offsetFromEndSeconds?: number; // default: 0.04s
    timeoutMs?: number; // default: 10000ms
  }
): Promise<{ blob: Blob; dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;

    let isCleanedUp = false;
    const timeoutTimer = setTimeout(() => {
      cleanup();
      reject(new Error("Video frame extraction timed out after " + (options?.timeoutMs || 10000) + "ms"));
    }, options?.timeoutMs || 10000);

    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      clearTimeout(timeoutTimer);
      video.pause();
      video.removeAttribute("src");
      video.load();
    };

    video.onloadedmetadata = () => {
      const duration = video.duration || 0;
      let targetTime = 0;

      if (options?.timestampSeconds !== undefined) {
        targetTime = Math.max(0, Math.min(duration, options.timestampSeconds));
      } else {
        const offset = options?.offsetFromEndSeconds !== undefined ? options.offsetFromEndSeconds : 0.04;
        targetTime = Math.max(0, duration - offset);
      }

      // If video duration is 0 or invalid, seek to 0
      video.currentTime = isFinite(targetTime) ? targetTime : 0;
    };

    video.onseeked = () => {
      try {
        const width = video.videoWidth || 1280;
        const height = video.videoHeight || 720;

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
          reject(new Error("Failed to get 2D canvas context for frame extraction"));
          return;
        }

        ctx.drawImage(video, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/png");
        canvas.toBlob((blob) => {
          cleanup();
          if (blob) {
            resolve({ blob, dataUrl, width, height });
          } else {
            reject(new Error("Failed to generate image blob from canvas"));
          }
        }, "image/png");
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error(`Failed to load video source for extraction: ${videoUrl}`));
    };

    video.src = videoUrl;
    video.load();
  });
}

/**
 * Extracts the last frame of a video take and uploads it to the backend as a project asset.
 */
export async function extractAndUploadTakeLastFrame({
  videoUrl,
  sceneName,
  sourceShotNumber,
  sourceTakeNumber,
  targetShotNumber,
  customLabel
}: {
  videoUrl: string;
  sceneName: string;
  sourceShotNumber: number;
  sourceTakeNumber: number;
  targetShotNumber?: number;
  customLabel?: string;
}): Promise<FrameExtractionResult> {
  try {
    // 1. Extract the frame via canvas
    const { blob, dataUrl, width, height } = await extractFrameFromVideoUrl(videoUrl);

    // 2. Format sanitized asset filename
    const cleanScene = (sceneName || "scene").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const paddedSourceShot = String(sourceShotNumber).padStart(2, "0");
    const paddedTargetShot = targetShotNumber ? String(targetShotNumber).padStart(2, "0") : undefined;
    
    const baseName = paddedTargetShot 
      ? `first_frame_${cleanScene}_shot_${paddedTargetShot}_from_shot_${paddedSourceShot}_take_${sourceTakeNumber}_${Date.now()}.png`
      : `first_frame_${cleanScene}_shot_${paddedSourceShot}_take_${sourceTakeNumber}_${Date.now()}.png`;

    // 3. Upload to server
    const formData = new FormData();
    formData.append("file", blob, baseName);
    formData.append("type", "Scene Reference");
    formData.append("scene_name", cleanScene);
    formData.append("description", customLabel || `Last frame of Shot ${sourceShotNumber} Take ${sourceTakeNumber} (chained for Shot ${targetShotNumber || sourceShotNumber + 1})`);
    formData.append("tags", JSON.stringify(["First Frame", "Frame 0", "Continuity", `Shot_${paddedSourceShot}`, `Take_${sourceTakeNumber}`]));
    formData.append("subject_name", cleanScene);

    const res = await fetch("/api/assets/upload", {
      method: "POST",
      body: formData
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "Upload failed");
      return {
        success: false,
        blob,
        dataUrl,
        error: `Server responded with ${res.status}: ${errText}`
      };
    }

    const data = await res.json();
    if (data.success && data.asset) {
      return {
        success: true,
        blob,
        dataUrl,
        asset: data.asset,
        assetFilename: data.asset.filename || baseName,
        width,
        height
      };
    }

    return {
      success: true,
      blob,
      dataUrl,
      assetFilename: baseName,
      width,
      height
    };
  } catch (err: any) {
    console.error("[Frame Extraction Error]:", err);
    return {
      success: false,
      error: err.message || "Failed to extract video frame"
    };
  }
}
