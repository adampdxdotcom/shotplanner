// Client-side canvas stitching engine for character reference sheets
import { SheetLayoutPreset } from "../components/cast/ReferenceSheetsTab";

export interface RenderSlotData {
  slotIndex: number;
  label: string;
  sublabel: string;
  imageUrl?: string;
}

export interface SheetRenderOptions {
  layout: SheetLayoutPreset;
  slots: RenderSlotData[];
  theme: "studio-dark" | "neutral-charcoal" | "slate-navy" | "studio-white";
  fitMode: "cover" | "contain";
  showLabels: boolean;
  characterName?: string;
  sheetTitle?: string;
}

// Background colors and border styling by theme
const THEME_STYLES: Record<string, { bg: string; panelBg: string; border: string; text: string; labelBg: string }> = {
  "studio-dark": {
    bg: "#09090b",
    panelBg: "#121215",
    border: "#27272a",
    text: "#e4e4e7",
    labelBg: "rgba(9, 9, 11, 0.85)"
  },
  "neutral-charcoal": {
    bg: "#18181b",
    panelBg: "#202024",
    border: "#3f3f46",
    text: "#f4f4f5",
    labelBg: "rgba(24, 24, 27, 0.85)"
  },
  "slate-navy": {
    bg: "#0f172a",
    panelBg: "#1e293b",
    border: "#334155",
    text: "#f8fafc",
    labelBg: "rgba(15, 23, 42, 0.85)"
  },
  "studio-white": {
    bg: "#f8fafc",
    panelBg: "#ffffff",
    border: "#e2e8f0",
    text: "#0f172a",
    labelBg: "rgba(255, 255, 255, 0.9)"
  }
};

/**
 * Loads an image from URL or dataURL with CORS support.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Fallback without crossOrigin if local/tainted
      const fallbackImg = new Image();
      fallbackImg.onload = () => resolve(fallbackImg);
      fallbackImg.onerror = (err) => reject(new Error(`Failed to load image: ${src}`));
      fallbackImg.src = src;
    };
    img.src = src;
  });
}

/**
 * Calculates output dimensions based on layout.
 */
export function getReferenceSheetDimensions(layout: SheetLayoutPreset): { width: number; height: number } {
  if (layout === "3-panel") {
    // 16:9 Widescreen high-resolution
    return { width: 2400, height: 1350 };
  }
  // 1:1 High-res Square
  return { width: 2048, height: 2048 };
}

/**
 * Stitches the assigned reference images into a high-res composite image on canvas.
 */
export async function renderReferenceSheetToBlob(
  options: SheetRenderOptions
): Promise<{ blob: Blob; dataUrl: string; width: number; height: number }> {
  const { layout, slots, theme, fitMode, showLabels, characterName, sheetTitle } = options;
  const { width, height } = getReferenceSheetDimensions(layout);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not acquire 2D canvas context");

  const style = THEME_STYLES[theme] || THEME_STYLES["studio-dark"];

  // 1. Render Canvas Background
  ctx.fillStyle = style.bg;
  ctx.fillRect(0, 0, width, height);

  // 2. Pre-load all slot images in parallel
  const loadedImages: Record<number, HTMLImageElement | null> = {};
  await Promise.all(
    slots.map(async (slot) => {
      if (slot.imageUrl) {
        try {
          loadedImages[slot.slotIndex] = await loadImage(slot.imageUrl);
        } catch (e) {
          console.warn(`Failed loading image for slot ${slot.slotIndex}`, e);
          loadedImages[slot.slotIndex] = null;
        }
      }
    })
  );

  // 3. Compute grid layout geometry
  const cols = layout === "3-panel" ? 3 : layout === "4-panel" ? 2 : 3;
  const rows = layout === "3-panel" ? 1 : layout === "4-panel" ? 2 : 3;
  const marginX = layout === "3-panel" ? 40 : 36;
  const marginY = layout === "3-panel" ? 40 : 36;
  const gutter = layout === "9-panel" ? 18 : 24;

  const totalGutterX = (cols - 1) * gutter;
  const totalGutterY = (rows - 1) * gutter;
  const panelW = (width - marginX * 2 - totalGutterX) / cols;
  const panelH = (height - marginY * 2 - totalGutterY) / rows;

  // 4. Render each panel
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const slot = slots[idx];
      const px = marginX + c * (panelW + gutter);
      const py = marginY + r * (panelH + gutter);

      // Panel background
      ctx.save();
      ctx.fillStyle = style.panelBg;
      ctx.fillRect(px, py, panelW, panelH);

      const img = loadedImages[idx];
      if (img) {
        // Clip to panel boundaries
        ctx.beginPath();
        ctx.rect(px, py, panelW, panelH);
        ctx.clip();

        // Object-fit rendering
        const imgRatio = img.width / img.height;
        const panelRatio = panelW / panelH;
        let dw = panelW;
        let dh = panelH;
        let dx = px;
        let dy = py;

        if (fitMode === "cover") {
          if (imgRatio > panelRatio) {
            dh = panelH;
            dw = panelH * imgRatio;
            dx = px - (dw - panelW) / 2;
          } else {
            dw = panelW;
            dh = panelW / imgRatio;
            dy = py - (dh - panelH) / 2;
          }
        } else {
          // Contain mode
          if (imgRatio > panelRatio) {
            dw = panelW;
            dh = panelW / imgRatio;
            dy = py + (panelH - dh) / 2;
          } else {
            dh = panelH;
            dw = panelH * imgRatio;
            dx = px + (panelW - dw) / 2;
          }
        }

        ctx.drawImage(img, dx, dy, dw, dh);
        ctx.restore();
      } else {
        // Empty slot placeholder drawing
        ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
        ctx.fillRect(px, py, panelW, panelH);
        ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
        ctx.font = "bold 24px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(slot?.label || `Panel ${idx + 1}`, px + panelW / 2, py + panelH / 2);
        ctx.restore();
      }

      // Panel border stroke
      ctx.strokeStyle = style.border;
      ctx.lineWidth = 2;
      ctx.strokeRect(px, py, panelW, panelH);

      // Optional text label strip
      if (showLabels && slot) {
        const labelText = slot.sublabel || slot.label;
        const labelH = layout === "9-panel" ? 28 : 36;
        ctx.fillStyle = style.labelBg;
        ctx.fillRect(px, py + panelH - labelH, panelW, labelH);

        ctx.fillStyle = style.text;
        ctx.font = layout === "9-panel" ? "600 13px sans-serif" : "600 16px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(labelText, px + panelW / 2, py + panelH - labelH / 2);
      }
    }
  }

  // 5. Convert to Blob
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Canvas toBlob failed"));
        return;
      }
      const dataUrl = canvas.toDataURL("image/png");
      resolve({ blob, dataUrl, width, height });
    }, "image/png");
  });
}

/**
 * Triggers a browser download of a generated blob.
 */
export function downloadReferenceSheetBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
