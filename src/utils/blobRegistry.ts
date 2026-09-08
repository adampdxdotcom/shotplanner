/**
 * Centralized Ephemeral Blob & Object URL Registry
 * 
 * Provides leak-proof tracking and disposal of temporary `blob:` URLs
 * generated during image uploads, chroma-keying, staging previews, and composite generation.
 */

// Internal registry keeping track of active object URLs and their tags/categories
const activeBlobUrls = new Map<string, { category?: string; createdAt: number }>();

/**
 * Creates an object URL for a Blob or File and registers it in the active registry.
 */
export function createManagedBlobUrl(blobOrFile: Blob | File, category?: string): string {
  if (typeof window === "undefined" || !window.URL || typeof window.URL.createObjectURL !== "function") {
    return "";
  }

  const url = window.URL.createObjectURL(blobOrFile);
  activeBlobUrls.set(url, {
    category,
    createdAt: Date.now()
  });

  return url;
}

/**
 * Revokes a managed or unmanaged blob URL and removes it from the tracking registry.
 * Safe to call with null, undefined, or regular HTTP/data URLs.
 */
export function revokeManagedBlobUrl(url: string | null | undefined): void {
  if (!url || typeof url !== "string") return;

  // Only attempt to revoke if it's a browser blob URL
  if (url.startsWith("blob:")) {
    if (typeof window !== "undefined" && window.URL && typeof window.URL.revokeObjectURL === "function") {
      try {
        window.URL.revokeObjectURL(url);
      } catch (err) {
        console.warn("Failed to revoke object URL:", url, err);
      }
    }
  }

  activeBlobUrls.delete(url);
}

/**
 * Checks whether a given URL is currently registered in the active registry.
 */
export function isManagedBlobUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return activeBlobUrls.has(url);
}

/**
 * Returns the count of currently registered active blob URLs.
 */
export function getManagedBlobUrlCount(): number {
  return activeBlobUrls.size;
}

/**
 * Purges and revokes all currently tracked blob URLs, or optionally only those belonging to a specific category.
 * Recommended on project switch, route navigation, or modal closure.
 */
export function purgeManagedBlobUrls(category?: string): number {
  if (typeof window === "undefined" || !window.URL || typeof window.URL.revokeObjectURL !== "function") {
    activeBlobUrls.clear();
    return 0;
  }

  let revokedCount = 0;
  const urlsToRevoke: string[] = [];

  for (const [url, meta] of activeBlobUrls.entries()) {
    if (!category || meta.category === category) {
      urlsToRevoke.push(url);
    }
  }

  for (const url of urlsToRevoke) {
    try {
      window.URL.revokeObjectURL(url);
      revokedCount++;
    } catch (err) {
      console.warn("Error revoking object URL during purge:", url, err);
    }
    activeBlobUrls.delete(url);
  }

  return revokedCount;
}
