import fs from "fs";
import path from "path";
import sharp from "sharp";

/**
 * Ensures the thumbnails folder exists alongside the parent media directory.
 */
export function ensureThumbnailDirectory(parentDir: string): string {
  const thumbDir = path.join(parentDir, "thumbnails");
  if (!fs.existsSync(thumbDir)) {
    fs.mkdirSync(thumbDir, { recursive: true });
  }
  return thumbDir;
}

/**
 * Generates a crisp, lightweight thumbnail (~384px) for fast UI rendering and LLM vision ingestion.
 */
export async function generateThumbnailFile(
  sourcePath: string,
  targetThumbPath?: string,
  maxDimension = 384
): Promise<string> {
  const resolvedTarget = targetThumbPath || path.join(
    ensureThumbnailDirectory(path.dirname(sourcePath)),
    path.basename(sourcePath)
  );

  try {
    ensureThumbnailDirectory(path.dirname(resolvedTarget));

    // Convert and downscale to compact JPEG/PNG thumbnail
    await sharp(sourcePath)
      .rotate() // Auto-orient according to EXIF
      .resize(maxDimension, maxDimension, {
        fit: "inside",
        withoutEnlargement: true
      })
      .jpeg({ quality: 85, mozjpeg: true })
      .toFile(resolvedTarget);

    return resolvedTarget;
  } catch (err: any) {
    console.warn(`[ThumbnailService] Sharp thumbnail generation failed for ${path.basename(sourcePath)}:`, err?.message);
    try {
      // Fallback: copy source directly if sharp encounters an edge format
      fs.copyFileSync(sourcePath, resolvedTarget);
      return resolvedTarget;
    } catch (copyErr) {
      return sourcePath;
    }
  }
}

/**
 * Converts an image file path or buffer into a compact base64 data URI for vision models.
 */
export async function getImageBase64ForVision(
  source: string | Buffer,
  maxDimension = 384
): Promise<string> {
  try {
    let pipeline = sharp(source).rotate().resize(maxDimension, maxDimension, {
      fit: "inside",
      withoutEnlargement: true
    });

    const jpegBuffer = await pipeline.jpeg({ quality: 85 }).toBuffer();
    return `data:image/jpeg;base64,${jpegBuffer.toString("base64")}`;
  } catch (err) {
    if (typeof source === "string" && fs.existsSync(source)) {
      const rawBuf = fs.readFileSync(source);
      return `data:image/jpeg;base64,${rawBuf.toString("base64")}`;
    } else if (Buffer.isBuffer(source)) {
      return `data:image/jpeg;base64,${source.toString("base64")}`;
    }
    throw new Error("Unable to convert image source to base64 for vision processing.");
  }
}
