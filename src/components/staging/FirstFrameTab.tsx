import React, { useState, useMemo, useRef } from "react";
import { 
  MediaAsset, 
  SceneProjectFile, 
  ShotItem, 
  ShotTake, 
  ShotFirstFrame 
} from "../../types";
import { getAssetMediaUrl } from "../../utils/assetUrl";
import { extractAndUploadTakeLastFrame } from "../../utils/frameExtraction";
import { MultimodalFrameComposer } from "./MultimodalFrameComposer";
import { 
  Clapperboard, 
  Lock, 
  Unlock, 
  Upload, 
  Trash2, 
  Download, 
  Link as LinkIcon, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  Play, 
  Film, 
  Image as ImageIcon, 
  FolderOpen,
  Eye
} from "lucide-react";

interface FirstFrameTabProps {
  sceneProject?: SceneProjectFile;
  activeShot: ShotItem | null;
  activeScene: string;
  allAssets?: MediaAsset[];
  onUpdateShot?: (updater: (prev: ShotItem) => ShotItem) => void;
  onUpdateProject?: React.Dispatch<React.SetStateAction<SceneProjectFile>> | ((updater: (prev: SceneProjectFile) => SceneProjectFile) => void);
  onSelectShot?: (id: string | null) => void;
  onAssetUploaded?: (asset: MediaAsset, targetSlotIndex?: number) => void;
  addToast?: (msg: string, type?: "success" | "error" | "info") => void;
}

export const FirstFrameTab: React.FC<FirstFrameTabProps> = ({
  sceneProject,
  activeShot,
  activeScene,
  allAssets = [],
  onUpdateShot,
  onUpdateProject,
  onSelectShot,
  onAssetUploaded,
  addToast
}) => {
  const [isExtracting, setIsExtracting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);
  const [previewTakeUrl, setPreviewTakeUrl] = useState<string | null>(null);
  const [extractOffsetSeconds, setExtractOffsetSeconds] = useState<number>(0.04);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derive shots list and sequence position
  const shots = sceneProject?.shots || [];
  const currentShotIndex = activeShot ? shots.findIndex(s => s.id === activeShot.id) : -1;
  const previousShot = currentShotIndex > 0 ? shots[currentShotIndex - 1] : null;
  const nextShot = currentShotIndex >= 0 && currentShotIndex < shots.length - 1 ? shots[currentShotIndex + 1] : null;

  // Identify previous shot's hero or best take
  const previousHeroTake = useMemo<ShotTake | null>(() => {
    if (!previousShot || !previousShot.takes || previousShot.takes.length === 0) return null;
    
    // Check for explicit hero take
    if (previousShot.hero_take_id) {
      const hero = previousShot.takes.find(t => t.id === previousShot.hero_take_id);
      if (hero) return hero;
    }
    const heroFlagged = previousShot.takes.find(t => t.is_hero);
    if (heroFlagged) return heroFlagged;

    // Check for approved/good take
    const goodTake = previousShot.takes.find(t => t.rating === "good" || t.review_status === "approved" || t.review_status === "good");
    if (goodTake) return goodTake;

    // Fallback to most recent take
    return previousShot.takes[previousShot.takes.length - 1];
  }, [previousShot]);

  // Resolve video URL for previous take
  const previousTakeVideoUrl = useMemo<string | null>(() => {
    if (!previousHeroTake) return null;
    if (previousHeroTake.video_url) return previousHeroTake.video_url;

    const paddedShot = String(previousShot?.shot_number || currentShotIndex).padStart(2, "0");
    const filename = previousHeroTake.video_filename || `${activeScene}_Shot_${paddedShot}_Take_${previousHeroTake.take_number}.mp4`;
    return `/api/outputs/stream/${encodeURIComponent(activeScene)}/${encodeURIComponent(filename)}`;
  }, [previousHeroTake, previousShot, currentShotIndex, activeScene]);

  // 1. Action: Assign extracted or uploaded first frame to active shot
  const handleSetFirstFrame = (firstFrameData: ShotFirstFrame) => {
    if (!activeShot) return;

    if (onUpdateShot) {
      onUpdateShot(prev => ({
        ...prev,
        first_frame: firstFrameData,
        updated_at: new Date().toISOString()
      }));
    } else if (onUpdateProject) {
      onUpdateProject(prev => {
        const nextShots = [...prev.shots];
        const idx = nextShots.findIndex(s => s.id === activeShot.id);
        if (idx !== -1) {
          nextShots[idx] = {
            ...nextShots[idx],
            first_frame: firstFrameData,
            updated_at: new Date().toISOString()
          };
        }
        return { ...prev, shots: nextShots };
      });
    }
  };

  // 2. Action: Extract last frame from previous shot's take
  const handleExtractFromPreviousShot = async () => {
    if (!previousShot || !previousHeroTake || !previousTakeVideoUrl || !activeShot) {
      if (addToast) addToast("No valid previous video take found for extraction.", "error");
      return;
    }

    if (activeShot.first_frame?.locked) {
      if (addToast) addToast("Current first frame is locked. Unlock it first to overwrite.", "info");
      return;
    }

    setIsExtracting(true);
    try {
      const result = await extractAndUploadTakeLastFrame({
        videoUrl: previousTakeVideoUrl,
        sceneName: activeScene,
        sourceShotNumber: previousShot.shot_number || currentShotIndex,
        sourceTakeNumber: previousHeroTake.take_number,
        targetShotNumber: activeShot.shot_number || currentShotIndex + 1,
        customLabel: `Chained First Frame from Shot ${previousShot.shot_number} (Take ${previousHeroTake.take_number})`
      });

      if (!result.success || !result.assetFilename) {
        throw new Error(result.error || "Frame extraction failed");
      }

      if (result.asset && onAssetUploaded) {
        onAssetUploaded(result.asset);
      }

      const newFirstFrame: ShotFirstFrame = {
        source: "last_frame_chain",
        asset_filename: result.assetFilename,
        preview_url: result.dataUrl,
        source_shot_id: previousShot.id,
        source_shot_number: previousShot.shot_number,
        source_take_number: previousHeroTake.take_number,
        locked: true, // Default to locked to protect continuity
        updated_at: new Date().toISOString(),
        notes: `Chained from Shot ${previousShot.shot_number} Take ${previousHeroTake.take_number}`
      };

      handleSetFirstFrame(newFirstFrame);
      if (addToast) {
        addToast(`Extracted last frame from Shot ${previousShot.shot_number} and locked as Shot ${activeShot.shot_number} Frame 0!`, "success");
      }
    } catch (err: any) {
      console.error("Frame extraction error:", err);
      if (addToast) addToast(`Frame extraction failed: ${err.message}`, "error");
    } finally {
      setIsExtracting(false);
    }
  };

  // 3. Action: Manual upload of first frame
  const handleManualUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeShot) return;

    setIsUploading(true);
    try {
      const cleanScene = activeScene.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_") || "scene";
      const paddedShot = String(activeShot.shot_number || currentShotIndex + 1).padStart(2, "0");
      const targetFilename = `first_frame_${cleanScene}_shot_${paddedShot}_manual_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

      const formData = new FormData();
      formData.append("file", file, targetFilename);
      formData.append("type", "Scene Reference");
      formData.append("scene_name", cleanScene);
      formData.append("description", `Manual first frame for Shot ${activeShot.shot_number}`);
      formData.append("tags", JSON.stringify(["First Frame", "Frame 0", `Shot_${paddedShot}`]));
      formData.append("subject_name", cleanScene);

      const res = await fetch("/api/assets/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();

      if (data.success && data.asset) {
        if (onAssetUploaded) onAssetUploaded(data.asset);
        
        const newFirstFrame: ShotFirstFrame = {
          source: "manual_upload",
          asset_filename: data.asset.filename,
          locked: false,
          updated_at: new Date().toISOString()
        };

        handleSetFirstFrame(newFirstFrame);
        if (addToast) addToast(`Uploaded first frame for Shot ${activeShot.shot_number}`, "success");
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      if (addToast) addToast(`Failed to upload first frame: ${err.message}`, "error");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // 4. Action: Lock toggle
  const handleToggleLock = () => {
    if (!activeShot || !activeShot.first_frame) return;
    const isLocked = !activeShot.first_frame.locked;
    handleSetFirstFrame({
      ...activeShot.first_frame,
      locked: isLocked,
      updated_at: new Date().toISOString()
    });
    if (addToast) addToast(`First frame ${isLocked ? "locked" : "unlocked"} for Shot ${activeShot.shot_number}`, "info");
  };

  // 5. Action: Clear first frame
  const handleClearFirstFrame = () => {
    if (!activeShot) return;
    if (onUpdateShot) {
      onUpdateShot(prev => {
        const { first_frame, ...rest } = prev;
        return {
          ...rest,
          updated_at: new Date().toISOString()
        };
      });
    } else if (onUpdateProject) {
      onUpdateProject(prev => {
        const nextShots = [...prev.shots];
        const idx = nextShots.findIndex(s => s.id === activeShot.id);
        if (idx !== -1) {
          const { first_frame, ...rest } = nextShots[idx];
          nextShots[idx] = { ...rest, updated_at: new Date().toISOString() };
        }
        return { ...prev, shots: nextShots };
      });
    }
    if (addToast) addToast(`Cleared first frame for Shot ${activeShot.shot_number}`, "info");
  };

  // 6. Action: Select an existing asset as first frame
  const handleSelectExistingAsset = (asset: MediaAsset) => {
    if (!activeShot) return;
    const newFirstFrame: ShotFirstFrame = {
      source: "manual_upload",
      asset_filename: asset.filename,
      locked: false,
      updated_at: new Date().toISOString(),
      notes: `Assigned from library: ${asset.description || asset.filename}`
    };
    handleSetFirstFrame(newFirstFrame);
    setIsAssetPickerOpen(false);
    if (addToast) addToast(`Assigned ${asset.filename} as First Frame`, "success");
  };

  if (!activeShot) {
    return (
      <div className="p-8 text-center bg-zinc-950/40 rounded-xl border border-zinc-800 text-zinc-400">
        <Film className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
        <p className="text-sm font-semibold text-zinc-300">No Target Shot Selected</p>
        <p className="text-xs text-zinc-500 mt-1">Please select a target shot from the header dropdown to manage its starting keyframe.</p>
      </div>
    );
  }

  const assignedFirstFrame = activeShot.first_frame;
  const assignedMediaUrl = assignedFirstFrame?.asset_filename 
    ? getAssetMediaUrl(assignedFirstFrame.asset_filename) 
    : assignedFirstFrame?.preview_url;

  return (
    <div className="p-5 flex flex-col gap-6" id="first-frame-tab-container">
      {/* SHOT CONTEXT BANNER */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 px-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 font-bold text-xs">
            S{String(activeShot.shot_number).padStart(2, "0")}
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Shot {activeShot.shot_number}: {activeShot.shot_name || `Shot ${activeShot.shot_number}`}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono">
                {activeShot.aspect_ratio || "16:9"}
              </span>
            </h2>
            <p className="text-[11px] text-zinc-400 truncate max-w-lg">
              {activeShot.basic_stub || "No basic stub prompt defined for this shot."}
            </p>
          </div>
        </div>

        {/* SHOT QUICK SWITCHER */}
        {shots.length > 1 && onSelectShot && (
          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1">
            <span className="text-[11px] text-zinc-400">Switch Shot:</span>
            <select
              value={activeShot.id}
              onChange={(e) => onSelectShot(e.target.value)}
              className="bg-transparent text-xs font-semibold text-purple-300 outline-none cursor-pointer"
            >
              {shots.map((s, idx) => (
                <option key={s.id} value={s.id} className="bg-zinc-900 text-zinc-200">
                  Shot {s.shot_number || idx + 1} {s.first_frame ? "✓ [Frame 0]" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* MAIN TWO-COLUMN WORKBENCH */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: ACTIVE FIRST FRAME PREVIEW CARD (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
            {/* CARD HEADER */}
            <div className="p-3.5 px-4 border-b border-zinc-800/80 bg-zinc-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clapperboard className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Shot {activeShot.shot_number} Frame 0 (Starting Keyframe)
                </h3>
              </div>
              {assignedFirstFrame && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleToggleLock}
                    title={assignedFirstFrame.locked ? "Click to unlock first frame" : "Click to lock and prevent accidental overwrite"}
                    className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                      assignedFirstFrame.locked
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                        : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200"
                    }`}
                  >
                    {assignedFirstFrame.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    <span>{assignedFirstFrame.locked ? "Locked" : "Unlocked"}</span>
                  </button>
                </div>
              )}
            </div>

            {/* PREVIEW IMAGE DISPLAY */}
            <div className="p-4 flex flex-col items-center justify-center bg-black/40 min-h-[260px] relative">
              {assignedMediaUrl ? (
                <div className="relative w-full group rounded-lg overflow-hidden border border-zinc-800 bg-black aspect-video flex items-center justify-center">
                  <img
                    src={assignedMediaUrl}
                    alt={`First frame for Shot ${activeShot.shot_number}`}
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-3">
                    <a
                      href={assignedMediaUrl}
                      download={assignedFirstFrame?.asset_filename || `Shot_${activeShot.shot_number}_First_Frame.png`}
                      className="p-2 bg-zinc-800/90 hover:bg-zinc-700 text-white rounded-lg border border-zinc-600 transition-colors text-xs flex items-center gap-1 font-semibold"
                      title="Download image"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                    <button
                      type="button"
                      onClick={handleClearFirstFrame}
                      className="p-2 bg-rose-900/80 hover:bg-rose-800 text-white rounded-lg border border-rose-700 transition-colors text-xs flex items-center gap-1 font-semibold cursor-pointer"
                      title="Remove assigned first frame"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center p-6 flex flex-col items-center justify-center text-zinc-500">
                  <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 mb-3">
                    <Clapperboard className="w-6 h-6 opacity-60" />
                  </div>
                  <p className="text-xs font-semibold text-zinc-300">No First Frame Set</p>
                  <p className="text-[11px] text-zinc-500 mt-1 max-w-xs text-center">
                    Chain from the previous shot's good take or upload a starting image to lock character and scene continuity.
                  </p>
                </div>
              )}
            </div>

            {/* METADATA FOOTER */}
            {assignedFirstFrame && (
              <div className="p-3 px-4 bg-zinc-900/40 border-t border-zinc-800 text-[11px] text-zinc-400 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Source:</span>
                  <span className="font-semibold text-purple-300 capitalize flex items-center gap-1">
                    {assignedFirstFrame.source === "last_frame_chain" && <LinkIcon className="w-3 h-3 text-purple-400" />}
                    {assignedFirstFrame.source.replace(/_/g, " ")}
                  </span>
                </div>
                {assignedFirstFrame.source_shot_number && (
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Extracted from:</span>
                    <span className="text-zinc-200 font-mono">
                      Shot {assignedFirstFrame.source_shot_number} (Take {assignedFirstFrame.source_take_number || 1})
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Filename:</span>
                  <span className="text-zinc-300 font-mono text-[10px] truncate max-w-[200px]" title={assignedFirstFrame.asset_filename}>
                    {assignedFirstFrame.asset_filename}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: SOURCES & CONTINUITY CHAINING (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          
          {/* OPTION 1: SHOT CONTINUITY BRIDGE */}
          <div className="bg-zinc-950/80 border border-purple-900/40 rounded-xl overflow-hidden shadow-sm flex flex-col">
            <div className="p-3.5 px-4 border-b border-zinc-800/80 bg-purple-950/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Option 1: Continuity Chaining from Previous Shot
                </h3>
              </div>
              <span className="text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full">
                Phase 1 Active
              </span>
            </div>

            <div className="p-4 flex flex-col gap-4">
              {currentShotIndex === 0 ? (
                <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-lg flex items-start gap-3 text-zinc-400">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-semibold text-zinc-200">Opening Establishing Shot (Shot 1)</p>
                    <p className="text-zinc-400 mt-1 leading-relaxed">
                      This is the first shot in the scene. Because there is no preceding shot to chain from, upload a custom keyframe or use the scene staging canvas to establish the scene's opening look.
                    </p>
                  </div>
                </div>
              ) : previousShot ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">Preceding Shot:</span>
                    <span className="font-bold text-white">
                      Shot {previousShot.shot_number}: {previousShot.shot_name || `Shot ${previousShot.shot_number}`}
                    </span>
                  </div>

                  {previousHeroTake ? (
                    <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3.5 flex flex-col sm:flex-row gap-4 items-center">
                      {/* MINI VIDEO PLAYER / THUMBNAIL */}
                      <div className="w-full sm:w-44 aspect-video bg-black rounded-lg overflow-hidden border border-zinc-700/60 shrink-0 relative flex items-center justify-center">
                        {previousTakeVideoUrl ? (
                          <video
                            src={previousTakeVideoUrl}
                            className="w-full h-full object-contain"
                            controls={false}
                            muted
                            playsInline
                            onMouseEnter={(e) => {
                              const el = e.currentTarget;
                              el.currentTime = Math.max(0, (el.duration || 0) - extractOffsetSeconds);
                            }}
                          />
                        ) : (
                          <Film className="w-6 h-6 text-zinc-600" />
                        )}
                        <span className="absolute bottom-1 right-1 bg-black/80 text-[10px] font-mono font-semibold text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30">
                          Take {previousHeroTake.take_number} {previousHeroTake.is_hero ? "★" : ""}
                        </span>
                      </div>

                      {/* TAKE INFO & ACTION */}
                      <div className="flex-1 flex flex-col gap-2 w-full">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">Take {previousHeroTake.take_number}</span>
                            {previousHeroTake.is_hero && (
                              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-semibold">
                                Hero Take
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">
                            {previousHeroTake.expanded_prompt || previousHeroTake.basic_stub || "Rendered take available"}
                          </p>
                        </div>

                        {/* EXTRACTION BUTTON */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleExtractFromPreviousShot}
                            disabled={isExtracting || assignedFirstFrame?.locked}
                            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer ${
                              assignedFirstFrame?.locked
                                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                                : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white"
                            }`}
                          >
                            <LinkIcon className="w-3.5 h-3.5" />
                            <span>{isExtracting ? "Extracting Final Frame..." : "Extract & Lock as Frame 0"}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-lg flex items-start gap-3 text-zinc-400">
                      <AlertCircle className="w-5 h-5 text-zinc-500 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <p className="font-semibold text-zinc-300">No Rendered Takes for Shot {previousShot.shot_number} Yet</p>
                        <p className="text-zinc-500 mt-1">
                          Once you render a take for Shot {previousShot.shot_number} and review it in the Takes/Renders tab, its final frame will be automatically ready for one-click continuity extraction here.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {/* OPTION 2: MULTIMODAL FIRST FRAME GENERATOR */}
          <MultimodalFrameComposer
            sceneProject={sceneProject}
            activeShot={activeShot}
            activeScene={activeScene}
            allAssets={allAssets}
            assignedFirstFrame={assignedFirstFrame}
            onAcceptFirstFrame={handleSetFirstFrame}
            onAssetUploaded={onAssetUploaded}
            addToast={addToast}
          />

          {/* MANUAL UPLOAD & ASSET SELECTOR */}
          <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
            <div className="p-3.5 px-4 border-b border-zinc-800/80 bg-zinc-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Manual Keyframe / Asset Library
                </h3>
              </div>
            </div>

            <div className="p-4 flex flex-wrap items-center gap-3">
              {/* HIDDEN FILE INPUT */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleManualUpload}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-2 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-400" />
                <span>{isUploading ? "Uploading..." : "Upload Custom Frame Image"}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAssetPickerOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                <span>Pick from Scene Assets</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SCENE FILMSTRIP CONTINUITY OVERVIEW */}
      <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-4 shadow-sm flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Scene Keyframe Continuity Strip
            </h3>
          </div>
          <span className="text-[11px] text-zinc-400">
            {shots.filter(s => !!s.first_frame).length} / {shots.length} shots have Frame 0 assigned
          </span>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto pb-2 pt-1">
          {shots.map((s, idx) => {
            const isCurrent = s.id === activeShot.id;
            const hasFrame = !!s.first_frame;
            const thumbUrl = s.first_frame ? getAssetMediaUrl(s.first_frame.asset_filename) : null;

            return (
              <React.Fragment key={s.id}>
                {idx > 0 && (
                  <div className="flex items-center text-zinc-600 shrink-0">
                    <ArrowRight className="w-3.5 h-3.5 opacity-60" />
                  </div>
                )}
                <div
                  onClick={() => onSelectShot && onSelectShot(s.id)}
                  className={`flex flex-col w-36 shrink-0 rounded-lg overflow-hidden border transition-all cursor-pointer ${
                    isCurrent
                      ? "border-purple-500 ring-2 ring-purple-500/30 bg-purple-950/20"
                      : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"
                  }`}
                >
                  <div className="aspect-video bg-black/60 relative flex items-center justify-center overflow-hidden">
                    {thumbUrl ? (
                      <img src={thumbUrl} alt={`Shot ${s.shot_number}`} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-zinc-600 text-[10px] flex flex-col items-center">
                        <Clapperboard className="w-4 h-4 mb-0.5 opacity-40" />
                        <span>Empty</span>
                      </div>
                    )}
                    <span className="absolute top-1 left-1 bg-black/80 text-[9px] font-mono font-bold text-zinc-200 px-1 rounded">
                      S{String(s.shot_number || idx + 1).padStart(2, "0")}
                    </span>
                    {s.first_frame?.locked && (
                      <span className="absolute top-1 right-1 bg-amber-950/90 text-amber-300 p-0.5 rounded text-[8px] border border-amber-600/40">
                        <Lock className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>
                  <div className="p-2 text-[10px] flex items-center justify-between bg-zinc-950/60">
                    <span className="font-semibold text-zinc-300 truncate">Shot {s.shot_number || idx + 1}</span>
                    <span className={`text-[9px] ${hasFrame ? "text-purple-400" : "text-zinc-600"}`}>
                      {hasFrame ? "Linked" : "No frame"}
                    </span>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ASSET PICKER MODAL */}
      {isAssetPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-purple-400" />
                Select Scene Asset for Shot {activeShot.shot_number} Frame 0
              </h3>
              <button
                type="button"
                onClick={() => setIsAssetPickerOpen(false)}
                className="text-xs text-zinc-400 hover:text-white px-2 py-1 bg-zinc-800 rounded-md cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {allAssets.filter(a => !a.media_type || a.media_type === "image").map(asset => (
                <div
                  key={asset.filename}
                  onClick={() => handleSelectExistingAsset(asset)}
                  className="group relative bg-zinc-900 border border-zinc-800 hover:border-purple-500 rounded-lg overflow-hidden cursor-pointer flex flex-col transition-all"
                >
                  <div className="aspect-video bg-black flex items-center justify-center overflow-hidden">
                    <img
                      src={getAssetMediaUrl(asset.filename, true)}
                      alt={asset.description || asset.filename}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-2 text-[10px]">
                    <p className="font-semibold text-zinc-200 truncate">{asset.subject_name || asset.type}</p>
                    <p className="text-zinc-500 truncate text-[9px]">{asset.filename}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
