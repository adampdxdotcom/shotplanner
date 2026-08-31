import React, { useState } from 'react';
import { SceneProjectFile, ShotItem } from '../types';
import { Film, VideoIcon, ArrowRightLeft, Star, Eye } from 'lucide-react';
import { TakeSelector } from './TakeSelector';
import { TakeReviewModal } from './TakeReviewModal';
import { TakeComparisonModal } from './TakeComparisonModal';

export const RendersView: React.FC<{ sceneProject: SceneProjectFile | null, sceneName: string, onUpdateProject: React.Dispatch<React.SetStateAction<SceneProjectFile>> }> = ({ sceneProject, sceneName, onUpdateProject }) => {
  const [reviewTake, setReviewTake] = useState<{shotId: string, takeNumber: number} | null>(null);
  const [comparingShotId, setComparingShotId] = useState<string | null>(null);

  if (!sceneProject || !sceneProject.shots || sceneProject.shots.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <Film className="w-5 h-5 text-indigo-400" />
          <h2 className="text-xl font-bold text-zinc-100">Renders / Dailies</h2>
        </div>
        <div className="bg-zinc-900/60 border-2 border-dashed border-zinc-700 rounded-xl p-12 flex flex-col items-center justify-center text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center">
            <VideoIcon className="w-8 h-8 text-zinc-500" />
          </div>
          <h3 className="text-xl font-bold text-zinc-300">No Renders Found</h3>
          <p className="text-zinc-500 max-w-md leading-relaxed">
            You haven't generated any dailies for this scene yet. Stage and execute a shot from the <strong className="text-indigo-400">Execute / Send</strong> tab to see your renders appear here.
          </p>
        </div>
      </div>
    );
  }

  // Filter shots that have takes
  const shotsWithTakes = sceneProject.shots.filter(s => s.takes && s.takes.length > 0);

  if (shotsWithTakes.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <Film className="w-5 h-5 text-indigo-400" />
          <h2 className="text-xl font-bold text-zinc-100">Renders / Dailies</h2>
        </div>
        <div className="bg-zinc-900/60 border-2 border-dashed border-zinc-700 rounded-xl p-12 flex flex-col items-center justify-center text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center">
            <VideoIcon className="w-8 h-8 text-zinc-500" />
          </div>
          <h3 className="text-xl font-bold text-zinc-300">No Renders Found</h3>
          <p className="text-zinc-500 max-w-md leading-relaxed">
            No outputs have been generated for the shots in this scene yet. Stage and execute a shot from the <strong className="text-indigo-400">Execute / Send</strong> tab to see your renders appear here.
          </p>
        </div>
      </div>
    );
  }

  const comparingShot = comparingShotId ? sceneProject.shots.find(s => s.id === comparingShotId) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Film className="w-5 h-5 text-indigo-400" />
          <h2 className="text-xl font-bold text-zinc-100">Renders / Dailies</h2>
          <span className="text-xs bg-indigo-950 text-indigo-300 border border-indigo-800/60 px-2 py-0.5 rounded-full font-semibold">
            {shotsWithTakes.length} {shotsWithTakes.length === 1 ? "Shot" : "Shots"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {shotsWithTakes.map(shot => (
           <ShotRenderCard 
             key={shot.id} 
             shot={shot} 
             sceneName={sceneName} 
             onReviewTake={(takeId) => {
               const foundTake = (shot.takes || []).find(t => t.id === takeId || String(t.take_number) === String(takeId));
               if (foundTake) {
                 setReviewTake({ shotId: shot.id, takeNumber: foundTake.take_number });
               }
             }} 
             onSetHeroTake={(tid) => onUpdateProject(prev => {
               const shots = [...prev.shots];
               const idx = shots.findIndex(s => s.id === shot.id);
               if (idx !== -1) {
                 const updatedTakes = (shots[idx].takes || []).map(t => ({
                   ...t,
                   is_hero: t.id === tid || String(t.take_number) === String(tid)
                 }));
                 shots[idx] = { ...shots[idx], hero_take_id: tid, takes: updatedTakes };
               }
               return { ...prev, shots };
             })}
             onCompareTakes={() => setComparingShotId(shot.id)}
           />
        ))}
      </div>

      {reviewTake && (
         <TakeReviewModal
           take={sceneProject.shots.find(s => s.id === reviewTake.shotId)!.takes!.find(t => t.take_number === reviewTake.takeNumber)!}
           sceneName={sceneName}
           shotNumber={sceneProject.shots.find(s => s.id === reviewTake.shotId)!.shot_number}
           onClose={() => setReviewTake(null)}
           onSetHero={() => {
             onUpdateProject(prev => {
               const shots = [...prev.shots];
               const idx = shots.findIndex(s => s.id === reviewTake.shotId);
               if (idx !== -1) {
                 const targetTake = (shots[idx].takes || []).find(t => t.take_number === reviewTake.takeNumber);
                 const heroId = targetTake ? targetTake.id : String(reviewTake.takeNumber);
                 const updatedTakes = (shots[idx].takes || []).map(t => ({
                   ...t,
                   is_hero: t.take_number === reviewTake.takeNumber
                 }));
                 shots[idx] = { ...shots[idx], hero_take_id: heroId, takes: updatedTakes };
               }
               return { ...prev, shots };
             });
             setReviewTake(null);
           }}
         />
      )}

      {comparingShot && (
        <TakeComparisonModal
          shot={comparingShot}
          sceneName={sceneName}
          onClose={() => setComparingShotId(null)}
          onSetHeroTake={(tid) => {
            onUpdateProject(prev => {
              const shots = [...prev.shots];
              const idx = shots.findIndex(s => s.id === comparingShot.id);
              if (idx !== -1) {
                const updatedTakes = (shots[idx].takes || []).map(t => ({
                  ...t,
                  is_hero: t.id === tid || String(t.take_number) === String(tid)
                }));
                shots[idx] = { ...shots[idx], hero_take_id: tid, takes: updatedTakes };
              }
              return { ...prev, shots };
            });
          }}
        />
      )}
    </div>
  );
};

const ShotRenderCard: React.FC<{
  shot: ShotItem;
  sceneName: string;
  onReviewTake: (takeId: string) => void;
  onSetHeroTake: (tid: string) => void;
  onCompareTakes?: () => void;
}> = ({ shot, sceneName, onReviewTake, onSetHeroTake, onCompareTakes }) => {
  const takes = shot.takes || [];
  const [selectedTakeId, setSelectedTakeId] = useState<string>(
    shot.active_take_id || shot.hero_take_id || (takes.length > 0 ? takes[takes.length - 1].id : "")
  );

  const activeTake = takes.find(t => t.id === selectedTakeId) 
    || takes.find(t => t.id === shot.hero_take_id) 
    || takes[takes.length - 1];
  
  if (!activeTake) return null;

  const paddedShot = String(shot.shot_number).padStart(2, "0");
  const filename = activeTake.video_filename || `${sceneName}_Shot_${paddedShot}_Take_${activeTake.take_number}.mp4`;
  const streamUrl = `/api/outputs/stream/${encodeURIComponent(filename)}?scene_name=${encodeURIComponent(sceneName)}`;
  const isHero = activeTake.id === shot.hero_take_id || Boolean(activeTake.is_hero);

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden shadow-sm flex flex-col hover:border-zinc-700/80 transition-colors">
      <div className="aspect-video bg-black relative flex-shrink-0 group">
        <video 
          key={streamUrl}
          controls 
          className="w-full h-full object-contain"
          preload="metadata"
          src={streamUrl}
        />
        <div className="absolute top-2 left-2 flex items-center gap-2 pointer-events-none">
          <span className="bg-black/70 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm border border-zinc-700/60 font-mono">
            Take {activeTake.take_number}
          </span>
          {activeTake.generation_params?.steps && (
            <span className="bg-black/70 backdrop-blur-md text-zinc-300 text-[10px] font-bold px-2 py-1 rounded shadow-sm border border-zinc-700/60 font-mono">
              {activeTake.generation_params.steps} Steps
            </span>
          )}
          {isHero && (
            <span className="bg-amber-500/25 backdrop-blur-md text-amber-300 text-[10px] font-bold px-2 py-1 rounded shadow-sm border border-amber-500/50 flex items-center gap-1">
              <Star className="w-3 h-3 fill-amber-400" />
              Hero Take
            </span>
          )}
        </div>
      </div>
      
      {/* Take Selector Pill Bar */}
      <div className="p-3.5 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <TakeSelector 
            shot={shot} 
            activeTakeId={activeTake.id}
            onSelectTake={(tid) => setSelectedTakeId(tid)}
            onReviewTake={onReviewTake} 
            onSetHeroTake={onSetHeroTake}
            onCompareTakes={onCompareTakes}
          />
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-indigo-500/20 text-indigo-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                  Shot {paddedShot}
                </span>
                <span className="text-xs font-mono text-zinc-500 truncate max-w-[220px]" title={filename}>
                  {filename}
                </span>
              </div>
              <h4 className="text-sm font-bold text-zinc-200">
                {shot.shot_type || "Rendered Daily"}
              </h4>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              {takes.length >= 2 && onCompareTakes && (
                <button
                  type="button"
                  onClick={onCompareTakes}
                  className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-zinc-700 transition-colors"
                  title="Compare Prompt and Parameters"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Compare</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onReviewTake(activeTake.id)}
                className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-zinc-700 transition-colors"
                title="Review snapshot and QA review status"
              >
                <Eye className="w-3.5 h-3.5 text-zinc-400" />
                <span>Details</span>
              </button>
              {!isHero && (
                <button
                  type="button"
                  onClick={() => onSetHeroTake(activeTake.id)}
                  className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-amber-500/30 transition-colors"
                  title="Designate this take as the definitive Hero version"
                >
                  <Star className="w-3.5 h-3.5" />
                  <span>Set Hero</span>
                </button>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/60">
            {shot.camera_movement && (
              <div className="flex flex-col">
                <span className="text-zinc-500 font-semibold uppercase tracking-wider text-[9px]">Camera Motion</span>
                <span className="text-zinc-300">{shot.camera_movement}</span>
              </div>
            )}
            {shot.basic_stub && (
              <div className="flex flex-col">
                <span className="text-zinc-500 font-semibold uppercase tracking-wider text-[9px]">Scene Stub</span>
                <span className="text-zinc-300 truncate" title={shot.basic_stub}>{shot.basic_stub}</span>
              </div>
            )}
            {activeTake.expanded_prompt && (
              <div className="col-span-2 flex flex-col pt-1 border-t border-zinc-800/40">
                <span className="text-zinc-500 font-semibold uppercase tracking-wider text-[9px]">Take {activeTake.take_number} Prompt Snapshot</span>
                <span className="text-zinc-400 font-mono text-[11px] truncate" title={activeTake.expanded_prompt}>
                  {activeTake.expanded_prompt}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

