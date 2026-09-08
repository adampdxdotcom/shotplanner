/**
 * Helper: Create a stylized silhouette fallback if character has no image asset
 * Uses a persistent offscreen scratchpad canvas and caches generated silhouettes by name
 */
let silhouetteScratchCanvas: HTMLCanvasElement | null = null;
const silhouetteCache = new Map<string, string>();

export function createSilhouetteImage(name: string): HTMLImageElement {
  const cachedDataUrl = silhouetteCache.get(name);
  if (cachedDataUrl) {
    const img = new Image();
    img.src = cachedDataUrl;
    return img;
  }

  if (!silhouetteScratchCanvas) {
    silhouetteScratchCanvas = document.createElement("canvas");
    silhouetteScratchCanvas.width = 600;
    silhouetteScratchCanvas.height = 900;
  }

  const canvas = silhouetteScratchCanvas;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 600, 900);
    const grad = ctx.createLinearGradient(0, 0, 0, 900);
    grad.addColorStop(0, "#4f46e5");
    grad.addColorStop(1, "#1e1b4b");
    ctx.fillStyle = grad;

    // Head
    ctx.beginPath();
    ctx.arc(300, 180, 95, 0, Math.PI * 2);
    ctx.fill();

    // Torso & Shoulders
    ctx.beginPath();
    ctx.moveTo(130, 340);
    ctx.quadraticCurveTo(300, 270, 470, 340);
    ctx.lineTo(510, 900);
    ctx.lineTo(90, 900);
    ctx.closePath();
    ctx.fill();

    // Label text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 34px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(name, 300, 520);
  }

  const dataUrl = canvas.toDataURL("image/png");
  silhouetteCache.set(name, dataUrl);

  const img = new Image();
  img.src = dataUrl;
  return img;
}
