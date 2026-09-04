import React, { useCallback } from 'react';
import { MediaAsset, SceneProjectFile, ParsedWorkflow } from '../../types';

interface UseAssetManagementParams {
  setSceneProject: React.Dispatch<React.SetStateAction<SceneProjectFile>>;
  setIsDirty: (isDirty: boolean) => void;
  parsedWorkflow: ParsedWorkflow | null;
  nodeMappings: Record<string, string>;
  setNodeMappings: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export function useAssetManagement({
  setSceneProject,
  setIsDirty,
  parsedWorkflow,
  nodeMappings,
  setNodeMappings
}: UseAssetManagementParams) {

  const handleAssetUploaded = useCallback((
    newAsset: MediaAsset,
    targetSlotIndex?: number,
    mediaType?: "image" | "audio" | "video"
  ) => {
    const slotIdx = targetSlotIndex !== undefined ? targetSlotIndex : (newAsset.slot_index ?? 0);
    const mType = mediaType || newAsset.media_type || "image";
    const assetWithSlot: MediaAsset = {
      ...newAsset,
      slot_index: slotIdx,
      media_type: mType
    };

    setSceneProject(prevProject => {
      const prevAssets = prevProject.assets || [];
      const exactMatch = prevAssets.findIndex(a => a.filename === newAsset.filename);
      let nextAssets = [...prevAssets];
      if (exactMatch !== -1) {
        nextAssets[exactMatch] = assetWithSlot;
      } else {
        nextAssets.push(assetWithSlot);
      }
      return { ...prevProject, assets: nextAssets };
    });
    setIsDirty(true);

    // Auto-map if there's a loader node for this slot type and index
    if (parsedWorkflow) {
      const loaderNodes = mType === "image" 
        ? parsedWorkflow.nodes_info.image_loader_nodes 
        : mType === "video" 
        ? parsedWorkflow.nodes_info.video_loader_nodes 
        : parsedWorkflow.nodes_info.audio_loader_nodes;

      if (loaderNodes && loaderNodes[slotIdx]) {
        const targetNodeId = loaderNodes[slotIdx].id;
        setNodeMappings(prev => ({ ...prev, [targetNodeId]: newAsset.filename }));
      } else {
        const emptySlot = loaderNodes?.find((n: any) => !nodeMappings[n.id]);
        if (emptySlot) {
          setNodeMappings(prev => ({ ...prev, [emptySlot.id]: newAsset.filename }));
        }
      }
    }
  }, [setSceneProject, setIsDirty, parsedWorkflow, nodeMappings, setNodeMappings]);

  const handleAssetUpdated = useCallback((oldFilename: string, newAsset: MediaAsset) => {
    setSceneProject(prev => {
      const prevAssets = prev.assets || [];
      return {
        ...prev,
        assets: prevAssets.map(a => a.filename === oldFilename ? { ...newAsset, slot_index: a.slot_index ?? newAsset.slot_index } : a)
      };
    });
    setIsDirty(true);
    // Update nodeMappings if the filename changed
    if (oldFilename !== newAsset.filename) {
      setNodeMappings(prev => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (next[key] === oldFilename) next[key] = newAsset.filename;
        }
        return next;
      });
    }
  }, [setSceneProject, setIsDirty, setNodeMappings]);

  const handleAssetDeleted = useCallback((filename: string) => {
    setSceneProject(prev => {
      const prevAssets = prev.assets || [];
      const nextShots = (prev.shots || []).map(shot => {
        const nextSlots = { ...(shot.assigned_slots || {}) };
        for (const key of Object.keys(nextSlots)) {
          if (nextSlots[key] === filename) {
            delete nextSlots[key];
          }
        }
        return { ...shot, assigned_slots: nextSlots };
      });
      return {
        ...prev,
        assets: prevAssets.filter(a => a.filename !== filename),
        shots: nextShots
      };
    });
    setIsDirty(true);
    // Clear mappings referencing this deleted asset
    setNodeMappings(prev => {
      const updated = { ...prev };
      for (const [nodeId, file] of Object.entries(updated)) {
        if (file === filename) updated[nodeId] = "";
      }
      return updated;
    });
  }, [setSceneProject, setIsDirty, setNodeMappings]);

  return {
    handleAssetUploaded,
    handleAssetUpdated,
    handleAssetDeleted
  };
}
