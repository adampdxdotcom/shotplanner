import { useState, useEffect, useRef, useCallback } from "react";
import { createManagedBlobUrl, revokeManagedBlobUrl } from "../utils/blobRegistry";

/**
 * React hook that manages a single object URL for a Blob or File.
 * Guarantees that:
 * 1. Updating the input blob/file automatically revokes the previous object URL.
 * 2. Clearing the input blob/file revokes the active object URL.
 * 3. Component unmounting revokes the active object URL to prevent memory leaks.
 */
export function useSafeObjectUrl(
  blobOrFile: Blob | File | null | undefined,
  category?: string
): string | null {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const activeUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!blobOrFile) {
      if (activeUrlRef.current) {
        revokeManagedBlobUrl(activeUrlRef.current);
        activeUrlRef.current = null;
      }
      setObjectUrl(null);
      return;
    }

    const nextUrl = createManagedBlobUrl(blobOrFile, category);

    // Revoke previous URL if any existed
    if (activeUrlRef.current && activeUrlRef.current !== nextUrl) {
      revokeManagedBlobUrl(activeUrlRef.current);
    }

    activeUrlRef.current = nextUrl;
    setObjectUrl(nextUrl);

    return () => {
      if (activeUrlRef.current) {
        revokeManagedBlobUrl(activeUrlRef.current);
        activeUrlRef.current = null;
      }
    };
  }, [blobOrFile, category]);

  return objectUrl;
}

/**
 * React hook that tracks a collection of dynamically created Blob URLs within a component.
 * Automatically revokes all registered URLs when the host component unmounts.
 */
export function useBlobUrlTracker(category?: string) {
  const trackedUrlsRef = useRef<Set<string>>(new Set());

  const createTrackedUrl = useCallback((blobOrFile: Blob | File): string => {
    const url = createManagedBlobUrl(blobOrFile, category);
    trackedUrlsRef.current.add(url);
    return url;
  }, [category]);

  const revokeTrackedUrl = useCallback((url: string | null | undefined) => {
    if (!url) return;
    if (trackedUrlsRef.current.has(url)) {
      trackedUrlsRef.current.delete(url);
    }
    revokeManagedBlobUrl(url);
  }, []);

  const clearAllTrackedUrls = useCallback(() => {
    for (const url of trackedUrlsRef.current) {
      revokeManagedBlobUrl(url);
    }
    trackedUrlsRef.current.clear();
  }, []);

  // Guarantee revocation of all tracked URLs when component unmounts
  useEffect(() => {
    const urls = trackedUrlsRef.current;
    return () => {
      for (const url of urls) {
        revokeManagedBlobUrl(url);
      }
      urls.clear();
    };
  }, []);

  return {
    createTrackedUrl,
    revokeTrackedUrl,
    clearAllTrackedUrls
  };
}
