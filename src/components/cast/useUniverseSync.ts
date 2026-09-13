import { useState, useEffect } from "react";
import { MediaAsset, CharacterProfile, UniverseCharacterProfile } from "../../types";
import { isLocationEntity } from "../../utils/locationUtils";
import { 
  fetchUniverseCharacters, 
  fetchUniverseAssets,
  saveUniverseCharacter, 
  deleteUniverseCharacter, 
  promoteAssetToUniverse 
} from "../../utils/universeApi";

interface UseUniverseSyncOptions {
  activeSceneName: string;
  assets: MediaAsset[];
  onRegisterSubject: (subject: string) => void;
  onUpdateCharacter: (profile: CharacterProfile) => void;
  onAssetUploaded: (asset: MediaAsset) => void;
  addToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export function useUniverseSync({
  activeSceneName,
  assets,
  onRegisterSubject,
  onUpdateCharacter,
  onAssetUploaded,
  addToast
}: UseUniverseSyncOptions) {
  const [universeCharacters, setUniverseCharacters] = useState<Record<string, UniverseCharacterProfile>>({});
  const [universeAssets, setUniverseAssets] = useState<MediaAsset[]>([]);
  const [isUniverseLoading, setIsUniverseLoading] = useState(false);
  const [pushingToUniverse, setPushingToUniverse] = useState<Record<string, boolean>>({});

  const loadUniverseData = async () => {
    setIsUniverseLoading(true);
    try {
      const [charsData, uAssets] = await Promise.all([
        fetchUniverseCharacters(),
        fetchUniverseAssets()
      ]);
      setUniverseCharacters(charsData || {});
      setUniverseAssets(uAssets || []);
    } catch (e) {
      console.error("Error loading universe data:", e);
    } finally {
      setIsUniverseLoading(false);
    }
  };

  useEffect(() => {
    loadUniverseData();
  }, []);

  const handlePushToUniverse = async (
    subject: string, 
    profile: CharacterProfile, 
    charAssets: MediaAsset[]
  ) => {
    setPushingToUniverse(prev => ({ ...prev, [subject]: true }));
    try {
      // Promote character reference assets into universe media pool
      for (const asset of charAssets) {
        if (asset && asset.filename) {
          await promoteAssetToUniverse(asset.filename);
        }
      }

      const isLoc = isLocationEntity(subject, profile, charAssets);
      const saved = await saveUniverseCharacter({
        ...profile,
        name: subject,
        is_location: isLoc,
        source_scene: activeSceneName,
        default_outfit_ref: profile.scene_outfit_ref || ""
      });

      if (saved) {
        setUniverseCharacters(prev => ({ ...prev, [subject]: saved }));
        onUpdateCharacter?.({ ...profile, in_universe: true });
        addToast(`Added "${subject}" to Universe Roster!`, "success");
        // Refresh universe media pool
        fetchUniverseAssets().then(uAssets => setUniverseAssets(uAssets || [])).catch(() => {});
      } else {
        addToast(`Failed to add "${subject}" to Universe`, "error");
      }
    } catch (err: any) {
      console.error("Error pushing to universe:", err);
      addToast(`Error adding to Universe: ${err.message}`, "error");
    } finally {
      setPushingToUniverse(prev => ({ ...prev, [subject]: false }));
    }
  };

  const handleImportUniverseCharToScene = (char: UniverseCharacterProfile) => {
    const subject = char.name;
    onRegisterSubject(subject);

    onUpdateCharacter({
      id: char.id || `char_${Date.now()}`,
      name: subject,
      notes: char.notes || "",
      quick_slots: char.quick_slots || ["", "", "", ""],
      scene_outfit_ref: char.default_outfit_ref || char.scene_outfit_ref || "",
      is_location: char.is_location,
      in_universe: true
    });

    // Import universe reference assets for this character into active scene assets
    const charUniverseAssets = universeAssets.filter(
      a => (a.subject_name || "").trim().toLowerCase() === subject.trim().toLowerCase()
    );
    charUniverseAssets.forEach(uAsset => {
      if (!assets.some(a => a.filename === uAsset.filename)) {
        onAssetUploaded({
          ...uAsset,
          is_universe: true
        });
      }
    });

    addToast(`Imported "${subject}" from Universe into active scene!`, "success");
  };

  const handleCreateUniverseCharacter = async (profile: Partial<UniverseCharacterProfile> & { name: string }) => {
    const saved = await saveUniverseCharacter(profile);
    if (saved) {
      setUniverseCharacters(prev => ({ ...prev, [saved.name]: saved }));
      addToast(`Created global universe entity "${saved.name}"`, "success");
    } else {
      addToast(`Failed to create universe character`, "error");
    }
  };

  const handleUpdateUniverseChar = async (updated: UniverseCharacterProfile) => {
    try {
      const res = await saveUniverseCharacter(updated);
      if (res) {
        setUniverseCharacters(prev => ({ ...prev, [updated.name]: res }));
        addToast(`Updated universe profile for "${updated.name}"`, "success");
      }
    } catch (err: any) {
      addToast(`Error updating universe character: ${err.message}`, "error");
    }
  };

  const handleDeleteUniverseChar = async (name: string) => {
    try {
      const ok = await deleteUniverseCharacter(name);
      if (ok) {
        setUniverseCharacters(prev => {
          const copy = { ...prev };
          delete copy[name];
          return copy;
        });
        addToast(`Deleted "${name}" from Universe roster`, "success");
      } else {
        addToast(`Failed to delete "${name}" from Universe`, "error");
      }
    } catch (err: any) {
      addToast(`Error deleting universe character: ${err.message}`, "error");
    }
  };

  return {
    universeCharacters,
    universeAssets,
    isUniverseLoading,
    pushingToUniverse,
    loadUniverseData,
    handlePushToUniverse,
    handleImportUniverseCharToScene,
    handleCreateUniverseCharacter,
    handleUpdateUniverseChar,
    handleDeleteUniverseChar
  };
}
