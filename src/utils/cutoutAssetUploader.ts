import { assetsApi } from "../api";
import { getAssetMediaUrl } from "./assetUrl";

/**
 * Utility to convert base64 data URLs to Blobs and upload them to the backend 
 * as persistent physical assets on disk, preventing bloated project JSON payloads.
 */

export function isBase64DataUrl(url?: string | null): boolean {
  return typeof url === "string" && url.startsWith("data:");
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const parts = dataUrl.split(",");
    if (parts.length < 2) return null;
    const header = parts[0];
    const base64Data = parts[1];
    const mimeMatch = header.match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/png";

    const byteCharacters = atob(base64Data);
    const byteArrays = new Uint8Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteArrays[i] = byteCharacters.charCodeAt(i);
    }

    return new Blob([byteArrays], { type: mimeType });
  } catch (err) {
    console.error("[CutoutAssetUploader] Failed to convert dataUrl to Blob:", err);
    return null;
  }
}

export interface UploadCutoutParams {
  dataUrl: string;
  characterName: string;
  sceneName?: string;
  onUploaded?: (filename: string, url: string) => void;
}

export interface UploadMaskParams {
  dataUrl: string;
  characterName: string;
  sceneName?: string;
  onUploaded?: (filename: string, url: string) => void;
}

export interface UploadBackgroundParams {
  dataUrl: string;
  locationName?: string;
  sceneName?: string;
  onUploaded?: (filename: string, url: string) => void;
}

export interface UploadBase64ImageParams {
  dataUrl: string;
  prefix: string;
  semanticType?: string;
  subjectName?: string;
  sceneName?: string;
  onUploaded?: (filename: string, url: string) => void;
}

/**
 * Uploads a base64 image as a physical PNG asset file to the backend.
 * Returns the generated filename and canonical asset URL.
 */
export async function uploadBase64ImageAsAsset({
  dataUrl,
  prefix,
  semanticType = "Asset",
  subjectName = "Staging",
  sceneName,
  onUploaded
}: UploadBase64ImageParams): Promise<{ filename: string; url: string } | null> {
  if (!isBase64DataUrl(dataUrl)) {
    return null;
  }

  const blob = dataUrlToBlob(dataUrl);
  if (!blob) return null;

  const cleanPrefix = (prefix || "asset").toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const randomSuffix = Math.random().toString(36).substring(2, 7);
  const filename = `${cleanPrefix}_${Date.now()}_${randomSuffix}.png`;

  try {
    const formData = new FormData();
    formData.append("file", blob, filename);
    formData.append("scene_name", sceneName || "scene01");
    formData.append("semantic_type", semanticType);
    formData.append("type", semanticType);
    formData.append("subject_name", subjectName);
    formData.append("custom_filename", filename);

    const response = await assetsApi.upload(formData);
    const savedFilename = response?.asset?.filename || filename;
    const url = getAssetMediaUrl(savedFilename);

    if (onUploaded) {
      onUploaded(savedFilename, url);
    }

    return { filename: savedFilename, url };
  } catch (err) {
    console.error(`[CutoutAssetUploader] Error uploading ${prefix} asset:`, err);
    return null;
  }
}

/**
 * Uploads a base64 canvas cutout as a physical PNG asset file to the backend.
 * Returns the generated filename and canonical asset URL.
 */
export async function uploadCutoutAsset({
  dataUrl,
  characterName,
  sceneName,
  onUploaded
}: UploadCutoutParams): Promise<{ filename: string; url: string } | null> {
  const cleanChar = (characterName || "actor").toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  return uploadBase64ImageAsAsset({
    dataUrl,
    prefix: `${cleanChar}_cutout`,
    semanticType: "Cutout",
    subjectName: characterName || "Character",
    sceneName,
    onUploaded
  });
}

/**
 * Uploads a base64 canvas alpha mask as a physical PNG asset file to the backend.
 * Returns the generated filename and canonical asset URL.
 */
export async function uploadMaskAsset({
  dataUrl,
  characterName,
  sceneName,
  onUploaded
}: UploadMaskParams): Promise<{ filename: string; url: string } | null> {
  const cleanChar = (characterName || "actor").toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  return uploadBase64ImageAsAsset({
    dataUrl,
    prefix: `${cleanChar}_mask`,
    semanticType: "Mask",
    subjectName: characterName || "Character Mask",
    sceneName,
    onUploaded
  });
}

/**
 * Uploads a base64 background/location image as a physical PNG asset file to the backend.
 * Returns the generated filename and canonical asset URL.
 */
export async function uploadBackgroundAsset({
  dataUrl,
  locationName,
  sceneName,
  onUploaded
}: UploadBackgroundParams): Promise<{ filename: string; url: string } | null> {
  const cleanLoc = (locationName || "environment").toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  return uploadBase64ImageAsAsset({
    dataUrl,
    prefix: `${cleanLoc}_backdrop`,
    semanticType: "Location",
    subjectName: locationName || "Location Backdrop",
    sceneName,
    onUploaded
  });
}
