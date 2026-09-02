/**
 * High-Performance Client-Side Chroma-Key & Background Removal Utility
 * 
 * Provides pixel-level color keying on an in-memory 2D HTML5 canvas,
 * smart auto-detection of background color (green screen, blue screen, corner sampling),
 * configurable key color, tolerance thresholding, edge softness / feathering,
 * and despill suppression to eliminate halos and fringing.
 */

export interface ChromaKeyOptions {
  source: HTMLImageElement | HTMLCanvasElement | string;
  keyColor?: string; // Hex e.g. "#00FF00" or rgb
  tolerance?: number; // 0 to 100 (range sensitivity)
  softness?: number; // 0 to 100 (edge feathering transition)
  despill?: boolean; // suppress key color spill on semi-transparent edges
  maxWidth?: number; // optional constraint for preview performance
  maxHeight?: number;
}

export interface ChromaKeyResult {
  dataUrl: string; // Transparent PNG data:image/png;base64,...
  width: number;
  height: number;
  transparentPixelCount: number;
  transparentPercentage: number;
}

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

/**
 * Parses hex color strings (#RGB, #RRGGBB) to RGB object
 */
export function parseHexColor(hex: string): RGBColor {
  let clean = hex.replace(/^#/, "").trim();
  if (clean.length === 3) {
    clean = clean.split("").map(c => c + c).join("");
  }
  if (clean.length !== 6) {
    return { r: 0, g: 255, b: 0 }; // Default to Chroma Green
  }
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Converts RGB numbers to #RRGGBB hex string
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => {
    const hex = Math.max(0, Math.min(255, Math.round(c))).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Calculates Euclidean color distance between two RGB colors (0 to ~441.67)
 */
export function getColorDistance(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number
): number {
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

/**
 * Loads an image from a URL, blob, or data URL safely
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Do not set crossOrigin for data URLs or blob URLs to prevent Safari bugs
    if (!src.startsWith("data:") && !src.startsWith("blob:")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error(`Failed to load image for chroma keying: ${err}`));
    img.src = src;
  });
}

/**
 * Smart auto-detection of key background color.
 * Analyzes the corners (top-left, top-right, bottom-left, bottom-right)
 * and edge samples. Detects chroma green (#00FF00), chroma blue, or averages corner samples.
 */
export function autoDetectKeyColor(
  source: HTMLImageElement | HTMLCanvasElement | ImageData
): string {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null;
  let width: number;
  let height: number;
  let imgData: ImageData;

  if (source instanceof ImageData) {
    imgData = source;
    width = imgData.width;
    height = imgData.height;
  } else {
    width = source.width;
    height = source.height;
    canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return "#00FF00";
    ctx.drawImage(source, 0, 0);
    imgData = ctx.getImageData(0, 0, width, height);
  }

  const { data } = imgData;

  // Sample points near 4 corners (offset slightly inside to bypass any border lines)
  const xOffsets = [
    Math.min(5, Math.floor(width * 0.02)),
    Math.max(width - 6, Math.floor(width * 0.98)),
  ];
  const yOffsets = [
    Math.min(5, Math.floor(height * 0.02)),
    Math.max(height - 6, Math.floor(height * 0.98)),
  ];

  const samples: RGBColor[] = [];

  for (const x of xOffsets) {
    for (const y of yOffsets) {
      const idx = (y * width + x) * 4;
      samples.push({
        r: data[idx],
        g: data[idx + 1],
        b: data[idx + 2],
      });
    }
  }

  // Also sample top-center and bottom-center
  const topCenterIdx = (Math.min(5, Math.floor(height * 0.02)) * width + Math.floor(width / 2)) * 4;
  samples.push({
    r: data[topCenterIdx],
    g: data[topCenterIdx + 1],
    b: data[topCenterIdx + 2],
  });

  // Check if samples are predominantly green (Chroma Green screen)
  let greenCount = 0;
  let blueCount = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;

  for (const s of samples) {
    sumR += s.r;
    sumG += s.g;
    sumB += s.b;

    // Green dominant
    if (s.g > 110 && s.g > s.r * 1.25 && s.g > s.b * 1.25) {
      greenCount++;
    }
    // Blue dominant
    if (s.b > 110 && s.b > s.r * 1.25 && s.b > s.g * 1.25) {
      blueCount++;
    }
  }

  const sampleCount = samples.length;

  // If majority of sampled points are green screen, use standard chroma green or corner green
  if (greenCount >= Math.ceil(sampleCount / 2)) {
    // If very saturated green, return pure chroma green
    const avgG = sumG / sampleCount;
    const avgR = sumR / sampleCount;
    const avgB = sumB / sampleCount;
    if (avgG > 180 && avgR < 80 && avgB < 80) {
      return "#00FF00";
    }
    return rgbToHex(avgR, avgG, avgB);
  }

  // If majority of sampled points are blue screen
  if (blueCount >= Math.ceil(sampleCount / 2)) {
    const avgB = sumB / sampleCount;
    const avgR = sumR / sampleCount;
    const avgG = sumG / sampleCount;
    if (avgB > 180 && avgR < 80 && avgG < 80) {
      return "#0000FF";
    }
    return rgbToHex(avgR, avgG, avgB);
  }

  // Otherwise return the average of the corner samples
  const avgR = Math.round(sumR / sampleCount);
  const avgG = Math.round(sumG / sampleCount);
  const avgB = Math.round(sumB / sampleCount);
  return rgbToHex(avgR, avgG, avgB);
}

/**
 * Samples a pixel from an image or canvas at specified coordinates
 */
export async function samplePixelColor(
  source: HTMLImageElement | HTMLCanvasElement | string,
  pixelX: number,
  pixelY: number
): Promise<{ hex: string; rgb: RGBColor }> {
  let imgElement: HTMLImageElement | HTMLCanvasElement;
  if (typeof source === "string") {
    imgElement = await loadImage(source);
  } else {
    imgElement = source;
  }

  const canvas = document.createElement("canvas");
  canvas.width = imgElement.width;
  canvas.height = imgElement.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return { hex: "#00FF00", rgb: { r: 0, g: 255, b: 0 } };
  }
  ctx.drawImage(imgElement, 0, 0);

  const clampedX = Math.max(0, Math.min(imgElement.width - 1, Math.round(pixelX)));
  const clampedY = Math.max(0, Math.min(imgElement.height - 1, Math.round(pixelY)));

  const p = ctx.getImageData(clampedX, clampedY, 1, 1).data;
  const rgb: RGBColor = { r: p[0], g: p[1], b: p[2] };
  return {
    hex: rgbToHex(rgb.r, rgb.g, rgb.b),
    rgb,
  };
}

/**
 * Core Chroma-Key background removal processor.
 * Replaces matching key color pixels with transparency.
 * Supports tolerance threshold, softness/feathering, and despill.
 */
export async function applyChromaKey(options: ChromaKeyOptions): Promise<ChromaKeyResult> {
  const {
    source,
    keyColor = "#00FF00",
    tolerance = 35, // 0 to 100
    softness = 15, // 0 to 100
    despill = true,
    maxWidth,
    maxHeight,
  } = options;

  let imgElement: HTMLImageElement | HTMLCanvasElement;
  if (typeof source === "string") {
    imgElement = await loadImage(source);
  } else {
    imgElement = source;
  }

  let width = imgElement.width;
  let height = imgElement.height;

  // Optional bounding
  if (maxWidth && width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }
  if (maxHeight && height > maxHeight) {
    width = Math.round((width * maxHeight) / height);
    height = maxHeight;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Could not initialize 2D canvas rendering context for chroma keying");
  }

  ctx.drawImage(imgElement, 0, 0, width, height);
  const imgData = ctx.getImageData(0, 0, width, height);
  const { data } = imgData;

  const keyRGB = parseHexColor(keyColor);
  const kr = keyRGB.r;
  const kg = keyRGB.g;
  const kb = keyRGB.b;

  // Maximum Euclidean distance in RGB is sqrt(255^2 * 3) ~= 441.67
  const maxDistance = 441.67;

  // Tolerance maps 0-100 to distance threshold (0 to 300)
  // At tolerance 35, threshold is ~105
  const threshold = (Math.max(1, tolerance) / 100) * 300;

  // Softness maps 0-100 to feathering band (0 to 120)
  const featherBand = (Math.max(0, softness) / 100) * 120;

  // Detect which channel is dominant in key color for despill
  const isGreenKey = kg > kr * 1.2 && kg > kb * 1.2;
  const isBlueKey = kb > kr * 1.2 && kb > kg * 1.2;

  let transparentCount = 0;
  const totalPixels = width * height;
  const len = data.length;

  for (let i = 0; i < len; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a === 0) {
      transparentCount++;
      continue;
    }

    // Euclidean distance in RGB space
    const dist = Math.hypot(r - kr, g - kg, b - kb);

    if (dist <= threshold) {
      // Fully within key tolerance -> make completely transparent
      data[i + 3] = 0;
      transparentCount++;
    } else if (featherBand > 0 && dist < threshold + featherBand) {
      // Within the feathering / softness band -> gradual alpha interpolation
      const factor = (dist - threshold) / featherBand; // 0.0 to 1.0
      const newAlpha = Math.round(a * factor);
      data[i + 3] = newAlpha;

      if (newAlpha === 0) {
        transparentCount++;
      } else if (despill) {
        // Suppress key color spill on semi-transparent transition fringes
        if (isGreenKey) {
          const maxRB = Math.max(r, b);
          if (g > maxRB) {
            data[i + 1] = Math.round(maxRB + (g - maxRB) * factor);
          }
        } else if (isBlueKey) {
          const maxRG = Math.max(r, g);
          if (b > maxRG) {
            data[i + 2] = Math.round(maxRG + (b - maxRG) * factor);
          }
        }
      }
    } else if (despill && dist < threshold + featherBand + 30) {
      // Subtle despill on edge pixels just outside the softness band
      if (isGreenKey && g > Math.max(r, b)) {
        data[i + 1] = Math.max(r, b);
      } else if (isBlueKey && b > Math.max(r, g)) {
        data[i + 2] = Math.max(r, g);
      }
    }
  }

  // Put processed keyed pixels back onto canvas
  ctx.putImageData(imgData, 0, 0);

  const dataUrl = canvas.toDataURL("image/png");
  const transparentPercentage = totalPixels > 0 ? Math.round((transparentCount / totalPixels) * 100) : 0;

  return {
    dataUrl,
    width,
    height,
    transparentPixelCount: transparentCount,
    transparentPercentage,
  };
}
