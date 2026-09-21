/**
 * Shared aspect ratio utilities for both frontend and backend ComfyUI processing.
 */

/**
 * Formats an aspect ratio string into the standard representation for ComfyUI ResolutionSelector
 * (e.g. "16:9 (Widescreen)", "9:16 (Vertical)", "1:1 (Square)")
 */
export function formatAspectRatioForComfyUI(aspectRatio?: string): string {
  const ar = (aspectRatio || "16:9").trim().toLowerCase();
  if (ar.includes("16:9") || ar.includes("widescreen")) return "16:9 (Widescreen)";
  if (ar.includes("9:16") || ar.includes("vertical") || ar.includes("tiktok") || ar.includes("reel")) return "9:16 (Vertical)";
  if (ar.includes("1:1") || ar.includes("square")) return "1:1 (Square)";
  if (ar.includes("4:3")) return "4:3 (Standard)";
  if (ar.includes("3:4")) return "3:4 (Tall)";
  if (ar.includes("2.39") || ar.includes("2.35") || ar.includes("anamorphic") || ar.includes("cinemascope")) return "2.39:1 (Anamorphic)";
  if (ar.includes("21:9") || ar.includes("ultrawide")) return "21:9 (Ultrawide)";
  if (ar.includes("4:5")) return "4:5 (Instagram)";
  if (ar.includes("3:2")) return "3:2 (Classic 35mm)";
  if (ar.includes("2:3")) return "2:3 (Vertical 35mm)";
  return "16:9 (Widescreen)";
}

/**
 * Calculates pixel dimensions (width, height) snapped to 64px increments based on aspect ratio and megapixels
 */
export function getDimensionsFromAspectRatio(aspectRatio?: string, megapixels: number = 1.0): { width: number; height: number } {
  const ar = (aspectRatio || "16:9").trim().toLowerCase();
  const totalPixels = Math.round((megapixels || 1.0) * 1024 * 1024);
  let ratio = 16 / 9;
  if (ar === "9:16" || ar.includes("9:16") || ar === "vertical") ratio = 9 / 16;
  else if (ar === "1:1" || ar.includes("1:1") || ar === "square") ratio = 1 / 1;
  else if (ar === "4:3" || ar.includes("4:3")) ratio = 4 / 3;
  else if (ar === "3:4" || ar.includes("3:4")) ratio = 3 / 4;
  else if (ar.includes("2.39") || ar.includes("2.35") || ar === "cinemascope") ratio = 2.39;
  else if (ar.includes("21:9") || ar.includes("ultrawide")) ratio = 21 / 9;
  else if (ar.includes("3:2")) ratio = 3 / 2;
  else if (ar.includes("2:3")) ratio = 2 / 3;
  else if (ar.includes("4:5")) ratio = 4 / 5;

  let width = Math.round(Math.sqrt(totalPixels * ratio));
  let height = Math.round(totalPixels / width);
  width = Math.max(256, Math.round(width / 64) * 64);
  height = Math.max(256, Math.round(height / 64) * 64);
  return { width, height };
}
