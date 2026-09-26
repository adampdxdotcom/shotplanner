import React, { Component, ErrorInfo, ReactNode } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackLabel?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
}

/**
 * SectionErrorBoundary catches rendering errors in dynamically imported tabs.
 * If a module chunk fails to load (e.g., due to background rebuild or cache skew),
 * it provides an automatic reload recovery mechanism.
 */
export class SectionErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    isChunkError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    const isChunkError =
      error.message?.includes("dynamically imported module") ||
      error.message?.includes("Failed to fetch dynamically imported module") ||
      error.message?.includes("Loading chunk") ||
      error.name === "ChunkLoadError";

    return {
      hasError: true,
      error,
      isChunkError
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[SectionErrorBoundary caught an error]:", error, errorInfo);
    
    // If it's a chunk loading failure and hasn't reloaded in this session yet, auto-reload seamlessly
    if (this.state.isChunkError) {
      const reloadKey = "chunk_error_autoreload";
      const lastReload = sessionStorage.getItem(reloadKey);
      if (!lastReload || Date.now() - Number(lastReload) > 10000) {
        sessionStorage.setItem(reloadKey, String(Date.now()));
        window.location.reload();
      }
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, isChunkError: false });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full min-h-[360px] flex flex-col items-center justify-center p-8 bg-[var(--bg-surface)] border border-amber-500/30 rounded-2xl text-center shadow-lg">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 mb-4 shadow-inner">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
          </div>

          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
            {this.state.isChunkError ? "App Updated in Background" : "Section Failed to Load"}
          </h3>

          <p className="text-sm text-[var(--text-secondary)] max-w-md mb-6 leading-relaxed">
            {this.state.isChunkError
              ? "A newer version of this module was deployed. Refresh the page to load the latest build."
              : (this.state.error?.message || "An unexpected error occurred while loading this tab.")}
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Application
            </button>
            {!this.state.isChunkError && (
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2.5 bg-[var(--bg-element)] hover:bg-[var(--border-subtle)] text-[var(--text-secondary)] text-xs font-medium rounded-xl transition-all border border-[var(--border-subtle)]"
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
