// High-performance client-side Composite Canvas Flattening & Export Utility

export interface CompositeExportActor {
  id: string;
  characterName: string;
  cutoutDataUrl?: string;
  fallbackUrl?: string;
  xPercent: number; // 0 to 100
  yPercent: number; // 0 to 100
  scale: number; // 0.2 to 2.5
  isFlipped: boolean;
  zIndex: number;
}

export interface CompositeExportOptions {
  backgroundUrl?: string;
  actors: CompositeExportActor[];
  aspectRatio: string; // "16:9" | "2.39:1" | "4:3" | "9:16"
  customWidth?: number;
}

/**
 * Calculates canvas pixel dimensions based on the requested aspect ratio.
 */
export function getCanvasDimensions(aspectRatio: string, customWidth?: number): { width: number; height: number } {
  if (customWidth) {
    if (aspectRatio === "2.39:1") {
      return { width: customWidth, height: Math.round(customWidth / 2.39) };
    }
    if (aspectRatio === "4:3") {
      return { width: customWidth, height: Math.round((customWidth * 3) / 4) };
    }
    if (aspectRatio === "9:16") {
      return { width: customWidth, height: Math.round((customWidth * 16) / 9) };
    }
    // Default 16:9
    return { width: customWidth, height: Math.round((customWidth * 9) / 16) };
  }

  // High-resolution cinema defaults
  switch (aspectRatio) {
    case "2.39:1":
      return { width: 2390, height: 1000 };
    case "4:3":
      return { width: 1440, height: 1080 };
    case "9:16":
      return { width: 1080, height: 1920 };
    case "16:9":
    default:
      return { width: 1920, height: 1080 };
  }
}

/**
 * Loads an image from a URL or base64 string with crossOrigin support.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error(`Failed to load image: ${src.slice(0, 40)}... (${err})`));
    img.src = src;
  });
}

/**
 * Flattens the environment background and all layered actor cutouts into a single full-resolution image Blob.
 */
export async function renderCompositeToBlob(options: CompositeExportOptions): Promise<Blob> {
  const { width, height } = getCanvasDimensions(options.aspectRatio, options.customWidth);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { willReadFrequently: false });
  if (!ctx) {
    throw new Error("Unable to obtain 2D canvas context for composite rendering.");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // 1. Draw Background
  if (options.backgroundUrl) {
    try {
      const bgImg = await loadImage(options.backgroundUrl);
      const bgAspect = bgImg.naturalWidth / bgImg.naturalHeight;
      const targetAspect = width / height;

      let drawW = width;
      let drawH = height;
      let drawX = 0;
      let drawY = 0;

      // Cover scaling
      if (bgAspect > targetAspect) {
        drawW = height * bgAspect;
        drawX = (width - drawW) / 2;
      } else {
        drawH = width / bgAspect;
        drawY = (height - drawH) / 2;
      }

      ctx.drawImage(bgImg, drawX, drawY, drawW, drawH);
    } catch (err) {
      console.warn("Background image failed to load for composite, falling back to cinematic studio gradient:", err);
      renderDefaultStudioBackdrop(ctx, width, height);
    }
  } else {
    renderDefaultStudioBackdrop(ctx, width, height);
  }

  // 2. Sort Actors by zIndex ascending
  const sortedActors = [...options.actors].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

  // 3. Render Each Actor
  for (const actor of sortedActors) {
    const actorSrc = actor.cutoutDataUrl || actor.fallbackUrl;
    if (!actorSrc) continue;

    try {
      const actorImg = await loadImage(actorSrc);
      const naturalAspect = actorImg.naturalWidth / actorImg.naturalHeight;

      // Base reference height for scale 1.0 is 55% of canvas height
      const actorHeight = height * 0.55 * (actor.scale || 1.0);
      const actorWidth = actorHeight * naturalAspect;

      // Foot anchor point at (xPercent, yPercent)
      const footX = (actor.xPercent / 100) * width;
      const footY = (actor.yPercent / 100) * height;

      const posX = footX - actorWidth / 2;
      const posY = footY - actorHeight;

      // Draw soft elliptical ground contact shadow
      ctx.save();
      const shadowRadiusX = actorWidth * 0.38;
      const shadowRadiusY = actorHeight * 0.045;
      const shadowGrad = ctx.createRadialGradient(footX, footY, 0, footX, footY, shadowRadiusX);
      shadowGrad.addColorStop(0, "rgba(0, 0, 0, 0.65)");
      shadowGrad.addColorStop(0.6, "rgba(0, 0, 0, 0.35)");
      shadowGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.ellipse(footX, footY, shadowRadiusX, shadowRadiusY, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Draw Actor Cutout with optional horizontal flip
      ctx.save();
      if (actor.isFlipped) {
        ctx.translate(footX, posY + actorHeight / 2);
        ctx.scale(-1, 1);
        ctx.drawImage(actorImg, -actorWidth / 2, -actorHeight / 2, actorWidth, actorHeight);
      } else {
        ctx.drawImage(actorImg, posX, posY, actorWidth, actorHeight);
      }
      ctx.restore();
    } catch (err) {
      console.warn(`Failed to render actor ${actor.characterName} in composite:`, err);
    }
  }

  // 4. Convert Canvas to PNG Blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Canvas toBlob failed to produce an image payload."));
        }
      },
      "image/png",
      0.95
    );
  });
}

/**
 * Fallback background when no room image is selected: elegant dark cyclorama studio
 */
function renderDefaultStudioBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number) {
  // Deep vignette background
  const bgGrad = ctx.createRadialGradient(
    width / 2,
    height * 0.45,
    width * 0.1,
    width / 2,
    height * 0.5,
    width * 0.75
  );
  bgGrad.addColorStop(0, "#1f2430");
  bgGrad.addColorStop(0.6, "#111319");
  bgGrad.addColorStop(1, "#08090c");

  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Perspective floor plane
  const floorY = height * 0.65;
  const floorGrad = ctx.createLinearGradient(0, floorY, 0, height);
  floorGrad.addColorStop(0, "rgba(255, 255, 255, 0.04)");
  floorGrad.addColorStop(1, "rgba(0, 0, 0, 0.6)");

  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, floorY, width, height - floorY);

  // Soft horizon line
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, floorY);
  ctx.lineTo(width, floorY);
  ctx.stroke();
}
