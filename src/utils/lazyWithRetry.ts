import { ComponentType, lazy, LazyExoticComponent } from "react";

/**
 * lazyWithRetry wraps React.lazy to gracefully handle chunk load failures
 * (e.g. after fresh deployments or background builds where chunk hashes change).
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  return lazy(async () => {
    const pageHasAlreadyBeenRefreshed = JSON.parse(
      sessionStorage.getItem("chunk_retry_refreshed") || "false"
    );

    try {
      return await factory();
    } catch (error: any) {
      console.warn("[lazyWithRetry] Dynamic import failed, checking retry status:", error);

      // Check if error matches chunk/module import failure
      const isChunkError =
        error?.message?.includes("dynamically imported module") ||
        error?.message?.includes("Failed to fetch dynamically imported module") ||
        error?.name === "ChunkLoadError";

      if (isChunkError && !pageHasAlreadyBeenRefreshed) {
        sessionStorage.setItem("chunk_retry_refreshed", "true");
        window.location.reload();
        // Return a pending promise while the reload occurs to prevent React render crash
        return new Promise<{ default: T }>(() => {});
      }

      // If already refreshed or different error, throw to be caught by ErrorBoundary
      throw error;
    }
  });
}
