import React, { useState } from "react";
import { MediaAsset, ImageVisualAnalysis } from "../types";
import { X, Trash2, Sparkles, RefreshCw, Eye, Sun, Camera, Palette, Shirt, User } from "lucide-react";
import { getAssetMediaUrl } from "../utils/assetUrl";
import { formatSize } from "../utils/formatters";
import { apiClient } from "../api";

interface AssetLightboxProps {
  asset: MediaAsset | null;
  visualAnalysis?: ImageVisualAnalysis;
  onClose: () => void;
  onDelete?: (asset: MediaAsset) => void;
  onAnalysisSaved?: (filename: string, analysis: ImageVisualAnalysis) => void;
}

export const AssetLightbox: React.FC<AssetLightboxProps> = ({ 
  asset, 
  visualAnalysis,
  onClose, 
  onDelete,
  onAnalysisSaved
}) => {
  if (!asset) return null;

  const [analyzing, setAnalyzing] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<ImageVisualAnalysis | undefined>(
    visualAnalysis || (asset as any).visual_analysis
  );
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const isVideoOrAudio = /\.(mp3|wav|ogg|m4a|flac|mp4|mov|webm|mkv)$/i.test(asset.filename);
  const isImage = asset.media_type === "image" || (!asset.media_type && !isVideoOrAudio);

  const handleRunVisionAnalysis = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isImage) return;

    setAnalyzing(true);
    setAnalysisError(null);

    try {
      const res: any = await apiClient.post("/api/vision/caption", {
        filename: asset.filename,
        subject_name: asset.subject_name || "",
        context_type: asset.type || "reference"
      });

      if (res && res.success && res.analysis) {
        setCurrentAnalysis(res.analysis);
        onAnalysisSaved?.(asset.filename, res.analysis);
      } else {
        throw new Error(res?.error || "Vision analysis did not return structured data.");
      }
    } catch (err: any) {
      console.error("Vision analysis failed:", err);
      setAnalysisError(err.message || "Failed to analyze image with Vision AI.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div 
      className="asset-lightbox-backdrop dark-viewport fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 cursor-zoom-out overflow-y-auto"
      onClick={onClose}
    >
      <div className="fixed top-4 right-4 flex items-center gap-3 z-50">
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(asset);
            }}
            className="p-2.5 bg-zinc-900 hover:bg-red-900/80 border border-zinc-800 text-red-400 rounded-full shadow-lg transition-colors cursor-pointer"
            title="Delete asset"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        <button 
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="p-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white rounded-full shadow-lg transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="w-full max-w-4xl flex flex-col items-center my-auto py-6 space-y-4">
        {/* Media Frame */}
        <div 
          className="max-w-4xl max-h-[65vh] flex items-center justify-center rounded-xl overflow-hidden shadow-2xl bg-zinc-950/80 border border-zinc-850"
          onClick={(e) => e.stopPropagation()}
        >
          {isImage ? (
            <img 
              src={getAssetMediaUrl(asset.filename)} 
              alt={asset.subject_name || "Asset"} 
              className="max-w-full max-h-[65vh] object-contain"
              referrerPolicy="no-referrer"
            />
          ) : (
            <video 
              src={getAssetMediaUrl(asset.filename)} 
              className="max-w-full max-h-[65vh] object-contain"
              controls
              autoPlay
            />
          )}
        </div>

        {/* Info & Vision Analysis Card */}
        <div 
          className="w-full max-w-3xl p-4 bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-xl space-y-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 border-b border-zinc-800/80 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-100">{asset.subject_name || "Unlabeled Asset"}</h3>
                <span className="text-[10px] text-amber-400 font-mono font-medium px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/60">
                  {asset.type || "Scene Reference"}
                </span>
              </div>
              {asset.description && (
                <p className="text-xs text-zinc-400 max-w-lg mt-1 leading-relaxed">{asset.description}</p>
              )}
            </div>

            {isImage && (
              <button
                type="button"
                onClick={handleRunVisionAnalysis}
                disabled={analyzing}
                className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 text-white font-semibold text-xs flex items-center gap-1.5 shrink-0 shadow-2xs transition-colors cursor-pointer"
                title="Run Vision AI to analyze traits, lighting, wardrobe, and optics"
              >
                {analyzing ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-amber-300" />
                    <span>{currentAnalysis ? "Re-Analyze Vision" : "Analyze with Vision AI"}</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Visual AI Breakdown View */}
          {currentAnalysis ? (
            <div className="bg-zinc-950/80 border border-purple-900/30 rounded-xl p-3.5 space-y-3 text-xs">
              <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-2">
                <div className="flex items-center gap-1.5 text-purple-400 font-semibold">
                  <Eye className="w-3.5 h-3.5" />
                  <span className="uppercase tracking-wider text-[10px] font-bold">Multimodal Vision Breakdown</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">
                  {currentAnalysis.scanned_at ? new Date(currentAnalysis.scanned_at).toLocaleTimeString() : "Verified"}
                </span>
              </div>

              <p className="text-zinc-200 text-xs italic bg-purple-950/20 border border-purple-900/40 p-2.5 rounded-lg leading-relaxed">
                "{currentAnalysis.summary}"
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
                {/* Subject & Features */}
                {currentAnalysis.subject && (
                  <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-lg p-2 space-y-1">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-zinc-300">
                      <User className="w-3 h-3 text-purple-400" />
                      <span>Subject Traits</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 font-mono">
                      Age: {currentAnalysis.subject.apparent_age || "--"}<br />
                      Hair: {currentAnalysis.subject.hair || "--"}<br />
                      Mood: {currentAnalysis.subject.expression || "--"}
                    </p>
                  </div>
                )}

                {/* Wardrobe */}
                {currentAnalysis.wardrobe && (
                  <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-lg p-2 space-y-1">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-zinc-300">
                      <Shirt className="w-3 h-3 text-cyan-400" />
                      <span>Wardrobe</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 font-mono">
                      Outfit: {currentAnalysis.wardrobe.garments || "--"}<br />
                      Colors: {currentAnalysis.wardrobe.colors || "--"}
                    </p>
                  </div>
                )}

                {/* Lighting */}
                {currentAnalysis.lighting && (
                  <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-lg p-2 space-y-1">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-zinc-300">
                      <Sun className="w-3 h-3 text-amber-400" />
                      <span>Lighting</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 font-mono">
                      Key: {currentAnalysis.lighting.key_direction || "--"}<br />
                      Temp: {currentAnalysis.lighting.color_temperature || "--"}
                    </p>
                  </div>
                )}

                {/* Cinematography */}
                {currentAnalysis.cinematography && (
                  <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-lg p-2 space-y-1">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-zinc-300">
                      <Camera className="w-3 h-3 text-emerald-400" />
                      <span>Optics &amp; Angle</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 font-mono">
                      Framing: {currentAnalysis.cinematography.framing || "--"}<br />
                      Angle: {currentAnalysis.cinematography.camera_angle || "--"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : analysisError ? (
            <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs text-center">
              {analysisError}
            </div>
          ) : null}

          {/* Footer Metadata */}
          <div className="flex justify-between items-center text-[10px] text-zinc-500 pt-1.5 border-t border-zinc-850">
            <span>Filename: {asset.original_name || asset.filename}</span>
            <span>Size: {formatSize(asset.size_bytes || 0)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
